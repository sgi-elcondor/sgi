'use strict';

/**
 * Cross-check: every route actually mounted by src/index.js against the
 * ROUTE_PERMISSIONS map, reproducing the real key construction of
 * permisos.middleware.js.
 *
 * Catches:
 *  - routes reachable by ANY authenticated user (no map entry)
 *  - routes whose key can never match because a param is not numeric (SEG-09)
 *  - map entries that no longer point at a live route (dead config)
 *  - distinct routes collapsing onto one key (shared permission by accident)
 *  - routers mounted before the auth guard (unauthenticated by position)
 *  - route files never mounted (dead code)
 */

const { scanRoutes, scanPermissionsMap } = require('./lib/scan');
const { resolveHandler } = require('./lib/controllers');
const { makeReporter, writeReport } = require('./lib/util');

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Mounted before the /api/v1 guard on purpose (documented public surface).
const EXPECTED_PUBLIC_PREFIXES = ['/api/v1/auth', '/api/v1/public'];

// Endpoints designed to be reachable by any authenticated user because the
// controller scopes the query to req.usuario. Still verified manually.
const SELF_SCOPED = /\/(mis-[\w-]+|perfil|mi-rol|avatar|completar-perfil|notificaciones|firebase-config|stream)/;

function main() {
  const rep = makeReporter('RP', 'Anexo A · Rutas montadas vs. ROUTE_PERMISSIONS');
  const { routes, mounts, guards, inlineRoutes, prehooks, orphanRouteFiles, unparsed } = scanRoutes();
  const perms = scanPermissionsMap();

  const permByKey = new Map(perms.entries.map(e => [e.key, e]));
  const guard     = guards.find(g => g.prefix === '/api/v1');

  // ── 1. Mount order: anything mounted before the guard is unauthenticated ────
  const publicMounts = guard ? mounts.filter(m => m.line < guard.line) : mounts;
  for (const m of publicMounts) {
    const expected = EXPECTED_PUBLIC_PREFIXES.includes(m.prefix);
    rep.add({
      severity: expected ? 'INFO' : 'P0',
      category: 'authn',
      summary: expected
        ? `Router público por diseño: ${m.prefix}`
        : `Router montado ANTES de verificarToken y por tanto público: ${m.prefix}`,
      where: `${m.file}:${m.line}`,
      detail: expected
        ? `Montado en la línea ${m.line}, antes del guard de la línea ${guard ? guard.line : '?'}. Superficie pública documentada.`
        : `Montado en la línea ${m.line}; el guard \`app.use('/api/v1', verificarToken, verificarPermiso)\` está en la línea ${guard ? guard.line : '?'}. Todo endpoint de este router es accesible sin token.`,
      action: expected ? 'Ninguna; documentar en el Documento Técnico.' : 'Mover el mount debajo del guard o aplicar verificarToken explícitamente en el router.',
    });
  }

  const guardedRoutes = routes.filter(r => !publicMounts.some(m => m.prefix === r.prefix));

  // ── 2 & 3. Key matching per route ──────────────────────────────────────────
  const usedKeys  = new Set();
  const keyOwners = new Map();

  const unresolved = [];

  for (const r of guardedRoutes) {
    const entry = permByKey.get(r.key);
    if (entry) usedKeys.add(r.key);

    if (!keyOwners.has(r.key)) keyOwners.set(r.key, []);
    keyOwners.get(r.key).push(r);

    const selfScoped = SELF_SCOPED.test(r.fullPath);
    const isWrite    = WRITE_METHODS.includes(r.method);

    // Resolve the handler to see whether the controller gates access itself.
    const h = resolveHandler(r, r.requires || { aliases: {}, named: {} });
    if (h.unresolved) unresolved.push({ route: `${r.method} ${r.fullPath}`, at: `${r.file}:${r.line}`, why: h.unresolved });

    const gated     = !h.unresolved && h.authz.length > 0 && h.has403;
    const partial   = !h.unresolved && h.authz.length > 0 && !h.has403;
    const gateNote  = gated
      ? `Mitigado en el controller \`${h.file}:${h.line}\` (${h.authz.join(', ')} + respuesta 403).`
      : partial
        ? `El controller \`${h.file}:${h.line}\` usa ${h.authz.join(', ')} pero no se detecta un 403 explícito: verificar que realmente corte el acceso.`
        : h.unresolved
          ? `No se pudo resolver el handler para verificar mitigación (${h.unresolved}).`
          : `El controller \`${h.file || '?'}${h.line ? `:${h.line}` : ''}\` no contiene ninguna validación de rol/permiso.`;

    if (!r.matchable) {
      // Param non-numeric: the runtime URL keeps the real value, so the key
      // built by the middleware never equals any map key.
      rep.add({
        severity: gated ? 'P2' : isWrite ? 'P0' : 'P1',
        category: gated ? 'authz-descentralizada' : 'authz',
        summary: `Param no numérico ⇒ el permiso central nunca se evalúa: ${r.method} ${r.fullPath}`,
        where: [`${r.file}:${r.line}`, h.file ? `${h.file}:${h.line}` : null].filter(Boolean),
        detail: `El middleware sólo elimina segmentos numéricos (\`/\\d+/g\`). Con ${r.nonNumericParams.join(', ')} la clave en runtime es \`${r.method} ${r.fullPath.replace(/:(\w+)/g, '<valor>')}\`, que no existe en el mapa${entry ? ` (la entrada \`${entry.key}\` del mapa es letra muerta)` : ''}. ${gateNote}`,
        action: gated
          ? 'Aceptable, pero documentar la excepción: el permiso vive en el controller y NO es visible en ROUTE_PERMISSIONS.'
          : 'Validar el permiso dentro del controller (patrón `_puedeConfig`) o normalizar el segmento no numérico en el middleware.',
      });
      continue;
    }

    if (!entry) {
      const severity = gated ? 'P2' : selfScoped ? 'INFO' : isWrite ? 'P0' : 'P1';
      rep.add({
        severity,
        category: gated ? 'authz-descentralizada' : 'authz',
        summary: gated
          ? `Autorización fuera del mapa central: ${r.method} ${r.fullPath}`
          : `Sin entrada en ROUTE_PERMISSIONS: ${r.method} ${r.fullPath}`,
        where: [`${r.file}:${r.line}`, h.file ? `${h.file}:${h.line}` : null].filter(Boolean),
        detail: `Clave calculada \`${r.key}\` ausente del mapa ⇒ el middleware sólo exige autenticación. ${gateNote}${selfScoped && !gated ? ' Parece endpoint de auto-servicio; verificar el filtro por req.usuario.' : ''}`,
        action: gated
          ? 'Deuda de consistencia: la lista de roles/permisos hardcodeada no es configurable desde la vista Permisos. Evaluar migrar a ROUTE_PERMISSIONS.'
          : selfScoped
            ? 'Confirmar el filtro por req.usuario en el controller y documentarlo como endpoint de auto-servicio.'
            : `Registrar \`'${r.key}': { recurso, accion }\` en src/config/permissions.js.`,
      });
    }
  }

  for (const u of unresolved) {
    rep.add({
      severity: 'INFO',
      category: 'cobertura-auditoria',
      summary: `Handler no resuelto (mitigación no verificable): ${u.route}`,
      where: u.at,
      detail: u.why,
      action: 'Revisión manual del controller.',
    });
  }

  // ── 4. Key collisions between distinct routes ──────────────────────────────
  for (const [key, owners] of keyOwners) {
    if (owners.length < 2) continue;
    const distinct = new Set(owners.map(o => o.fullPath));
    if (distinct.size < 2) continue;

    // The benign case is a list + detail pair (`/x` and `/x/:id`): same resource,
    // same sensitivity, one permission is correct. Anything else means two
    // different operations share a single permission and cannot be separated.
    const paths     = [...distinct].sort((a, b) => a.length - b.length);
    const listDetail = paths.length === 2 && paths[1].replace(/\/:\w+$/, '') === paths[0];

    rep.add({
      severity: listDetail ? 'INFO' : 'P2',
      category: 'granularidad-permisos',
      summary: `Rutas distintas colapsan en la misma clave de permiso: ${key}`,
      where: owners.map(o => `${o.file}:${o.line}`),
      detail: `Rutas afectadas: ${paths.join(' , ')}. Comparten ${permByKey.has(key) ? `el permiso \`${permByKey.get(key).permiso}\`` : 'la ausencia de permiso'}; no se pueden autorizar por separado.${listDetail ? ' Patrón lista+detalle del mismo recurso: aceptable.' : ''}`,
      action: listDetail
        ? 'Ninguna; documentar que lista y detalle comparten permiso.'
        : 'Verificar que ambas operaciones deban compartir sensibilidad; si no, diferenciar la ruta o validar en el controller.',
    });
  }

  // ── 5. Dead map entries ────────────────────────────────────────────────────
  for (const e of perms.entries) {
    if (usedKeys.has(e.key)) continue;
    const shadowed = guardedRoutes.some(r => !r.matchable && r.key === e.key);
    if (shadowed) continue; // already reported as SEG-09 above
    rep.add({
      severity: 'P2',
      category: 'config-muerta',
      summary: `Entrada de ROUTE_PERMISSIONS sin ruta viva: ${e.key}`,
      where: `${e.file}:${e.line}`,
      detail: `Ninguna ruta montada produce la clave \`${e.key}\` (permiso \`${e.permiso}\`).`,
      action: 'Eliminar la entrada o corregir la clave si la ruta cambió de forma.',
    });
  }

  // ── 6. Route files never mounted ───────────────────────────────────────────
  for (const f of orphanRouteFiles) {
    rep.add({
      severity: 'P2',
      category: 'codigo-muerto',
      summary: `Archivo de rutas nunca montado: ${f}`,
      where: f,
      detail: 'No aparece en ningún app.use() de src/index.js.',
      action: 'Montarlo si debía existir, o eliminarlo.',
    });
  }

  // ── 7. Parser blind spots ──────────────────────────────────────────────────
  for (const u of unparsed) {
    rep.add({
      severity: 'INFO',
      category: 'cobertura-auditoria',
      summary: 'Línea de ruta/mount no interpretable por el auditor',
      where: `${u.file}:${u.line}`,
      detail: `\`${u.text}\` — revisar a mano; no entró en el cruce automático.`,
      action: 'Revisión manual.',
    });
  }

  return writeReport('01-routes-vs-permissions', rep, {
    stats: {
      mounts: mounts.length,
      routes_total: routes.length,
      routes_guarded: guardedRoutes.length,
      routes_public_by_mount: routes.length - guardedRoutes.length,
      inline_routes: inlineRoutes.length,
      prehooks: prehooks.length,
      permission_entries: perms.entries.length,
      permission_entries_used: usedKeys.size,
    },
    inventory: routes.map(r => ({
      method: r.method,
      path: r.fullPath,
      key: r.key,
      matchable: r.matchable,
      permiso: permByKey.get(r.key)?.permiso || null,
      file: `${r.file}:${r.line}`,
    })),
  });
}

if (require.main === module) main();
module.exports = main;
