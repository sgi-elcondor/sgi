import { esperarAuthListo } from "./auth.js";

const VIEWS = {
  dashboard:     { fn: "dashboardView",     title: "Dashboard" },
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
  alertas:       { fn: "alertasView",       title: "Alertas Jurídicas" },
  auditoria:     { fn: "auditoriaView",     title: "Auditoría" },
  usuarios:      { fn: "usuariosView",      title: "Gestión de Usuarios" },
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
  asesor_comercial: [
    "dashboard", "proyectos", "lotes", "compradores", "ventas"
  ],
};

window.currentUser = null;

function capitalize(text = "") {
  return text.charAt(0).toUpperCase() + text.slice(1);
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

function setActiveNav(viewKey) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewKey);
  });
}

function setViewTitle(title) {
  const viewTitle = document.getElementById("viewTitle");
  if (viewTitle) {
    viewTitle.textContent = title;
  }
}

function renderMissingView(viewKey, triedNames = []) {
  const names = triedNames.length ? triedNames.join(", ") : "ninguno";

  return `
    <section class="table-wrap" style="padding: 24px;">
      <div class="table-header">
        <h3>Vista no disponible</h3>
      </div>
      <div style="padding: 20px; color: var(--text-muted); line-height: 1.6;">
        <p>No se encontró una función válida para la vista <strong style="color: var(--text);">${viewKey}</strong>.</p>
        <p>Se intentó buscar: <strong style="color: var(--text);">${names}</strong>.</p>
        <p>Asegúrate de que el archivo JS de la vista esté cargado y exponga la función en <code>window</code>.</p>
      </div>
    </section>
  `;
}

function renderViewError(title) {
  return `
    <section class="table-wrap" style="padding: 24px;">
      <div class="table-header">
        <h3>Error al cargar la vista</h3>
      </div>
      <div style="padding: 20px; color: var(--danger); line-height: 1.6;">
        Ocurrió un error cargando <strong>${title}</strong>. Revisa la consola para más detalles.
      </div>
    </section>
  `;
}

function renderAccessDenied() {
  return `
    <div style="text-align:center; margin-top:4rem; color:#888;">
      <h2>⛔ Sin acceso</h2>
      <p>No tienes permiso para ver esta sección.</p>
    </div>
  `;
}

function resolveViewFunction(viewKey, view) {
  const normalizedKey = capitalize(viewKey);
  const candidates = [
    view.fn,
    `${viewKey}View`,
    `render${normalizedKey}`,
    viewKey,
  ];

  for (const name of candidates) {
    if (typeof window[name] === "function") {
      return { fn: window[name], candidates };
    }
  }

  return { fn: null, candidates };
}

function navigate(viewKey, updateHash = true) {
  const view = VIEWS[viewKey];
  const viewContainer = document.getElementById("viewContainer");

  if (!view) return;

  const permitidas = VISTAS_POR_ROL[window.currentUser?.rol] ?? [];
  if (!permitidas.includes(viewKey)) {
    setActiveNav(viewKey);
    setViewTitle(view.title);
    if (viewContainer) viewContainer.innerHTML = renderAccessDenied();
    return;
  }

  setActiveNav(viewKey);
  setViewTitle(view.title);

  const { fn: viewFn, candidates } = resolveViewFunction(viewKey, view);

  if (!viewFn) {
    if (viewContainer) viewContainer.innerHTML = renderMissingView(viewKey, candidates);
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

function renderUsuarioHeader(perfil) {
  const el = document.getElementById("usuarioInfo");
  if (!el) return;

  el.innerHTML = `
    <span class="badge badge-${perfil.rol}" style="
      padding:.25rem .65rem;border-radius:999px;font-size:.75rem;
      background:#e8edff;color:#3d5af1;font-weight:600;">
      ${perfil.rol}
    </span>
    <span style="font-size:.85rem;color:#555;">${perfil.email}</span>
    <button id="btn-logout" style="
      padding:.3rem .8rem;border:1px solid #ddd;border-radius:6px;
      background:#fff;cursor:pointer;font-size:.8rem;color: #222222">
      Cerrar sesión
    </button>
  `;

  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    const auth = window._firebaseAuth;
    if (auth) {
      const { signOut } = await import(
        "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
      );
      await signOut(auth);
    }
    localStorage.removeItem("fb_token");
    window.location.href = "/login.html";
  });
}

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
  let firebaseUser = null;

  try {
    firebaseUser = await Promise.race([
      esperarAuthListo(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firebase tardó demasiado")), 5000)
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

    aplicarMenuPorRol(perfil.rol);
    renderUsuarioHeader(perfil);
    setTodayDate();
    bindNavigation();

    window.addEventListener("hashchange", () => {
      navigate(getInitialView(), false);
    });

    navigate(getInitialView(), false);
  } catch (err) {
    console.error("Error cargando perfil:", err.message);
    localStorage.removeItem("fb_token");

    try {
      const auth = window._firebaseAuth;
      if (auth?.currentUser) {
        const { signOut } = await import(
          "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
        );
        await signOut(auth);
      }
    } catch (e) {}

    redirigirConDelay("/login.html");
  }
}

iniciarApp();
window.navigate = navigate;
