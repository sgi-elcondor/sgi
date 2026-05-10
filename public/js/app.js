import { esperarAuthListo } from "./auth.js";

const VIEWS = {
  dashboard:     { fn: "dashboardView",     title: "Panel de control" },
  proyectos:     { fn: "proyectosView",     title: "Proyectos" },
  lotes:         { fn: "lotesView",         title: "Lotes" },
  compradores:   { fn: "compradoresView",   title: "Compradores" },
  ventas:        { fn: "ventasView",        title: "Ventas" },
  cuotas:        { fn: "cuotasView",        title: "Cuotas" },
  pagos:         { fn: "pagosView",         title: "Pagos" },
  comisionistas: { fn: "comisionistasView", title: "Comisionistas" },
  facturas:      { fn: "facturasView",      title: "Facturas" },
  recibos:       { fn: "recibosView",       title: "Recibos" },
  reportes:      { fn: "reportesView",      title: "Reportes" },
  alertas:       { fn: "alertasView",       title: "Alertas Juridicas" },
  auditoria:     { fn: "auditoriaView",     title: "Auditoria" },
  usuarios:      { fn: "usuariosView",      title: "Gestion de Usuarios" },
};

const VISTAS_POR_ROL = {
  admin: [
    "dashboard", "proyectos", "lotes", "compradores", "ventas",
    "cuotas", "pagos", "comisionistas", "facturas", "recibos",
    "reportes", "alertas", "auditoria", "usuarios"
  ],
  operador: [
    "dashboard", "proyectos", "lotes", "compradores", "ventas",
    "cuotas", "pagos", "comisionistas", "facturas", "recibos", "reportes"
  ],
  juridico: [
    "dashboard", "proyectos", "lotes", "compradores", "ventas",
    "cuotas", "reportes", "alertas", "auditoria"
  ],
  comprador: ["dashboard"],
  comisionista: ["dashboard", "reportes"],
  auxiliar_contable: [
    "dashboard", "proyectos", "lotes", "compradores", "ventas",
    "cuotas", "pagos", "comisionistas", "facturas", "recibos",
    "reportes", "alertas", "auditoria", "usuarios"
  ],
  asesor_comercial: [
    "dashboard", "proyectos", "lotes", "compradores", "ventas"
  ],
};

const TOPBAR_SUBTITLES = {
  dashboard: "Centro de operacion inmobiliaria",
  proyectos: "Gestion de proyectos",
  lotes: "Inventario y comercializacion de lotes",
  compradores: "Administracion de compradores",
  ventas: "Seguimiento del proceso comercial",
  cuotas: "Control de obligaciones y vencimientos",
  pagos: "Registro y aplicacion de pagos",
  comisionistas: "Seguimiento de comisiones",
  facturas: "Emision y control de facturas",
  recibos: "Consulta de recibos",
  reportes: "Indicadores y reportes consolidados",
  alertas: "Seguimiento juridico y alertas",
  auditoria: "Trazabilidad y control interno",
  usuarios: "Administracion de accesos y roles",
};

window.currentUser    = null;
window.currentViewKey = "dashboard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(text = "") {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function humanizeRole(role = "") {
  return String(role)
    .split("_")
    .map((part) => capitalize(part))
    .join(" ");
}

function setTodayDate() {
  const todayDate = document.getElementById("todayDate");
  if (!todayDate) return;

  const formattedDate = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  todayDate.textContent = capitalize(formattedDate);
}

// ── Theme ────────────────────────────────────────────────────────────────────

const THEME_KEY = "sgi_theme";

function applyTheme(value) {
  const html = document.documentElement;
  if (value === "dark") {
    html.setAttribute("data-theme", "dark");
  } else if (value === "light") {
    html.setAttribute("data-theme", "light");
  } else {
    html.removeAttribute("data-theme");
  }
  localStorage.setItem(THEME_KEY, value);
  document.querySelectorAll("[data-theme-val]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeVal === value);
  });
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "system");
}

// ── Navigation ───────────────────────────────────────────────────────────────

function setActiveNav(viewKey) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewKey);
  });
}

