'use strict';

/**
 * Dead weight audit: files nobody loads, modules nobody requires, dependencies
 * nobody uses, and lines that should not ship (debug logs, corrupted encoding,
 * commented-out code).
 *
 * Every check reports WHY something is considered dead, so the cleanup can be
 * justified file by file instead of deleted on a hunch.
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, rel, readText, readLines, walk, exists, makeReporter, writeReport } = require('./lib/util');

const SRC    = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');

// Mojibake: UTF-8 bytes that were once decoded as cp1252 and re-encoded.
const MOJIBAKE = /Ã[-¿©¡³­±ºÃ]|â€[-”“˜™¦]|Â[ -¿]|ï¿½/;

const DEBUG_LINE = /\bconsole\.(log|debug|dir|table)\s*\(|\bdebugger\b/;
const TODO_LINE  = /\b(TODO|FIXME|HACK|XXX)\b/;

function sha(content) {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function main() {
  const rep = makeReporter('DC', 'Anexo G · Código, archivos y dependencias sin uso');

  const srcFiles    = walk(SRC, ['.js']);
  const publicJs    = walk(path.join(PUBLIC, 'js'), ['.js']);
  const cssFiles    = walk(path.join(PUBLIC, 'css'), ['.css']);
  const testFiles   = walk(path.join(ROOT, 'tests'), ['.js']);
  const seedFiles   = walk(path.join(ROOT, 'seeds'), ['.js']);
  const auditFiles  = walk(path.join(ROOT, 'tools'), ['.js']);
  const imgFiles    = walk(path.join(PUBLIC, 'src'), ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico']);

  const allCode = [...srcFiles, ...publicJs, ...testFiles, ...seedFiles, ...auditFiles];
  const htmlFiles = walk(PUBLIC, ['.html']).filter(f => !/index\.prod\.html$/.test(f));

  // Concatenated corpus used for reference lookups.
  const corpus = [...allCode, ...htmlFiles, path.join(ROOT, 'build.mjs')]
    .filter(exists)
    .map(f => ({ file: f, text: readText(f) }));
  const corpusText = corpus.map(c => c.text).join('\n');

  // ── 1. Módulos de src/ que nadie requiere ──────────────────────────────────
  const ENTRY = ['src/index.js'];
  for (const abs of srcFiles) {
    const r = rel(abs);
    if (ENTRY.includes(r)) continue;
    const base = path.basename(abs, '.js');
    // A require can be written with or without the .js extension.
    const re = new RegExp(`require\\([^)]*['"\`][^'"\`]*${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.js)?['"\`]`);
    const referenced = corpus.some(c => c.file !== abs && re.test(c.text));
    if (referenced) continue;
    rep.add({
      severity: 'P2',
      category: 'modulo-huerfano',
      summary: `Módulo de backend que nadie requiere: ${r}`,
      where: r,
      detail: 'Ningún archivo del repositorio lo importa (`require`). No se ejecuta nunca.',
      action: 'Eliminarlo, o conectarlo si debía usarse.',
    });
  }

  // ── 2. CSS no importado ────────────────────────────────────────────────────
  const styleCss = path.join(PUBLIC, 'css', 'style.css');
  const styleSrc = exists(styleCss) ? readText(styleCss) : '';
  const htmlSrc  = htmlFiles.map(readText).join('\n');
  const buildSrc = exists(path.join(ROOT, 'build.mjs')) ? readText(path.join(ROOT, 'build.mjs')) : '';

  for (const abs of cssFiles) {
    const r    = rel(abs);
    const name = r.replace(/^public\/css\//, '');
    if (name === 'style.css') continue;
    const referenced = styleSrc.includes(name)
      || htmlSrc.includes(name)
      || buildSrc.includes(name)
      || htmlSrc.includes(r.replace(/^public\//, ''));
    if (referenced) continue;
    rep.add({
      severity: 'P2',
      category: 'css-huerfano',
      summary: `Hoja de estilos que nadie carga: ${r}`,
      where: r,
      detail: 'No aparece en los @import de public/css/style.css, ni en un <link> de los HTML, ni en build.mjs.',
      action: 'Eliminarla o importarla si sus estilos son necesarios.',
    });
  }

  // ── 3. Imágenes sin referencia ─────────────────────────────────────────────
  for (const abs of imgFiles) {
    const r    = rel(abs);
    const name = path.basename(abs);
    if (corpusText.includes(name)) continue;
    rep.add({
      severity: 'P2',
      category: 'asset-huerfano',
      summary: `Imagen sin ninguna referencia: ${r}`,
      where: r,
      detail: 'Su nombre de archivo no aparece en ningún JS, HTML ni CSS del repositorio.',
      action: 'Eliminarla del repositorio si no se usa.',
    });
  }

  // ── 4. Dependencias npm ────────────────────────────────────────────────────
  const pkg  = JSON.parse(readText(path.join(ROOT, 'package.json')));
  const deps = { ...pkg.dependencies };
  const dev  = { ...pkg.devDependencies };

  // A bare specifier only counts as a package when it is a syntactically valid
  // npm name; otherwise prose inside comments ("...apart from 'X'") and quoted
  // URLs get mistaken for dependencies.
  const VALID_PKG = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  // Backticks are excluded from the `from` form: ESM never needs them, and
  // allowing them makes inline prose in comments look like an import.
  const importRe = /(?:require\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[\s;}])from\s+['"]([^'"]+)['"])/gm;
  const usedPkgs = new Set();
  const pkgImporters = new Map();
  // The audit tooling is not part of the product; its own text must not feed
  // the dependency analysis of the application.
  const depCorpus = corpus.filter(c => !/[\\/]tools[\\/]/.test(c.file));
  for (const c of depCorpus) {
    let m;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(c.text))) {
      const spec = m[1] || m[2];
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || /[\s:]/.test(spec)) continue;
      const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!VALID_PKG.test(root)) continue;
      usedPkgs.add(root);
      if (!pkgImporters.has(root)) pkgImporters.set(root, []);
      if (!pkgImporters.get(root).includes(rel(c.file))) pkgImporters.get(root).push(rel(c.file));
    }
  }

  for (const [name] of Object.entries(deps)) {
    if (usedPkgs.has(name)) continue;
    rep.add({
      severity: 'P2',
      category: 'dependencia-sin-uso',
      summary: `Dependencia de producción que el código no importa: ${name}`,
      where: 'package.json',
      detail: 'No aparece en ningún require/import del repositorio. Aumenta el tamaño del despliegue y la superficie de vulnerabilidades.',
      action: 'Verificar que no se use de forma indirecta y desinstalarla (`npm rm ' + name + '`).',
    });
  }
  for (const [name] of Object.entries(dev)) {
    if (usedPkgs.has(name)) continue;
    // Tooling invoked only from npm scripts is legitimately absent from imports.
    if (Object.values(pkg.scripts || {}).some(s => s.includes(name))) continue;
    rep.add({
      severity: 'INFO',
      category: 'dependencia-sin-uso',
      summary: `Dependencia de desarrollo sin importaciones ni uso en scripts: ${name}`,
      where: 'package.json',
      detail: 'Puede ser una herramienta usada manualmente.',
      action: 'Confirmar y desinstalar si sobra.',
    });
  }

  const declared = new Set([...Object.keys(deps), ...Object.keys(dev)]);
  const BUILTIN = new Set(['fs', 'path', 'crypto', 'http', 'https', 'os', 'url', 'util', 'stream', 'events', 'child_process', 'zlib', 'buffer', 'assert', 'net', 'tls', 'dns', 'readline', 'worker_threads', 'perf_hooks', 'timers', 'querystring', 'string_decoder', 'tty', 'v8', 'vm', 'process']);
  for (const used of usedPkgs) {
    if (declared.has(used) || BUILTIN.has(used) || used.startsWith('node:')) continue;
    const importers  = pkgImporters.get(used) || [];
    const inRuntime  = importers.some(f => f.startsWith('src/'));
    rep.add({
      severity: inRuntime ? 'P0' : 'P1',
      category: 'dependencia-no-declarada',
      summary: `Paquete importado pero no declarado en package.json: ${used}`,
      where: ['package.json', ...importers],
      detail: `Importado desde ${importers.join(', ')}. Hoy resuelve por una dependencia transitiva; tras un \`npm ci\` limpio (o cuando esa transitiva cambie de versión) ${inRuntime ? 'la aplicación no arranca' : 'la herramienta deja de funcionar'}.`,
      action: `Declararlo explícitamente (\`npm i ${inRuntime ? '' : '-D '}${used}\`).`,
    });
  }

  // ── 5. Líneas que no deberían ir a producción ──────────────────────────────
  const debugByFile = new Map();
  const todos = [];
  const mojibake = [];

  for (const abs of [...srcFiles, ...publicJs]) {
    const r = rel(abs);
    readLines(abs).forEach((line, i) => {
      const at = `${r}:${i + 1}`;
      if (DEBUG_LINE.test(line) && !/^\s*\/\//.test(line)) {
        if (!debugByFile.has(r)) debugByFile.set(r, []);
        debugByFile.get(r).push(i + 1);
      }
      if (TODO_LINE.test(line)) todos.push({ at, text: line.trim().slice(0, 120) });
      if (MOJIBAKE.test(line)) mojibake.push({ at, text: line.trim().slice(0, 120) });
    });
  }

  for (const [file, lines] of debugByFile) {
    // console.error/warn are legitimate logging; only chatty debug output counts.
    rep.add({
      severity: 'P2',
      category: 'log-de-depuracion',
      summary: `${lines.length} console.log/debugger en ${file}`,
      where: `${file}:${lines.slice(0, 8).join(',')}${lines.length > 8 ? ',…' : ''}`,
      detail: 'Salida de depuración que llega a producción (ruido en logs del servidor o en la consola del navegador del usuario).',
      action: 'Eliminar, o degradar a console.error/warn si es diagnóstico real.',
    });
  }

  for (const m of mojibake) {
    rep.add({
      severity: 'P2',
      category: 'encoding-corrupto',
      summary: `Texto con codificación corrupta (mojibake): ${m.at}`,
      where: m.at,
      detail: `\`${m.text}\` — bytes UTF-8 que fueron decodificados como cp1252 y vueltos a guardar. Si el texto llega a la UI, el usuario ve caracteres basura.`,
      action: 'Reescribir la línea con los caracteres correctos y guardar en UTF-8.',
    });
  }

  if (todos.length) {
    rep.add({
      severity: 'INFO',
      category: 'pendientes',
      summary: `${todos.length} marcas TODO/FIXME/HACK en el código`,
      where: todos.slice(0, 10).map(t => t.at),
      detail: todos.slice(0, 10).map(t => `${t.at}: ${t.text}`).join(' · '),
      action: 'Resolver o convertir en tickets antes de la entrega.',
    });
  }

  // ── 6. Archivos duplicados ─────────────────────────────────────────────────
  const byHash = new Map();
  for (const abs of [...srcFiles, ...publicJs, ...cssFiles]) {
    const h = sha(readText(abs));
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(rel(abs));
  }
  for (const [, files] of byHash) {
    if (files.length < 2) continue;
    rep.add({
      severity: 'P2',
      category: 'archivo-duplicado',
      summary: `Archivos con contenido idéntico: ${files.join(' ≡ ')}`,
      where: files,
      detail: 'Mismo contenido byte a byte. Mantener dos copias garantiza que se desincronicen.',
      action: 'Conservar uno y referenciarlo desde el otro punto de uso.',
    });
  }

  // ── 7. Scripts operativos ad-hoc en seeds/ ─────────────────────────────────
  const adHoc = seedFiles.map(rel).filter(f => /\/(diag|fix|gen|cleanup|reset|check|backfill)[-_]/i.test(f));
  if (adHoc.length) {
    rep.add({
      severity: 'P2',
      category: 'script-ad-hoc',
      summary: `${adHoc.length} scripts de mantenimiento puntual en seeds/`,
      where: adHoc,
      detail: 'Utilidades de diagnóstico/corrección contra datos de desarrollo. No forman parte del producto y ejecutarlas contra producción es peligroso.',
      action: 'Mover a `tools/dev/` (fuera del runner de seeds) o eliminar antes de la entrega.',
    });
  }

  // ── 8. Archivos vacíos o casi vacíos ───────────────────────────────────────
  for (const abs of [...srcFiles, ...publicJs, ...cssFiles]) {
    const body = readText(abs).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').trim();
    if (body.length > 20) continue;
    rep.add({
      severity: 'P2',
      category: 'archivo-vacio',
      summary: `Archivo sin contenido efectivo: ${rel(abs)}`,
      where: rel(abs),
      detail: `Sólo ${body.length} caracteres de código tras quitar comentarios.`,
      action: 'Eliminarlo.',
    });
  }

  // ── 9. Higiene de entorno y repositorio ────────────────────────────────────
  if (!exists(path.join(ROOT, '.env.example'))) {
    rep.add({
      severity: 'P1',
      category: 'entrega-incompleta',
      summary: 'No existe .env.example',
      where: '.',
      detail: 'Quien reciba el proyecto no tiene forma de saber qué variables de entorno hacen falta para arrancarlo. `src/config/*` lanza excepción si faltan.',
      action: 'Crear .env.example con todas las claves requeridas y sin valores reales.',
    });
  }
  if (!exists(path.join(ROOT, 'README.md'))) {
    rep.add({
      severity: 'P1',
      category: 'entrega-incompleta',
      summary: 'No existe README.md',
      where: '.',
      detail: 'Falta el punto de entrada de la documentación (requisitos, arranque, scripts, despliegue).',
      action: 'Crear README.md.',
    });
  }

  return writeReport('06-dead-code', rep, {
    stats: {
      src_files: srcFiles.length,
      public_js_files: publicJs.length,
      css_files: cssFiles.length,
      img_files: imgFiles.length,
      deps: Object.keys(deps).length,
      dev_deps: Object.keys(dev).length,
      debug_lines: [...debugByFile.values()].reduce((a, b) => a + b.length, 0),
      mojibake_lines: mojibake.length,
      todos: todos.length,
    },
  });
}

if (require.main === module) main();
module.exports = main;
