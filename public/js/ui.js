const UI = {
  openModal(title, bodyHTML) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHTML;
    document.getElementById("modalOverlay").classList.add("open");
    window.SGIUI?.hydrate();
  },
  closeModal() {
    document.getElementById("modalOverlay").classList.remove("open");
  },
  forceClose() {
    document.getElementById("modalOverlay").classList.remove("open");
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
        else if (action === "cancel") { cleanup(); resolve(false); }
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

  // Compact currency for summary cards so large amounts never overflow: shows millones
  // ("$1.209 M") above a million, full value below. Pair with `title` for the exact figure.
  function fmtCompactMoney(n) {
    const v   = Number(n) || 0;
    const abs = Math.abs(v);
    if (abs >= 1e6) {
      const dec = abs >= 1e8 ? 0 : 1;
      return `$${(v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: dec })} M`;
    }
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
  }

  // Shared summary cards. cards: [{ label, value, sub?, tone?, title? }].
  function statCards(cards = []) {
    const esc = s => String(s ?? "").replace(/"/g, "&quot;");
    return `<section class="stats-grid">${cards.map(c => `
      <article class="stat-card${c.tone ? ` stat-card--${c.tone}` : ""}">
        <div class="stat-label">${c.label}</div>
        <div class="stat-value"${c.title ? ` title="${esc(c.title)}"` : ""}>${c.value}</div>
        ${c.sub ? `<div class="stat-sub">${c.sub}</div>` : ""}
      </article>`).join("")}</section>`;
  }

  // Unified search/filter bar. Each view keeps its own ids + handler strings so existing
  // wiring keeps working; this only standardizes markup and styling.
  // fields: [{ type:"search"|"text"|"select"|"month"|"date", id, label?, placeholder?,
  //            value?, options?:[{value,label}], oninput?, onchange?, grow? }]
  function filterBar({ fields = [], actions = "", id = "" } = {}) {
    const esc = v => String(v ?? "").replace(/"/g, "&quot;");
    const searchIco = `<svg class="sgi-filter-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    const fieldHTML = fields.map(f => {
      const grow  = f.grow ? " sgi-filter-field--grow" : "";
      const label = f.label ? `<label for="${f.id}">${f.label}</label>` : "";
      if (f.type === "select") {
        const opts = (f.options || []).map(o =>
          `<option value="${esc(o.value)}"${String(o.value) === String(f.value ?? "") ? " selected" : ""}>${o.label}</option>`
        ).join("");
        return `<div class="sgi-filter-field${grow}">${label}<div class="sgi-filter-control sgi-filter-control--select"><select id="${f.id}"${f.onchange ? ` onchange="${f.onchange}"` : ""}>${opts}</select></div></div>`;
      }
      const isSearch  = f.type === "search";
      const inputType = isSearch ? "text" : (f.type || "text");
      const handler   = f.oninput ? ` oninput="${f.oninput}"` : (f.onchange ? ` onchange="${f.onchange}"` : "");
      return `<div class="sgi-filter-field${grow}">${label}<div class="sgi-filter-control${isSearch ? " sgi-filter-control--search" : ""}">${isSearch ? searchIco : ""}<input id="${f.id}" type="${inputType}" placeholder="${esc(f.placeholder)}" value="${esc(f.value)}"${handler}></div></div>`;
    }).join("");
    return `<div class="sgi-filter-bar"${id ? ` id="${id}"` : ""}>${fieldHTML}${actions ? `<div class="sgi-filter-actions">${actions}</div>` : ""}</div>`;
  }

  window.SGIUI = {
    icon,
    pageHeader,
    sectionHeader,
    emptyState,
    toast,
    hydrate,
    statCards,
    filterBar,
    fmtCompactMoney
  };
})();

document.getElementById("modalClose").addEventListener("click", UI.closeModal);

// Press ESC to close any open detail modal / popup window.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const overlay = document.getElementById("modalOverlay");
  if (overlay && overlay.classList.contains("open")) UI.closeModal();
});