function setViewTitle(title, viewKey = "dashboard") {
  const viewTitle = document.getElementById("viewTitle");
  const topbarSubtitle = document.getElementById("topbarSubtitle");

  if (viewTitle) {
    viewTitle.textContent = title;
  }

  if (topbarSubtitle) {
    topbarSubtitle.textContent =
      TOPBAR_SUBTITLES[viewKey] || "Centro de operación inmobiliaria";
  }
}

function renderMissingView(viewKey, triedNames = []) {
  const names = triedNames.length ? triedNames.join(", ") : "ninguno";
  return `
    <section class="table-wrap" style="padding: 24px;">
      <div class="table-header"><h3>Vista no disponible</h3></div>
      <div style="padding: 20px; color: var(--text-muted); line-height: 1.6;">
        <p>No se encontro una funcion valida para la vista <strong style="color: var(--text);">${viewKey}</strong>.</p>
        <p>Se intento buscar: <strong style="color: var(--text);">${names}</strong>.</p>
      </div>
    </section>
  `;
}

function renderViewError(title) {
  return `
    <section class="table-wrap" style="padding: 24px;">
      <div class="table-header"><h3>Error al cargar la vista</h3></div>
      <div style="padding: 20px; color: var(--danger); line-height: 1.6;">
        Ocurrio un error cargando <strong>${title}</strong>. Revisa la consola para mas detalles.
      </div>
    </section>
  `;
}

function renderAccessDenied() {
  return `
    <section class="table-wrap" style="padding: 24px;">
      <div class="table-header"><h3>Acceso restringido</h3></div>
      <div style="padding: 20px; color: var(--text-muted); line-height: 1.6;">
        <p>No tienes permiso para ver esta seccion.</p>
      </div>
    </section>
  `;
}

function resolveViewFunction(viewKey, view) {
  const normalizedKey = capitalize(viewKey);
  const candidates = [view.fn, `${viewKey}View`, `render${normalizedKey}`, viewKey];
  for (const name of candidates) {
    if (typeof window[name] === "function") return { fn: window[name], candidates };
  }
  return { fn: null, candidates };
}

function navigate(viewKey, updateHash = true) {
  const view          = VIEWS[viewKey];
  const viewContainer = document.getElementById("viewContainer");
  if (!view) return;

  const permitidas = VISTAS_POR_ROL[window.currentUser?.rol] ?? [];
  if (!permitidas.includes(viewKey)) {
    setActiveNav(viewKey);
    setViewTitle(view.title, viewKey);
    if (viewContainer) viewContainer.innerHTML = renderAccessDenied();
    window.SGIUI?.hydrate();
    return;
  }

  window.currentViewKey = viewKey;
  setActiveNav(viewKey);
  setViewTitle(view.title, viewKey);

  const { fn: viewFn, candidates } = resolveViewFunction(viewKey, view);

  if (!viewFn) {
    if (viewContainer) viewContainer.innerHTML = renderMissingView(viewKey, candidates);
    window.SGIUI?.hydrate();
    return;
  }

  try {
    if (viewContainer) viewContainer.innerHTML = "";
    const result = viewFn(viewContainer);
    if (viewContainer) {
      if (typeof result === "string") {
        viewContainer.innerHTML = result;
      } else if (result instanceof Node) {
        viewContainer.replaceChildren(result);
      } else if (Array.isArray(result) && result.every((item) => item instanceof Node)) {
        viewContainer.replaceChildren(...result);
      }
    }
  } catch (error) {
    console.error(`Error al cargar la vista "${viewKey}":`, error);
    if (viewContainer) viewContainer.innerHTML = renderViewError(view.title);
  }

  window.SGIUI?.hydrate();
  if (updateHash && window.location.hash !== `#${viewKey}`) {
    window.location.hash = viewKey;
  }
}

function aplicarMenuPorRol(rol) {
  const permitidas = VISTAS_POR_ROL[rol] ?? [];
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.style.display = permitidas.includes(btn.dataset.view) ? "" : "none";
  });
}

// ── User menu panel ───────────────────────────────────────────────────────────

