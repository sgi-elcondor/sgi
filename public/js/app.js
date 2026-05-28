import { esperarAuthListo } from "./auth.js";

const VIEWS = {
  dashboard:           { fn: "dashboardView",        title: "Panel de control" },  
  proyectos:           { fn: "proyectosView",         title: "Proyectos" },
  lotes:               { fn: "lotesView",             title: "Lotes" },
  compradores:         { fn: "compradoresView",       title: "Compradores" },
  ventas:              { fn: "ventasView",            title: "Ventas" },
  cuotas:              { fn: "cuotasView",            title: "Cuotas" },
  pagos:               { fn: "pagosView",             title: "Pagos" },
  comisionistas:       { fn: "comisionistasView",     title: "Comisionistas" },
  facturas:            { fn: "facturasView",          title: "Facturas" },
  recibos:             { fn: "recibosView",           title: "Recibos" },
  reportes:            { fn: "reportesView",          title: "Reportes" },
  auditoria:           { fn: "auditoriaView",         title: "Auditoria" },
  juridico:            { fn: "juridicoView",          title: "Seguimiento Juridico" },
  personal:            { fn: "personalView",          title: "Personal" },
  usuarios:            { fn: "usuariosView",          title: "Gestion de Usuarios" },
  roles:               { fn: "rolesView",             title: "Permisos" },
  "el-proyecto":       { fn: "elProyectoView",          title: "El Proyecto" },
  "mis-cuotas":        { fn: "compradorCuotasView",   title: "Mis Cuotas" },
  "mis-facturas":      { fn: "misFacturasView",        title: "Mis Facturas" },
  "mis-recibos":       { fn: "compradorRecibosView",  title: "Mis Pagos" },
  "bank-transactions": { fn: "bankTransactionsView",  title: "Transacciones Bancarias" },
  "payment-validation":{ fn: "paymentValidationView", title: "Validacion de Pagos" },
  gastos:              { fn: "gastosView",             title: "Gastos Operativos" },
};

const TOPBAR_SUBTITLES = {
  dashboard:           "Centro de operacion inmobiliaria",
  proyectos:           "Gestion e inventario de proyectos",
  lotes:               "Inventario y comercializacion de lotes",
  compradores:         "Administracion de compradores",
  ventas:              "Seguimiento del proceso comercial",
  cuotas:              "Control de obligaciones y vencimientos",
  pagos:               "Registro, consulta y aplicacion de pagos",
  comisionistas:       "Seguimiento de comisiones",
  facturas:            "Emision y control de facturas",
  recibos:             "Consulta de recibos",
  reportes:            "Indicadores y reportes consolidados",
  auditoria:           "Trazabilidad y control interno",
  personal:            "Distribucion de usuarios activos por rol en la plataforma",
  usuarios:            "Administracion de accesos y roles",
  roles:               "Que puede ver y hacer cada rol del sistema",
  "el-proyecto":       "Plano, disponibilidad y detalles del proyecto",
  "mis-cuotas":        "Plan de pago de tu lote",
  "mis-facturas":      "Facturas emitidas pendientes de pago.",
  "mis-recibos":       "Historial de pagos y comprobantes",
  "bank-transactions": "Registro de movimientos bancarios",
  "payment-validation":"Contraste y aprobacion de pagos",
  gastos:              "Registro y control de gastos operativos por proyecto",
  juridico:            "Ventas en mora, pre-mora y devolucion — observaciones juridicas",
};

window.currentUser    = null;
window.currentViewKey = "dashboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(text) {
  return (text || "").charAt(0).toUpperCase() + (text || "").slice(1);
}

function humanizeRole(role) {
  return String(role || "").split("_").map(capitalize).join(" ");
}

function setTodayDate() {
  const todayDate = document.getElementById("todayDate");
  if (!todayDate) return;
  const formatted = new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  todayDate.textContent = capitalize(formatted);
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const THEME_KEY = "sgi_theme";

function applyTheme(value) {
  const html = document.documentElement;
  if (value === "dark")       html.setAttribute("data-theme", "dark");
  else if (value === "light") html.setAttribute("data-theme", "light");
  else                        html.removeAttribute("data-theme");
  localStorage.setItem(THEME_KEY, value);
  document.querySelectorAll("[data-theme-val]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeVal === value);
  });
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "system");
}

// ── Navigation ────────────────────────────────────────────────────────────────

function setActiveNav(viewKey) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewKey);
  });
}

function setViewTitle(title, viewKey) {
  const viewTitle      = document.getElementById("viewTitle");
  const topbarSubtitle = document.getElementById("topbarSubtitle");
  if (viewTitle)      viewTitle.textContent      = title;
  if (topbarSubtitle) topbarSubtitle.textContent = TOPBAR_SUBTITLES[viewKey] || "Centro de operacion inmobiliaria";
}

function renderAccessDenied() {
  return '<section class="table-wrap" style="padding:24px"><div class="table-header"><h3>Acceso restringido</h3></div><div style="padding:20px;color:var(--text-muted)">No tienes permiso para ver esta seccion.</div></section>';
}

