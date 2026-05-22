const UI = {
  openModal(title, bodyHTML) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHTML;
    document.getElementById("modalConfirm").hidden = true;
    document.getElementById("modalOverlay").classList.add("open");
  },
  closeModal() {
    document.getElementById("modalConfirm").hidden = true;
    document.getElementById("modalOverlay").classList.remove("open");
  },
  forceClose() {
    document.getElementById("modalConfirm").hidden = true;
    document.getElementById("modalOverlay").classList.remove("open");
  },
  cancelConfirm() {
    document.getElementById("modalConfirm").hidden = true;
  },
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
  confirm(opts = {}) {
    const o = typeof opts === "string" ? { message: opts } : opts;
    const {
      title       = "¿Confirmar acción?",
      message     = "",
      confirmText = "Aceptar",
      cancelText  = "Cancelar",
      danger      = false,
    } = o;

    return new Promise(resolve => {
      let ov = document.getElementById("confirmOverlay");
      if (!ov) {
        ov = document.createElement("div");
        ov.id = "confirmOverlay";
        ov.className = "confirm-overlay";
        document.body.appendChild(ov);
      }
      ov.innerHTML = `
        <div class="confirm-dialog" role="alertdialog" aria-modal="true">
          <div class="confirm-icon ${danger ? "confirm-icon-danger" : ""}">
            <i data-lucide="${danger ? "alert-triangle" : "help-circle"}"></i>
          </div>
          <h3 class="confirm-title">${title}</h3>
          ${message ? `<p class="confirm-message">${message}</p>` : ""}
          <div class="confirm-actions">
            <button class="btn btn-ghost" data-confirm="cancel">${cancelText}</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm="ok">${confirmText}</button>
          </div>
        </div>`;
      ov.classList.add("show");
      window.SGIUI?.hydrate?.();

      const cleanup = () => {
        ov.classList.remove("show");
        ov.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKey);
      };
      const onClick = e => {
        const action = e.target.closest("[data-confirm]")?.dataset.confirm;
        if (action === "ok") { cleanup(); resolve(true); }
        else if (action === "cancel" || e.target === ov) { cleanup(); resolve(false); }
      };
      const onKey = e => { if (e.key === "Escape") { cleanup(); resolve(false); } };

      ov.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
    });
  },
  toast(msg, type="info") {
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;bottom:24px;right:24px;background:var(--surface2);border:1px solid var(--border);
      border-left:3px solid var(--${type==="error"?"danger":type==="ok"?"success":"accent"});
      padding:12px 20px;border-radius:8px;font-size:13px;z-index:9999;color:var(--text);box-shadow:var(--shadow);`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },
  _loadCount: 0,
  _loadTimer: null,
  _loadingOverlay() {
    let ov = document.getElementById("globalLoading");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "globalLoading";
      ov.className = "global-loading";
      ov.setAttribute("aria-hidden", "true");
      ov.innerHTML = `
        <div class="global-loading-box" role="status" aria-live="polite">
          <div class="global-loading-spinner"></div>
          <span class="global-loading-text">Procesando…</span>
        </div>`;
      document.body.appendChild(ov);
    }
    return ov;
  },
  showGlobalLoading() {
    this._loadCount++;
    if (this._loadCount > 1 || this._loadTimer) return;
    this._loadTimer = setTimeout(() => {
      this._loadTimer = null;
      this._loadingOverlay().classList.add("show");
    }, 150);
  },
  hideGlobalLoading() {
    this._loadCount = Math.max(0, this._loadCount - 1);
    if (this._loadCount > 0) return;
    if (this._loadTimer) {
      clearTimeout(this._loadTimer);
      this._loadTimer = null;
    }
    document.getElementById("globalLoading")?.classList.remove("show");
  }
};

window.UI = UI;

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
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target.id !== "modalOverlay") return;
  const confirm = document.getElementById("modalConfirm");
  if (confirm.hidden) {
    confirm.hidden = false;
    document.getElementById("modal").scrollTop = document.getElementById("modal").scrollHeight;
  } else {
    confirm.hidden = true;
  }
});
