'use strict';

/**
 * Static scanners shared by the audit scripts.
 *
 * Design rule: never fail silently. Anything that looks like a route/mount/API
 * call but cannot be parsed is returned in an `unparsed` list so the audit
 * reports its own blind spots instead of pretending full coverage.
 */

const path = require('path');
const { ROOT, rel, readLines, walk, exists } = require('./util');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];

/** Params that carry a numeric value at runtime, which the permission middleware strips. */
const NUMERIC_PARAM = /^:(id|ids|idx?[A-Z_]\w*|\w*[Ii]d|id_\w+|\w+_id)$/;

function isNumericParam(param) {
  return NUMERIC_PARAM.test(param);
}

// ── src/index.js: mounts, inline routes, guard position ────────────────────────

function scanIndex() {
  const file  = path.join(ROOT, 'src', 'index.js');
  const lines = readLines(file);

  const mounts       = [];
  const inlineRoutes = [];
  const guards       = [];
  const prehooks     = [];
  const unparsed     = [];

  lines.forEach((raw, i) => {
    const line = raw.trim();
    const at   = { file: rel(file), line: i + 1 };
    if (!line || line.startsWith('//')) return;

    let m = line.match(/^app\.use\(\s*['"]([^'"]+)['"]\s*,\s*require\(\s*['"]\.\/routes\/([\w.\-]+?)(?:\.js)?['"]\s*\)\s*\)/);
    if (m) {
      mounts.push({ prefix: m[1], routerFile: `src/routes/${m[2]}.js`, ...at });
      return;
    }

    m = line.match(/^app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(verificarToken|verificarPermiso)/);
    if (m) {
      const names = line.match(/verificarToken|verificarPermiso/g) || [];
      guards.push({ prefix: m[1], middlewares: [...new Set(names)], ...at });
      return;
    }

    m = line.match(/^app\.(get|post|put|patch|delete|all)\(\s*['"]([^'"]+)['"]/);
    if (m) {
      inlineRoutes.push({ method: m[1].toUpperCase(), path: m[2], ...at });
      return;
    }

    m = line.match(/^app\.use\(\s*['"]([^'"]+)['"]\s*,\s*\(/);
    if (m) {
      prehooks.push({ prefix: m[1], ...at });
      return;
    }

    if (/^app\.(use|get|post|put|patch|delete|all)\(/.test(line) && !/^app\.use\(\s*(cors|compression|express|connectLivereload)/.test(line)) {
      unparsed.push({ ...at, text: line.slice(0, 160) });
    }
  });

  return { mounts, inlineRoutes, guards, prehooks, unparsed };
}

// ── src/routes/*.routes.js: one entry per declared route ───────────────────────

/** require() bindings of a routes file, so handlers can be resolved to a controller. */
function scanRequires(abs, lines) {
  const aliases = {};
  const named   = {};

  const resolveTarget = spec => {
    const target = path.resolve(path.dirname(abs), spec);
    const withExt = target.endsWith('.js') ? target : `${target}.js`;
    return exists(withExt) ? rel(withExt) : null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    let m = line.match(/^(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/);
    if (m) {
      const file = resolveTarget(m[2]);
      if (file) aliases[m[1]] = file;
      continue;
    }

    m = line.match(/^(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/);
    if (m) {
      const file = resolveTarget(m[2]);
      if (!file) continue;
      for (const part of m[1].split(',')) {
        const id = part.split(':').pop().trim();
        if (id) named[id] = file;
      }
    }
  }

  return { aliases, named };
}

function scanRouteFile(abs) {
  const lines    = readLines(abs);
  const routes   = [];
  const unparsed = [];
  const requires = scanRequires(abs, lines);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('*')) return;

    const m = line.match(/^router\.(get|post|put|patch|delete|all)\(\s*(['"`])([^'"`]*)\2\s*(.*)$/);
    if (m) {
      const rest = m[4];
      routes.push({
        method: m[1].toUpperCase(),
        path: m[3] || '/',
        handlers: rest,
        hasVerificarPermiso: /verificarPermiso/.test(rest),
        hasVerificarToken: /verificarToken\b/.test(rest),
        hasVerificarTokenFirebase: /verificarTokenFirebase/.test(rest),
        hasRateLimit: /rateLimit/.test(rest),
        file: rel(abs),
        line: i + 1,
      });
      return;
    }
    if (/^router\.(get|post|put|patch|delete|all)\(/.test(line)) {
      unparsed.push({ file: rel(abs), line: i + 1, text: line.slice(0, 160) });
    }
  });

  return { routes, unparsed, requires };
}

/** Full route inventory: every declared route resolved to its absolute API path. */
function scanRoutes() {
  const idx      = scanIndex();
  const routes   = [];
  const unparsed = [...idx.unparsed];

  const routeFiles = walk(path.join(ROOT, 'src', 'routes'), ['.js']);
  const mounted    = new Set(idx.mounts.map(mt => mt.routerFile));

  for (const mount of idx.mounts) {
    const abs = path.join(ROOT, mount.routerFile);
    if (!exists(abs)) {
      unparsed.push({ file: mount.file, line: mount.line, text: `mount apunta a archivo inexistente: ${mount.routerFile}` });
      continue;
    }
    const parsed = scanRouteFile(abs);
    unparsed.push(...parsed.unparsed);
    for (const r of parsed.routes) {
      const full = joinPath(mount.prefix, r.path);
      routes.push({
        ...r,
        prefix: mount.prefix,
        fullPath: full,
        requires: parsed.requires,
        ...effectiveKey(r.method, full),
      });
    }
  }

  const orphanRouteFiles = routeFiles.map(rel).filter(f => !mounted.has(f));

  return { ...idx, routes, orphanRouteFiles, unparsed };
}

function joinPath(prefix, sub) {
  const p = `${prefix.replace(/\/$/, '')}/${String(sub).replace(/^\//, '')}`;
  return p.replace(/\/+$/, '') || '/';
}

/**
 * Reproduces permisos.middleware.js key construction:
 *   originalUrl → strip query → remove every `/\d+` segment → `METHOD path`.
 * A param that is NOT numeric at runtime survives in the URL, so the resulting
 * key can never match ROUTE_PERMISSIONS (SEG-09 trap).
 */
function effectiveKey(method, fullPath) {
  const segs = fullPath.split('/').filter(Boolean);
  const kept = [];
  const params = [];
  const nonNumericParams = [];

  for (const seg of segs) {
    if (seg.startsWith(':')) {
      params.push(seg);
      if (isNumericParam(seg)) continue;
      nonNumericParams.push(seg);
      kept.push(seg);
    } else {
      kept.push(seg);
    }
  }

  return {
    params,
    nonNumericParams,
    key: `${method} /${kept.join('/')}`,
    matchable: nonNumericParams.length === 0,
  };
}

// ── src/config/permissions.js ──────────────────────────────────────────────────

function scanPermissionsMap() {
  const file    = path.join(ROOT, 'src', 'config', 'permissions.js');
  const lines   = readLines(file);
  const entries = [];
  const unparsed = [];

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//')) return;
    const m = line.match(/^['"]([A-Z]+)\s+([^'"]+)['"]\s*:\s*\{\s*recurso:\s*['"]([^'"]+)['"]\s*,\s*accion:\s*['"]([^'"]+)['"]/);
    if (m) {
      entries.push({
        key: `${m[1]} ${m[2]}`,
        method: m[1],
        path: m[2],
        recurso: m[3],
        accion: m[4],
        permiso: `${m[3]}:${m[4]}`,
        file: rel(file),
        line: i + 1,
      });
      return;
    }
    if (/^['"](GET|POST|PUT|PATCH|DELETE)\s/.test(line)) {
      unparsed.push({ file: rel(file), line: i + 1, text: line.slice(0, 160) });
    }
  });

  return { entries, unparsed, file: rel(file) };
}

// ── public/js: API calls issued by the SPA ────────────────────────────────────

const API_CALL = /\b(?:window\.)?API\.(get|post|put|patch|delete|getCached|invalidate)\s*\(\s*(['"`])([^'"`]*)\2/g;
const FETCH_CALL = /\bfetch\s*\(\s*(['"`])(\/api\/[^'"`]*)\1/g;

function scanFrontendCalls() {
  const calls    = [];
  const dynamic  = [];
  const files    = walk(path.join(ROOT, 'public', 'js'), ['.js']).filter(f => !/[\\/]lib[\\/]/.test(f));

  for (const abs of files) {
    const lines = readLines(abs);
    lines.forEach((raw, i) => {
      const at = { file: rel(abs), line: i + 1 };
      // fetch() options frequently sit on the following lines.
      const window5 = lines.slice(i, i + 5).join('\n');

      let m;
      API_CALL.lastIndex = 0;
      while ((m = API_CALL.exec(raw))) {
        const verb = m[1];
        const url  = m[3];
        const after = raw.slice(m.index + m[0].length);
        calls.push({
          method: verb === 'getCached' ? 'GET' : verb === 'invalidate' ? 'INVALIDATE' : verb.toUpperCase(),
          raw: url,
          normalized: normalizeCallPath(url),
          templated: /\$\{/.test(url),
          // `API.put('/roles/' + id + '/permisos')`: the literal is only a prefix.
          concatenated: /^\s*['"`]?\s*\+/.test(after),
          kind: verb,
          ...at,
        });
      }

      FETCH_CALL.lastIndex = 0;
      while ((m = FETCH_CALL.exec(raw))) {
        const after = raw.slice(m.index + m[0].length);
        calls.push({
          method: methodFromFetchLine(window5),
          raw: m[2],
          normalized: normalizeCallPath(m[2]),
          templated: /\$\{/.test(m[2]),
          concatenated: /^\s*['"`]?\s*\+/.test(after),
          kind: 'fetch',
          ...at,
        });
      }

      // API.get(`${base}/...`) or API.get(variable) — cannot be resolved statically.
      if (/\b(?:window\.)?API\.(get|post|put|patch|delete|getCached)\s*\(\s*[^'"`)]/.test(raw)) {
        dynamic.push({ ...at, text: raw.trim().slice(0, 160) });
      }
    });
  }

  return { calls, dynamic };
}

function methodFromFetchLine(line) {
  const m = line.match(/method\s*:\s*['"]([A-Za-z]+)['"]/);
  return m ? m[1].toUpperCase() : 'GET';
}

/**
 * Turns a frontend URL into the same shape as a backend route key:
 * drops the query string, and replaces interpolations / numeric ids with `:id`.
 */
function normalizeCallPath(url) {
  let u = url.split('?')[0].split('#')[0];
  if (!u.startsWith('/api/')) {
    u = u.startsWith('/') ? `/api/v1${u}` : `/api/v1/${u}`;
  }
  u = u.replace(/\$\{[^}]*\}/g, ':id');
  u = u.replace(/\/\d+(?=\/|$)/g, '/:id');
  return u.replace(/\/+$/, '') || '/';
}

/** Route path with every param normalized to `:id`, for frontend↔backend matching. */
function routeShape(fullPath) {
  return fullPath.replace(/:[A-Za-z_]\w*/g, ':id').replace(/\/+$/, '') || '/';
}

/**
 * Segment-wise match between a frontend URL shape and a route shape.
 * A `:id` on either side matches any single segment; a segment that merely
 * contains `:id` (e.g. `documentos:id`, produced by an interpolated query
 * string) matches on its literal prefix.
 */
function shapesMatch(callShape, routeShapeStr) {
  const a = callShape.split('/').filter(Boolean);
  const b = routeShapeStr.split('/').filter(Boolean);
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x === ':id' || y === ':id') continue;
    if (x.includes(':id') && y.startsWith(x.split(':id')[0])) continue;
    if (y.includes(':id') && x.startsWith(y.split(':id')[0])) continue;
    return false;
  }
  return true;
}

/**
 * First-level keys of a top-level object literal. Depth tracking is essential:
 * `VIEWS` holds nested objects and a naive regex would return their inner
 * `fn`/`title` keys as if they were views.
 */
function objectFirstLevelKeys(src, varName) {
  const m = src.match(new RegExp(`const\\s+${varName}\\s*=\\s*\\{`));
  if (!m) return null;

  const start = src.indexOf('{', m.index);
  let depth = 0;
  let end = start;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }

  const body = src.slice(start + 1, end);
  const keys = [];
  let d = 0;
  let atEntry = true;

  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];

    if (c === '/' && body[i + 1] === '/') { i = body.indexOf('\n', i); if (i === -1) break; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const close = body.indexOf(c, i + 1);
      if (d === 0 && atEntry && close !== -1 && /^\s*:/.test(body.slice(close + 1))) {
        keys.push(body.slice(i + 1, close));
        atEntry = false;
      }
      i = close === -1 ? body.length : close;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') { d += 1; continue; }
    if (c === '}' || c === ']' || c === ')') { d -= 1; continue; }
    if (c === ',' && d === 0) { atEntry = true; continue; }

    if (d === 0 && atEntry && /[A-Za-z_]/.test(c)) {
      const rest = body.slice(i).match(/^([A-Za-z_][\w-]*)\s*:/);
      if (rest) { keys.push(rest[1]); atEntry = false; i += rest[1].length; continue; }
    }
  }

  return { keys, body };
}

/** Registered SPA view keys (public/js/app.js → VIEWS). */
function scanViews() {
  const src = readLines(path.join(ROOT, 'public', 'js', 'app.js')).join('\n');
  const o   = objectFirstLevelKeys(src, 'VIEWS');
  return o ? o.keys : [];
}

module.exports = {
  HTTP_METHODS,
  objectFirstLevelKeys,
  scanViews,
  isNumericParam,
  scanIndex,
  scanRouteFile,
  scanRoutes,
  scanPermissionsMap,
  scanFrontendCalls,
  normalizeCallPath,
  routeShape,
  shapesMatch,
  effectiveKey,
  joinPath,
};
