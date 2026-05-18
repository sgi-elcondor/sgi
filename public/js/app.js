import { esperarAuthListo } from "./auth.js";

const VIEWS = {
  dashboard:          { fn: "dashboardView",       title: "Panel de control" },
  proyectos:           { fn: "proyectosView",        title: "Proyectos" },
  lotes:               { fn: "lotesView",            title: "Lotes" },
  compradores:        { fn: "compradoresView",      title: "Compradores" },
  ventas:             { fn: "ventasView",           title: "Ventas" },
  cuotas:             { fn: "cuotasView",           title: "Cuotas" },
  pagos:               { fn: "pagosView",             title: "Pagos" },
  comisionistas:      { fn: "comisionistasView",    title: "Comisionistas" },
  facturas:           { fn: "facturasView",         title: "Facturas" },
  recibos:            { fn: "recibosView",          title: "Recibos" },
  reportes:           { fn: "reportesView",         title: "Reportes" },
  alertas:            { fn: "alertasView",          title: "Alertas Juridicas" },
  auditoria:          { fn: "auditoriaView",        title: "Auditoria" },
  juridico:           { fn: "juridicoView",         title: "Seguimiento Juridico" },
  personal:           { fn: "personalView",         title: "Personal" },
  usuarios:           { fn: "usuariosView",         title: "Gestion de Usuarios" },
  roles:              { fn: "rolesView",            title: "Permisos" },
  "mis-cuotas":        { fn: "compradorCuotasView",   title: "Mis Cuotas" },
  "mis-recibos":       { fn: "compradorRecibosView",  title: "Mis Recibos" },
  "bank-transactions": { fn: "bankTransactionsView", title: "Transacciones Bancarias" },
  "payment-validation":{ fn: "paymentValidationView", title: "Validacion de Pagos" },
  gastos:              { fn: "gastosView",            title: "Gastos Operativos" },
};

const SIDEBAR_GROUPS = [
  { label: "General", items: [
    { view: "dashboard",      icon: "layout-dashboard", label: "Panel" },
  ]},
  { label: "Operacion", items: [
    { view: "proyectos",  icon: "building-2",    label: "Proyectos" },
    { view: "lotes",      icon: "map",           label: "Lotes" },
    { view: "compradores",icon: "users",         label: "Compradores" },
    { view: "ventas",     icon: "briefcase",     label: "Ventas" },
  ]},
  { label: "Finanzas", items: [
    { view: "cuotas",             icon: "calendar",      label: "Cuotas" },
    { view: "pagos",              icon: "wallet",        label: "Pagos" },
    { view: "comisionistas",      icon: "percent",       label: "Comisionistas" },
    { view: "facturas",           icon: "receipt",       label: "Facturas" },
    { view: "recibos",            icon: "file-text",     label: "Recibos" },
    { view: "bank-transactions",  icon: "landmark",      label: "Transacciones" },
    { view: "payment-validation", icon: "shield-check",  label: "Validar pagos" },
    { view: "gastos",             icon: "trending-down", label: "Gastos" },
  ]},
  { label: "Mi cuenta", items: [
    { view: "mis-cuotas",  icon: "calendar",   label: "Mis Cuotas" },
    { view: "mis-recibos", icon: "receipt",     label: "Mis Recibos" },
  ]},
  { label: "Control", items: [
    { view: "reportes",       icon: "bar-chart-3",   label: "Reportes" },
    { view: "alertas",        icon: "triangle-alert",label: "Alertas" },
    { view: "auditoria",      icon: "shield-check",  label: "Auditoria" },
    { view: "personal",       icon: "users",         label: "Personal" },
    { view: "usuarios",       icon: "settings",      label: "Usuarios" },
    { view: "roles",          icon: "shield-check",  label: "Permisos" },
  ]},
  { label: "Juridico", items: [
    { view: "juridico",       icon: "scale",         label: "Seguimiento Juridico" },
  ]},
];

