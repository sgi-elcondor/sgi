// Lazy loader for heavy third-party libraries (chart.js, jspdf + autotable, exceljs, cropperjs).
// These are no longer eager <script> tags in index.html: each is fetched the first time a chart,
// an export or the avatar cropper is actually used, so they stay out of the critical path.
// Every loader is idempotent — the underlying request is made at most once and shared.
(function () {
  "use strict";

  const CDN = {
    chart:        "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
    exceljs:      "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
    jspdf:        "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    jspdfAuto:    "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
    cropperCss:   "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css",
    cropperJs:    "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js",
  };

  const _scripts = {};
  const _styles  = {};

  function loadScript(src) {
    if (_scripts[src]) return _scripts[src];
    _scripts[src] = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src     = src;
      el.async   = false;
      el.onload  = resolve;
      el.onerror = () => reject(new Error("No se pudo cargar el recurso: " + src));
      document.head.appendChild(el);
    });
    return _scripts[src];
  }

  function loadStyle(href) {
    if (_styles[href]) return _styles[href];
    _styles[href] = new Promise((resolve, reject) => {
      const el = document.createElement("link");
      el.rel     = "stylesheet";
      el.href    = href;
      el.onload  = resolve;
      el.onerror = () => reject(new Error("No se pudo cargar el estilo: " + href));
      document.head.appendChild(el);
    });
    return _styles[href];
  }

  let _charts, _export, _cropper;

  // Chart.js — exposes window.Chart.
  function ensureCharts() {
    if (!_charts) _charts = loadScript(CDN.chart);
    return _charts;
  }

  // jsPDF (+ autoTable plugin) and ExcelJS — exposes window.jspdf / window.jsPDF and window.ExcelJS.
  // autoTable must load after jspdf because it augments the jsPDF prototype.
  function ensureExport() {
    if (!_export) {
      _export = loadScript(CDN.jspdf)
        .then(() => Promise.all([loadScript(CDN.jspdfAuto), loadScript(CDN.exceljs)]));
    }
    return _export;
  }

  // CropperJS — exposes window.Cropper (plus its stylesheet).
  function ensureCropper() {
    if (!_cropper) _cropper = Promise.all([loadStyle(CDN.cropperCss), loadScript(CDN.cropperJs)]);
    return _cropper;
  }

  window.SGILibs = { ensureCharts, ensureExport, ensureCropper };
})();
