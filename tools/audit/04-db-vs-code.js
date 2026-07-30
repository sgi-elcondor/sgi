'use strict';

/**
 * Cross-check: what the backend asks the database for, against what the
 * database actually exposes. STRICTLY READ-ONLY.
 *
 * Two sources of truth are combined:
 *  1. Static scan of every `.schema()/.from()/.select()/.rpc()` in src/.
 *  2. The live PostgREST OpenAPI document for the `condor` schema, which lists
 *     every table/view with its columns and types (also the raw material for
 *     the data dictionary of the Documento de Datos).
 *
 * Catches the classic "la vista sale vacía" family: a column, table or view the
 * code selects that the database does not have.
 */

require('dotenv').config();

const path = require('path');
const { ROOT, rel, readText, walk, makeReporter, writeReport, OUT_DIR } = require('./lib/util');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const SCHEMA       = 'condor';

// ── 1. Static extraction ──────────────────────────────────────────────────────

/**
 * Finds `.from('table')` and the `.select('...')` chained to it. Chains are
 * frequently split across lines, so a window of source after `.from(` is used.
 */
function scanQueries() {
  const queries = [];
  const rpcs    = [];
  const files   = walk(path.join(ROOT, 'src'), ['.js']);

  for (const abs of files) {
    const src   = readText(abs);
    const lines = src.split('\n');

    lines.forEach((line, i) => {
      const fromRe = /\.from\(\s*["'`]([\w.]+)["'`]\s*\)/g;
      let m;
      while ((m = fromRe.exec(line))) {
        const table  = m[1];
        // `supabase.storage.from('bucket')` addresses object storage, not a table.
        // The `.storage` frequently sits on a previous line of the same chain.
        const chainStart = lines.slice(Math.max(0, i - 3), i).join('\n') + '\n' + line.slice(0, m.index);
        if (/\.storage\b/.test(chainStart.slice(chainStart.lastIndexOf(';') + 1))) continue;
        // Look ahead for the .select() of THIS chain only. The window must stop at
        // the end of the statement, otherwise a later `.from('x').select('y')`
        // gets attributed to this table and produces phantom missing columns.
        const window    = lines.slice(i, i + 12).join('\n');
        const afterFrom = window.slice(window.indexOf(m[0]) + m[0].length);
        const stmtEnd   = afterFrom.indexOf(';');
        const stmt      = stmtEnd === -1 ? afterFrom : afterFrom.slice(0, stmtEnd);
        const sel = stmt.match(/\.select\(\s*(["'`])([\s\S]*?)\1/);
        queries.push({
          table,
          select: sel ? sel[2].replace(/\s+/g, '') : null,
          file: rel(abs),
          line: i + 1,
        });
      }

      const rpcRe = /\.rpc\(\s*["'`]([\w]+)["'`]/g;
      while ((m = rpcRe.exec(line))) {
        // Without an explicit `.schema()`, PostgREST resolves the function in `public`.
        const scoped = /\.schema\(/.test(line.slice(0, m.index));
        rpcs.push({ name: m[1], scoped, file: rel(abs), line: i + 1 });
      }
    });
  }

  return { queries, rpcs };
}

/**
 * Splits a PostgREST select string into top-level items, respecting the
 * parentheses of embedded resources.
 */
function splitSelect(sel) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const c of sel) {
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out.filter(Boolean);
}

/** Parses one select item into { column, alias, embed, embedSelect }. */
function parseItem(item) {
  const embedMatch = item.match(/^([\w:!]+)\(([\s\S]*)\)$/);
  if (embedMatch) {
    let head = embedMatch[1];
    let alias = null;
    if (head.includes(':')) { const [a, b] = head.split(':'); alias = a; head = b; }
    const [relation] = head.split('!');
    return { embed: relation, alias, embedSelect: embedMatch[2] };
  }
  let col = item;
  let alias = null;
  if (col.includes(':')) { const [a, b] = col.split(':'); alias = a; col = b; }
  col = col.replace(/\.(sum|avg|count|max|min)\(\)$/, '');
  col = col.replace(/::[\w]+$/, '');
  return { column: col, alias };
}

// ── 2. Live catalog from the PostgREST OpenAPI document ──────────────────────

async function fetchSpec(schema) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Accept-Profile': schema,
      Accept: 'application/openapi+json',
    },
  });
  if (!res.ok) throw new Error(`OpenAPI ${schema}: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * `condor` is the application schema, but RPCs invoked without `.schema()`
 * resolve in `public`, so both specs are needed to tell a missing function
 * apart from one that simply lives in the default schema.
 */
async function fetchCatalog() {
  const spec       = await fetchSpec(SCHEMA);
  const publicSpec = await fetchSpec('public').catch(() => ({ paths: {} }));

  const catalog = {};
  for (const [name, def] of Object.entries(spec.definitions || {})) {
    catalog[name] = {
      columns: Object.entries(def.properties || {}).map(([col, p]) => {
        const desc = p.description || '';
        // PostgREST documents relationships inline: <fk table='x' column='y'/>
        const fk = desc.match(/<fk table='([^']+)' column='([^']+)'\/>/);
        return {
          name: col,
          type: p.format || p.type || 'unknown',
          description: desc,
          required: (def.required || []).includes(col),
          pk: /Note:\s*This is a Primary Key/i.test(desc),
          fk: fk ? { table: fk[1], column: fk[2] } : null,
        };
      }),
      required: def.required || [],
    };
  }

  const rpcsOf = s => Object.keys(s.paths || {}).filter(p => p.startsWith('/rpc/')).map(p => p.replace('/rpc/', ''));

  return {
    catalog,
    rpcs: rpcsOf(spec),
    publicRpcs: rpcsOf(publicSpec),
    tableCount: Object.keys(catalog).length,
  };
}

// ── 3. Report ────────────────────────────────────────────────────────────────

async function main() {
  const rep = makeReporter('DB', 'Anexo D · Consultas del backend vs. esquema real de la base de datos');

  if (!SUPABASE_URL || !SERVICE_KEY) {
    rep.add({
      severity: 'P0',
      category: 'cobertura-auditoria',
      summary: 'Sin credenciales de Supabase: el cruce código↔BD no se ejecutó',
      where: '.env',
      detail: 'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY en el entorno.',
      action: 'Exportar las variables y re-ejecutar.',
    });
    return writeReport('04-db-vs-code', rep);
  }

  const { queries, rpcs } = scanQueries();
  const { catalog, rpcs: dbRpcs, publicRpcs, tableCount } = await fetchCatalog();

  const known = new Set(Object.keys(catalog));
  const usedTables = new Set();
  const usedColumns = new Map(); // table -> Set(cols)

  const noteUse = (table, col) => {
    if (!usedColumns.has(table)) usedColumns.set(table, new Set());
    if (col) usedColumns.get(table).add(col);
  };

  const reported = new Set();
  const once = key => {
    if (reported.has(key)) return false;
    reported.add(key);
    return true;
  };

  // ── Tables / views referenced by the code ──────────────────────────────────
  for (const q of queries) {
    usedTables.add(q.table);

    if (!known.has(q.table)) {
      if (once(`table:${q.table}`)) {
        rep.add({
          severity: 'P0',
          category: 'bd-inexistente',
          summary: `El código consulta una tabla/vista que no existe en condor: ${q.table}`,
          where: `${q.file}:${q.line}`,
          detail: `No aparece en el esquema \`${SCHEMA}\` expuesto por PostgREST. Toda petición que pase por aquí falla en runtime (404/PGRST205) y la vista queda vacía.`,
          action: 'Crear el objeto en BD, corregir el nombre, o eliminar el código que lo consulta.',
        });
      }
      continue;
    }

    if (!q.select) continue;

    // Validate each selected column against the catalog, recursing into embeds.
    const validate = (table, selectStr, trail) => {
      if (!known.has(table)) return;
      const cols = new Set(catalog[table].columns.map(c => c.name));
      for (const item of splitSelect(selectStr)) {
        const p = parseItem(item);

        if (p.embed) {
          noteUse(table, null);
          // An embed target can be: the related table itself, a FK column of this
          // table (`permisos:id_permiso(...)`), or an aliased relationship.
          const fkCol = catalog[table].columns.find(c => c.name === p.embed && c.fk);
          if (fkCol) noteUse(table, p.embed);
          const target = known.has(p.embed)
            ? p.embed
            : fkCol ? fkCol.table || fkCol.fk.table
            : p.alias && known.has(p.alias) ? p.alias
            : null;

          if (target) validate(target, p.embedSelect, `${trail}.${p.embed}`);
          else if (once(`embed:${table}:${p.embed}`)) {
            rep.add({
              severity: 'INFO',
              category: 'cobertura-auditoria',
              summary: `Embed no resoluble estáticamente: ${trail} → ${p.embed}`,
              where: `${q.file}:${q.line}`,
              detail: `\`${p.embed}\` no es una tabla del esquema; probablemente es el nombre de una FK o una relación con alias. No se validaron sus columnas.`,
              action: 'Verificación manual.',
            });
          }
          continue;
        }

        const col = p.column;
        if (!col || col === '*' || col.startsWith('count')) { noteUse(table, null); continue; }
        noteUse(table, col);

        if (!cols.has(col) && once(`col:${table}:${col}`)) {
          rep.add({
            severity: 'P0',
            category: 'bd-columna-inexistente',
            summary: `Columna seleccionada que la BD no tiene: ${table}.${col}`,
            where: `${q.file}:${q.line}`,
            detail: `El select pide \`${col}\` sobre \`${trail}\`, pero \`${table}\` sólo expone: ${[...cols].sort().join(', ')}. PostgREST responde 400 (PGRST204/42703) y el endpoint devuelve error o datos vacíos.`,
            action: 'Corregir el nombre de la columna, o añadirla en BD si el campo debía existir.',
          });
        }
      }
    };

    validate(q.table, q.select, q.table);
  }

  // ── RPCs ──────────────────────────────────────────────────────────────────
  const dbRpcSet     = new Set(dbRpcs);
  const publicRpcSet = new Set(publicRpcs);
  for (const r of rpcs) {
    const inCondor = dbRpcSet.has(r.name);
    const inPublic = publicRpcSet.has(r.name);

    if (!inCondor && !inPublic) {
      if (!once(`rpc:${r.name}`)) continue;
      rep.add({
        severity: 'P0',
        category: 'bd-inexistente',
        summary: `El código invoca un RPC que no existe en la BD: ${r.name}()`,
        where: `${r.file}:${r.line}`,
        detail: `PostgREST no expone \`/rpc/${r.name}\` ni en \`${SCHEMA}\` ni en \`public\`. La llamada falla en runtime.`,
        action: 'Crear la función en BD o corregir el nombre.',
      });
      continue;
    }

    // Schema/scope mismatch: resolvable, but contrary to the project rule of
    // always addressing `condor` explicitly.
    if (r.scoped && !inCondor && inPublic && once(`rpc-scope-condor:${r.name}`)) {
      rep.add({
        severity: 'P0',
        category: 'bd-esquema-incorrecto',
        summary: `RPC invocado con .schema('${SCHEMA}') pero definido en public: ${r.name}()`,
        where: `${r.file}:${r.line}`,
        detail: `La llamada resuelve contra \`${SCHEMA}.${r.name}\`, que no existe. Falla en runtime.`,
        action: `Quitar el \`.schema('${SCHEMA}')\` de esta llamada o mover la función al esquema ${SCHEMA}.`,
      });
    }
    if (!r.scoped && !inPublic && inCondor && once(`rpc-scope-public:${r.name}`)) {
      rep.add({
        severity: 'P0',
        category: 'bd-esquema-incorrecto',
        summary: `RPC invocado sin .schema('${SCHEMA}') pero definido sólo en ${SCHEMA}: ${r.name}()`,
        where: `${r.file}:${r.line}`,
        detail: 'Sin `.schema()` PostgREST busca en `public`, donde la función no existe. Falla en runtime.',
        action: `Añadir \`.schema('${SCHEMA}')\` a la llamada.`,
      });
    }
    if (!r.scoped && inPublic && once(`rpc-public:${r.name}`)) {
      rep.add({
        severity: 'P2',
        category: 'bd-esquema-inconsistente',
        summary: `RPC que vive en public y no en ${SCHEMA}: ${r.name}()`,
        where: `${r.file}:${r.line}`,
        detail: `Funciona, pero rompe la regla del proyecto de direccionar siempre \`${SCHEMA}\` explícitamente: esta función es la excepción y no está documentada como tal. Los demás RPC (${dbRpcs.join(', ')}) sí viven en \`${SCHEMA}\`.`,
        action: `Documentar la excepción, o mover la función a \`${SCHEMA}\` y añadir \`.schema('${SCHEMA}')\` en los ${rpcs.filter(x => x.name === r.name).length} puntos de llamada.`,
      });
    }
  }

  // ── Database objects the code never touches ───────────────────────────────
  for (const t of Object.keys(catalog).sort()) {
    if (usedTables.has(t)) continue;
    rep.add({
      severity: 'P2',
      category: 'bd-sin-uso',
      summary: `Objeto de BD que el backend nunca consulta: ${t}`,
      where: `condor.${t}`,
      detail: `Expuesto en el esquema pero sin ningún \`.from('${t}')\` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.`,
      action: 'Confirmar si sigue siendo necesario; documentarlo o retirarlo.',
    });
  }

  // Columns never selected by the backend (candidate dead columns).
  const unusedColumns = [];
  for (const [t, def] of Object.entries(catalog)) {
    if (!usedTables.has(t)) continue;
    const used = usedColumns.get(t);
    // Skip tables read with `*`, where every column is implicitly used.
    const readsStar = queries.some(q => q.table === t && (!q.select || q.select.includes('*')));
    if (readsStar || !used) continue;
    const never = def.columns.map(c => c.name).filter(c => !used.has(c));
    if (never.length) unusedColumns.push({ table: t, columns: never });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'db-catalog.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), schema: SCHEMA, tables: catalog, rpcs: dbRpcs, public_rpcs: publicRpcs }, null, 2),
    'utf8'
  );

  return writeReport('04-db-vs-code', rep, {
    stats: {
      db_objects: tableCount,
      db_rpcs: dbRpcs.length,
      public_rpcs: publicRpcs.length,
      queries_scanned: queries.length,
      tables_referenced: usedTables.size,
      rpc_calls_scanned: rpcs.length,
    },
    unused_columns: unusedColumns,
    catalog_file: 'docs/auditoria/anexos/db-catalog.json',
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error('[04-db-vs-code] error:', err.message);
    process.exit(1);
  });
}
module.exports = main;