const TOPBAR_SUBTITLES = {
  dashboard:          "Centro de operacion inmobiliaria",
  proyectos:          "Gestion e inventario de proyectos",
  lotes:              "Inventario y comercializacion de lotes",
  compradores:        "Administracion de compradores",
  ventas:             "Seguimiento del proceso comercial",
  cuotas:             "Control de obligaciones y vencimientos",
  pagos:              "Registro, consulta y aplicacion de pagos",
  comisionistas:      "Seguimiento de comisiones",
  facturas:           "Emision y control de facturas",
  recibos:            "Consulta de recibos",
  reportes:           "Indicadores y reportes consolidados",
  alertas:            "Seguimiento juridico y alertas",
  auditoria:          "Trazabilidad y control interno",
  personal:           "Distribucion de usuarios activos por rol en la plataforma",
  usuarios:           "Administracion de accesos y roles",
  roles:              "Que puede ver y hacer cada rol del sistema",
  "mis-cuotas":        "Consulta y pago de tus cuotas",
  "mis-recibos":       "Recibos de pago emitidos a tu nombre",
  "bank-transactions": "Registro de movimientos bancarios",
  "payment-validation":"Contraste y aprobacion de pagos",
  gastos:              "Registro y control de gastos operativos por proyecto",
  juridico:            "Ventas en mora, pre-mora y devolucion — observaciones juridicas",
};

window.currentUser    = null;
window.currentViewKey = "dashboard";

const ROLE_VIEW_STORAGE_KEY = "sgi_view_as";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Theme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function setActiveNav(viewKey) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewKey);
  });
}

function setViewTitle(title, viewKey) {
  const viewTitle      = document.getElementById("viewTitle");
  const topbarSubtitle = document.getElementById("topbarSubtitle");
  if (viewTitle)      viewTitle.textContent = title;
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
  const cap = viewKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
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
      if (typeof result === "string")       vc.innerHTML = result;
      else if (result instanceof Node)      vc.replaceChildren(result);
      else if (Array.isArray(result) && result.every(n => n instanceof Node)) vc.replaceChildren(...result);
    }
  } catch (err) {
    console.error('Error al cargar la vista "' + viewKey + '":', err);
    if (vc) vc.innerHTML = renderViewError(view.title);
  }

  window.SGIUI?.hydrate();
  if (updateHash && window.location.hash !== "#" + viewKey) {
    window.location.hash = viewKey;
  }
}

// â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderSidebar(vistas) {
  const nav = document.getElementById("sidebarNav");
  if (!nav) return;

  const allowed = new Set(vistas || []);
  let html = "";
  let firstGroup = true;

  SIDEBAR_GROUPS.forEach(function(group) {
    const visible = group.items.filter(function(item) {
      return allowed.has(item.view);
    });
    if (!visible.length) return;

    if (!firstGroup) html += '<div class="nav-divider"></div>';
    firstGroup = false;

    html += '<div class="nav-group"><span class="nav-group-title">' + group.label + '</span>';
    visible.forEach(function(item) {
      html += '<button type="button" class="nav-item" data-view="' + item.view + '">' +
        '<span class="nav-icon"><i data-lucide="' + item.icon + '"></i></span>' +
        '<span>' + item.label + '</span>' +
        '</button>';
    });
    html += '</div>';
  });

  nav.innerHTML = html;

  nav.querySelectorAll(".nav-item").forEach(function(btn) {
    btn.addEventListener("click", function() {
      if (btn.dataset.view) navigate(btn.dataset.view);
    });
  });

  window.SGIUI?.hydrate();
}

