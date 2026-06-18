// Public landing (/proyectos). No authentication: talks only to /api/v1/public/* (no token).
// Includes a theme (light/dark) and language (es/en) toggle, synced into the embedded login iframe.
(function () {
  "use strict";

  const THEME_KEY = "sgi_theme";
  const LANG_KEY  = "sgi_lang";

  const I18N = {
    es: {
      title: "Conoce el proyecto",
      sub: "Explora los lotes disponibles y contacta a nuestros asesores comerciales.",
      note: "<strong>¿Ya tienes un lote?</strong> Inicia sesión para ver tus cuotas, plan de pagos, facturas y recibos.",
      lots: "Lotes disponibles",
      advisors: "Asesores comerciales",
      emptyLots: "No hay lotes disponibles en este proyecto por ahora.",
      emptyAdvisors: "Pronto publicaremos nuestros asesores comerciales.",
      emptyProjects: "Pronto publicaremos nuestros proyectos.",
      loading: "Cargando…",
      error: "No se pudo cargar la información.",
      inquire: "Consultar",
      advisorName: "Asesor comercial",
      advisorContact: "Contáctanos para más información",
      themeDark: "Oscuro",
      themeLight: "Claro",
    },
    en: {
      title: "Discover the project",
      sub: "Browse the available lots and contact our sales advisors.",
      note: "<strong>Already own a lot?</strong> Sign in to view your installments, payment plan, invoices and receipts.",
      lots: "Available lots",
      advisors: "Sales advisors",
      emptyLots: "No lots available in this project right now.",
      emptyAdvisors: "We'll publish our sales advisors soon.",
      emptyProjects: "We'll publish our projects soon.",
      loading: "Loading…",
      error: "Could not load the information.",
      inquire: "Inquire",
      advisorName: "Sales advisor",
      advisorContact: "Contact us for more information",
      themeDark: "Dark",
      themeLight: "Light",
    },
  };

  const ICON = {
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    sun:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>`,
  };
  const FLAG = {
    es: `<svg class="pv-flag" viewBox="0 0 6 4" preserveAspectRatio="none"><rect width="6" height="4" fill="#AA151B"/><rect y="1" width="6" height="2" fill="#F1BF00"/></svg>`,
    en: `<svg class="pv-flag" viewBox="0 0 60 30" preserveAspectRatio="none"><rect width="60" height="30" fill="#012169"/><path d="M0,0 60,30 M60,0 0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 60,30 M60,0 0,30" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/></svg>`,
  };

  const state = { theme: resolveTheme(), lang: resolveLang() };
  let DATA = { proyectos: [], lotes: [], lotesByProyecto: {}, asesores: [] };
  let selectedIdx = 0;

  const content   = document.getElementById("pv-content");
  const loginFrame = document.getElementById("pv-login");

  const t = (k) => (I18N[state.lang] || I18N.es)[k];

  const fmtM = (n) => n != null && n !== ""
    ? Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    : t("inquire");

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function resolveTheme() {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "light") return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function resolveLang() {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "es";
  }

  function syncIframe() {
    try {
      const w = loginFrame && loginFrame.contentWindow;
      if (w && typeof w.previewApplyTheme === "function") w.previewApplyTheme(state.theme);
      if (w && typeof w.previewApplyLang === "function")  w.previewApplyLang(state.lang);
    } catch (_) { /* cross-origin guard, never happens (same origin) */ }
  }

  function renderControls() {
    const themeBtn = document.getElementById("pv-theme");
    const langBtn  = document.getElementById("pv-lang");
    themeBtn.innerHTML = state.theme === "dark"
      ? `${ICON.sun}<span>${t("themeLight")}</span>`
      : `${ICON.moon}<span>${t("themeDark")}</span>`;
    langBtn.innerHTML = `${FLAG[state.lang]}<span>${state.lang.toUpperCase()}</span>`;
  }

  function applyStatic() {
    document.documentElement.lang = state.lang;
    document.getElementById("pv-title").textContent = t("title");
    document.getElementById("pv-sub").textContent   = t("sub");
    document.getElementById("pv-note").innerHTML     = t("note");
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    renderControls();
    syncIframe();
  }

  function setTheme(next) {
    state.theme = next;
    localStorage.setItem(THEME_KEY, next);
    applyTheme();
  }
  function setLang(next) {
    state.lang = next;
    localStorage.setItem(LANG_KEY, next);
    applyStatic();
    render();
    renderControls();
    syncIframe();
  }

  function advisorCard(a) {
    const nombre   = `${a.nombres || ""} ${a.apellidos || ""}`.trim() || t("advisorName");
    const initials = (nombre.split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase();
    const avatar   = a.photo_url
      ? `<img class="pv-avatar" src="${esc(a.photo_url)}" alt="${esc(nombre)}">`
      : `<div class="pv-avatar">${esc(initials)}</div>`;
    const contacto = [
      a.telefono ? `<a href="tel:${esc(a.telefono)}">${esc(a.telefono)}</a>` : "",
      a.email    ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>`    : "",
    ].filter(Boolean).join("<br>");
    return `
      <div class="pv-advisor">
        ${avatar}
        <div style="min-width:0">
          <div class="pv-advisor-name">${esc(nombre)}</div>
          <div class="pv-advisor-contact">${contacto || esc(t("advisorContact"))}</div>
        </div>
      </div>`;
  }

  function render() {
    const proyectos = DATA.proyectos;
    if (!proyectos.length) {
      content.innerHTML = `<div class="pv-empty">${esc(t("emptyProjects"))}</div>`;
      return;
    }
    if (selectedIdx >= proyectos.length) selectedIdx = 0;

    const proyecto    = proyectos[selectedIdx];
    const disponibles = DATA.lotesByProyecto[proyecto.id_proyecto] || [];

    const chips = proyectos.map((p, i) =>
      `<button class="pv-chip ${i === selectedIdx ? "active" : ""}" data-pidx="${i}">${esc(p.nombre)}</button>`
    ).join("");

    const lotsHtml = disponibles.length
      ? `<div class="pv-lots">${disponibles.map((l) => `
          <div class="pv-lot">
            <div class="pv-lot-code">${esc(l.codigo_lote)}</div>
            <div class="pv-lot-meta">${[
              l.manzana ? "Mz " + esc(l.manzana) : "",
              l.area_m2 ? esc(l.area_m2) + " m²" : "",
              l.dimensiones ? esc(l.dimensiones) : "",
            ].filter(Boolean).join(" · ") || "&nbsp;"}</div>
            <div class="pv-lot-price">${fmtM(l.precio_base)}</div>
          </div>`).join("")}</div>`
      : `<div class="pv-empty">${esc(t("emptyLots"))}</div>`;

    const advisorsHtml = DATA.asesores.length
      ? `<div class="pv-advisors">${DATA.asesores.map(advisorCard).join("")}</div>`
      : `<div class="pv-empty">${esc(t("emptyAdvisors"))}</div>`;

    content.innerHTML = `
      <div class="pv-chips">${chips}</div>
      ${proyecto.descripcion ? `<p class="pv-proj-desc">${esc(proyecto.descripcion)}</p>` : ""}
      ${proyecto.ubicacion ? `<p class="pv-proj-loc">📍 ${esc(proyecto.ubicacion)}</p>` : ""}

      <section class="pv-section">
        <div class="pv-section-head"><h2>${esc(t("lots"))}</h2><span class="pv-count">${disponibles.length}</span></div>
        ${lotsHtml}
      </section>

      <section class="pv-section">
        <div class="pv-section-head"><h2>${esc(t("advisors"))}</h2></div>
        ${advisorsHtml}
      </section>`;

    content.querySelectorAll("[data-pidx]").forEach((btn) => {
      btn.addEventListener("click", () => { selectedIdx = Number(btn.dataset.pidx); render(); });
    });
  }

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(t("error"));
    return res.json();
  }

  async function load() {
    content.innerHTML = `<div class="pv-empty">${esc(t("loading"))}</div>`;
    try {
      const [proyectos, lotes, asesores] = await Promise.all([
        getJSON("/api/v1/public/proyectos"),
        getJSON("/api/v1/public/lotes"),
        getJSON("/api/v1/public/asesores"),
      ]);
      DATA.proyectos = proyectos || [];
      DATA.lotes     = lotes || [];
      DATA.asesores  = asesores || [];
      DATA.lotesByProyecto = {};
      DATA.lotes.forEach((l) => {
        (DATA.lotesByProyecto[l.id_proyecto] = DATA.lotesByProyecto[l.id_proyecto] || []).push(l);
      });
      render();
    } catch (e) {
      content.innerHTML = `<div class="pv-empty" style="color:var(--danger,#dc2626)">${esc(e.message)}</div>`;
    }
  }

  function init() {
    applyTheme();
    applyStatic();
    renderControls();

    document.getElementById("pv-theme").addEventListener("click", () =>
      setTheme(state.theme === "dark" ? "light" : "dark"));
    document.getElementById("pv-lang").addEventListener("click", () =>
      setLang(state.lang === "en" ? "es" : "en"));

    if (loginFrame) loginFrame.addEventListener("load", syncIframe);

    load();
  }

  init();
})();
