import { esperarAuthListo, logout } from "./auth.js";

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
  recepciones:         { fn: "recepcionesView",        title: "Recepción de Materiales" },
  requerimientos:      { fn: "requerimientosView",     title: "Requerimientos" },
  aprobaciones:        { fn: "aprobacionesView",       title: "Aprobaciones" },
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
  recepciones:         "Registro de entrega de materiales y actualizacion de stock",
  requerimientos:      "Solicita materiales para tu área y consulta su estado",
  aprobaciones:        "Revisa y aprueba los requerimientos de materiales",
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
  if (VIEWS[hash] && AppState.hasVista(hash)) return hash;
  if (AppState.hasVista("dashboard")) return "dashboard";
  const firstVista = (window.currentUser?.vistas || []).find(v => VIEWS[v]);
  return firstVista || "dashboard";
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
    redirigirConDelay("/login");
    return;
  }

  if (!firebaseUser) { window.location.href = "/"; return; }

  try {
    const token = await firebaseUser.getIdToken(true);
    localStorage.setItem("fb_token", token);
  } catch (e) {
    console.error("Could not refresh token:", e.message);
    window.location.href = "/login";
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
    if (!fbUser) { localStorage.removeItem("fb_token"); redirigirConDelay("/login"); return; }

    if (err.code === "EMAIL_NOT_VERIFIED") { mostrarVerificarCorreo(fbUser); return; }

    if (/inactiv/i.test(err.message || "")) { mostrarCuentaInactiva(); return; }
    if (err.code === "CUENTA_NO_VINCULADA") { mostrarVincularCuenta(); return; }

    const vc = document.getElementById("viewContainer");
    if (vc) vc.innerHTML =
      '<section class="table-wrap" style="padding:24px"><div class="table-header"><h3>Error al cargar el perfil</h3></div>' +
      '<div style="padding:20px;color:var(--danger)">' + err.message +
      '<br><br><button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div></section>';
  }
}

function mostrarCuentaInactiva() {
  const o = document.createElement("div");
  o.style.cssText =
    "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;" +
    "padding:1.5rem;background:var(--bg-primary,var(--bg,#0e0e10))";
  o.innerHTML =
    '<div style="max-width:26rem;width:100%;text-align:center;background:var(--surface,var(--bg-secondary));' +
      'border:1px solid var(--border,var(--border-color));border-radius:1rem;padding:2.5rem 2rem;' +
      'box-shadow:0 0.625rem 2.5rem rgba(0,0,0,.25)">' +
      '<div style="width:3.5rem;height:3.5rem;margin:0 auto 1.25rem;border-radius:50%;display:flex;' +
        'align-items:center;justify-content:center;background:rgba(var(--danger-rgb,220,38,38),.12);color:var(--danger,#dc2626)">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' +
      '</div>' +
      '<h1 style="margin:0 0 .5rem;font-size:1.35rem;color:var(--text,var(--text-primary))">Cuenta inactiva</h1>' +
      '<p style="margin:0 0 1.5rem;color:var(--text-muted);font-size:.9rem;line-height:1.55">' +
        'Tu cuenta fue deshabilitada y no tiene acceso a la plataforma. ' +
        'Si crees que es un error, comunícate con el administrador.</p>' +
      '<button class="btn btn-primary" id="inactive-logout" style="width:100%">Volver al inicio de sesión</button>' +
    '</div>';
  document.body.appendChild(o);
  document.getElementById("inactive-logout").addEventListener("click", async function() {
    try { await logout(); } catch (_) {}
    localStorage.removeItem("fb_token");
    window.location.href = "/login";
  });
}