// â”€â”€ User menu panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function initUserMenu(perfil) {
  const btn   = document.getElementById("userMenuBtn");
  const panel = document.getElementById("userMenuPanel");
  if (!btn || !panel) return;

  const canEdit    = perfil.rol === "comprador" || perfil.rol === "comisionista";
  const savedTheme = localStorage.getItem(THEME_KEY) || "system";

  panel.innerHTML =
    '<div class="ump-header">' +
    '<div class="ump-avatar"><i data-lucide="user"></i></div>' +
    '<div class="ump-identity">' +
    '<span class="ump-email">' + perfil.email + '</span>' +
    '<span class="ump-role">' + humanizeRole(perfil.rol) + '</span>' +
    '</div></div>' +
    '<div class="ump-divider"></div>' +
    '<div class="ump-section"><span class="ump-label">Tema</span>' +
    '<div class="ump-theme-row">' +
    '<button class="ump-theme-btn' + (savedTheme === "system" ? " active" : "") + '" data-theme-val="system"><i data-lucide="monitor"></i><span>Sistema</span></button>' +
    '<button class="ump-theme-btn' + (savedTheme === "light"  ? " active" : "") + '" data-theme-val="light"><i data-lucide="sun"></i><span>Claro</span></button>' +
    '<button class="ump-theme-btn' + (savedTheme === "dark"   ? " active" : "") + '" data-theme-val="dark"><i data-lucide="moon"></i><span>Oscuro</span></button>' +
    '</div></div>' +
    (canEdit ? '<div class="ump-divider"></div><button class="ump-action" id="ump-edit-profile"><i data-lucide="user-pen"></i><span>Editar perfil</span></button>' : '') +
    '<div class="ump-divider"></div>' +
    '<button class="ump-action" id="ump-change-pwd"><i data-lucide="key-round"></i><span>Cambiar contrasena</span></button>' +
    '<div class="ump-divider"></div>' +
    '<button class="ump-action ump-action--danger" id="ump-logout"><i data-lucide="log-out"></i><span>Cerrar sesion</span></button>';

  window.SGIUI?.hydrate();

  btn.addEventListener("click", function(e) {
    e.stopPropagation();
    const open = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
  });

  document.addEventListener("click", function(e) {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
    }
  });

  panel.addEventListener("click", function(e) {
    const themeBtn = e.target.closest("[data-theme-val]");
    if (themeBtn) applyTheme(themeBtn.dataset.themeVal);
  });

  document.getElementById("ump-logout")?.addEventListener("click", async function() {
    const auth = window._firebaseAuth;
    if (auth) {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await signOut(auth);
    }
    localStorage.removeItem("fb_token");
    window.location.href = "/login.html";
  });

  if (canEdit) {
    document.getElementById("ump-edit-profile")?.addEventListener("click", function() {
      panel.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      renderEditProfileView(perfil);
    });
  }

  document.getElementById("ump-change-pwd")?.addEventListener("click", function() {
    panel.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    renderChangePasswordView();
  });
}

