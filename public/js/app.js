import { esperarAuthListo } from './auth.js';

const VIEWS = {
  dashboard:     { fn: "dashboardView",     title: "Dashboard" },
  proyectos:     { fn: "proyectosView",     title: "Proyectos" },
  lotes:         { fn: "lotesView",         title: "Lotes" },
  compradores:   { fn: "compradoresView",   title: "Compradores" },
  ventas:        { fn: "ventasView",        title: "Ventas" },
  cuotas:        { fn: "cuotasView",        title: "Cuotas Vencidas" },
  pagos:         { fn: "pagosView",         title: "Pagos" },
  comisionistas: { fn: "comisionistasView", title: "Comisionistas" },
  facturas:      { fn: "facturasView",      title: "Facturas" },
  recibos:       { fn: "recibosView",       title: "Recibos" },
  reportes:      { fn: "reportesView",      title: "Reportes" },
  alertas:       { fn: "alertasView",       title: "Alertas Jurídicas" },
  auditoria:     { fn: "auditoriaView",     title: "Auditoría" },
  usuarios:      { fn: "usuariosView",      title: "Gestión de Usuarios" },
};

// Qué vistas puede ver cada rol — modifica aquí para cambiar permisos de menú
const VISTAS_POR_ROL = {
  admin: [
    "dashboard","proyectos","lotes","compradores","ventas",
    "cuotas","pagos","comisionistas","facturas","recibos",
    "reportes","alertas","auditoria","usuarios"
  ],
  operador: [
    "dashboard","proyectos","lotes","compradores","ventas",
    "cuotas","pagos","comisionistas","facturas","recibos","reportes"
  ],
  juridico: [
    "dashboard","proyectos","lotes","compradores","ventas",
    "cuotas","reportes","alertas","auditoria"
  ],
  comprador:    ["dashboard"],
  comisionista: ["dashboard", "reportes"],
  asesor_comercial: [
    "dashboard", "proyectos", "lotes", "compradores", "ventas"
  ],
};

window.currentUser = null;

// ─────────────────────────────────────────────
// Navegación
// ─────────────────────────────────────────────
function navigate(viewKey) {
  const view = VIEWS[viewKey];
  if (!view) return;

  const permitidas = VISTAS_POR_ROL[window.currentUser?.rol] ?? [];
  if (!permitidas.includes(viewKey)) {
    document.getElementById("viewContainer")?.insertAdjacentHTML('afterbegin', `
      <div style="text-align:center;margin-top:4rem;color:#888;">
        <h2>⛔ Sin acceso</h2>
        <p>No tienes permiso para ver esta sección.</p>
      </div>`);
    return;
  }

  document.querySelectorAll(".nav-item").forEach(n =>
    n.classList.toggle("active", n.dataset.view === viewKey)
  );
  document.getElementById("viewTitle").textContent = view.title;
  window[view.fn]?.();
}

// ─────────────────────────────────────────────
// Menú según rol
// ─────────────────────────────────────────────
function aplicarMenuPorRol(rol) {
  const permitidas = VISTAS_POR_ROL[rol] ?? [];
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.style.display = permitidas.includes(btn.dataset.view) ? "" : "none";
  });
}

// ─────────────────────────────────────────────
// Header de usuario
// ─────────────────────────────────────────────
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
      background:#fff;cursor:pointer;font-size:.8rem;">
      Cerrar sesión
    </button>
  `;
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    // Llama logout desde el auth global expuesto por auth.js
    const auth = window._firebaseAuth;
    if (auth) {
      const { signOut } = await import(
        "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
      );
      await signOut(auth);
    }
    localStorage.removeItem('fb_token');
    window.location.href = '/login.html';
  });
}

// ─────────────────────────────────────────────
// Inicio: espera a Firebase, luego arranca
// ─────────────────────────────────────────────
async function iniciarApp() {  

  // Espera a que auth.js (módulo) haya creado window._authReady
  await new Promise(resolve => {
    if (window._authReady) return resolve();
    const interval = setInterval(() => {
      if (window._authReady) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
    // Timeout de seguridad: 5 segundos
    setTimeout(() => { clearInterval(interval); resolve(); }, 5000);
  });


  let firebaseUser = null;
  try {
    firebaseUser = await Promise.race([
      window._authReady,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firebase tardó demasiado')), 5000)
      )
    ]);
  } catch (e) {
    redirigirConDelay('/login.html');
    return;
  } 

  // 2. Si Firebase dice que no hay sesión → login
  if (!firebaseUser) {
    window.location.href = '/login.html';
    return;
  }

  // 3. Obtiene token fresco (refresca si expiró)
  try {
    const token = await firebaseUser.getIdToken(true);
    localStorage.setItem('fb_token', token);
  } catch (e) {
    console.error("No se pudo refrescar el token:", e.message);
    window.location.href = '/login.html';
    return;
  }

  // 4. Carga el perfil desde el backend

  function redirigirConDelay(url, segundos = 4) {
    console.log(`[REDIRECT] Redirigiendo a ${url} en ${segundos} segundos...`);
    setTimeout(() => {
      window.location.href = url; 
    }, segundos * 2000); 
  }

  try {
    const perfil = await API.get('/auth/perfil');
    window.currentUser = perfil;

    aplicarMenuPorRol(perfil.rol);
    renderUsuarioHeader(perfil);

    document.getElementById("todayDate").textContent =
      new Date().toLocaleDateString("es-CO", {
        weekday: "long", year: "numeric",
        month: "long",   day: "numeric"
      });

    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => navigate(btn.dataset.view));
    });

    navigate("dashboard");

  } catch (err) {
    console.error("Error cargando perfil:", err.message);
    localStorage.removeItem('fb_token');
    try {
      const auth = window._firebaseAuth;
      if (auth?.currentUser) {
        const { signOut } = await import(
          "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
        );
        await signOut(auth);
      }
    } catch(e) { /* silencioso */ }

    redirigirConDelay('/login.html');
    return;
  }
}

iniciarApp();