function renderMissingView(viewKey) {
  return '<section class="table-wrap" style="padding:24px"><div class="table-header"><h3>Vista no disponible</h3></div><div style="padding:20px;color:var(--text-muted)">La vista <strong>' + viewKey + '</strong> no tiene una funcion asignada.</div></section>';
}

function renderViewError(title) {
  return '<section class="table-wrap" style="padding:24px"><div class="table-header"><h3>Error al cargar la vista</h3></div><div style="padding:20px;color:var(--danger)">Ocurrio un error cargando <strong>' + title + '</strong>. Revisa la consola.</div></section>';
}

function resolveViewFn(viewKey, view) {
  const cap  = viewKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const cap1 = cap.charAt(0).toUpperCase() + cap.slice(1);
  const names = [view.fn, viewKey + "View", "render" + cap1, viewKey];
  for (const name of names) {
    if (typeof window[name] === "function") return window[name];
  }
  return null;
}

function navigate(viewKey, updateHash) {
  if (updateHash === undefined) updateHash = true;
  const view = VIEWS[viewKey];
  const vc   = document.getElementById("viewContainer");
  if (!view) return;

  if (!AppState.hasVista(viewKey)) {
    setActiveNav(viewKey);
    setViewTitle(view.title, viewKey);
    if (vc) vc.innerHTML = renderAccessDenied();
    window.SGIUI?.hydrate();
    return;
  }

  window.currentViewKey = viewKey;
  setActiveNav(viewKey);
  setViewTitle(view.title, viewKey);

  const fn = resolveViewFn(viewKey, view);
  if (!fn) {
    if (vc) vc.innerHTML = renderMissingView(viewKey);
    window.SGIUI?.hydrate();
    return;
  }

  try {
    if (vc) vc.innerHTML = "";
    const result = fn(vc);
    if (vc) {
      if (typeof result === "string")                                    vc.innerHTML = result;
      else if (result instanceof Node)                                   vc.replaceChildren(result);
      else if (Array.isArray(result) && result.every(n => n instanceof Node)) vc.replaceChildren(...result);
    }
  } catch (err) {
    console.error('Error loading view "' + viewKey + '":', err);
    if (vc) vc.innerHTML = renderViewError(view.title);
  }

  window.SGIUI?.hydrate();
  if (updateHash && window.location.hash !== "#" + viewKey) {
    window.location.hash = viewKey;
  }
}

// ── App init ──────────────────────────────────────────────────────────────────

function getInitialView() {
  const hash = window.location.hash.replace("#", "").trim();
  return VIEWS[hash] ? hash : "dashboard";
}

function redirigirConDelay(url, segundos) {
  setTimeout(function() { window.location.href = url; }, (segundos || 4) * 1000);
}

async function iniciarApp() {
  initTheme();

  let firebaseUser = null;
  try {
    firebaseUser = await Promise.race([
      esperarAuthListo(),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error("Firebase tardo demasiado")); }, 5000);
      }),
    ]);
  } catch (e) {
    redirigirConDelay("/login.html");
    return;
  }

  if (!firebaseUser) { window.location.href = "/login.html"; return; }

  try {
    const token = await firebaseUser.getIdToken(true);
    localStorage.setItem("fb_token", token);
  } catch (e) {
    console.error("Could not refresh token:", e.message);
    window.location.href = "/login.html";
    return;
  }

  try {
    const perfil = await API.get("/auth/perfil");
    window.currentUser = perfil;
    AppState.init(perfil);

    const necesitaOnboarding =
      (perfil.rol === "comprador" || perfil.rol === "comisionista") && !perfil.nombres;

    window.currentUser._originalVistas = perfil.vistas.slice();

    if (necesitaOnboarding) {
      renderSidebar(perfil.vistas);
      initUserMenu(perfil);
      window.SGIUI?.hydrate();
      initSidebarToggle();
      mostrarOnboarding(perfil, firebaseUser);
      return;
    }

    renderSidebar(perfil.vistas);
    initUserMenu(perfil);
    initRoleViewSwitcher(perfil);
    initSidebarToggle();
    window.SGIUI?.hydrate();
    setTodayDate();

    window.addEventListener("hashchange", function() { navigate(getInitialView(), false); });
    navigate(getInitialView(), false);

  } catch (err) {
    console.error("Error loading profile:", err.message);
    const fbUser = window._firebaseAuth?.currentUser;
    if (!fbUser) { localStorage.removeItem("fb_token"); redirigirConDelay("/login.html"); return; }
    const vc = document.getElementById("viewContainer");
    if (vc) vc.innerHTML =
      '<section class="table-wrap" style="padding:24px"><div class="table-header"><h3>Error al cargar el perfil</h3></div>' +
      '<div style="padding:20px;color:var(--danger)">' + err.message +
      '<br><br><button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div></section>';
  }
}

iniciarApp();

window.navigate     = navigate;
window.applyTheme   = applyTheme;
window.humanizeRole = humanizeRole;
window.setActiveNav = setActiveNav;
window.setViewTitle = setViewTitle;