// â”€â”€ Change password view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderChangePasswordView() {
  const prev = window.currentViewKey || "dashboard";
  const vc   = document.getElementById("viewContainer");
  if (!vc) return;
  setActiveNav("");
  setViewTitle("Cambiar contrasena");

  const user            = window._firebaseAuth?.currentUser;
  const isEmailProvider = user?.providerData?.some(function(p) { return p.providerId === "password"; });

  if (!isEmailProvider) {
    vc.innerHTML =
      '<div class="auth-card-wrap"><div class="auth-card">' +
      '<div class="auth-card-brand"><div class="auth-card-icon"><i data-lucide="key-round"></i></div>' +
      '<div><div class="auth-card-title">Cambiar contrasena</div><div class="auth-card-sub">Seguridad de cuenta</div></div></div>' +
      '<p style="color:var(--text-muted);font-size:.9rem;line-height:1.6;margin-bottom:1.5rem">Tu cuenta usa Google. Gestiona tu contrasena desde tu cuenta de Google.</p>' +
      '<button class="auth-card-btn" id="back-from-pwd"><i data-lucide="arrow-left"></i> Volver</button>' +
      '</div></div>';
    window.SGIUI?.hydrate();
    document.getElementById("back-from-pwd")?.addEventListener("click", function() { navigate(prev); });
    return;
  }

  vc.innerHTML =
    '<div class="auth-card-wrap"><div class="auth-card">' +
    '<div class="auth-card-brand"><div class="auth-card-icon"><i data-lucide="key-round"></i></div>' +
    '<div><div class="auth-card-title">Cambiar contrasena</div><div class="auth-card-sub">Seguridad de cuenta</div></div></div>' +
    '<div class="auth-card-field"><label>Contrasena actual</label><input type="password" id="pwd-current" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="current-password" /></div>' +
    '<div class="auth-card-field"><label>Nueva contrasena</label><input type="password" id="pwd-new" placeholder="Minimo 8 caracteres" autocomplete="new-password" />' +
    '<div class="pwd-rules"><span class="pwd-rule" id="pr-len">Minimo 8 caracteres</span><span class="pwd-rule" id="pr-upper">Una letra mayuscula</span><span class="pwd-rule" id="pr-num">Un numero</span></div></div>' +
    '<div class="auth-card-field"><label>Confirmar contrasena</label><input type="password" id="pwd-confirm" placeholder="Repite la contrasena" autocomplete="new-password" /></div>' +
    '<div class="auth-card-error" id="pwd-error"></div>' +
    '<div class="auth-card-success" id="pwd-success"></div>' +
    '<button class="auth-card-btn auth-card-btn--primary" id="btn-change-pwd">Actualizar contrasena</button>' +
    '<button class="auth-card-btn" id="back-from-pwd"><i data-lucide="arrow-left"></i> Volver</button>' +
    '</div></div>';

  window.SGIUI?.hydrate();

  document.getElementById("pwd-new")?.addEventListener("input", function(e) {
    const v = e.target.value;
    document.getElementById("pr-len")?.classList.toggle("ok", v.length >= 8);
    document.getElementById("pr-upper")?.classList.toggle("ok", /[A-Z]/.test(v));
    document.getElementById("pr-num")?.classList.toggle("ok", /[0-9]/.test(v));
  });

  document.getElementById("back-from-pwd")?.addEventListener("click", function() { navigate(prev); });

  document.getElementById("btn-change-pwd")?.addEventListener("click", async function() {
    const current   = document.getElementById("pwd-current").value;
    const newPwd    = document.getElementById("pwd-new").value;
    const confirm   = document.getElementById("pwd-confirm").value;
    const errorEl   = document.getElementById("pwd-error");
    const successEl = document.getElementById("pwd-success");
    const btn       = document.getElementById("btn-change-pwd");

    errorEl.style.display = successEl.style.display = "none";

    if (!current || !newPwd || !confirm)                                        { errorEl.textContent = "Completa todos los campos."; errorEl.style.display = "block"; return; }
    if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) { errorEl.textContent = "La contrasena no cumple los requisitos."; errorEl.style.display = "block"; return; }
    if (newPwd !== confirm)                                                     { errorEl.textContent = "Las contrasenass no coinciden."; errorEl.style.display = "block"; return; }

    btn.disabled = true; btn.textContent = "Actualizando...";

    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      const fbUser = window._firebaseAuth?.currentUser;
      await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(fbUser.email, current));
      await updatePassword(fbUser, newPwd);
      successEl.textContent = "Contrasena actualizada correctamente."; successEl.style.display = "block";
      setTimeout(function() { navigate(prev); }, 2000);
    } catch (err) {
      const MAP = { "auth/wrong-password": "La contrasena actual es incorrecta.", "auth/too-many-requests": "Demasiados intentos.", "auth/weak-password": "Contrasena demasiado debil.", "auth/invalid-credential": "La contrasena actual es incorrecta." };
      errorEl.textContent = MAP[err.code] || err.message; errorEl.style.display = "block";
      btn.disabled = false; btn.textContent = "Actualizar contrasena";
    }
  });
}

