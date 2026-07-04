(function () {

const ESTADO_LABEL = {
  pendiente_jefe:   { label: "Pendiente de jefe", cls: "badge-warning" },
  aprobado:         { label: "Aprobado",          cls: "badge-info"    },
  aprobado_jefe:    { label: "Aprobado por jefe", cls: "badge-info"    },
  pendiente_tesoreria: { label: "En tesorería",   cls: "badge-info"    },
  rechazado:        { label: "Rechazado",         cls: "badge-danger"  },
  desembolsado:     { label: "Desembolsado",      cls: "badge-warning" },
  recibido_parcial: { label: "Recibido parcial",  cls: "badge-info"    },
  en_inventario:    { label: "En inventario",     cls: "badge-success" },
  cancelado:        { label: "Cancelado",         cls: "badge-danger"  },
};

const URGENCIA_LABEL = {
  baja:  { label: "Baja",  cls: "badge-muted"  },
  media: { label: "Media", cls: "badge-info"   },
  alta:  { label: "Alta",  cls: "badge-danger" },
};

const CATEGORIAS = [
  { value: "materiales",   label: "Materiales",   icon: "package"   },
  { value: "herramientas", label: "Herramientas", icon: "wrench"    },
  { value: "equipos",      label: "Equipos",      icon: "monitor"   },
  { value: "servicios",    label: "Servicios",    icon: "briefcase" },
  { value: "otros",        label: "Otros",        icon: "box"       },
];

// Document flow shown in the detail timeline. `stepOf` maps each estado to the
// step currently in progress (0-based); -1 on `failedAt` marks a terminal rejection.
const FLOW_STEPS = [
  { label: "Solicitado",   icon: "file-plus"     },
  { label: "Jefe de área", icon: "user-check"    },
  { label: "Tesorería",    icon: "landmark"      },
  { label: "Desembolso",   icon: "banknote"      },
  { label: "Recepción",    icon: "package-check" },
];

function flowStateOf(estado) {
  switch (estado) {
    case "pendiente_jefe":      return { current: 1 };
    case "aprobado":
    case "aprobado_jefe":
    case "pendiente_tesoreria": return { current: 2 };
    case "desembolsado":        return { current: 4 };
    case "recibido_parcial":    return { current: 4 };
    case "en_inventario":       return { current: 5, done: true };
    case "rechazado":           return { current: 1, failedAt: 1 };
    case "cancelado":           return { current: 1, failedAt: 1 };
    default:                    return { current: 1 };
  }
}

const icon     = (name) => window.SGIUI?.icon(name) ?? "";
const fmtMoney = n => Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtDate  = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-CO") : "—";
const fmtQty   = n => Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });

let _requerimientos = [];
let _proyectos      = [];
let _highlightId    = null;
const _filtros      = { q: "", est: "", urg: "" };

// Mini version of the flow timeline: five dots at a glance inside the table.
function miniFlowHTML(estado) {
  const flow  = flowStateOf(estado);
  const title = ESTADO_LABEL[estado]?.label || estado;
  return `<div class="req-mini-flow" title="${title}">${FLOW_STEPS.map((s, i) => {
    let cls = "pending";
    if (flow.failedAt === i) cls = "failed";
    else if (flow.done || i < flow.current) cls = "done";
    else if (i === flow.current) cls = "current";
    return `<span class="req-mini-dot ${cls}"></span>`;
  }).join("")}</div>`;
}

function esperaHTML(r) {
  if (r.estado !== "pendiente_jefe" || !r.fecha_solicitud) return "";
  const dias = Math.floor((Date.now() - new Date(r.fecha_solicitud + "T12:00:00")) / 86400000);
  if (dias <= 0) return `<div class="req-wait">Enviado hoy</div>`;
  const cls = dias > 7 ? "req-wait-danger" : dias > 3 ? "req-wait-warn" : "";
  return `<div class="req-wait ${cls}">${dias} día${dias === 1 ? "" : "s"} esperando</div>`;
}

