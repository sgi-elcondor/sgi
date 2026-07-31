'use strict';

/**
 * Cross-check: the authorization model as written in code against the rows that
 * actually exist in the database. STRICTLY READ-ONLY.
 *
 *   ROUTE_PERMISSIONS ─ VISTA_API_MAP ─ condor.permisos ─ condor.rol_permiso ─ condor.roles
 *
 * Catches the failures that look like "el rol no tiene permisos" in production:
 *  - a route demanding a permission that does not exist as a row (403 forever)
 *  - a view whose activation in Permisos grants nothing
 *  - permissions no role holds, and roles holding nothing
 *  - role NAMES hardcoded in code that do not match any row: notification
 *    fan-out and role gates then fail silently (RN-28 is fire-and-forget)
 *
 * Also emits the effective access matrix (rol × permisos × vistas), which is an
 * annex of the Documento Funcional.
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { ROOT, rel, readText, walk, makeReporter, writeReport, OUT_DIR } = require('./lib/util');
const { scanPermissionsMap, scanViews } = require('./lib/scan');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const SCHEMA       = 'condor';

async function select(table, cols = '*') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(cols)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Accept-Profile': SCHEMA,
    },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Role names referenced as literals in backend code. */
function scanRoleLiterals() {
  const hits = new Map(); // role -> [where]
  const note = (role, where) => {
    if (!hits.has(role)) hits.set(role, []);
    if (!hits.get(role).includes(where)) hits.get(role).push(where);
  };

  for (const abs of walk(path.join(ROOT, 'src'), ['.js'])) {
    const lines = readText(abs).split('\n');
    lines.forEach((line, i) => {
      const where = `${rel(abs)}:${i + 1}`;

      // notif.crear({ paraRoles: ['jefe_area', ...] })
      const fan = line.match(/paraRoles:\s*\[([^\]]*)\]/);
      if (fan) for (const m of fan[1].matchAll(/["'](\w+)["']/g)) note(m[1], where);

      // const ROLES_X = ['auxiliar_contable', 'admin']
      const list = line.match(/ROLES?_[A-Z_]+\s*=\s*\[([^\]]*)\]/);
      if (list) for (const m of list[1].matchAll(/["'](\w+)["']/g)) note(m[1], where);

      // req.usuario.rol === 'juridico'   |   ['a','b'].includes(req.usuario.rol)
      for (const m of line.matchAll(/rol\s*!?===?\s*["'](\w+)["']/g)) note(m[1], where);
      const inc = line.match(/\[([^\]]*)\]\s*\.includes\(\s*(?:req\.usuario\??\.?\.?rol|reqUsuario\.rol)/);
      if (inc) for (const m of inc[1].matchAll(/["'](\w+)["']/g)) note(m[1], where);
    });
  }

  return hits;
}

function scanVistaApiMap() {
  const src  = readText(path.join(ROOT, 'src', 'controllers', 'roles.controller.js'));
  const out  = new Map();
  const body = src.slice(src.indexOf('VISTA_API_MAP'));
  const re   = /['"]([\w-]+)['"]\s*:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(body))) {
    if (out.has(m[1])) continue;
    out.set(m[1], [...m[2].matchAll(/['"]([\w-]+:[\w-]+)['"]/g)].map(x => x[1]));
    if (out.size > 200) break;
  }
  return out;
}

async function main() {
  const rep = makeReporter('PD', 'Anexo E · Modelo de autorización: código vs. base de datos');

  if (!SUPABASE_URL || !SERVICE_KEY) {
    rep.add({
      severity: 'P0',
      category: 'cobertura-auditoria',
      summary: 'Sin credenciales de Supabase: el drift de permisos no se ejecutó',
      where: '.env',
      detail: 'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY.',
      action: 'Exportar las variables y re-ejecutar.',
    });
    return writeReport('05-permissions-db-drift', rep);
  }

  const [permisos, rolPermiso, roles] = await Promise.all([
    select('permisos'),
    select('rol_permiso'),
    select('roles'),
  ]);

  const permById   = new Map(permisos.map(p => [p.id_permiso, p]));
  const permByName = new Map(permisos.map(p => [`${p.recurso}:${p.accion}`, p]));
  const roleById   = new Map(roles.map(r => [r.id_rol, r]));
  const roleByName = new Map(roles.map(r => [String(r.nombre), r]));

  const grantsByRole = new Map();
  const rolesByPerm  = new Map();
  for (const rp of rolPermiso) {
    const role = roleById.get(rp.id_rol);
    const perm = permById.get(rp.id_permiso);
    if (!role || !perm) continue;
    const pname = `${perm.recurso}:${perm.accion}`;
    if (!grantsByRole.has(role.nombre)) grantsByRole.set(role.nombre, new Set());
    grantsByRole.get(role.nombre).add(pname);
    if (!rolesByPerm.has(pname)) rolesByPerm.set(pname, new Set());
    rolesByPerm.get(pname).add(role.nombre);
  }

  const routePerms = scanPermissionsMap().entries;
  const vistaMap   = scanVistaApiMap();

  // ── 1. Permissions demanded by a route but absent from `permisos` ──────────
  const seen = new Set();
  for (const e of routePerms) {
    if (seen.has(e.permiso)) continue;
    seen.add(e.permiso);
    if (permByName.has(e.permiso)) continue;
    rep.add({
      severity: 'P0',
      category: 'permiso-inexistente',
      summary: `Ruta exige un permiso que no existe en condor.permisos: ${e.permiso}`,
      where: `${e.file}:${e.line}`,
      detail: `\`${e.key}\` exige \`${e.permiso}\`, pero no hay fila en \`permisos\`. Ningún rol puede tenerlo: todos reciben 403 salvo \`admin\` (que hace bypass). El endpoint es inalcanzable para el resto.`,
      action: `INSERT en condor.permisos (recurso='${e.recurso}', accion='${e.accion}') y otorgarlo a los roles que lo necesiten.`,
    });
  }

  // ── 2. Permissions demanded by a route that no role holds ─────────────────
  for (const p of seen) {
    if (!permByName.has(p)) continue;
    const holders = rolesByPerm.get(p);
    if (holders && holders.size) continue;
    rep.add({
      severity: 'P1',
      category: 'permiso-sin-rol',
      summary: `Permiso exigido por una ruta que ningún rol tiene otorgado: ${p}`,
      where: 'condor.rol_permiso',
      detail: 'Existe la fila en `permisos` pero no hay ninguna concesión en `rol_permiso`. En la práctica el endpoint sólo es accesible para `admin`.',
      action: 'Otorgarlo al rol correspondiente desde la vista Permisos, o retirar la ruta si no debe usarse.',
    });
  }

  // ── 3. VISTA_API_MAP referencing non-existent permissions ─────────────────
  for (const [vista, perms] of vistaMap) {
    for (const p of perms) {
      if (permByName.has(p)) continue;
      rep.add({
        severity: 'P1',
        category: 'permiso-ui-inexistente',
        summary: `VISTA_API_MAP otorga un permiso inexistente: ${p} (vista ${vista})`,
        where: 'src/controllers/roles.controller.js',
        detail: `Al activar la vista \`${vista}\` para un rol, el backend intentará conceder \`${p}\`, que no existe en \`permisos\`. La concesión se pierde silenciosamente y el rol queda con la vista visible pero sin acceso a la API.`,
        action: 'Crear el permiso en BD o corregir/eliminar la entrada del mapa.',
      });
    }
  }

  // ── 4. Visibility permissions (`vista:<clave>`) ───────────────────────────
  // roles.controller.js genera `vista:${v}` al guardar permisos, y el frontend
  // los lee con AppState.hasVista(): son el mecanismo de visibilidad de la UI.
  const views = scanViews();
  for (const v of views) {
    if (permByName.has(`vista:${v}`)) continue;
    rep.add({
      severity: 'P1',
      category: 'vista-no-otorgable',
      summary: `Vista registrada sin su permiso de visibilidad en BD: falta vista:${v}`,
      where: ['public/js/app.js', 'condor.permisos'],
      detail: `\`roles.controller.js\` concede \`vista:${v}\` al activar la vista para un rol, pero esa fila no existe en \`permisos\`: la concesión se pierde y la vista nunca aparece en el sidebar de un rol no-admin.`,
      action: `INSERT en condor.permisos (recurso='vista', accion='${v}').`,
    });
  }

  // ── 5. Dead permissions ───────────────────────────────────────────────────
  const uiPerms  = new Set([...vistaMap.values()].flat());
  const viewSet  = new Set(views);
  for (const p of permByName.keys()) {
    if (seen.has(p) || uiPerms.has(p)) continue;

    if (p.startsWith('vista:')) {
      const key = p.slice('vista:'.length);
      if (viewSet.has(key)) continue; // en uso por el mecanismo de visibilidad
      rep.add({
        severity: 'P2',
        category: 'permiso-muerto',
        summary: `Permiso de visibilidad de una vista que ya no existe: ${p}`,
        where: 'condor.permisos',
        detail: `\`${key}\` no está registrada en VIEWS (public/js/app.js).${rolesByPerm.get(p) ? ` Sigue otorgado a: ${[...rolesByPerm.get(p)].join(', ')}.` : ''}`,
        action: 'Eliminar el permiso y sus concesiones, o registrar la vista si debía existir.',
      });
      continue;
    }

    const holders = rolesByPerm.get(p);
    rep.add({
      severity: 'P2',
      category: 'permiso-muerto',
      summary: `Permiso que ninguna ruta exige y ninguna vista otorga: ${p}`,
      where: 'condor.permisos',
      detail: `No aparece en ROUTE_PERMISSIONS ni en VISTA_API_MAP.${holders ? ` Otorgado a: ${[...holders].join(', ')} (concesiones sin efecto).` : ' Sin concesiones.'}`,
      action: 'Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones.',
    });
  }

  // ── 5. Role names hardcoded in code vs `roles` rows ───────────────────────
  const NON_ROLE = new Set(['admin']); // admin siempre existe por bypass
  for (const [role, wheres] of scanRoleLiterals()) {
    if (roleByName.has(role)) continue;
    if (NON_ROLE.has(role)) continue;
    const isFanout = wheres.some(w => /notificaciones|controller/.test(w));
    rep.add({
      severity: 'P1',
      category: 'rol-inexistente',
      summary: `Nombre de rol usado en código que no existe en condor.roles: ${role}`,
      where: wheres.slice(0, 6),
      detail: `Roles reales en BD: ${[...roleByName.keys()].sort().join(', ')}.${isFanout ? ' Si se usa en un fan-out de notificaciones, el envío no alcanza a nadie y el fallo es silencioso (RN-28 es best-effort).' : ''}`,
      action: 'Corregir el literal o crear el rol.',
    });
  }

  // ── 6. Roles with no permissions at all ───────────────────────────────────
  for (const r of roles) {
    if (r.nombre === 'admin') continue;
    const g = grantsByRole.get(r.nombre);
    if (g && g.size) continue;
    rep.add({
      severity: 'P2',
      category: 'rol-sin-permisos',
      summary: `Rol sin ningún permiso otorgado: ${r.nombre}`,
      where: 'condor.rol_permiso',
      detail: 'Un usuario con este rol pasa la autenticación pero no puede usar ningún endpoint con permiso declarado.',
      action: 'Otorgar permisos desde la vista Permisos, o eliminar el rol si no se usa.',
    });
  }

  // ── Effective access matrix (annex for the functional document) ───────────
  const matrix = roles
    .map(r => {
      const granted = grantsByRole.get(r.nombre) || new Set();
      const vistas  = [...vistaMap.entries()]
        .filter(([, perms]) => perms.some(p => granted.has(p)))
        .map(([v]) => v);
      return {
        rol: r.nombre,
        acceso_total: r.nombre === 'admin',
        permisos: [...granted].sort(),
        permisos_total: granted.size,
        vistas_alcanzables: r.nombre === 'admin' ? [...vistaMap.keys()] : vistas,
      };
    })
    .sort((a, b) => b.permisos_total - a.permisos_total);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'matriz-acceso.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), roles: matrix }, null, 2),
    'utf8'
  );

  const mm = ['# Anexo F · Matriz de acceso efectiva (rol × vistas × permisos)', ''];
  mm.push(`_Derivada de condor.rol_permiso el ${new Date().toISOString()}._`, '');
  mm.push('| Rol | Permisos | Vistas alcanzables |', '|---|---|---|');
  for (const r of matrix) {
    mm.push(`| ${r.rol}${r.acceso_total ? ' (acceso total)' : ''} | ${r.permisos_total} | ${r.vistas_alcanzables.join(', ') || '—'} |`);
  }
  mm.push('', '## Detalle por rol', '');
  for (const r of matrix) {
    mm.push(`### ${r.rol}`, '');
    mm.push(`- **Vistas:** ${r.vistas_alcanzables.join(', ') || '—'}`);
    mm.push(`- **Permisos (${r.permisos_total}):** ${r.permisos.join(', ') || '—'}`, '');
  }
  fs.writeFileSync(path.join(OUT_DIR, 'matriz-acceso.md'), mm.join('\n'), 'utf8');

  return writeReport('05-permissions-db-drift', rep, {
    stats: {
      permisos_en_bd: permisos.length,
      concesiones: rolPermiso.length,
      roles_en_bd: roles.length,
      permisos_exigidos_por_rutas: seen.size,
      permisos_en_vista_api_map: uiPerms.size,
      vistas_en_vista_api_map: vistaMap.size,
    },
    matrix_files: ['docs/auditoria/anexos/matriz-acceso.md', 'docs/auditoria/anexos/matriz-acceso.json'],
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error('[05-permissions-db-drift] error:', err.message);
    process.exit(1);
  });
}
module.exports = main;