// â”€â”€ Edit profile view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderEditProfileView(perfil) {
  const prev = window.currentViewKey || "dashboard";
  const vc   = document.getElementById("viewContainer");
  if (!vc) return;
  setActiveNav(""); setViewTitle("Editar perfil");

  vc.innerHTML =
    '<div class="auth-card-wrap"><div class="auth-card">' +
    '<div class="auth-card-brand"><div class="auth-card-icon"><i data-lucide="user-pen"></i></div>' +
    '<div><div class="auth-card-title">Editar perfil</div><div class="auth-card-sub">' + perfil.email + '</div></div></div>' +
    '<div class="auth-card-grid-2">' +
    '<div class="auth-card-field"><label>Nombres <span style="color:var(--danger)">*</span></label><input type="text" id="ep-nombres" value="' + (perfil.nombres || "") + '" placeholder="Nombres" /></div>' +
    '<div class="auth-card-field"><label>Apellidos <span style="color:var(--danger)">*</span></label><input type="text" id="ep-apellidos" value="' + (perfil.apellidos || "") + '" placeholder="Apellidos" /></div>' +
    '</div>' +
    '<div class="auth-card-field"><label>Telefono <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label><input type="tel" id="ep-telefono" value="' + (perfil.telefono || "") + '" placeholder="Ej: 3001234567" /></div>' +
    '<div class="auth-card-error" id="ep-error"></div>' +
    '<div class="auth-card-success" id="ep-success"></div>' +
    '<button class="auth-card-btn auth-card-btn--primary" id="btn-save-profile">Guardar cambios</button>' +
    '<button class="auth-card-btn" id="back-from-ep"><i data-lucide="arrow-left"></i> Volver</button>' +
    '</div></div>';

  window.SGIUI?.hydrate();

  document.getElementById("back-from-ep")?.addEventListener("click", function() { navigate(prev); });

  document.getElementById("btn-save-profile")?.addEventListener("click", async function() {
    const nombres   = document.getElementById("ep-nombres").value.trim();
    const apellidos = document.getElementById("ep-apellidos").value.trim();
    const telefono  = document.getElementById("ep-telefono").value.trim();
    const errorEl   = document.getElementById("ep-error");
    const successEl = document.getElementById("ep-success");
    const btn       = document.getElementById("btn-save-profile");
    errorEl.style.display = successEl.style.display = "none";
    if (!nombres || !apellidos) { errorEl.textContent = "Nombres y apellidos son obligatorios."; errorEl.style.display = "block"; return; }
    btn.disabled = true; btn.textContent = "Guardando...";
    try {
      await API.put("/auth/perfil", { nombres, apellidos, telefono: telefono || undefined });
      window.currentUser.nombres = nombres; window.currentUser.apellidos = apellidos; window.currentUser.telefono = telefono;
      successEl.textContent = "Perfil actualizado correctamente."; successEl.style.display = "block";
      setTimeout(function() { navigate(prev); }, 1800);
    } catch (err) {
      errorEl.textContent = err.message || "Error al guardar."; errorEl.style.display = "block";
      btn.disabled = false; btn.textContent = "Guardar cambios";
    }
  });
}

// â”€â”€ Sidebar toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function applySidebarState(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  const toggle = document.getElementById("sidebarToggle");
  if (!toggle) return;
  toggle.setAttribute("aria-pressed", String(collapsed));
  toggle.title = collapsed ? "Expandir barra lateral" : "Colapsar barra lateral";
  toggle.innerHTML = collapsed ? '<i data-lucide="panel-left-open"></i>' : '<i data-lucide="panel-left-close"></i>';
  window.SGIUI?.hydrate();
}

function initSidebarToggle() {
  const toggle = document.getElementById("sidebarToggle");
  if (!toggle) return;
  const STORAGE_KEY = "sgi_sidebar_collapsed";
  applySidebarState(localStorage.getItem(STORAGE_KEY) === "1");
  toggle.addEventListener("click", function() {
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    applySidebarState(collapsed);
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  });
}

// â”€â”€ Onboarding modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseDisplayName(displayName) {
  const parts = (displayName || "").trim().split(" ").filter(Boolean);
  if (!parts.length) return { nombres: "", apellidos: "" };
  if (parts.length === 1) return { nombres: parts[0], apellidos: "" };
  const mid = Math.ceil(parts.length / 2);
  return { nombres: parts.slice(0, mid).join(" "), apellidos: parts.slice(mid).join(" ") };
}