function mostrarVerificarCorreo(firebaseUser) {
  const email = firebaseUser?.email || "tu correo";
  const o = document.createElement("div");
  o.style.cssText =
    "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;" +
    "padding:1.5rem;background:var(--bg-primary,var(--bg,#0e0e10))";
  o.innerHTML =
    '<div style="max-width:28rem;width:100%;text-align:center;background:var(--surface,var(--bg-secondary));' +
      'border:1px solid var(--border,var(--border-color));border-radius:1rem;padding:2.5rem 2rem;' +
      'box-shadow:0 0.625rem 2.5rem rgba(0,0,0,.25)">' +
      '<div style="width:3.5rem;height:3.5rem;margin:0 auto 1.25rem;border-radius:50%;display:flex;' +
        'align-items:center;justify-content:center;background:rgba(var(--accent-rgb,255,106,0),.12);color:var(--accent,#ff6a00)">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>' +
      '</div>' +
      '<h1 style="margin:0 0 .5rem;font-size:1.35rem;color:var(--text,var(--text-primary))">Verifica tu correo</h1>' +
      '<p style="margin:0 0 1.5rem;color:var(--text-muted);font-size:.9rem;line-height:1.55">' +
        'Te enviamos un enlace de verificación a <strong>' + email + '</strong>. ' +
        'Ábrelo para activar tu cuenta y luego continúa.</p>' +
      '<div id="verify-msg" style="display:none;margin:0 0 1rem;font-size:.85rem;line-height:1.5"></div>' +
      '<button class="btn btn-primary" id="verify-check" style="width:100%;margin-bottom:.6rem">Ya verifiqué mi correo</button>' +
      '<button class="btn btn-secondary" id="verify-resend" style="width:100%;margin-bottom:.6rem">Reenviar correo</button>' +
      '<button class="btn btn-ghost btn-sm" id="verify-logout" style="width:100%">Cerrar sesión</button>' +
    '</div>';
  document.body.appendChild(o);

  const msg = document.getElementById("verify-msg");
  function showMsg(text, ok) {
    msg.textContent = text;
    msg.style.display = "block";
    msg.style.color = ok ? "var(--success,#16a34a)" : "var(--danger,#dc2626)";
  }

  // Auto-detect verification: opening the email link verifies the account
  // server-side (even if the link page later shows "already used"), so we poll.
  let polling = false;
  const pollId = setInterval(async function() {
    if (polling) return;
    polling = true;
    try {
      if (await window._recargarUsuario()) { clearInterval(pollId); window.location.reload(); }
    } catch (_) {
    } finally {
      polling = false;
    }
  }, 4000);

  document.getElementById("verify-check").addEventListener("click", async function() {
    const btn = this;
    btn.disabled = true;
    try {
      const verificado = await window._recargarUsuario();
      if (verificado) { window.location.reload(); return; }
      showMsg("Aún no detectamos la verificación. Revisa tu correo y vuelve a intentar.", false);
    } catch (e) {
      showMsg("No se pudo comprobar. Intenta de nuevo.", false);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("verify-resend").addEventListener("click", async function() {
    const btn = this;
    btn.disabled = true;
    try {
      await window._reenviarVerificacion();
      showMsg("Correo de verificación reenviado. Revisa tu bandeja y la carpeta de spam.", true);
    } catch (e) {
      showMsg(e.message || "No se pudo reenviar el correo.", false);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("verify-logout").addEventListener("click", async function() {
    clearInterval(pollId);
    try { await logout(); } catch (_) {}
    localStorage.removeItem("fb_token");
    window.location.href = "/login";
  });
}

// Shown when the login is valid but no account is linked yet (CUENTA_NO_VINCULADA). The person
// claims their pre-registered account by documento (hybrid link); on success the app reloads.
function mostrarVincularCuenta() {
  const o = document.createElement("div");
  o.style.cssText =
    "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;" +
    "padding:1.5rem;background:var(--bg-primary,var(--bg,#0e0e10))";
  o.innerHTML =
    '<div style="max-width:26rem;width:100%;text-align:center;background:var(--surface,var(--bg-secondary));' +
      'border:1px solid var(--border,var(--border-color));border-radius:1rem;padding:2.5rem 2rem;' +
      'box-shadow:0 0.625rem 2.5rem rgba(0,0,0,.25)">' +
      '<h1 style="margin:0 0 .5rem;font-size:1.35rem;color:var(--text,var(--text-primary))">Vincula tu cuenta</h1>' +
      '<p style="margin:0 0 1.5rem;color:var(--text-muted);font-size:.9rem;line-height:1.55">' +
        'Tu acceso aún no está vinculado a una compra. Ingresa tu documento de identidad para vincularlo. ' +
        'Si no tienes una compra registrada, comunícate con la oficina.</p>' +
      '<div style="display:flex;gap:.5rem;margin-bottom:.75rem">' +
        '<select id="vc-tipo" class="form-control" style="flex:0 0 7.5rem">' +
          '<option value="cc">C.C.</option><option value="ce">C.E.</option>' +
          '<option value="ppt">PPT</option><option value="pasaporte">Pasaporte</option>' +
        '</select>' +
        '<input id="vc-doc" class="form-control" style="flex:1" placeholder="Número de documento" inputmode="numeric" autocomplete="off">' +
      '</div>' +
      '<p id="vc-error" style="display:none;margin:0 0 .75rem;color:var(--danger,#dc2626);font-size:.82rem"></p>' +
      '<button class="btn btn-primary" id="vc-submit" style="width:100%;margin-bottom:.5rem">Vincular cuenta</button>' +
      '<button class="btn btn-ghost btn-sm" id="vc-logout" style="width:100%">Cerrar sesión</button>' +
    '</div>';
  document.body.appendChild(o);

  const errEl = document.getElementById("vc-error");
  const btn   = document.getElementById("vc-submit");
  const showErr = (m) => { errEl.textContent = m; errEl.style.display = "block"; };

  btn.addEventListener("click", async function() {
    const documento      = document.getElementById("vc-doc").value.trim();
    const tipo_documento = document.getElementById("vc-tipo").value;
    if (!documento) return showErr("Ingresa tu número de documento.");
    errEl.style.display = "none";
    btn.disabled = true; btn.textContent = "Vinculando...";
    try {
      await API.post("/auth/vincular", { documento, tipo_documento });
      window.location.reload();
    } catch (e) {
      btn.disabled = false; btn.textContent = "Vincular cuenta";
      showErr(e.message || "No se pudo vincular la cuenta.");
    }
  });
  document.getElementById("vc-logout").addEventListener("click", async function() {
    try { await logout(); } catch (_) {}
    localStorage.removeItem("fb_token");
    window.location.href = "/login";
  });
}

iniciarApp();

window.navigate     = navigate;
window.applyTheme   = applyTheme;
window.humanizeRole = humanizeRole;
window.setActiveNav = setActiveNav;
window.setViewTitle = setViewTitle;