function initUserMenu(perfil) {
  const btn   = document.getElementById("userMenuBtn");
  const panel = document.getElementById("userMenuPanel");
  if (!btn || !panel) return;

  const canEdit    = perfil.rol === "comprador" || perfil.rol === "comisionista";
  const savedTheme = localStorage.getItem(THEME_KEY) || "system";

  panel.innerHTML = `
    <div class="ump-header">
      <div class="ump-avatar"><i data-lucide="user"></i></div>
      <div class="ump-identity">
        <span class="ump-email">${perfil.email}</span>
        <span class="ump-role">${humanizeRole(perfil.rol)}</span>
      </div>
    </div>

    <div class="ump-divider"></div>

    <div class="ump-section">
      <span class="ump-label">Tema</span>
      <div class="ump-theme-row">
        <button class="ump-theme-btn${savedTheme === "system" ? " active" : ""}" data-theme-val="system">
          <i data-lucide="monitor"></i><span>Sistema</span>
        </button>
        <button class="ump-theme-btn${savedTheme === "light" ? " active" : ""}" data-theme-val="light">
          <i data-lucide="sun"></i><span>Claro</span>
        </button>
        <button class="ump-theme-btn${savedTheme === "dark" ? " active" : ""}" data-theme-val="dark">
          <i data-lucide="moon"></i><span>Oscuro</span>
        </button>
      </div>
    </div>

    ${canEdit ? `
    <div class="ump-divider"></div>
    <button class="ump-action" id="ump-edit-profile">
      <i data-lucide="user-pen"></i><span>Editar perfil</span>
    </button>
    ` : ""}

    <div class="ump-divider"></div>
    <button class="ump-action" id="ump-change-pwd">
      <i data-lucide="key-round"></i><span>Cambiar contrasena</span>
    </button>

    <div class="ump-divider"></div>
    <button class="ump-action ump-action--danger" id="ump-logout">
      <i data-lucide="log-out"></i><span>Cerrar sesion</span>
    </button>
  `;

  window.SGIUI?.hydrate();

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
    }
  });

  panel.addEventListener("click", (e) => {
    const themeBtn = e.target.closest("[data-theme-val]");
    if (themeBtn) applyTheme(themeBtn.dataset.themeVal);
  });

  document.getElementById("ump-logout")?.addEventListener("click", async () => {
    const auth = window._firebaseAuth;
    if (auth) {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await signOut(auth);
    }
    localStorage.removeItem("fb_token");
    window.location.href = "/login.html";
  });

  if (canEdit) {
    document.getElementById("ump-edit-profile")?.addEventListener("click", () => {
      panel.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      renderEditProfileView(perfil);
    });
  }

  document.getElementById("ump-change-pwd")?.addEventListener("click", () => {
    panel.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    renderChangePasswordView();
  });
}

// ── Change password view ──────────────────────────────────────────────────────