function mostrarOnboarding(perfil, firebaseUser) {
  const overlay = document.createElement("div");
  overlay.id = "onboarding-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
  const { nombres, apellidos } = parseDisplayName(firebaseUser?.displayName || "");
  const labelRol = perfil.rol === "comisionista" ? "Comisionista" : "Comprador";

  overlay.innerHTML =
    '<div style="background:var(--surface,#fff);border-radius:12px;padding:2rem;width:min(480px,94vw);box-shadow:0 8px 32px rgba(0,0,0,.25)">' +
    '<h2 style="margin:0 0 .5rem;font-size:1.25rem">Completa tu perfil</h2>' +
    '<p style="margin:0 0 1.5rem;color:var(--text-muted,#666);font-size:.9rem">Para continuar como <strong>' + labelRol + '</strong> necesitamos algunos datos.</p>' +
    '<div style="display:grid;gap:.875rem">' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Correo electronico</label>' +
    '<input type="email" value="' + perfil.email + '" disabled style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--surface2,#f5f5f5);color:var(--text-muted,#888);box-sizing:border-box" /></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Nombres <span style="color:var(--danger,red)">*</span></label><input id="ob-nombres" type="text" value="' + nombres + '" placeholder="Nombres" style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box" /></div>' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Apellidos <span style="color:var(--danger,red)">*</span></label><input id="ob-apellidos" type="text" value="' + apellidos + '" placeholder="Apellidos" style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box" /></div>' +
    '</div>' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Cedula <span style="color:var(--danger,red)">*</span></label><input id="ob-documento" type="text" placeholder="Ej: 1234567890" style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box" /></div>' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Telefono <span style="color:var(--text-muted,#888);font-weight:400">(opcional)</span></label><input id="ob-telefono" type="tel" placeholder="Ej: 3001234567" style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box" /></div>' +
    '<div id="ob-error" style="display:none;color:var(--danger,red);font-size:.85rem"></div>' +
    '<button id="ob-submit" class="btn btn-primary" style="width:100%;margin-top:.25rem">Guardar y continuar</button>' +
    '</div></div>';

  document.body.appendChild(overlay);

  document.getElementById("ob-submit").addEventListener("click", async function() {
    const nombres   = document.getElementById("ob-nombres").value.trim();
    const apellidos = document.getElementById("ob-apellidos").value.trim();
    const documento = document.getElementById("ob-documento").value.trim();
    const telefono  = document.getElementById("ob-telefono").value.trim();
    const errorEl   = document.getElementById("ob-error");
    const btn       = document.getElementById("ob-submit");
    if (!nombres || !apellidos || !documento) { errorEl.textContent = "Nombres, apellidos y cedula son obligatorios."; errorEl.style.display = "block"; return; }
    errorEl.style.display = "none"; btn.disabled = true; btn.textContent = "Guardando...";
    try {
      await API.post("/auth/completar-perfil", { nombres, apellidos, documento, telefono: telefono || undefined });
      overlay.remove();
    } catch (err) {
      errorEl.textContent = err.message || "Error al guardar."; errorEl.style.display = "block";
      btn.disabled = false; btn.textContent = "Guardar y continuar";
    }
  });
}

// â”€â”€ App init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ── Role view switcher ────────────────────────────────────────────────────────────────────────────

function revertRoleSelect() {
  const select = document.getElementById("roleViewSelect");
  if (select) select.value = "admin";
  sessionStorage.setItem(ROLE_VIEW_STORAGE_KEY, "admin");
  applyAdminView();
}

function applyAdminView() {
  const perfil = window.currentUser;
  window.currentUser.vistas = perfil._originalVistas.slice();
  AppState.restore(perfil);
  renderSidebar(perfil._originalVistas);
  navigate(window.currentViewKey || "dashboard");
}

function applyRoleView(idRol, rolNombre) {
  if (rolNombre === "comprador" && !window.currentUser.id_comprador) {
    showLinkProfileModal("comprador", function() { applyRoleView(idRol, rolNombre); }, revertRoleSelect);
    return;
  }
  if (rolNombre === "comisionista" && !window.currentUser.id_comisionista) {
    showLinkProfileModal("comisionista", function() { applyRoleView(idRol, rolNombre); }, revertRoleSelect);
    return;
  }

  API.get("/roles/" + idRol + "/permisos").then(function(data) {
    const vistas = data.vistas || [];
    window.currentUser.vistas = vistas;
    AppState.simulate(vistas, data.can || []);
    renderSidebar(vistas);
    const cur  = window.currentViewKey || "dashboard";
    const next = vistas.includes(cur) ? cur : (vistas[0] || "dashboard");
    navigate(next);
  }).catch(function(err) {
    console.error("Error fetching role vistas:", err);
  });
}

function showLinkProfileModal(tipo, onSuccess, onCancel) {
  const existing = document.getElementById("link-profile-overlay");
  if (existing) existing.remove();

  const tipoLabel    = tipo === "comprador" ? "Comprador" : "Comisionista";
  const fieldStyle   = "width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box;background:var(--surface);color:var(--text);font-family:inherit;font-size:.9rem;";
  const disabledStyle = fieldStyle + "background:var(--surface-2,#f5f5f5);color:var(--text-muted,#888);";
  const labelStyle   = "display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500;";

  const overlay = document.createElement("div");
  overlay.id = "link-profile-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";

  overlay.innerHTML =
    '<div style="background:var(--surface,#fff);border-radius:1rem;padding:2rem;width:min(480px,94vw);box-shadow:0 8px 32px rgba(0,0,0,.28)">' +
    '<h2 style="margin:0 0 .5rem;font-size:1.2rem;font-family:var(--font-serif)">Vincular perfil de ' + tipoLabel + '</h2>' +
    '<p style="margin:0 0 1.5rem;color:var(--text-muted,#666);font-size:.875rem;line-height:1.55">Para simular la vista de <strong>' + tipoLabel + '</strong> necesitas un perfil vinculado a tu cuenta de admin.</p>' +
    '<div style="display:grid;gap:.875rem">' +
    '<div><label style="' + labelStyle + '">Correo electronico</label>' +
    '<input type="email" value="' + (window.currentUser?.email || "") + '" disabled style="' + disabledStyle + '" /></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
    '<div><label style="' + labelStyle + '">Nombres <span style="color:var(--danger,red)">*</span></label>' +
    '<input id="lp-nombres" type="text" placeholder="Nombres" style="' + fieldStyle + '" /></div>' +
    '<div><label style="' + labelStyle + '">Apellidos <span style="color:var(--danger,red)">*</span></label>' +
    '<input id="lp-apellidos" type="text" placeholder="Apellidos" style="' + fieldStyle + '" /></div>' +
    '</div>' +
    '<div><label style="' + labelStyle + '">Cedula <span style="color:var(--danger,red)">*</span></label>' +
    '<input id="lp-documento" type="text" placeholder="Ej: 1234567890" style="' + fieldStyle + '" /></div>' +
    '<div><label style="' + labelStyle + '">Telefono <span style="color:var(--text-muted,#888);font-weight:400">(opcional)</span></label>' +
    '<input id="lp-telefono" type="tel" placeholder="Ej: 3001234567" style="' + fieldStyle + '" /></div>' +
    '<div id="lp-error" style="display:none;color:var(--danger,red);font-size:.85rem"></div>' +
    '<button id="lp-submit" class="btn btn-primary" style="width:100%;margin-top:.25rem">Guardar y continuar</button>' +
    '<button id="lp-cancel" style="width:100%;padding:.6rem;border:1px solid var(--border,#ddd);border-radius:.5rem;background:transparent;color:var(--text-muted);cursor:pointer;font-family:inherit;font-size:.875rem;font-weight:500">Cancelar</button>' +
    '</div></div>';

  document.body.appendChild(overlay);
  window.SGIUI?.hydrate();

  document.getElementById("lp-cancel").addEventListener("click", function() {
    overlay.remove();
    onCancel();
  });

  document.getElementById("lp-submit").addEventListener("click", async function() {
    const nombres   = document.getElementById("lp-nombres").value.trim();
    const apellidos = document.getElementById("lp-apellidos").value.trim();
    const documento = document.getElementById("lp-documento").value.trim();
    const telefono  = document.getElementById("lp-telefono").value.trim();
    const errorEl   = document.getElementById("lp-error");
    const btn       = document.getElementById("lp-submit");

    if (!nombres || !apellidos || !documento) {
      errorEl.textContent = "Nombres, apellidos y cedula son obligatorios.";
      errorEl.style.display = "block";
      return;
    }

    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      const result = await API.post("/auth/completar-perfil", {
        nombres, apellidos, documento,
        telefono: telefono || undefined,
        tipo,
      });
      if (tipo === "comprador")    window.currentUser.id_comprador    = result.id_comprador;
      if (tipo === "comisionista") window.currentUser.id_comisionista = result.id_comisionista;
      overlay.remove();
      onSuccess();
    } catch (err) {
      errorEl.textContent = err.message || "Error al guardar.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Guardar y continuar";
    }
  });
}

