'use strict';

/**
 * Controller introspection: resolve a route handler to its function body so the
 * audit can tell "unauthorized" apart from "authorized inside the controller".
 *
 * Brace matching skips strings, template literals and comments; anything that
 * cannot be resolved is reported as unresolved rather than assumed safe.
 */

const path = require('path');
const { ROOT, rel, readText, exists } = require('./util');

const FN_DECL = [
  // exports.foo = async (req, res) => {   |   exports.foo = async function (req, res) {
  /^\s*exports\.(\w+)\s*=\s*(?:async\s+)?(?:function\s*\w*\s*)?\(/,
  // const foo = async (req, res) => {
  /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function\s*\w*\s*)?\(/,
  // async function foo(req, res) {
  /^\s*(?:async\s+)?function\s+(\w+)\s*\(/,
];

/** Extracts every top-level-ish function body keyed by name. */
function scanController(abs) {
  const src   = readText(abs);
  const lines = src.split(/\r?\n/);
  const fns   = new Map();

  lines.forEach((line, i) => {
    for (const re of FN_DECL) {
      const m = line.match(re);
      if (!m) continue;
      const name  = m[1];
      const start = offsetOf(lines, i);
      const open  = src.indexOf('{', start);
      if (open === -1) return;
      const end = matchBrace(src, open);
      if (end === -1) return;
      if (!fns.has(name)) {
        fns.set(name, { name, line: i + 1, body: src.slice(open, end + 1), file: rel(abs) });
      }
      return;
    }
  });

  return fns;
}

function offsetOf(lines, index) {
  let n = 0;
  for (let i = 0; i < index; i += 1) n += lines[i].length + 1;
  return n;
}

/** Returns the index of the `}` matching the `{` at `open`, or -1. */
function matchBrace(src, open) {
  let depth = 0;
  let i = open;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];

    if (c === '/' && n === '/') { i = skipTo(src, i, '\n'); continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') { i = skipString(src, i, c); continue; }

    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return i; }
    i += 1;
  }
  return -1;
}

function skipTo(src, i, ch) {
  const e = src.indexOf(ch, i);
  return e === -1 ? src.length : e + 1;
}

function skipString(src, i, quote) {
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === quote) return j + 1;
    j += 1;
  }
  return src.length;
}

// ── authorization patterns performed inside controllers ───────────────────────

const AUTHZ_PATTERNS = [
  { re: /_puede\w*\s*\(/,                        label: 'helper _puede*()' },
  { re: /req\.usuario\??\.?\.?rol\b/,            label: 'chequeo de req.usuario.rol' },
  { re: /permisos\s*\??\.\s*has\s*\(/,           label: 'permisos.has()' },
  { re: /ROLES?_[A-Z_]+\s*\.includes/,           label: 'lista de roles hardcodeada' },
  { re: /id_solicitante\s*!==\s*req\.usuario/,   label: 'ownership por id_solicitante' },
  { re: /id_usuario\s*[:=]{1,3}\s*req\.usuario/, label: 'scoping por req.usuario.id_usuario' },
];

function authzInBody(body) {
  const hits = [];
  for (const p of AUTHZ_PATTERNS) if (p.re.test(body)) hits.push(p.label);
  return hits;
}

/** 403-returning statements are the strongest signal of an in-controller gate. */
function returns403(body) {
  return /status\(\s*403\s*\)/.test(body);
}

const cache = new Map();

function controllerFns(relPath) {
  if (cache.has(relPath)) return cache.get(relPath);
  const abs = path.join(ROOT, relPath);
  const fns = exists(abs) ? scanController(abs) : new Map();
  cache.set(relPath, fns);
  return fns;
}

/**
 * Resolves the handler of a route (as declared in the routes file) to
 * { file, name, authz[], has403 } or { unresolved: reason }.
 */
function resolveHandler(route, routeFileRequires) {
  const rest = route.handlers || '';
  // Prefer the LAST identifier before the closing paren: middlewares come first.
  const dotted = [...rest.matchAll(/\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\b/g)]
    .filter(m => !/^(res|req|next|console|JSON|Object|Array|process)$/.test(m[1]))
    .filter(m => !/^(single|array|fields|none|any)$/.test(m[2]));
  const bare = [...rest.matchAll(/[,(]\s*([A-Za-z_$][\w$]*)\s*\)/g)];

  let file = null;
  let name = null;

  if (dotted.length) {
    const last  = dotted[dotted.length - 1];
    const alias = last[1];
    name = last[2];
    file = routeFileRequires.aliases[alias] || null;
  } else if (bare.length) {
    name = bare[bare.length - 1][1];
    file = routeFileRequires.named[name] || null;
  }

  if (!file || !name) return { unresolved: `handler no resuelto en \`${rest.slice(0, 80)}\`` };

  const fns = controllerFns(file);
  const fn  = fns.get(name);
  if (!fn) return { unresolved: `función \`${name}\` no encontrada en ${file}` };

  return {
    file,
    name,
    line: fn.line,
    authz: authzInBody(fn.body),
    has403: returns403(fn.body),
  };
}

module.exports = { scanController, authzInBody, returns403, resolveHandler, controllerFns };
