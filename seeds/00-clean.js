'use strict';
// Limpia todas las tablas de negocio en orden inverso de dependencias.
// NO toca: roles, permisos, rol_permiso (configuración del sistema).
const { supabase, SCHEMA } = require('./lib/batch');

// [tabla, columna_filtro] — cualquier columna numérica/texto que exista siempre
const TABLES = [
  ['auditoria',            'id_registro',    'gte', 0],
  ['observacion_juridica', 'id_venta',       'gte', 0],
  ['bank_transaction',     'id_transaction', 'gte', 0],
  ['cuota_factura',        'id_cuota',       'gte', 0],
  ['comprador_recibo',     'id_recibo',      'gte', 0],
  ['recibo_pago',          'id_recibo',      'gte', 0],
  ['recibo',               'id_recibo',      'gte', 0],
  ['factura',              'id_factura',     'gte', 0],
  ['cuota_pago',           'id_pago',        'gte', 0],
  ['pago',                 'id_pago',        'gte', 0],
  ['cuota',                'id_cuota',       'gte', 0],
  ['venta_comisionista',   'id_venta',       'gte', 0],
  ['venta_comprador',      'id_venta',       'gte', 0],
  ['venta',                'id_venta',       'gte', 0],
  ['lote',                 'id_lote',        'gte', 0],
  ['proyecto',             'id_proyecto',    'gte', 0],
  ['usuarios',             'id_usuario',     'gte', 0],
  ['comisionista',         'id_comisionista','gte', 0],
  ['comprador',            'id_comprador',   'gte', 0],
];

async function run(_ctx = {}) {
  console.log('→ Limpiando tablas existentes...');
  let ok = 0, warn = 0;

  for (const [table, col, op, val] of TABLES) {
    let q = supabase.schema(SCHEMA).from(table).delete();
    if (op === 'gte') q = q.gte(col, val);

    const { error } = await q;

    if (error) {
      console.warn(`  ⚠  ${table}: ${error.message}`);
      warn++;
    } else {
      console.log(`  ✓ ${table}`);
      ok++;
    }
  }

  console.log(`  → ${ok} tablas limpiadas${warn ? `, ${warn} advertencias` : ''}`);
  return {};
}

module.exports = { run };