function initRoleViewSwitcher(perfil) {
  if (perfil.rol !== "admin") return;

  const container = document.getElementById("roleViewSwitcher");
  if (!container) return;
  container.style.display = "";

  API.get("/roles").then(function(roles) {
    const select = document.getElementById("roleViewSelect");
    if (!select) return;

    select.innerHTML = '<option value="admin">Vista Admin</option>';
    roles.forEach(function(r) {
      if (r.nombre === "admin") return;
      const opt          = document.createElement("option");
      opt.value          = r.id_rol;
      opt.dataset.nombre = r.nombre;
      opt.textContent    = humanizeRole(r.nombre);
      select.appendChild(opt);
    });

    const saved = sessionStorage.getItem(ROLE_VIEW_STORAGE_KEY);
    if (saved && saved !== "admin") {
      select.value = saved;
      if (select.value === saved) {
        const opt    = select.options[select.selectedIndex];
        const nombre = opt.dataset.nombre;
        applyRoleView(Number(saved), nombre);
      }
    }

    select.addEventListener("change", function() {
      const val = this.value;
      sessionStorage.setItem(ROLE_VIEW_STORAGE_KEY, val);
      if (val === "admin") {
        applyAdminView();
      } else {
        const opt    = this.options[this.selectedIndex];
        const nombre = opt.dataset.nombre;
        applyRoleView(Number(val), nombre);
      }
    });
  }).catch(function(err) {
    console.error("Error loading roles for switcher:", err);
  });
}

