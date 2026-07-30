'use strict';

/**
 * Generates the data dictionary annex from the live schema catalogue produced by
 * 04-db-vs-code.js. Transcribing 47 objects by hand would guarantee drift between
 * the document and the database; generating it guarantees the opposite.
 */

const fs   = require('fs');
const path = require('path');
const { ROOT, readText, exists } = require('./lib/util');

const CATALOG = path.join(ROOT, 'docs', 'auditoria', 'anexos', 'db-catalog.json');
const OUT     = path.join(ROOT, 'docs', 'entrega', 'anexos', 'diccionario-datos.md');

// Domain grouping: the schema is flat, but a reader needs it grouped by purpose.
const DOMAINS = [
  ['Operación comercial', ['proyecto', 'lote', 'venta', 'venta_comprador', 'venta_comisionista', 'empresa_aliada']],
  ['Ciclo financiero', ['cuota', 'cuota_fraccion', 'factura', 'cuota_factura', 'solicitud_factura', 'pago', 'cuota_pago', 'recibo', 'recibo_pago', 'bank_transaction', 'pago_comision', 'gasto']],
  ['Requerimientos e inventario', ['requerimiento', 'requerimiento_item', 'recepcion', 'recepcion_item', 'inventario_movimiento']],
  ['Identidad y autorización', ['usuarios', 'roles', 'permisos', 'rol_permiso', 'login_2fa']],
  ['Gobierno y operación del sistema', ['auditoria', 'notificacion', 'config_sistema', 'consecutivos', 'observacion_juridica', 'respaldo', 'respaldo_restauracion']],
];

function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    // PostgREST embeds relationship metadata as pseudo-tags; the key information
    // is already rendered in the "Clave" column.
    .replace(/<[^>]+\/?>/g, '')
    .replace(/Note:\s*/gi, '')
    .replace(/This is a Primary Key\.?/i, '')
    .replace(/This is a Foreign Key to `([^`]+)`\.?/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function columnRow(col) {
  const marks = [];
  if (col.pk) marks.push('PK');
  if (col.fk) marks.push(`FK → \`${col.fk.table}.${col.fk.column}\``);
  const notes = [cleanDescription(col.description)].filter(Boolean).join(' ');
  return `| \`${col.name}\` | ${col.type} | ${col.required ? 'Sí' : 'No'} | ${marks.join(', ') || '—' } | ${notes || '—'} |`;
}

function main() {
  if (!exists(CATALOG)) {
    console.error('Falta db-catalog.json: ejecutar primero `node tools/audit/04-db-vs-code.js`.');
    process.exit(1);
  }

  const cat    = JSON.parse(readText(CATALOG));
  const names  = Object.keys(cat.tables);
  const views  = names.filter(n => /^(vw_|v_)/.test(n)).sort();
  const tables = names.filter(n => !/^(vw_|v_)/.test(n)).sort();

  const md = [];
  md.push('# Anexo · Diccionario de datos', '');
  md.push(`_Generado automáticamente por \`tools/audit/gen-data-dictionary.js\` a partir del esquema \`${cat.schema}\` vigente el ${cat.generated_at.slice(0, 10)}._`, '');
  md.push('Este anexo se genera del esquema real y no se edita a mano: cualquier');
  md.push('divergencia entre el documento y la base de datos se corrige regenerándolo.', '');
  md.push(`El esquema expone **${tables.length} tablas** y **${views.length} vistas**. Las columnas marcadas`);
  md.push('como obligatorias no admiten valor nulo.', '');

  // ── Tables grouped by domain ────────────────────────────────────────────────
  const placed = new Set();
  for (const [domain, members] of DOMAINS) {
    const present = members.filter(m => tables.includes(m));
    if (!present.length) continue;
    md.push(`## ${domain}`, '');
    for (const t of present) {
      placed.add(t);
      md.push(...tableSection(t, cat.tables[t]));
    }
  }

  const rest = tables.filter(t => !placed.has(t));
  if (rest.length) {
    md.push('## Otras tablas', '');
    for (const t of rest) md.push(...tableSection(t, cat.tables[t]));
  }

  // ── Views ───────────────────────────────────────────────────────────────────
  md.push('## Vistas', '');
  md.push('Las vistas no almacenan datos: derivan su contenido de las tablas en cada');
  md.push('consulta. Por eso no declaran clave primaria ni restricciones.', '');
  for (const v of views) md.push(...tableSection(v, cat.tables[v], true));

  // ── Stored functions ────────────────────────────────────────────────────────
  md.push('## Funciones almacenadas', '');
  md.push('| Función | Esquema | Invocación desde el código |', '|---|---|---|');
  for (const r of cat.rpcs || []) {
    md.push(`| \`${r}()\` | \`${cat.schema}\` | Con \`.schema('${cat.schema}')\` explícito |`);
  }
  for (const r of cat.public_rpcs || []) {
    md.push(`| \`${r}()\` | \`public\` | **Sin** \`.schema()\`: única excepción del proyecto |`);
  }
  md.push('');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md.join('\n'), 'utf8');

  console.log(`Diccionario generado: ${path.relative(ROOT, OUT)}`);
  console.log(`  ${tables.length} tablas · ${views.length} vistas · ${(cat.rpcs || []).length + (cat.public_rpcs || []).length} funciones`);
}

function tableSection(name, def, isView = false) {
  const out = [];
  const pk  = def.columns.filter(c => c.pk).map(c => c.name);
  out.push(`### \`${name}\``, '');
  if (!isView) {
    out.push(pk.length
      ? `Clave primaria: ${pk.map(c => `\`${c}\``).join(' + ')}.`
      : '**Sin clave primaria declarada.**');
    out.push('');
  }
  out.push('| Columna | Tipo | Obligatoria | Clave | Notas |', '|---|---|---|---|---|');
  for (const c of def.columns) out.push(columnRow(c));
  out.push('');
  return out;
}

if (require.main === module) main();
module.exports = main;