function renderChangePasswordView() {
  const previousView  = window.currentViewKey || "dashboard";
  const viewContainer = document.getElementById("viewContainer");
  if (!viewContainer) return;

  setActiveNav("");
  setViewTitle("Cambiar contrasena");

  const user            = window._firebaseAuth?.currentUser;
  const isEmailProvider = user?.providerData?.some((p) => p.providerId === "password");

  if (!isEmailProvider) {
    viewContainer.innerHTML = `
      <div class="auth-card-wrap">
        <div class="auth-card">
          <div class="auth-card-brand">
            <div class="auth-card-icon"><i data-lucide="key-round"></i></div>
            <div>
              <div class="auth-card-title">Cambiar contrasena</div>
              <div class="auth-card-sub">Seguridad de cuenta</div>
            </div>
          </div>
          <p style="color:var(--text-muted);font-size:.9rem;line-height:1.6;margin-bottom:1.5rem;">
            Tu cuenta usa inicio de sesion con Google. Para gestionar tu contrasena, visita tu cuenta de Google.
          </p>
          <button class="auth-card-btn" id="back-from-pwd">
            <i data-lucide="arrow-left"></i> Volver
          </button>
        </div>
      </div>
    `;
    window.SGIUI?.hydrate();
    document.getElementById("back-from-pwd")?.addEventListener("click", () => navigate(previousView));
    return;
  }

  viewContainer.innerHTML = `
    <div class="auth-card-wrap">
      <div class="auth-card">
        <div class="auth-card-brand">
          <div class="auth-card-icon"><i data-lucide="key-round"></i></div>
          <div>
            <div class="auth-card-title">Cambiar contrasena</div>
            <div class="auth-card-sub">Seguridad de cuenta</div>
          </div>
        </div>

        <div class="auth-card-field">
          <label>Contrasena actual</label>
          <input type="password" id="pwd-current" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div class="auth-card-field">
          <label>Nueva contrasena</label>
          <input type="password" id="pwd-new" placeholder="Minimo 8 caracteres" autocomplete="new-password" />
          <div class="pwd-rules">
            <span class="pwd-rule" id="pr-len">Minimo 8 caracteres</span>
            <span class="pwd-rule" id="pr-upper">Una letra mayuscula</span>
            <span class="pwd-rule" id="pr-num">Un numero</span>
          </div>
        </div>
        <div class="auth-card-field">
          <label>Confirmar contrasena</label>
          <input type="password" id="pwd-confirm" placeholder="Repite la contrasena" autocomplete="new-password" />
        </div>

        <div class="auth-card-error" id="pwd-error"></div>
        <div class="auth-card-success" id="pwd-success"></div>

        <button class="auth-card-btn auth-card-btn--primary" id="btn-change-pwd">Actualizar contrasena</button>
        <button class="auth-card-btn" id="back-from-pwd">
          <i data-lucide="arrow-left"></i> Volver
        </button>
      </div>
    </div>
  `;

  window.SGIUI?.hydrate();

  document.getElementById("pwd-new")?.addEventListener("input", (e) => {
    const val = e.target.value;
    document.getElementById("pr-len")?.classList.toggle("ok", val.length >= 8);
    document.getElementById("pr-upper")?.classList.toggle("ok", /[A-Z]/.test(val));
    document.getElementById("pr-num")?.classList.toggle("ok", /[0-9]/.test(val));
  });

  document.getElementById("back-from-pwd")?.addEventListener("click", () => navigate(previousView));

  document.getElementById("btn-change-pwd")?.addEventListener("click", async () => {
    const current   = document.getElementById("pwd-current").value;
    const newPwd    = document.getElementById("pwd-new").value;
    const confirm   = document.getElementById("pwd-confirm").value;
    const errorEl   = document.getElementById("pwd-error");
    const successEl = document.getElementById("pwd-success");
    const btn       = document.getElementById("btn-change-pwd");

    errorEl.style.display   = "none";
    successEl.style.display = "none";

    if (!current || !newPwd || !confirm) {
      errorEl.textContent  = "Completa todos los campos.";
      errorEl.style.display = "block";
      return;
    }
    if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
      errorEl.textContent  = "La contrasena no cumple los requisitos.";
      errorEl.style.display = "block";
      return;
    }
    if (newPwd !== confirm) {
      errorEl.textContent  = "Las contrasenass no coinciden.";
      errorEl.style.display = "block";
      return;
    }

    btn.disabled     = true;
    btn.textContent  = "Actualizando...";

    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import(
        "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
      );
      const fbUser   = window._firebaseAuth?.currentUser;
      const cred     = EmailAuthProvider.credential(fbUser.email, current);
      await reauthenticateWithCredential(fbUser, cred);
      await updatePassword(fbUser, newPwd);

      successEl.textContent  = "Contrasena actualizada correctamente.";
      successEl.style.display = "block";
      setTimeout(() => navigate(previousView), 2000);
    } catch (err) {
      const MAP = {
        "auth/wrong-password":    "La contrasena actual es incorrecta.",
        "auth/too-many-requests": "Demasiados intentos. Intenta mas tarde.",
        "auth/weak-password":     "La contrasena nueva es demasiado debil.",
        "auth/invalid-credential": "La contrasena actual es incorrecta.",
      };
      errorEl.textContent  = MAP[err.code] || err.message;
      errorEl.style.display = "block";
      btn.disabled    = false;
      btn.textContent = "Actualizar contrasena";
    }
  });
}

