'use strict';

/**
 * Cross-check: every endpoint the SPA calls against every route the server
 * actually mounts, in both directions.
 *
 * Catches:
 *  - UI calls to endpoints that do not exist (silent 404 → "la vista sale vacía")
 *  - method mismatches (UI does PUT where the server only exposes PATCH)
 *  - backend endpoints nobody consumes (dead surface)
 *  - file uploads bypassing window.API (documented exception, verified)
 */

const { scanRoutes, scanFrontendCalls, routeShape, shapesMatch } = require('./lib/scan');
const { makeReporter, writeReport } = require('./lib/util');

// Consumed outside public/js (landing page, login page, service worker, docs).
const NON_SPA_CONSUMERS = [
  '/api/v1/public/proyectos',
  '/api/v1/public/lotes',
  '/api/v1/public/asesores',
  '/api/v1/firebase-config',
  '/api/v1/auth/login',
  '/api/v1/auth/registrar',
  '/api/v1/auth/reset-password-email',
  '/api/v1/auth/reenviar-verificacion',
  '/api/v1/auth/vincular',
  '/api/v1/auth/login/2fa/verificar',
  '/api/v1/auth/login/2fa/reenviar',
];

function main() {
  const rep = makeReporter('FB', 'Anexo B · Endpoints consumidos por la SPA vs. rutas montadas');
  const { routes, inlineRoutes } = scanRoutes();
  const { calls, dynamic } = scanFrontendCalls();

  // Route index by shape (params normalized to :id) and by method.
  const byShape = new Map();
  for (const r of routes) {
    const shape = routeShape(r.fullPath);
    if (!byShape.has(shape)) byShape.set(shape, []);
    byShape.get(shape).push(r);
  }
  for (const r of inlineRoutes) {
    const shape = routeShape(r.path);
    if (!byShape.has(shape)) byShape.set(shape, []);
    byShape.get(shape).push({ ...r, fullPath: r.path, prefix: '', file: r.file, line: r.line });
  }

  const consumed = new Set();
  const realCalls = calls.filter(c => c.kind !== 'invalidate');

  // ── 1. UI → server ─────────────────────────────────────────────────────────
  const allShapes = [...byShape.entries()];

  for (const c of realCalls) {
    const shape = c.normalized;
    // Exact shape first, then segment-wise (handles interpolated action names
    // and interpolated query strings appended to the last segment).
    let matches = byShape.get(shape) || [];
    if (!matches.length) {
      matches = allShapes.filter(([s]) => shapesMatch(shape, s)).flatMap(([, rs]) => rs);
    }
    // `API.put('/roles/' + id + '/permisos')`: only the prefix is literal, so the
    // best available evidence is a prefix + method match against the mounted
    // routes. Needed both when nothing matched and when the literal prefix
    // happens to be a real route with a different method.
    let prefixMatched = false;
    const needsPrefix = c.concatenated
      && (!matches.length || !matches.some(m => m.method === c.method || m.method === 'ALL'));
    if (needsPrefix) {
      const prefix     = `${shape}/`;
      const cands      = allShapes.filter(([s]) => s.startsWith(prefix)).flatMap(([, rs]) => rs);
      const sameMethod = cands.filter(m => m.method === c.method);
      if (sameMethod.length) {
        matches = sameMethod;
        prefixMatched = true;
      }
    }

    // Only a fully literal URL proves a broken endpoint. Concatenated or
    // interpolated URLs are reported as unverified, never as a defect.
    const literal = !c.templated && !c.concatenated;

    if (!matches.length) {
      rep.add({
        severity: literal ? 'P0' : 'P1',
        category: literal ? 'endpoint-inexistente' : 'endpoint-no-verificado',
        summary: literal
          ? `La UI llama un endpoint que el servidor no expone: ${c.method} ${shape}`
          : `Llamada dinámica sin ruta equivalente detectada: ${c.method} ${shape}`,
        where: `${c.file}:${c.line}`,
        detail: `Llamada original \`${c.raw}\`${c.templated ? ' (interpolada)' : ''}${c.concatenated ? ' (concatenada con +, el literal es sólo un prefijo)' : ''}. Ninguna ruta montada coincide con \`${shape}\`.${literal ? ' En runtime devuelve 404 y la vista queda sin datos.' : ' Requiere verificación manual: el auditor no puede reconstruir la URL final.'}`,
        action: literal
          ? 'Corregir la URL en el frontend o montar la ruta en el backend.'
          : 'Verificar a mano la URL construida en runtime.',
      });
      continue;
    }

    const methodOk = prefixMatched || matches.some(m => m.method === c.method || m.method === 'ALL');
    if (!methodOk) {
      rep.add({
        severity: literal ? 'P0' : 'P1',
        category: 'metodo-incorrecto',
        summary: `Método no soportado por la ruta: la UI usa ${c.method} ${shape}`,
        where: [`${c.file}:${c.line}`, ...matches.map(m => `${m.file}:${m.line}`)],
        detail: `El servidor expone ${[...new Set(matches.map(m => m.method))].join('/')} para \`${shape}\`. La llamada del frontend usa ${c.method}${c.kind === 'fetch' ? ' (método leído de las 5 líneas siguientes al fetch; verificar si el objeto de opciones está más abajo)' : ''} ⇒ 404/405.`,
        action: 'Alinear el verbo HTTP entre frontend y backend.',
      });
      continue;
    }

    for (const m of matches) {
      if (prefixMatched || m.method === c.method || m.method === 'ALL') consumed.add(`${m.method} ${m.fullPath}`);
    }
  }

  // ── 2. server → UI (dead surface) ──────────────────────────────────────────
  for (const r of routes) {
    const sig = `${r.method} ${r.fullPath}`;
    if (consumed.has(sig)) continue;
    if (NON_SPA_CONSUMERS.includes(r.fullPath)) continue;

    rep.add({
      severity: 'P2',
      category: 'endpoint-sin-consumidor',
      summary: `Endpoint que la SPA nunca llama: ${sig}`,
      where: `${r.file}:${r.line}`,
      detail: 'No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.',
      action: 'Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.',
    });
  }

  // ── 3. Calls the scanner could not resolve statically ──────────────────────
  for (const d of dynamic) {
    rep.add({
      severity: 'INFO',
      category: 'cobertura-auditoria',
      summary: 'Llamada a la API construida dinámicamente (no verificable estáticamente)',
      where: `${d.file}:${d.line}`,
      detail: `\`${d.text}\``,
      action: 'Revisión manual del endpoint destino.',
    });
  }

  return writeReport('02-frontend-vs-backend', rep, {
    stats: {
      calls_found: realCalls.length,
      dynamic_calls: dynamic.length,
      routes_total: routes.length,
      routes_consumed: consumed.size,
      routes_unconsumed: routes.length - consumed.size,
    },
    consumed: [...consumed].sort(),
  });
}

if (require.main === module) main();
module.exports = main;
