const UI = {
  openModal(title, bodyHTML) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHTML;
    document.getElementById("modalOverlay").classList.add("open");
  },
  closeModal() { document.getElementById("modalOverlay").classList.remove("open"); },
  badge(estado) {
    const map = {
      activo:"success", activa:"success", disponible:"success", emitida:"success", ganada:"success",
      inactivo:"muted", finalizado:"muted", liquidada:"info", pagada:"info", entregado:"info",
      pre_mora:"warning", pendiente:"warning", no_ganada:"warning",
      en_mora:"danger", vencida:"danger", anulada:"danger", cancelada:"danger", devolucion:"danger"
    };
    return `<span class="badge badge-${map[estado]||"muted"}">${estado}</span>`;
  },
  fmt(n) { return n != null ? Number(n).toLocaleString("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }) : "—"; },
  date(d) { return d ? new Date(d).toLocaleDateString("es-CO") : "—"; },
  loader() { return `<div class="loader">Cargando...</div>`; },
  toast(msg, type="info") {
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;bottom:24px;right:24px;background:var(--surface2);border:1px solid var(--border);
      border-left:3px solid var(--${type==="error"?"danger":type==="ok"?"success":"accent"});
      padding:12px 20px;border-radius:8px;font-size:13px;z-index:999;color:var(--text);box-shadow:var(--shadow);`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
};

(() => {
  function icon(name, className = "") {
    return `<i data-lucide="${name}" class="sgi-icon ${className}"></i>`;
  }

  function pageHeader({
    kicker = "",
    title = "",
    subtitle = "",
    actions = "",
    meta = ""
  }) {
    return `
      <section class="page-header-card">
        <div class="page-header-main">
          <div class="page-header-copy">
            ${kicker ? `<span class="page-kicker">${kicker}</span>` : ""}
            <h2 class="page-title">${title}</h2>
            ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}
          </div>

          ${(actions || meta) ? `
            <div class="page-header-side">
              ${meta ? `<div class="page-meta">${meta}</div>` : ""}
              ${actions ? `<div class="page-actions">${actions}</div>` : ""}
            </div>
          ` : ""}
        </div>
      </section>
    `;
  }

  function sectionHeader({ kicker = "", title = "", actions = "" }) {
    return `
      <div class="section-head">
        <div>
          ${kicker ? `<span class="section-kicker">${kicker}</span>` : ""}
          <h3 class="section-title">${title}</h3>
        </div>
        ${actions ? `<div class="section-actions">${actions}</div>` : ""}
      </div>
    `;
  }

  function emptyState({
    title = "Sin resultados",
    text = "No hay información para mostrar.",
    actionLabel = "",
    actionId = ""
  }) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">
          ${icon("inbox")}
        </div>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-text">${text}</div>
        ${actionLabel && actionId ? `
          <div>
            <button class="btn btn-primary" id="${actionId}">
              ${actionLabel}
            </button>
          </div>
        ` : ""}
      </div>
    `;
  }

  function toast(message, type = "success", title = "Éxito") {
    let root = document.getElementById("toastRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "toastRoot";
      root.className = "toast-root";
      document.body.appendChild(root);
    }

    const toastEl = document.createElement("div");
    toastEl.className = `toast toast-${type}`;
    toastEl.innerHTML = `
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    `;

    root.appendChild(toastEl);

    requestAnimationFrame(() => {
      toastEl.classList.add("show");
    });

    setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => toastEl.remove(), 220);
    }, 2600);
  }

  function hydrate() {
    if (window.lucide?.createIcons) {
      window.lucide.createIcons({
        attrs: {
          "stroke-width": 1.8
        }
      });
    }
  }

  window.SGIUI = {
    icon,
    pageHeader,
    sectionHeader,
    emptyState,
    toast,
    hydrate
  };
})();

document.getElementById("modalClose").addEventListener("click", UI.closeModal);
document.getElementById("modalOverlay").addEventListener("click", e => { if (e.target.id === "modalOverlay") UI.closeModal(); });
