// Live updates client (REQ-07): subscribes to the requerimientos SSE stream,
// silently refreshes the module views, shows toasts for other users' actions
// and keeps the sidebar badges in sync. Falls back to polling if SSE fails.
(function () {

  const STREAM_URL   = "/api/v1/requerimientos/stream";
  // Views refreshed when a requerimiento moves. Besides the four flow views, a
  // recepción feeds the stock ledger, and a desembolso creates a gasto and links
  // an empresa aliada: those three would otherwise show stale data until the user
  // reloaded by hand.
  const LIVE_VIEWS   = {
    requerimientos:     "requerimientosView",
    aprobaciones:       "aprobacionesView",
    desembolsos:        "desembolsosView",
    recepciones:        "recepcionesView",
    inventario:         "inventarioView",
    gastos:             "gastosView",
    "empresas-aliadas": "empresasAliadasView",
  };
  // Must stay aligned with STREAM_PERMS in requerimientos.controller.js: the
  // backend accepts the stream for any of these, and a role that the backend
  // admits but this list omits would never open the connection.
  const MODULE_PERMS = [
    ["requerimientos", "leer"],
    ["requerimientos", "aprobar_jefe"],
    ["requerimientos", "aprobar_final"],
    ["requerimientos", "aprobar_dueno"],
    ["requerimientos", "aprobar_gerencia"],
    ["requerimientos", "desembolsar"],
    ["recepciones", "leer"],
  ];
  const MAX_SSE_RETRIES = 6;
  const POLL_MS         = 30000;

  let es           = null;
  let retries      = 0;
  let pollTimer    = null;
  let refreshTimer = null;
  let badgeTimer   = null;
  let lastCounts   = {};

  function esDelModulo() {
    if (window.currentUser?.rol === "admin") return true;
    return MODULE_PERMS.some(([r, a]) => window.AppState?.can(r, a));
  }

  // ── Refresh de la vista activa (silencioso, con debounce para ráfagas) ────
  function refreshCurrentView() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function tick() {
      const fnName = LIVE_VIEWS[window.currentViewKey];
      if (!fnName || typeof window[fnName] !== "function") return;

      // Re-rendering the view while a modal is open would wipe the form the user
      // is filling. Postpone instead of dropping the refresh, so the view still
      // converges once the modal closes.
      if (document.getElementById("modalOverlay")?.classList.contains("open")) {
        refreshTimer = setTimeout(tick, 2000);
        return;
      }

      window[fnName]();
    }, 400);
  }

  // ── Badges del sidebar ────────────────────────────────────────────────────
  async function refreshBadges() {
    try {
      const counts = await API.get("/requerimientos/contadores");
      lastCounts = counts || {};
      renderBadges();
    } catch (_) { /* badges are best-effort */ }
  }

  function renderBadges() {
    Object.keys(LIVE_VIEWS).forEach(view => {
      const item = document.querySelector(`.nav-item[data-view="${view}"]`);
      if (!item) return;
      let badge = item.querySelector(".nav-live-badge");
      const n = lastCounts[view] || 0;
      if (!n) {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "nav-live-badge";
        item.appendChild(badge);
      }
      badge.textContent = n > 99 ? "99+" : String(n);
    });
  }

  function scheduleBadges() {
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => {
      refreshBadges();
      window.SGINotif?.refresh();
    }, 600);
  }

  // ── Indicador "En vivo" en el topbar ──────────────────────────────────────
  function setLiveDot(on) {
    let dot = document.getElementById("liveDot");
    if (!dot) {
      // Anchored to the heading container: the h1 text is rewritten on every
      // navigation and would wipe the indicator.
      const heading = document.querySelector(".topbar-heading");
      if (!heading) return;
      dot = document.createElement("span");
      dot.id = "liveDot";
      dot.className = "live-dot";
      dot.textContent = "En vivo";
      heading.appendChild(dot);
    }
    dot.classList.toggle("on", !!on);
    dot.title = on
      ? "Actualizaciones en tiempo real activas"
      : "Sin conexión en vivo — actualizando periódicamente";
  }

  // ── Manejo de eventos ─────────────────────────────────────────────────────
  function handle(ev) {
    if (!ev || ev.tipo !== "requerimiento") return;

    const propio = ev.por != null && ev.por === window.currentUser?.id_usuario;

    if (!propio) {
      const label = window.SGIReq?.ESTADO_LABEL?.[ev.estado]?.label || ev.estado;
      UI.toast(`${ev.numero} → ${label}`, "info");
      // If the peticionario is looking at his list, glow the row that just moved.
      if (window.currentViewKey === "requerimientos") window.SGIReq?.markLive?.(ev.id_requerimiento);
    }

    refreshCurrentView();
    scheduleBadges();
  }

  // ── Conexión SSE ──────────────────────────────────────────────────────────
  function connect() {
    const token = localStorage.getItem("fb_token");
    if (!token) return;

    try { es?.close(); } catch (_) {}
    es = new EventSource(`${STREAM_URL}?token=${encodeURIComponent(token)}`);

    es.onopen = () => {
      retries = 0;
      stopPolling();
      setLiveDot(true);
    };

    es.onmessage = e => {
      try { handle(JSON.parse(e.data)); } catch (_) {}
    };

    es.onerror = () => {
      try { es.close(); } catch (_) {}
      es = null;
      retries++;
      setLiveDot(false);
      if (retries <= MAX_SSE_RETRIES) {
        // Fresh token on every retry: Firebase rotates it every hour.
        setTimeout(connect, Math.min(30000, 1000 * 2 ** retries));
      } else {
        startPolling();
      }
    };
  }

  // ── Respaldo: polling suave si SSE no está disponible ─────────────────────
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (LIVE_VIEWS[window.currentViewKey]) refreshCurrentView();
      refreshBadges();
    }, POLL_MS);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // ── API pública ───────────────────────────────────────────────────────────
  window.SGILive = {
    init() {
      if (!esDelModulo()) return;
      connect();
      refreshBadges();
    },
    refreshBadges,
  };

})();