window.requerimientosView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const canCreate = AppState.can("requerimientos", "crear");

  let data;
  try {
    [data, _proyectos] = await Promise.all([
      API.get("/requerimientos/mis-requerimientos"),
      API.get("/proyectos").catch(() => []),
    ]);
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }

  _requerimientos = data || [];

  // Smart default order: urgent first, then newest.
  const URG_WEIGHT = { alta: 0, media: 1, baja: 2 };
  _requerimientos.sort((a, b) =>
    (URG_WEIGHT[a.urgencia] ?? 1) - (URG_WEIGHT[b.urgencia] ?? 1) ||
    b.id_requerimiento - a.id_requerimiento
  );

  const pendientes = _requerimientos.filter(r => r.estado === "pendiente_jefe").length;
  const enProceso  = _requerimientos.filter(r =>
    ["aprobado", "aprobado_jefe", "pendiente_tesoreria", "desembolsado", "recibido_parcial", "en_inventario"].includes(r.estado)).length;
  const montoTotal = _requerimientos
    .filter(r => !["rechazado", "cancelado"].includes(r.estado))
    .reduce((s, r) => s + Number(r.valor_total || 0), 0);

  vc.innerHTML = `
    <section class="page-shell">
      ${window.SGIUI?.pageHeader({
        kicker:   "Operación",
        title:    "Mis requerimientos",
        subtitle: "Solicita materiales, herramientas o servicios y sigue cada solicitud hasta su entrega.",
        actions:  canCreate ? `<button class="btn btn-primary" id="btn-nuevo-req">${icon("plus")} Nuevo requerimiento</button>` : "",
        meta:     _requerimientos.length ? `<span class="results-chip">${icon("clipboard-list")} ${_requerimientos.length} solicitud(es)</span>` : "",
      }) ?? ""}

      <div class="req-kpi-row">
        <div class="req-kpi">
          <span class="req-kpi-icon">${icon("clipboard-list")}</span>
          <div><span class="req-kpi-val">${_requerimientos.length}</span><span class="req-kpi-label">Total solicitados</span></div>
        </div>
        <div class="req-kpi warning">
          <span class="req-kpi-icon">${icon("clock")}</span>
          <div><span class="req-kpi-val">${pendientes}</span><span class="req-kpi-label">Pendientes de jefe</span></div>
        </div>
        <div class="req-kpi success">
          <span class="req-kpi-icon">${icon("check-circle")}</span>
          <div><span class="req-kpi-val">${enProceso}</span><span class="req-kpi-label">Aprobados / en proceso</span></div>
        </div>
        <div class="req-kpi accent">
          <span class="req-kpi-icon">${icon("coins")}</span>
          <div><span class="req-kpi-val">${fmtMoney(montoTotal)}</span><span class="req-kpi-label">Monto estimado</span></div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-filters">
          <input id="req-buscar" type="text" class="filter-input"
            placeholder="Buscar por número, descripción o proyecto..." style="flex:2;min-width:18rem">
          <select id="req-estado" class="select-sm" style="flex:1;min-width:10rem">
            <option value="">Todos los estados</option>
            <option value="pendiente_jefe">Pendiente de jefe</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select id="req-urgencia" class="select-sm" style="flex:1;min-width:9rem">
            <option value="">Toda urgencia</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        <table class="req-table">
          <thead>
            <tr>
              <th>N° Requerimiento</th>
              <th>Proyecto</th>
              <th>Fecha</th>
              <th>Categoría</th>
              <th>Urgencia</th>
              <th>Monto estimado</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="req-tbody"></tbody>
        </table>
      </div>
    </section>`;

  const tbody = document.getElementById("req-tbody");

  function fila(r) {
    const est = ESTADO_LABEL[r.estado]     || { label: r.estado, cls: "badge-muted" };
    const urg = URGENCIA_LABEL[r.urgencia] || { label: r.urgencia || "—", cls: "badge-muted" };
    const cat = CATEGORIAS.find(c => c.value === r.categoria) || { label: r.categoria || "—", icon: "box" };
    const nItems = (r.items || []).length;
    return `
      <tr class="req-row ${r.urgencia === "alta" ? "req-row-alta" : ""} ${_highlightId === r.id_requerimiento ? "req-row-new" : ""}" data-req-id="${r.id_requerimiento}">
        <td class="req-td-main">
          <div class="req-num-cell">
            <span class="req-cat-icon" title="${cat.label}">${icon(cat.icon)}</span>
            <div>
              <div class="rec-num req-num-copy" title="Clic para copiar el número">${r.numero}</div>
              <div class="rec-desc">${r.descripcion || "—"} <span class="req-chip-items">${nItems} ítem${nItems === 1 ? "" : "s"}</span></div>
            </div>
          </div>
        </td>
        <td data-label="Proyecto">${r.proyecto || "—"}${r.sigla ? ` <span class="rec-sigla">(${r.sigla})</span>` : ""}</td>
        <td data-label="Fecha"><div title="Solicitado el ${fmtDate(r.fecha_solicitud)}">${fmtDate(r.fecha_solicitud)}${esperaHTML(r)}</div></td>
        <td data-label="Categoría">${cat.label}</td>
        <td data-label="Urgencia"><span class="badge ${urg.cls}">${urg.label}</span></td>
        <td data-label="Monto estimado" class="req-money">${fmtMoney(r.valor_total)}</td>
        <td data-label="Estado"><div class="req-estado-cell"><span class="badge ${est.cls}">${est.label}</span>${miniFlowHTML(r.estado)}</div></td>
        <td class="req-td-actions">
          <div class="req-actions">
            <button class="btn btn-ghost btn-sm btn-req-detalle" data-id="${r.id_requerimiento}">Ver detalle</button>
            <button class="btn btn-ghost btn-sm btn-req-pdf" data-id="${r.id_requerimiento}" title="Ver PDF">${icon("file-text")}</button>
            <button class="btn btn-ghost btn-sm btn-req-dup" data-id="${r.id_requerimiento}" title="Duplicar requerimiento">${icon("copy")}</button>
            ${canCreate && r.estado === "pendiente_jefe" ? `<button class="btn btn-ghost btn-sm btn-req-cancelar" data-id="${r.id_requerimiento}" title="Cancelar requerimiento">${icon("ban")}</button>` : ""}
          </div>
        </td>
      </tr>`;
  }

  function emptyState() {
    if (_requerimientos.length) {
      return `<tr><td colspan="8" class="empty-row">No hay requerimientos que coincidan con los filtros.</td></tr>`;
    }
    return `
      <tr><td colspan="8">
        <div class="req-empty">
          <div class="req-empty-icon">${icon("clipboard-list")}</div>
          <p class="req-empty-title">Aún no has creado requerimientos</p>
          <p class="req-empty-sub">Solicita los materiales que necesitas y sigue su aprobación paso a paso.</p>
          ${canCreate ? `<button class="btn btn-primary" id="btn-primer-req">${icon("plus")} Crear mi primer requerimiento</button>` : ""}
        </div>
      </td></tr>`;
  }

  function aplicarFiltros() {
    const q   = (document.getElementById("req-buscar").value || "").trim();
    const est = document.getElementById("req-estado").value;
    const urg = document.getElementById("req-urgencia").value;
    Object.assign(_filtros, { q, est, urg });

    const visibles = _requerimientos.filter(r => {
      if (est && r.estado !== est) return false;
      if (urg && r.urgencia !== urg) return false;
      if (q) {
        if (window.SGISearch?.matches) {
          if (!SGISearch.matches(q, r.numero, r.descripcion, r.proyecto, r.categoria)) return false;
        } else {
          const blob = `${r.numero} ${r.descripcion || ""} ${r.proyecto || ""} ${r.categoria || ""}`.toLowerCase();
          if (!blob.includes(q.toLowerCase())) return false;
        }
      }
      return true;
    });

    tbody.innerHTML = visibles.length ? visibles.map(fila).join("") : emptyState();
    document.getElementById("btn-primer-req")?.addEventListener("click", () => abrirModalNuevo());
    window.SGIUI?.hydrate();
  }

  // Restore filters from the previous render (the view reloads after create/cancel).
  document.getElementById("req-buscar").value   = _filtros.q;
  document.getElementById("req-estado").value   = _filtros.est;
  document.getElementById("req-urgencia").value = _filtros.urg;

  document.getElementById("req-buscar").addEventListener("input",  aplicarFiltros);
  document.getElementById("req-estado").addEventListener("change", aplicarFiltros);
  document.getElementById("req-urgencia").addEventListener("change", aplicarFiltros);

  tbody.addEventListener("click", e => {
    const num = e.target.closest(".req-num-copy");
    if (num) {
      navigator.clipboard?.writeText(num.textContent.trim())
        .then(() => UI.toast("Número copiado al portapapeles.", "ok"))
        .catch(() => {});
      return;
    }
    const btn = e.target.closest(".btn-req-detalle, .btn-req-pdf, .btn-req-dup, .btn-req-cancelar");
    if (!btn) return;
    const r = _requerimientos.find(x => String(x.id_requerimiento) === btn.dataset.id);
    if (!r) return;
    if (btn.classList.contains("btn-req-detalle")) abrirDetalle(r);
    else if (btn.classList.contains("btn-req-pdf")) abrirRequerimientoPDF(r);
    else if (btn.classList.contains("btn-req-cancelar")) abrirModalCancelar(r);
    else abrirModalNuevo(r);
  });

  document.getElementById("btn-nuevo-req")?.addEventListener("click", () => abrirModalNuevo());

  aplicarFiltros();
  window.SGIUI?.hydrate();

  // One-shot highlight of the row created a moment ago.
  if (_highlightId) {
    const row = tbody.querySelector(`tr[data-req-id="${_highlightId}"]`);
    _highlightId = null;
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => row.classList.remove("req-row-new"), 2200);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Timeline del flujo (detalle)
// ─────────────────────────────────────────────────────────────────────────────
function timelineHTML(estado) {
  const flow = flowStateOf(estado);
  return `
    <div class="req-flow">
      ${FLOW_STEPS.map((s, i) => {
        let cls = "pending";
        if (flow.failedAt === i) cls = "failed";
        else if (flow.done || i < flow.current) cls = "done";
        else if (i === flow.current) cls = "current";
        return `
          <div class="req-flow-step ${cls}">
            <span class="req-flow-dot">${flow.failedAt === i ? icon("x") : icon(s.icon)}</span>
            <span class="req-flow-label">${s.label}</span>
          </div>`;
      }).join(`<span class="req-flow-line"></span>`)}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF del requerimiento (formato unificado de comprobantes)
// ─────────────────────────────────────────────────────────────────────────────
function _buildRequerimientoHTML(r) {
  const SX  = window.SGIExport;
  const est = ESTADO_LABEL[r.estado]     || { label: r.estado, cls: "badge-muted" };
  const urg = URGENCIA_LABEL[r.urgencia] || { label: r.urgencia || "—" };
  const cat = CATEGORIAS.find(c => c.value === r.categoria) || { label: r.categoria || "—" };

  const URG_BADGE = { alta: "danger", media: "info", baja: "muted" };
  const EST_BADGE = {
    pendiente_jefe: "warning", aprobado: "info", aprobado_jefe: "info",
    pendiente_tesoreria: "info", desembolsado: "warning",
    recibido_parcial: "info", en_inventario: "success",
    rechazado: "danger", cancelado: "danger",
  };

  const solicitante =
    `${window.currentUser?.nombres || ""} ${window.currentUser?.apellidos || ""}`.trim() ||
    window.currentUser?.email || "";

  const valor      = Number(r.valor_total || 0);
  const valorTxt   = "$ " + valor.toLocaleString("es-CO", { minimumFractionDigits: 0 });
  const valorWords = SX.numToWordsES ? SX.numToWordsES(valor) : "";
  const fmtD       = SX.fmtDate || (x => x || "");

  const itemsHTML = `
    <div class="cmp-extra">
      <div class="cmp-extra-title">Ítems solicitados</div>
      <table class="cmp-mini">
        <thead>
          <tr><th>Ítem</th><th class="r">Cantidad</th><th class="r">Precio est.</th><th class="r">Subtotal</th></tr>
        </thead>
        <tbody>
          ${(r.items || []).map(it => `
            <tr>
              <td>${it.descripcion}</td>
              <td class="r">${fmtQty(it.cantidad_solicitada)} ${it.unidad || ""}</td>
              <td class="r">${fmtMoney(it.precio_unitario)}</td>
              <td class="r">${fmtMoney(Number(it.cantidad_solicitada) * Number(it.precio_unitario))}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  const jefeValue =
    r.estado === "rechazado" ? "Rechazado" :
    ["aprobado", "aprobado_jefe", "pendiente_tesoreria", "desembolsado", "recibido_parcial", "en_inventario"].includes(r.estado) ? "Aprobado" : "";

  const desembolsoValue =
    ["desembolsado", "recibido_parcial", "en_inventario"].includes(r.estado)
      ? (r.fecha_desembolso ? fmtD(r.fecha_desembolso) : "Realizado") : "";

  const recepcionValue =
    r.estado === "en_inventario" ? "Completa" :
    r.estado === "recibido_parcial" ? "Parcial" : "";

  const stamp =
    r.estado === "rechazado"     ? { label: "Rechazado", variant: "danger" } :
    r.estado === "cancelado"     ? { label: "Cancelado", variant: "danger" } :
    r.estado === "en_inventario" ? { label: "Entregado", variant: "success" } : null;

  const waNumber = (SX.CONTACT && SX.CONTACT.whatsapp) || "573001234567";
  const waMsg    = `Hola, quiero informacion sobre el requerimiento de materiales ${r.numero} por un monto estimado de ${valorTxt}, solicitado por ${solicitante}.`;
  const qrUrl    = SX.qrDataUri(`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`);

  return SX.comprobanteHTML({
    docTitle: `Requerimiento ${r.numero} — El Cóndor S.A.S.`,
    badge:    "Requerimiento de Materiales",
    fields: [
      { icon: "check",    label: "Estado",           value: est.label, badge: EST_BADGE[r.estado] || "muted" },
      { icon: "hash",     label: "N° requerimiento", value: r.numero },
      { icon: "user",     label: "Solicitado por",   value: solicitante },
      { icon: "pin",      label: "Proyecto / obra",  value: r.proyecto ? `${r.proyecto}${r.sigla ? " (" + r.sigla + ")" : ""}` : "" },
      { icon: "tag",      label: "Categoría",        value: cat.label },
      { icon: "clock",    label: "Urgencia",         value: urg.label, badge: URG_BADGE[r.urgencia] || "muted" },
      { icon: "calendar", label: "Fecha de solicitud", value: fmtD(r.fecha_solicitud) },
      { icon: "note",     label: "Justificación",    value: r.justificacion },
    ],
    extraHTML: itemsHTML,
    trace: [
      { label: "Requerimiento",   value: r.numero, current: true },
      { label: "Aprobación jefe", value: jefeValue },
      { label: "Tesorería",       value: "" },
      { label: "Desembolso",      value: desembolsoValue },
      { label: "Recepción",       value: recepcionValue },
    ],
    traceSubtitle: "Cadena Requerimiento → Jefe → Tesorería → Desembolso → Recepción",
    totalLabel: "Monto estimado total",
    totalValue: valorTxt,
    totalWords: valorWords,
    stamp,
    qrUrl,
    qrCaption: "<strong>¿Dudas con este requerimiento?</strong><br>Escanea el código QR para escribirnos por WhatsApp.",
  });
}

function abrirRequerimientoPDF(r) {
  if (!r) return UI.toast("Sin datos del requerimiento", "error");
  if (!(window.SGIExport && window.SGIExport.comprobanteHTML)) return UI.toast("No se pudo generar el comprobante", "error");
  const win = window.open("", "_blank", "width=780,height=720,scrollbars=yes");
  if (!win) return UI.toast("El navegador bloqueó la ventana emergente. Permita ventanas emergentes para este sitio.", "error");
  win.document.write(_buildRequerimientoHTML(r));
  win.document.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancelar requerimiento (solo pendiente_jefe, con motivo)
// ─────────────────────────────────────────────────────────────────────────────
function abrirModalCancelar(r) {
  UI.openModal(`Cancelar requerimiento · ${r.numero}`, `
    <div class="rec-modal">
      <div class="req-cancel-warn">
        ${icon("alert-triangle")}
        <p>Vas a cancelar <strong>${r.numero}</strong> (${r.descripcion || "sin descripción"}).
        Saldrá de la bandeja del jefe de área y <strong>no se podrá reactivar</strong>.</p>
      </div>
      <div class="form-group form-group--full" style="margin-top:0.75rem">
        <label>Motivo de la cancelación *</label>
        <textarea id="req-cancel-motivo" rows="2" placeholder="Ej: se solicitó por error, el material ya no se necesita..."></textarea>
      </div>
      <div id="req-cancel-error" class="form-error" style="display:none"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Volver</button>
      <button class="btn btn-danger" id="req-cancel-submit">Cancelar requerimiento</button>
    </div>
  `);

  document.getElementById("req-cancel-submit").addEventListener("click", async function () {
    const errorEl = document.getElementById("req-cancel-error");
    errorEl.style.display = "none";

    const motivo = document.getElementById("req-cancel-motivo").value.trim();
    if (motivo.length < 5) {
      errorEl.textContent = "Indica un motivo de al menos 5 caracteres.";
      errorEl.style.display = "block";
      return;
    }

    this.disabled = true;
    this.textContent = "Cancelando...";

    try {
      await API.patch(`/requerimientos/${r.id_requerimiento}/cancelar`, { motivo });
      UI.closeModal();
      UI.toast(`Requerimiento ${r.numero} cancelado.`, "ok");
      window.requerimientosView();
    } catch (e) {
      this.disabled = false;
      this.textContent = "Cancelar requerimiento";
      errorEl.textContent = e.message || "No se pudo cancelar el requerimiento.";
      errorEl.style.display = "block";
    }
  });
  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle (timeline + justificación + ítems)
// ─────────────────────────────────────────────────────────────────────────────
function abrirDetalle(r) {
  const est = ESTADO_LABEL[r.estado]     || { label: r.estado, cls: "badge-muted" };
  const urg = URGENCIA_LABEL[r.urgencia] || { label: r.urgencia || "—", cls: "badge-muted" };
  const cat = CATEGORIAS.find(c => c.value === r.categoria) || { label: r.categoria || "—", icon: "box" };

  const filas = (r.items || []).map(it => `
    <tr>
      <td>${it.descripcion}</td>
      <td class="req-td-right">${fmtQty(it.cantidad_solicitada)} ${it.unidad || ""}</td>
      <td class="req-td-right">${fmtMoney(it.precio_unitario)}</td>
      <td class="req-td-right">${fmtMoney(Number(it.cantidad_solicitada) * Number(it.precio_unitario))}</td>
    </tr>`).join("");

  UI.openModal(`Requerimiento · ${r.numero}`, `
    <div class="rec-modal">
      <div class="rec-modal-summary">
        <div class="rec-summary-item"><span class="lbl">Proyecto</span><span class="val">${r.proyecto || "—"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Fecha</span><span class="val">${fmtDate(r.fecha_solicitud)}</span></div>
        <div class="rec-summary-item"><span class="lbl">Categoría</span><span class="val">${cat.label}</span></div>
        <div class="rec-summary-item"><span class="lbl">Urgencia</span><span class="val"><span class="badge ${urg.cls}">${urg.label}</span></span></div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Estado de la solicitud &nbsp;<span class="badge ${est.cls}">${est.label}</span></span>
        ${timelineHTML(r.estado)}
      </div>

      <div class="form-section">
        <span class="form-section-label">Justificación</span>
        <p class="req-justificacion">${r.justificacion || "—"}</p>
      </div>

      <div class="form-section">
        <span class="form-section-label">Ítems solicitados</span>
        <table class="rec-items-table">
          <thead>
            <tr><th>Ítem</th><th class="req-td-right">Cantidad</th><th class="req-td-right">Precio est.</th><th class="req-td-right">Subtotal</th></tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
        <div class="req-total-strip">
          <span>Monto estimado total</span>
          <strong>${fmtMoney(r.valor_total)}</strong>
        </div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="req-det-pdf">${icon("file-text")} Ver PDF</button>
      <button class="btn btn-primary" onclick="UI.closeModal()">Cerrar</button>
    </div>
  `);
  document.getElementById("req-det-pdf")?.addEventListener("click", () => abrirRequerimientoPDF(r));
  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de creación (REQ-01)
// ─────────────────────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function filaItemEditable(it) {
  return `
    <tr class="req-item-row">
      <td><input type="text" class="req-it-desc" placeholder="Ej: Cemento gris 50kg" value="${esc(it?.descripcion)}" /></td>
      <td><input type="text" class="req-it-unidad" placeholder="und" style="width:5.5rem" value="${esc(it?.unidad)}" /></td>
      <td><input type="number" class="req-it-cantidad" min="0" step="any" placeholder="0" style="width:6rem" value="${it?.cantidad_solicitada ?? ""}" /></td>
      <td><input type="number" class="req-it-precio" min="0" step="any" placeholder="0" style="width:8.5rem" value="${it?.precio_unitario ?? ""}" /></td>
      <td class="req-td-right req-it-subtotal">—</td>
      <td><button class="btn btn-ghost btn-sm req-it-remove" title="Quitar ítem">✕</button></td>
    </tr>`;
}

// `base` (optional) pre-fills the form to duplicate an existing requerimiento.
function abrirModalNuevo(base) {
  const opcionesProyecto = (_proyectos || [])
    .map(p => `<option value="${p.id_proyecto}" ${base && Number(base.id_proyecto) === Number(p.id_proyecto) ? "selected" : ""}>${p.nombre}</option>`).join("");

  UI.openModal("Nuevo requerimiento de materiales", `
    <div class="rec-modal">
      <div class="form-section">
        <span class="form-section-label"><span class="req-step-num">1</span> Información general</span>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Descripción *</label>
            <input id="req-descripcion" type="text" placeholder="Ej: Materiales para fundición de placas Mz B" value="${esc(base?.descripcion)}" />
          </div>
          <div class="form-group">
            <label>Proyecto / obra</label>
            <select id="req-proyecto">
              <option value="">Sin proyecto</option>
              ${opcionesProyecto}
            </select>
          </div>
          <div class="form-group">
            <label>Categoría *</label>
            <select id="req-categoria">
              ${CATEGORIAS.map(c => `<option value="${c.value}" ${base?.categoria === c.value ? "selected" : ""}>${c.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-group form-group--full">
            <label>Urgencia *</label>
            <div class="req-urg-chips" id="req-urg-chips">
              ${[["baja", "leaf", "Baja"], ["media", "gauge", "Media"], ["alta", "flame", "Alta"]].map(([v, ic, lb]) =>
                `<button type="button" class="req-urg-chip ${(base?.urgencia || "media") === v ? "active" : ""}" data-urg="${v}">${icon(ic)} ${lb}</button>`
              ).join("")}
            </div>
          </div>
          <div class="form-group form-group--full">
            <label>Justificación *</label>
            <textarea id="req-justificacion" rows="2" placeholder="¿Para qué se necesita? Ej: fundición de placas de la manzana B programada para la próxima semana">${esc(base?.justificacion)}</textarea>
          </div>
        </div>
      </div>

      <div class="form-section">
        <span class="form-section-label"><span class="req-step-num">2</span> Ítems solicitados</span>
        <p class="rec-hint">Agrega cada material con su cantidad y monto estimado por unidad.</p>
        <table class="rec-items-table req-items-editor">
          <thead>
            <tr><th>Ítem *</th><th>Unidad</th><th>Cantidad *</th><th>Precio est. *</th><th class="req-td-right">Subtotal</th><th></th></tr>
          </thead>
          <tbody id="req-items-body">${base?.items?.length ? base.items.map(filaItemEditable).join("") : filaItemEditable()}</tbody>
        </table>
        <button class="btn btn-ghost btn-sm" id="req-add-item">${icon("plus")} Agregar ítem</button>
        <div class="req-total-strip">
          <span>Monto estimado total</span>
          <strong id="req-total">$ 0</strong>
        </div>
      </div>

      <div id="req-error" class="form-error" style="display:none"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="req-submit">Crear requerimiento</button>
    </div>
  `);

  const body  = document.getElementById("req-items-body");
  const chips = document.getElementById("req-urg-chips");

  chips.addEventListener("click", e => {
    const chip = e.target.closest(".req-urg-chip");
    if (!chip) return;
    chips.querySelectorAll(".req-urg-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
  });

  function recalcular() {
    let total = 0;
    body.querySelectorAll(".req-item-row").forEach(tr => {
      const cantidad = Number(tr.querySelector(".req-it-cantidad").value) || 0;
      const precio   = Number(tr.querySelector(".req-it-precio").value) || 0;
      const sub      = cantidad * precio;
      tr.querySelector(".req-it-subtotal").textContent = sub > 0 ? fmtMoney(sub) : "—";
      total += sub;
    });
    document.getElementById("req-total").textContent = fmtMoney(total);
  }

  body.addEventListener("input", recalcular);
  body.addEventListener("click", e => {
    const btn = e.target.closest(".req-it-remove");
    if (!btn) return;
    if (body.querySelectorAll(".req-item-row").length === 1) {
      UI.toast("Debe haber al menos un ítem.", "info");
      return;
    }
    btn.closest("tr").remove();
    recalcular();
  });

  document.getElementById("req-add-item").addEventListener("click", () => {
    body.insertAdjacentHTML("beforeend", filaItemEditable());
    body.querySelector(".req-item-row:last-child .req-it-desc")?.focus();
  });

  document.getElementById("req-submit").addEventListener("click", guardarRequerimiento);
  recalcular();
  window.SGIUI?.hydrate();
}

async function guardarRequerimiento() {
  const errorEl = document.getElementById("req-error");
  errorEl.style.display = "none";

  const descripcion   = document.getElementById("req-descripcion").value.trim();
  const id_proyecto   = document.getElementById("req-proyecto").value || null;
  const categoria     = document.getElementById("req-categoria").value;
  const urgencia      = document.querySelector("#req-urg-chips .req-urg-chip.active")?.dataset.urg || "media";
  const justificacion = document.getElementById("req-justificacion").value.trim();

  const items = [];
  document.querySelectorAll("#req-items-body .req-item-row").forEach(tr => {
    const desc = tr.querySelector(".req-it-desc").value.trim();
    if (!desc) return;
    items.push({
      descripcion:     desc,
      unidad:          tr.querySelector(".req-it-unidad").value.trim() || "und",
      cantidad:        Number(tr.querySelector(".req-it-cantidad").value),
      precio_unitario: Number(tr.querySelector(".req-it-precio").value),
    });
  });

  function fallar(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  if (!descripcion)   return fallar("La descripción es obligatoria.");
  if (!justificacion) return fallar("La justificación es obligatoria.");
  if (!items.length)  return fallar("Agrega al menos un ítem con descripción.");
  for (const it of items) {
    if (!Number.isFinite(it.cantidad) || it.cantidad <= 0)
      return fallar(`El ítem "${it.descripcion}" necesita una cantidad mayor a cero.`);
    if (!Number.isFinite(it.precio_unitario) || it.precio_unitario < 0)
      return fallar(`El ítem "${it.descripcion}" necesita un precio estimado válido.`);
  }

  const btn = document.getElementById("req-submit");
  btn.disabled = true;
  btn.textContent = "Creando...";

  try {
    const creado = await API.post("/requerimientos", {
      descripcion, id_proyecto, categoria, urgencia, justificacion, items,
    });
    UI.closeModal();
    UI.toast(`Requerimiento ${creado.numero} creado. Quedó pendiente de aprobación del jefe de área.`, "ok");
    _highlightId = creado.id_requerimiento;
    window.requerimientosView();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Crear requerimiento";
    errorEl.textContent = e.message || "Error al crear el requerimiento.";
    errorEl.style.display = "block";
  }
}

})();
