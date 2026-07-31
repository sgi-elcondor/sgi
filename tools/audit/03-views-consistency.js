'use strict';

/**
 * Cross-check of every registry a view must appear in to work end to end:
 *
 *   VIEWS (app.js) ─ TOPBAR_SUBTITLES ─ SIDEBAR_GROUPS ─ VISTA_API_MAP
 *        └─ global *View() function ─ CLASSIC (build.mjs) ─ index.html
 *
 * A view missing from any one of them is broken in a specific, silent way:
 * blank topbar, invisible in the menu, impossible to grant from Permisos, or
 * working in dev and dead in production.
 */

const path = require('path');
const { ROOT, rel, readText, readLines, walk, exists, makeReporter, writeReport } = require('./lib/util');
const { scanPermissionsMap, objectFirstLevelKeys } = require('./lib/scan');

const objectKeys = objectFirstLevelKeys;

function main() {
  const rep = makeReporter('VW', 'Anexo C · Consistencia de vistas (registro, navegación, permisos, build)');

  const appJs      = path.join(ROOT, 'public', 'js', 'app.js');
  const sidebarJs  = path.join(ROOT, 'public', 'js', 'components', 'sidebar.js');
  const rolesCtrl  = path.join(ROOT, 'src', 'controllers', 'roles.controller.js');
  const buildMjs   = path.join(ROOT, 'build.mjs');
  const indexHtml  = path.join(ROOT, 'public', 'index.html');
  const prodHtml   = path.join(ROOT, 'public', 'index.prod.html');

  const appSrc   = readText(appJs);
  const viewsObj = objectKeys(appSrc, 'VIEWS');
  const subsObj  = objectKeys(appSrc, 'TOPBAR_SUBTITLES');

  if (!viewsObj || !subsObj) {
    rep.add({
      severity: 'P0',
      category: 'cobertura-auditoria',
      summary: 'No se pudo parsear VIEWS o TOPBAR_SUBTITLES en app.js',
      where: rel(appJs),
      detail: 'El auditor no puede validar el registro de vistas; revisar manualmente.',
      action: 'Revisar la forma del objeto o ajustar el parser.',
    });
    return writeReport('03-views-consistency', rep);
  }

  const views = viewsObj.keys;
  const subs  = subsObj.keys;

  // fn name per view
  const viewFns = new Map();
  const fnRe = /['"]?([a-zA-Z_][\w-]*)['"]?\s*:\s*\{\s*fn:\s*["']([\w]+)["']/g;
  let fm;
  while ((fm = fnRe.exec(viewsObj.body))) viewFns.set(fm[1], fm[2]);

  // Sidebar entries
  const sidebarSrc  = readText(sidebarJs);
  const sidebarViews = [...sidebarSrc.matchAll(/\{\s*view:\s*["']([\w-]+)["']/g)].map(m => m[1]);

  // VISTA_API_MAP
  const rolesSrc = readText(rolesCtrl);
  const vistaMap = new Map();
  const vmBody   = objectKeys(rolesSrc, 'VISTA_API_MAP');
  if (vmBody) {
    const vmRe = /['"]([\w-]+)['"]\s*:\s*\[([^\]]*)\]/g;
    let v;
    while ((v = vmRe.exec(vmBody.body))) {
      vistaMap.set(v[1], [...v[2].matchAll(/['"]([\w-]+:[\w-]+)['"]/g)].map(x => x[1]));
    }
  }

  // Global *View functions actually defined in public/js
  const definedFns = new Map();
  for (const abs of walk(path.join(ROOT, 'public', 'js'), ['.js'])) {
    const lines = readLines(abs);
    lines.forEach((line, i) => {
      const m = line.match(/^\s*(?:async\s+)?function\s+(\w*View)\s*\(/)
        || line.match(/^\s*window\.(\w*View)\s*=/)
        || line.match(/^\s*(?:const|let|var)\s+(\w*View)\s*=\s*(?:async\s*)?(?:function|\()/);
      if (m) definedFns.set(m[1], `${rel(abs)}:${i + 1}`);
    });
  }

  // CLASSIC list + index.html scripts
  const classic = [...readText(buildMjs).matchAll(/^\s*["']((?:js|css)\/[^"']+)["']/gm)].map(m => m[1]);
  const htmlScripts = [...readText(indexHtml).matchAll(/<script[^>]*src=["']([^"']+)["']/g)].map(m => m[1].replace(/^\//, ''));
  const htmlModules = [...readText(indexHtml).matchAll(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/g)].map(m => m[1].replace(/^\//, ''));

  const permCatalog = new Set(scanPermissionsMap().entries.map(e => e.permiso));

  // ── 1. VIEWS ↔ TOPBAR_SUBTITLES ────────────────────────────────────────────
  for (const v of views) {
    if (!subs.includes(v)) {
      rep.add({
        severity: 'P2',
        category: 'vista-incompleta',
        summary: `Vista sin subtítulo en TOPBAR_SUBTITLES: ${v}`,
        where: rel(appJs),
        detail: 'La topbar queda sin subtítulo al entrar a la vista.',
        action: `Añadir \`${v}: "..."\` a TOPBAR_SUBTITLES.`,
      });
    }
  }
  for (const s of subs) {
    if (!views.includes(s)) {
      rep.add({
        severity: 'P2',
        category: 'config-muerta',
        summary: `Subtítulo de una vista que no existe en VIEWS: ${s}`,
        where: rel(appJs),
        detail: 'Entrada residual en TOPBAR_SUBTITLES.',
        action: 'Eliminar la entrada.',
      });
    }
  }

  // ── 2. VIEWS → función global ──────────────────────────────────────────────
  for (const v of views) {
    const fn = viewFns.get(v);
    if (!fn) {
      rep.add({
        severity: 'P1',
        category: 'vista-incompleta',
        summary: `Vista sin función declarada (\`fn\`) en VIEWS: ${v}`,
        where: rel(appJs),
        detail: 'No se pudo determinar la función que renderiza la vista.',
        action: 'Revisar la entrada de VIEWS.',
      });
      continue;
    }
    if (!definedFns.has(fn)) {
      rep.add({
        severity: 'P0',
        category: 'vista-rota',
        summary: `Vista apunta a una función inexistente: ${v} → ${fn}()`,
        where: rel(appJs),
        detail: `Ningún archivo de public/js define \`${fn}\`. Navegar a \`#${v}\` lanza un error y la vista no carga.`,
        action: 'Implementar la función o corregir el nombre en VIEWS.',
      });
    }
  }

  // ── 3. Funciones *View sin ninguna referencia (código realmente muerto) ────
  // Un `*View` no registrado puede ser un helper interno perfectamente vivo, así
  // que el criterio de muerte es "nadie la referencia en todo el frontend".
  const registeredFns = new Set(viewFns.values());
  const allFrontendSrc = walk(path.join(ROOT, 'public'), ['.js', '.html'])
    .filter(f => !/[\\/]dist[\\/]|[\\/]lib[\\/]/.test(f))
    .map(readText)
    .join('\n');

  for (const [fn, at] of definedFns) {
    if (registeredFns.has(fn)) continue;
    const refs = (allFrontendSrc.match(new RegExp(`\\b${fn}\\b`, 'g')) || []).length;
    if (refs > 1) continue; // definición + al menos un uso
    rep.add({
      severity: 'P2',
      category: 'codigo-muerto',
      summary: `Función sin ninguna referencia en el frontend: ${fn}()`,
      where: at,
      detail: 'No está registrada en VIEWS y no aparece invocada en ningún archivo de public/ (única aparición: su propia definición).',
      action: 'Eliminar la función, o registrarla si debía ser alcanzable.',
    });
  }

  // ── 4. Navegación: sidebar ↔ VIEWS ─────────────────────────────────────────
  for (const sv of new Set(sidebarViews)) {
    if (!views.includes(sv)) {
      rep.add({
        severity: 'P0',
        category: 'vista-rota',
        summary: `Ítem del sidebar apunta a una vista inexistente: ${sv}`,
        where: rel(sidebarJs),
        detail: 'Al hacer clic, el router no encuentra la vista.',
        action: 'Registrar la vista o quitar el ítem del sidebar.',
      });
    }
  }
  for (const v of views) {
    if (!sidebarViews.includes(v)) {
      rep.add({
        severity: 'INFO',
        category: 'navegacion',
        summary: `Vista sin ítem en el sidebar (sólo alcanzable por hash): ${v}`,
        where: rel(sidebarJs),
        detail: 'Puede ser intencional (vista de detalle o de auto-servicio abierta desde otra vista).',
        action: 'Confirmar que exista otra vía de acceso.',
      });
    }
  }

  // ── 5. Permisos por vista (VISTA_API_MAP) ──────────────────────────────────
  for (const v of views) {
    if (!vistaMap.has(v)) {
      rep.add({
        severity: 'P1',
        category: 'permisos-ui',
        summary: `Vista ausente de VISTA_API_MAP: ${v}`,
        where: rel(rolesCtrl),
        detail: 'Un admin no puede otorgar esta vista a un rol desde la pantalla Permisos: al activarla no se asignaría ningún permiso de API.',
        action: `Añadir \`'${v}': [...permisos]\` a VISTA_API_MAP.`,
      });
    }
  }
  for (const [v, perms] of vistaMap) {
    if (!views.includes(v)) {
      rep.add({
        severity: 'P2',
        category: 'config-muerta',
        summary: `VISTA_API_MAP declara una vista que no existe: ${v}`,
        where: rel(rolesCtrl),
        detail: 'Entrada residual.',
        action: 'Eliminar la entrada.',
      });
    }
    for (const p of perms) {
      if (permCatalog.has(p)) continue;
      rep.add({
        severity: 'INFO',
        category: 'permisos-ui',
        summary: `Permiso de VISTA_API_MAP que ninguna ruta exige: ${p} (vista ${v})`,
        where: rel(rolesCtrl),
        detail: 'No aparece como requisito de ninguna entrada de ROUTE_PERMISSIONS. Puede existir sólo para gating de UI, o ser un permiso obsoleto. Se confirma contra la tabla `permisos` en el anexo de drift de permisos.',
        action: 'Confirmar contra BD; si no existe, eliminarlo del mapa.',
      });
    }
  }

  // ── 6. Build: producción vs desarrollo ─────────────────────────────────────
  const viewFiles = walk(path.join(ROOT, 'public', 'js', 'views'), ['.js']).map(f => rel(f).replace(/^public\//, ''));
  const componentFiles = walk(path.join(ROOT, 'public', 'js', 'components'), ['.js']).map(f => rel(f).replace(/^public\//, ''));

  for (const f of [...viewFiles, ...componentFiles]) {
    const inClassic = classic.includes(f);
    const inHtml    = htmlScripts.includes(f);
    const isModule  = htmlModules.includes(f);
    if (isModule) continue;

    if (!inClassic && !inHtml) {
      rep.add({
        severity: 'P2',
        category: 'codigo-muerto',
        summary: `Archivo JS no cargado por index.html ni por el build: ${f}`,
        where: `public/${f}`,
        detail: 'No aparece en CLASSIC (build.mjs) ni en un <script> de index.html; no llega al navegador.',
        action: 'Eliminarlo o registrarlo si debía cargarse.',
      });
    } else if (inHtml && !inClassic) {
      rep.add({
        severity: 'P0',
        category: 'build-desincronizado',
        summary: `Script cargado en dev pero ausente del bundle de producción: ${f}`,
        where: [rel(indexHtml), rel(buildMjs)],
        detail: 'Está en un <script> de index.html pero no en la lista CLASSIC de build.mjs: funciona con `npm run dev` y falla en producción.',
        action: `Añadir "${f}" a CLASSIC en build.mjs.`,
      });
    } else if (inClassic && !inHtml) {
      rep.add({
        severity: 'P1',
        category: 'build-desincronizado',
        summary: `Script en el bundle de producción pero ausente de index.html: ${f}`,
        where: [rel(buildMjs), rel(indexHtml)],
        detail: 'Se empaqueta para producción pero no se carga en desarrollo: el comportamiento difiere entre entornos.',
        action: 'Añadir el <script defer> a index.html entre los marcadores build:js.',
      });
    }
  }

  for (const c of classic) {
    if (!exists(path.join(ROOT, 'public', c))) {
      rep.add({
        severity: 'P0',
        category: 'build-roto',
        summary: `CLASSIC referencia un archivo inexistente: ${c}`,
        where: rel(buildMjs),
        detail: '`npm run build` falla o produce un bundle incompleto.',
        action: 'Corregir la ruta o eliminar la entrada.',
      });
    }
  }

  if (!exists(prodHtml)) {
    rep.add({
      severity: 'P1',
      category: 'build-desincronizado',
      summary: 'No existe public/index.prod.html',
      where: 'public/',
      detail: 'En producción el servidor cae al index de desarrollo (scripts sueltos, sin hash ni cache immutable).',
      action: 'Ejecutar `npm run build` antes de desplegar y versionar el resultado según convenga.',
    });
  }

  return writeReport('03-views-consistency', rep, {
    stats: {
      views: views.length,
      sidebar_items: new Set(sidebarViews).size,
      vista_api_map: vistaMap.size,
      classic_entries: classic.length,
      html_scripts: htmlScripts.length,
      view_fns_defined: definedFns.size,
    },
    views,
  });
}

if (require.main === module) main();
module.exports = main;