// ── Edit profile view ─────────────────────────────────────────────────────────

function renderEditProfileView(perfil) {
  const previousView  = window.currentViewKey || "dashboard";
  const viewContainer = document.getElementById("viewContainer");
  if (!viewContainer) return;

  setActiveNav("");
  setViewTitle("Editar perfil");

  viewContainer.innerHTML = `
    <div class="auth-card-wrap">
      <div class="auth-card">
        <div class="auth-card-brand">
          <div class="auth-card-icon"><i data-lucide="user-pen"></i></div>
          <div>
            <div class="auth-card-title">Editar perfil</div>
            <div class="auth-card-sub">${perfil.email}</div>
          </div>
        </div>

        <div class="auth-card-grid-2">
          <div class="auth-card-field">
            <label>Nombres <span style="color:var(--danger)">*</span></label>
            <input type="text" id="ep-nombres" value="${perfil.nombres || ""}" placeholder="Nombres" />
          </div>
          <div class="auth-card-field">
            <label>Apellidos <span style="color:var(--danger)">*</span></label>
            <input type="text" id="ep-apellidos" value="${perfil.apellidos || ""}" placeholder="Apellidos" />
          </div>
        </div>

        <div class="auth-card-field">
          <label>Telefono <span style="color:var(--text-muted);font-weight:400;">(opcional)</span></label>
          <input type="tel" id="ep-telefono" value="${perfil.telefono || ""}" placeholder="Ej: 3001234567" />
        </div>

        <div class="auth-card-error" id="ep-error"></div>
        <div class="auth-card-success" id="ep-success"></div>

        <button class="auth-card-btn auth-card-btn--primary" id="btn-save-profile">Guardar cambios</button>
        <button class="auth-card-btn" id="back-from-ep">
          <i data-lucide="arrow-left"></i> Volver
        </button>
      </div>
    </div>
  `;

  window.SGIUI?.hydrate();

  document.getElementById("back-from-ep")?.addEventListener("click", () => navigate(previousView));

  document.getElementById("btn-save-profile")?.addEventListener("click", async () => {
    const nombres   = document.getElementById("ep-nombres").value.trim();
    const apellidos = document.getElementById("ep-apellidos").value.trim();
    const telefono  = document.getElementById("ep-telefono").value.trim();
    const errorEl   = document.getElementById("ep-error");
    const successEl = document.getElementById("ep-success");
    const btn       = document.getElementById("btn-save-profile");

    errorEl.style.display   = "none";
    successEl.style.display = "none";

    if (!nombres || !apellidos) {
      errorEl.textContent  = "Nombres y apellidos son obligatorios.";
      errorEl.style.display = "block";
      return;
    }

    btn.disabled    = true;
    btn.textContent = "Guardando...";

    try {
      await API.put("/auth/perfil", { nombres, apellidos, telefono: telefono || undefined });
      window.currentUser.nombres   = nombres;
      window.currentUser.apellidos = apellidos;
      window.currentUser.telefono  = telefono;

      successEl.textContent  = "Perfil actualizado correctamente.";
      successEl.style.display = "block";
      setTimeout(() => navigate(previousView), 1800);
    } catch (err) {
      errorEl.textContent  = err.message || "Error al guardar. Intenta de nuevo.";
      errorEl.style.display = "block";
      btn.disabled    = false;
      btn.textContent = "Guardar cambios";
    }
  });
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function applySidebarState(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);

  const toggle = document.getElementById("sidebarToggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(collapsed));
    toggle.title = collapsed ? "Expandir barra lateral" : "Colapsar barra lateral";
    toggle.innerHTML = collapsed
      ? '<i data-lucide="panel-left-open"></i>'
      : '<i data-lucide="panel-left-close"></i>';

    window.SGIUI?.hydrate();
  }
}

