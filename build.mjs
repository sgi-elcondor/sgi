// Production build for the SPA frontend.
//
// Strategy (keeps the vanilla, global-scope architecture intact):
//  - Classic scripts (the ~40 non-module files) are concatenated literally and minified WITHOUT
//    bundling, so their shared global scope behaves exactly like separate <script> tags today.
//  - The ES modules (app.js, which imports auth.js) are bundled together.
//  - CSS is bundled by resolving style.css @imports + comprador.css + responsive.css (last).
//  - A hashed index.prod.html is generated from index.html by swapping the <!-- build:* --> blocks.
//
// Dev is untouched: index.html still loads the loose sources, so livereload needs no build step.
// The server only serves index.prod.html when NODE_ENV=production.

import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const PUBLIC = "public";
const DIST   = path.join(PUBLIC, "dist");

// Must match the load order of the classic <script defer> tags in index.html.
const CLASSIC = [
  "js/api.js",
  "js/ui.js",
  "js/components/money-input.js",
  "js/helpers.js",
  "js/state.js",
  "js/views/dashboard.js",
  "js/views/operacion/el-proyecto.js",
  "js/views/operacion/proyectos.js",
  "js/views/operacion/lotes.js",
  "js/views/operacion/compradores.js",
  "js/views/operacion/ventas.js",
  "js/views/operacion/recepciones.js",
  "js/views/operacion/requerimientos.js",
  "js/views/finanzas/cuotas.js",
  "js/views/finanzas/pagos.js",
  "js/views/finanzas/comisionistas.js",
  "js/views/finanzas/facturas.js",
  "js/views/finanzas/recibos.js",
  "js/views/finanzas/gastos.js",
  "js/views/finanzas/transacciones.js",
  "js/views/finanzas/validacion-pagos.js",
  "js/views/control/reportes.js",
  "js/views/control/auditoria.js",
  "js/views/control/personal.js",
  "js/views/control/usuarios.js",
  "js/views/control/permisos.js",
  "js/views/juridico/juridico.js",
  "js/views/mi-cuenta/mis-cuotas.js",
  "js/views/mi-cuenta/mis-facturas.js",
  "js/views/mi-cuenta/mis-recibos.js",
  "js/lib-loader.js",
  "js/components/avatar-cropper.js",
  "js/components/sgi-select.js",
  "js/lib/qrcode.min.js",
  "js/components/export-styles.js",
  "js/components/brand-assets.js",
  "js/components/responsive-tables.js",
  "js/components/sidebar.js",
  "js/components/user-menu.js",
  "js/components/onboarding.js",
  "js/components/role-switcher.js",
];

const ASSET_EXTERNALS = ["*.png", "*.jpg", "*.jpeg", "*.svg", "*.gif", "*.webp",
                         "*.woff", "*.woff2", "*.ttf", "*.eot"];

const hash8 = (buf) => createHash("sha1").update(buf).digest("hex").slice(0, 8);
const kb    = (buf) => (buf.length / 1024).toFixed(1);

async function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  // 1. Classic scripts: literal concat + minify (bundle:false preserves global scope).
  const concat = CLASSIC
    .map((f) => `/* ${f} */\n` + readFileSync(path.join(PUBLIC, f), "utf8"))
    .join("\n;\n");
  await esbuild.build({
    stdin: { contents: concat, loader: "js", resolveDir: PUBLIC },
    outfile: path.join(DIST, "sgi.min.js"),
    bundle: false, minify: true, legalComments: "none", charset: "utf8",
  });

  // 2. ES modules: bundle app.js (it imports auth.js).
  await esbuild.build({
    entryPoints: [path.join(PUBLIC, "js/app.js")],
    outfile: path.join(DIST, "app.min.js"),
    bundle: true, format: "esm", minify: true, legalComments: "none", charset: "utf8",
  });

  // 3. CSS: resolve @imports, append comprador + responsive (responsive must stay last).
  await esbuild.build({
    stdin: {
      contents:
        '@import "css/style.css";\n' +
        '@import "css/views/comprador.css";\n' +
        '@import "css/responsive.css";\n',
      loader: "css", resolveDir: PUBLIC,
    },
    outfile: path.join(DIST, "sgi.min.css"),
    bundle: true, minify: true, legalComments: "none", charset: "utf8",
    external: ASSET_EXTERNALS,
  });

  // Content hashes for cache-busting (paired with immutable Cache-Control on /dist).
  const jsBuf  = readFileSync(path.join(DIST, "sgi.min.js"));
  const modBuf = readFileSync(path.join(DIST, "app.min.js"));
  const cssBuf = readFileSync(path.join(DIST, "sgi.min.css"));
  const vJs  = hash8(jsBuf);
  const vMod = hash8(modBuf);
  const vCss = hash8(cssBuf);

  // 4. Generate index.prod.html from index.html by replacing the build markers.
  let html = readFileSync(path.join(PUBLIC, "index.html"), "utf8");
  const replaceBlock = (name, content) => {
    const re = new RegExp(`<!-- build:${name} -->[\\s\\S]*?<!-- /build:${name} -->`);
    if (!re.test(html)) throw new Error(`Marcador <!-- build:${name} --> no encontrado en index.html`);
    html = html.replace(re, content);
  };
  replaceBlock("css",    `<link rel="stylesheet" href="/dist/sgi.min.css?v=${vCss}" />`);
  replaceBlock("auth",   "");                                            // auth.js goes into the module bundle
  replaceBlock("js",     `<script defer src="/dist/sgi.min.js?v=${vJs}"></script>`);
  replaceBlock("js2",    "");                                            // folded into sgi.min.js
  replaceBlock("module", `<script type="module" src="/dist/app.min.js?v=${vMod}"></script>`);
  writeFileSync(path.join(PUBLIC, "index.prod.html"), html);

  console.log("Build OK");
  console.log(`  dist/sgi.min.js   ${kb(jsBuf)} KB  v${vJs}`);
  console.log(`  dist/app.min.js   ${kb(modBuf)} KB  v${vMod}`);
  console.log(`  dist/sgi.min.css  ${kb(cssBuf)} KB  v${vCss}`);
  console.log("  public/index.prod.html generated");
}

const watch = process.argv.includes("--watch");
if (watch) {
  await build();
  // Lightweight watch: rebuild on any change under public/js or public/css.
  const { watch: fsWatch } = await import("node:fs");
  let timer = null;
  for (const dir of ["public/js", "public/css", "public/index.html"]) {
    fsWatch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => build().catch(console.error), 150);
    });
  }
  console.log("Watching public/js and public/css for changes...");
} else {
  build().catch((e) => { console.error(e); process.exit(1); });
}