function getInitialView() {
  const hash = window.location.hash.replace("#", "").trim();
  return VIEWS[hash] ? hash : "dashboard";
}

function redirigirConDelay(url, segundos) {
  console.log("[REDIRECT] Redirigiendo a " + url + " en " + (segundos || 4) + " segundos...");
  setTimeout(function() { window.location.href = url; }, (segundos || 4) * 1000);
}

async function iniciarApp() {
  initTheme();

  let firebaseUser = null;
  try {
    firebaseUser = await Promise.race([
      esperarAuthListo(),
      new Promise(function(_, reject) { setTimeout(function() { reject(new Error("Firebase tardo demasiado")); }, 5000); }),
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
    console.error("No se pudo refrescar el token:", e.message);
    window.location.href = "/login.html";
    return;
  }

  try {
    const perfil = await API.get("/auth/perfil");
    window.currentUser = perfil;
    AppState.init(perfil);

    const necesitaOnboarding =
      (perfil.rol === "comprador"    && !perfil.id_comprador) ||
      (perfil.rol === "comisionista" && !perfil.id_comisionista);

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
    console.error("Error cargando perfil:", err.message);
    const fbUser = window._firebaseAuth?.currentUser;
    if (!fbUser) { localStorage.removeItem("fb_token"); redirigirConDelay("/login.html"); return; }
    const vc = document.getElementById("viewContainer");
    if (vc) vc.innerHTML = '<section class="table-wrap" style="padding:24px"><div class="table-header"><h3>Error al cargar el perfil</h3></div><div style="padding:20px;color:var(--danger)">' + err.message + '<br><br><button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div></section>';
  }
}

iniciarApp();
window.navigate = navigate;
/* =========================================================
   MOBILE SIDEBAR / OFF-CANVAS
   Menú lateral responsive
   ========================================================= */

(function setupMobileSidebarDrawer() {
  const MOBILE_QUERY = "(max-width: 57.5rem)";

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function getElements() {
    return {
      btn: document.getElementById("mobileMenuToggle"),
      backdrop: document.getElementById("mobileSidebarBackdrop"),
      sidebar: document.getElementById("sidebar")
    };
  }

  function openSidebar() {
    if (!isMobile()) return;

    const { btn } = getElements();

    document.body.classList.add("sidebar-mobile-open");

    if (btn) {
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", "Cerrar menú");
    }
  }

  function closeSidebar() {
    const { btn } = getElements();

    document.body.classList.remove("sidebar-mobile-open");

    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Abrir menú");
    }
  }

  function toggleSidebar() {
    if (document.body.classList.contains("sidebar-mobile-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function init() {
    const { btn, backdrop } = getElements();

    if (btn) {
      btn.addEventListener("click", function() {
        toggleSidebar();
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", closeSidebar);
    }

    document.addEventListener("click", function(event) {
      if (!isMobile()) return;

      const navItem = event.target.closest(".sidebar .nav-item");

      if (navItem) {
        closeSidebar();
      }
    });

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });

    window.addEventListener("resize", function() {
      if (!isMobile()) {
        closeSidebar();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();