function initSidebarToggle() {
  const toggle = document.getElementById("sidebarToggle");
  if (!toggle) return;

  const STORAGE_KEY = "sgi_sidebar_collapsed";
  const savedState = localStorage.getItem(STORAGE_KEY) === "1";

  applySidebarState(savedState);

  toggle.addEventListener("click", () => {
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    applySidebarState(collapsed);
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  });
}

// ── Onboarding modal (comprador / comisionista) ───────────────────────────────

function parseDisplayName(displayName = "") {
  const parts = displayName.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return { nombres: "", apellidos: "" };
  if (parts.length === 1) return { nombres: parts[0], apellidos: "" };
  const mid = Math.ceil(parts.length / 2);
  return { nombres: parts.slice(0, mid).join(" "), apellidos: parts.slice(mid).join(" ") };
}

function mostrarOnboarding(perfil, firebaseUser) {
  const overlay = document.createElement("div");
  overlay.id = "onboarding-overlay";
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,0.6);
    display:flex; align-items:center; justify-content:center;
  `;

  const { nombres, apellidos } = parseDisplayName(firebaseUser?.displayName || "");
  const labelRol = perfil.rol === "comisionista" ? "Comisionista" : "Comprador";

  overlay.innerHTML = `
    <div style="
      background:var(--surface,#fff); border-radius:12px; padding:2rem;
      width:min(480px,94vw); box-shadow:0 8px 32px rgba(0,0,0,.25);
    ">
      <h2 style="margin:0 0 .5rem; font-size:1.25rem;">Completa tu perfil</h2>
      <p style="margin:0 0 1.5rem; color:var(--text-muted,#666); font-size:.9rem;">
        Para continuar como <strong>${labelRol}</strong> necesitamos algunos datos de identidad.
      </p>
      <div style="display:grid; gap:.875rem;">
        <div>
          <label style="display:block; font-size:.85rem; margin-bottom:.3rem; font-weight:500;">
            Correo electronico
          </label>
          <input type="email" value="${perfil.email}" disabled
            style="width:100%; padding:.5rem .75rem; border:1px solid var(--border,#ddd);
                   border-radius:8px; background:var(--surface2,#f5f5f5);
                   color:var(--text-muted,#888); box-sizing:border-box;" />
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:.75rem;">
          <div>
            <label style="display:block; font-size:.85rem; margin-bottom:.3rem; font-weight:500;">
              Nombres <span style="color:var(--danger,red)">*</span>
            </label>
            <input id="ob-nombres" type="text" value="${nombres}"
              placeholder="Nombres"
              style="width:100%; padding:.5rem .75rem; border:1px solid var(--border,#ddd);
                     border-radius:8px; background:var(--surface,#fff);
                     color:var(--text,#111); box-sizing:border-box;" />
          </div>
          <div>
            <label style="display:block; font-size:.85rem; margin-bottom:.3rem; font-weight:500;">
              Apellidos <span style="color:var(--danger,red)">*</span>
            </label>
            <input id="ob-apellidos" type="text" value="${apellidos}"
              placeholder="Apellidos"
              style="width:100%; padding:.5rem .75rem; border:1px solid var(--border,#ddd);
                     border-radius:8px; background:var(--surface,#fff);
                     color:var(--text,#111); box-sizing:border-box;" />
          </div>
        </div>
        <div>
          <label style="display:block; font-size:.85rem; margin-bottom:.3rem; font-weight:500;">
            Cedula de ciudadania <span style="color:var(--danger,red)">*</span>
          </label>
          <input id="ob-documento" type="text" placeholder="Ej: 1234567890"
            style="width:100%; padding:.5rem .75rem; border:1px solid var(--border,#ddd);
                   border-radius:8px; background:var(--surface,#fff);
                   color:var(--text,#111); box-sizing:border-box;" />
        </div>
        <div>
          <label style="display:block; font-size:.85rem; margin-bottom:.3rem; font-weight:500;">
            Telefono <span style="color:var(--text-muted,#888); font-weight:400;">(opcional)</span>
          </label>
          <input id="ob-telefono" type="tel" placeholder="Ej: 3001234567"
            style="width:100%; padding:.5rem .75rem; border:1px solid var(--border,#ddd);
                   border-radius:8px; background:var(--surface,#fff);
                   color:var(--text,#111); box-sizing:border-box;" />
        </div>
        <div id="ob-error" style="display:none; color:var(--danger,red); font-size:.85rem;"></div>
        <button id="ob-submit" class="btn btn-primary" style="width:100%; margin-top:.25rem;">
          Guardar y continuar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("ob-submit").addEventListener("click", async () => {
    const nombres   = document.getElementById("ob-nombres").value.trim();
    const apellidos = document.getElementById("ob-apellidos").value.trim();
    const documento = document.getElementById("ob-documento").value.trim();
    const telefono  = document.getElementById("ob-telefono").value.trim();
    const errorEl   = document.getElementById("ob-error");
    const btn       = document.getElementById("ob-submit");

    if (!nombres || !apellidos || !documento) {
      errorEl.textContent  = "Nombres, apellidos y cedula son obligatorios.";
      errorEl.style.display = "block";
      return;
    }

    errorEl.style.display = "none";
    btn.disabled    = true;
    btn.textContent = "Guardando...";

    try {
      await API.post("/auth/completar-perfil", { nombres, apellidos, documento, telefono: telefono || undefined });
      overlay.remove();
    } catch (err) {
      errorEl.textContent  = err.message || "Error al guardar. Intenta de nuevo.";
      errorEl.style.display = "block";
      btn.disabled    = false;
      btn.textContent = "Guardar y continuar";
    }
  });
}

// ── App init ──────────────────────────────────────────────────────────────────

function getInitialView() {
  const hash = window.location.hash.replace("#", "").trim();
  return VIEWS[hash] ? hash : "dashboard";
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewKey = btn.dataset.view;
      if (viewKey) navigate(viewKey);
    });
  });
}


function redirigirConDelay(url, segundos = 4) {
  console.log(`[REDIRECT] Redirigiendo a ${url} en ${segundos} segundos...`);
  setTimeout(() => {
    window.location.href = url;
  }, segundos * 1000);
}

async function iniciarApp() {
  initTheme();

  let firebaseUser = null;

  try {
    firebaseUser = await Promise.race([
      esperarAuthListo(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firebase tardo demasiado")), 5000)
      ),
    ]);
  } catch (e) {
    redirigirConDelay("/login.html");
    return;
  }

  if (!firebaseUser) {
    window.location.href = "/login.html";
    return;
  }

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

    const necesitaOnboarding =
      (perfil.rol === "comprador"    && !perfil.id_comprador) ||
      (perfil.rol === "comisionista" && !perfil.id_comisionista);

    if (necesitaOnboarding) {
      aplicarMenuPorRol(perfil.rol);
      initUserMenu(perfil);
      window.SGIUI?.hydrate();
      initSidebarToggle();
      mostrarOnboarding(perfil, firebaseUser);
      return;
    }

    aplicarMenuPorRol(perfil.rol);
    initUserMenu(perfil);
    initSidebarToggle();
    // renderUsuarioHeader(perfil);
    window.SGIUI?.hydrate();
    setTodayDate();
    bindNavigation();

    window.addEventListener("hashchange", () => {
      navigate(getInitialView(), false);
    });

    navigate(getInitialView(), false);
  } catch (err) {
    console.error("Error cargando perfil:", err.message);

    // Solo hace signOut si Firebase confirma que no hay sesión activa.
    // Un error de red o Supabase lento no debe cerrar la sesión.
    const firebaseUser = window._firebaseAuth?.currentUser;
    if (!firebaseUser) {
      localStorage.removeItem("fb_token");
      redirigirConDelay("/login.html");
      return;
    }

    // Hay sesión Firebase activa — muestra error sin cerrar sesión
    const vc = document.getElementById("viewContainer");
    if (vc) {
      vc.innerHTML = `
        <section class="table-wrap" style="padding:24px">
          <div class="table-header"><h3>Error al cargar el perfil</h3></div>
          <div style="padding:20px;color:var(--danger);line-height:1.6">
            ${err.message}<br><br>
            <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>
          </div>
        </section>`;
    }
  }
}

iniciarApp();
window.navigate = navigate;