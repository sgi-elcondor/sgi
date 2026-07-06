// Notification center (REQ-07): topbar bell with unread badge, dropdown panel,
// mark-as-read and click-to-navigate. Refreshed live by live-updates.js and
// drives the browser tab title counter.
(function () {

  const TITLE_BASE = "SGI · El Cóndor";

  let _items    = [];
  let _noLeidas = 0;
  let _abierto  = false;

  const icon = (name) => window.SGIUI?.icon(name) ?? "";

  function tiempoRelativo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1)  return "ahora";
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? "ayer" : `hace ${d} días`;
  }

  function updateTitle() {
    document.title = _noLeidas > 0 ? `(${_noLeidas}) ${TITLE_BASE}` : TITLE_BASE;
  }

  function renderBadge() {
    const badge = document.getElementById("notif-badge");
    if (!badge) return;
    if (_noLeidas > 0) {
      badge.textContent = _noLeidas > 99 ? "99+" : String(_noLeidas);
      badge.style.display = "";
    } else {
      badge.style.display = "none";
    }
  }

  function renderPanel() {
    const list = document.getElementById("notif-list");
    if (!list) return;

    if (!_items.length) {
      list.innerHTML = `
        <div class="notif-empty">
          ${icon("bell-off")}
          <p>No tienes notificaciones todavía.</p>
        </div>`;
    } else {
      list.innerHTML = _items.map(n => `
        <button class="notif-item ${n.leida ? "" : "unread"}" data-id="${n.id_notificacion}" data-vista="${n.vista || ""}">
          <span class="notif-dot"></span>
          <span class="notif-body">
            <span class="notif-titulo">${n.titulo}</span>
            ${n.mensaje ? `<span class="notif-mensaje">${n.mensaje}</span>` : ""}
            <span class="notif-tiempo">${tiempoRelativo(n.created_at)}</span>
          </span>
        </button>`).join("");
    }
    window.SGIUI?.hydrate();
  }

  async function refresh() {
    try {
      const data = await API.get("/notificaciones");
      _items    = data.items || [];
      _noLeidas = data.no_leidas || 0;
      renderBadge();
      updateTitle();
      if (_abierto) renderPanel();
    } catch (_) { /* best-effort */ }
  }

  function togglePanel(force) {
    const panel = document.getElementById("notif-panel");
    if (!panel) return;
    _abierto = force != null ? force : !_abierto;
    panel.classList.toggle("open", _abierto);
    if (_abierto) renderPanel();
  }

  function inject() {
    const actions = document.querySelector(".topbar-actions");
    if (!actions || document.getElementById("notif-bell")) return;

    const wrap = document.createElement("div");
    wrap.className = "notif-wrap";
    wrap.innerHTML = `
      <button type="button" class="notif-bell" id="notif-bell" aria-label="Notificaciones" title="Notificaciones">
        ${icon("bell")}
        <span class="notif-badge" id="notif-badge" style="display:none"></span>
      </button>
      <div class="notif-panel" id="notif-panel">
        <div class="notif-head">
          <span>Notificaciones</span>
          <button type="button" class="notif-mark-all" id="notif-mark-all">Marcar todas como leídas</button>
        </div>
        <div class="notif-list" id="notif-list"></div>
      </div>`;

    actions.insertBefore(wrap, actions.firstChild);
    window.SGIUI?.hydrate();

    document.getElementById("notif-bell").addEventListener("click", e => {
      e.stopPropagation();
      togglePanel();
    });

    document.getElementById("notif-mark-all").addEventListener("click", async () => {
      try {
        await API.patch("/notificaciones/leidas", {});
        await refresh();
      } catch (_) {}
    });

    document.getElementById("notif-list").addEventListener("click", async e => {
      const item = e.target.closest(".notif-item");
      if (!item) return;
      const id    = Number(item.dataset.id);
      const vista = item.dataset.vista;

      if (item.classList.contains("unread")) {
        API.patch("/notificaciones/leidas", { ids: [id] }).then(refresh).catch(() => {});
      }
      togglePanel(false);
      if (vista && window.AppState?.hasVista(vista)) window.navigate(vista);
    });

    document.addEventListener("click", e => {
      if (_abierto && !wrap.contains(e.target)) togglePanel(false);
    });
  }

  window.SGINotif = {
    init() {
      inject();
      refresh();
    },
    refresh,
  };

})();
