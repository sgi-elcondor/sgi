(function () {

const NIVEL_LABEL = {
  jefe:  { label: "Aprobación de jefe", cls: "badge-warning" },
  final: { label: "Aprobación final",   cls: "badge-info"    },
};

const icon     = (name) => window.SGIUI?.icon(name) ?? "";
const fmtMoney = n => Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtDate  = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-CO") : "—";
const fmtQty   = n => Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });

let _pendientes = [];
let _historial  = [];
let _tab        = "pendientes";
const _fPend    = { q: "", nivel: "", urg: "" };
const _fHist    = { q: "", resultado: "", urg: "" };

window.aprobacionesView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  try {
    [_pendientes, _historial] = await Promise.all([
      API.get("/requerimientos/aprobaciones"),
      API.get("/requerimientos/historial").catch(() => []),
    ]);
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }

  const URG_WEIGHT = { alta: 0, media: 1, baja: 2 };
  _pendientes = (_pendientes || []).sort((a, b) =>
    (URG_WEIGHT[a.urgencia] ?? 1) - (URG_WEIGHT[b.urgencia] ?? 1) ||
    a.id_requerimiento - b.id_requerimiento
  );
  _historial = _historial || [];

  render(vc);
};

function render(vc) {
  const puedeJefe  = AppState.can("requerimientos", "aprobar_jefe");
  const puedeFinal = AppState.can("requerimientos", "aprobar_final");

  const subtitle = puedeJefe && puedeFinal
    ? "Requerimientos esperando tu aprobación y el historial de decisiones."
    : puedeFinal
      ? "Aprobación final de requerimientos e historial de decisiones."
      : "Requerimientos de tu equipo esperando tu aprobación e historial de decisiones.";

  vc.innerHTML = `
    <section class="page-shell">
      ${window.SGIUI?.pageHeader({
        kicker:   "Operación",
        title:    "Aprobaciones",
        subtitle,
        meta:     _pendientes.length ? `<span class="results-chip">${icon("clipboard-check")} ${_pendientes.length} pendiente(s)</span>` : "",
      }) ?? ""}

      <div class="req-tabs">
        <button class="req-tab ${_tab === "pendientes" ? "active" : ""}" data-tab="pendientes">
          ${icon("inbox")} Pendientes <span class="req-tab-count">${_pendientes.length}</span>
        </button>
        <button class="req-tab ${_tab === "registros" ? "active" : ""}" data-tab="registros">
          ${icon("history")} Registros <span class="req-tab-count">${_historial.length}</span>
        </button>
      </div>

      <div id="apr-tab-content"></div>
    </section>`;

  vc.querySelectorAll(".req-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      _tab = btn.dataset.tab;
      render(vc);
    });
  });

  if (_tab === "pendientes") renderPendientes(puedeJefe, puedeFinal);
  else renderRegistros();

  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Pendientes de aprobación
// ─────────────────────────────────────────────────────────────────────────────
function renderPendientes(puedeJefe, puedeFinal) {
  const cont = document.getElementById("apr-tab-content");
  const SGIReq = window.SGIReq || {};
  const ambosNiveles = puedeJefe && puedeFinal;

  const deJefe  = _pendientes.filter(r => r.nivel === "jefe").length;
  const deFinal = _pendientes.filter(r => r.nivel === "final").length;
  const montoPendiente = _pendientes.reduce((s, r) => s + Number(r.valor_total || 0), 0);

  cont.innerHTML = `
    <div class="req-kpi-row">
      ${puedeJefe ? `
      <div class="req-kpi warning">
        <span class="req-kpi-icon">${icon("user-check")}</span>
        <div><span class="req-kpi-val">${deJefe}</span><span class="req-kpi-label">Para aprobación de jefe</span></div>
      </div>` : ""}
      ${puedeFinal ? `
      <div class="req-kpi">
        <span class="req-kpi-icon">${icon("shield-check")}</span>
        <div><span class="req-kpi-val">${deFinal}</span><span class="req-kpi-label">Para aprobación final</span></div>
      </div>` : ""}
      <div class="req-kpi accent">
        <span class="req-kpi-icon">${icon("coins")}</span>
        <div><span class="req-kpi-val">${fmtMoney(montoPendiente)}</span><span class="req-kpi-label">Monto en espera</span></div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-filters">
        <input id="apr-buscar" type="text" class="filter-input"
          placeholder="Buscar por número, solicitante, descripción o proyecto..." style="flex:2;min-width:18rem">
        ${ambosNiveles ? `
        <select id="apr-nivel" class="select-sm" style="flex:1;min-width:10rem">
          <option value="">Ambos niveles</option>
          <option value="jefe">Aprobación de jefe</option>
          <option value="final">Aprobación final</option>
        </select>` : ""}
        <select id="apr-urgencia" class="select-sm" style="flex:1;min-width:9rem">
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
            <th>Solicitante</th>
            <th>Proyecto</th>
            <th>Fecha</th>
            <th>Urgencia</th>
            <th>Monto estimado</th>
            <th>Nivel</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="apr-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("apr-tbody");

  function fila(r) {
    const urg   = SGIReq.URGENCIA_LABEL?.[r.urgencia] || { label: r.urgencia || "—", cls: "badge-muted" };
    const cat   = (SGIReq.CATEGORIAS || []).find(c => c.value === r.categoria) || { label: r.categoria || "—", icon: "box" };
    const nivel = NIVEL_LABEL[r.nivel] || NIVEL_LABEL.jefe;
    const nItems = (r.items || []).length;
    return `
      <tr class="req-row ${r.urgencia === "alta" ? "req-row-alta" : ""}">
        <td class="req-td-main">
          <div class="req-num-cell">
            <span class="req-cat-icon" title="${cat.label}">${icon(cat.icon)}</span>
            <div>
              <div class="rec-num">${r.numero}</div>
              <div class="rec-desc">${r.descripcion || "—"} <span class="req-chip-items">${nItems} ítem${nItems === 1 ? "" : "s"}</span></div>
            </div>
          </div>
        </td>
        <td data-label="Solicitante">${r.solicitante}</td>
        <td data-label="Proyecto">${r.proyecto || "—"}${r.sigla ? ` <span class="rec-sigla">(${r.sigla})</span>` : ""}</td>
        <td data-label="Fecha"><div>${fmtDate(r.fecha_solicitud)}${SGIReq.esperaHTML ? SGIReq.esperaHTML({ ...r, estado: "pendiente_jefe" }) : ""}</div></td>
        <td data-label="Urgencia"><span class="badge ${urg.cls}">${urg.label}</span></td>
        <td data-label="Monto estimado" class="req-money">${fmtMoney(r.valor_total)}</td>
        <td data-label="Nivel"><span class="badge ${nivel.cls}">${nivel.label}</span></td>
        <td class="req-td-actions">
          <div class="req-actions">
            <button class="btn btn-primary btn-sm btn-apr-revisar" data-id="${r.id_requerimiento}">Revisar</button>
          </div>
        </td>
      </tr>`;
  }

  function aplicarFiltros() {
    const q     = (document.getElementById("apr-buscar").value || "").trim();
    const nivel = document.getElementById("apr-nivel")?.value || "";
    const urg   = document.getElementById("apr-urgencia").value;
    Object.assign(_fPend, { q, nivel, urg });

    const visibles = _pendientes.filter(r => {
      if (nivel && r.nivel !== nivel) return false;
      if (urg && r.urgencia !== urg) return false;
      if (q) {
        if (window.SGISearch?.matches) {
          if (!SGISearch.matches(q, r.numero, r.solicitante, r.descripcion, r.proyecto)) return false;
        } else if (!`${r.numero} ${r.solicitante} ${r.descripcion || ""} ${r.proyecto || ""}`.toLowerCase().includes(q.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    if (visibles.length) {
      tbody.innerHTML = visibles.map(fila).join("");
    } else {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="req-empty">
            <div class="req-empty-icon req-empty-ok">${icon("check-circle")}</div>
            <p class="req-empty-title">${_pendientes.length ? "Nada coincide con los filtros" : "¡Estás al día!"}</p>
            <p class="req-empty-sub">${_pendientes.length ? "Ajusta la búsqueda o los filtros." : "No tienes requerimientos pendientes de aprobación."}</p>
          </div>
        </td></tr>`;
    }
    window.SGIUI?.hydrate();
  }

  document.getElementById("apr-buscar").value = _fPend.q;
  if (document.getElementById("apr-nivel")) document.getElementById("apr-nivel").value = _fPend.nivel;
  document.getElementById("apr-urgencia").value = _fPend.urg;

  document.getElementById("apr-buscar").addEventListener("input",  aplicarFiltros);
  document.getElementById("apr-nivel")?.addEventListener("change", aplicarFiltros);
  document.getElementById("apr-urgencia").addEventListener("change", aplicarFiltros);

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-apr-revisar");
    if (!btn) return;
    const r = _pendientes.find(x => String(x.id_requerimiento) === btn.dataset.id);
    if (r) abrirRevision(r);
  });

  aplicarFiltros();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Registros (historial de decisiones + métricas)
// ─────────────────────────────────────────────────────────────────────────────
function renderRegistros() {
  const cont = document.getElementById("apr-tab-content");
  const SGIReq = window.SGIReq || {};

  const aprobados  = _historial.filter(r => r.estado !== "rechazado");
  const rechazados = _historial.filter(r => r.estado === "rechazado");
  const montoAprob = aprobados.reduce((s, r) => s + Number(r.valor_total || 0), 0);
  const montoRech  = rechazados.reduce((s, r) => s + Number(r.valor_total || 0), 0);
  const total      = _historial.length;
  const tasa       = total ? Math.round((aprobados.length / total) * 100) : 0;

  // Average days between the request and the jefe decision (approved rows only).
  const tiempos = aprobados
    .filter(r => r.fecha_aprobado_jefe && r.fecha_solicitud)
    .map(r => (new Date(r.fecha_aprobado_jefe) - new Date(r.fecha_solicitud)) / 86400000);
  const tiempoMedio = tiempos.length
    ? (tiempos.reduce((s, d) => s + d, 0) / tiempos.length)
    : null;
  const tiempoTxt = tiempoMedio == null ? "—"
    : tiempoMedio < 1 ? "El mismo día"
    : `${tiempoMedio.toFixed(1).replace(".", ",")} días`;

  const totalMonto = montoAprob + montoRech;
  const pctAprob   = totalMonto ? Math.round((montoAprob / totalMonto) * 100) : 0;

  cont.innerHTML = `
    <div class="req-kpi-row">
      <div class="req-kpi success">
        <span class="req-kpi-icon">${icon("check-circle")}</span>
        <div><span class="req-kpi-val">${aprobados.length} · ${fmtMoney(montoAprob)}</span><span class="req-kpi-label">Aprobados</span></div>
      </div>
      <div class="req-kpi danger">
        <span class="req-kpi-icon">${icon("x-circle")}</span>
        <div><span class="req-kpi-val">${rechazados.length} · ${fmtMoney(montoRech)}</span><span class="req-kpi-label">Rechazados</span></div>
      </div>
      <div class="req-kpi">
        <span class="req-kpi-icon">${icon("percent")}</span>
        <div><span class="req-kpi-val">${tasa}%</span><span class="req-kpi-label">Tasa de aprobación</span></div>
      </div>
      <div class="req-kpi accent">
        <span class="req-kpi-icon">${icon("timer")}</span>
        <div><span class="req-kpi-val">${tiempoTxt}</span><span class="req-kpi-label">Respuesta del jefe (prom.)</span></div>
      </div>
    </div>

    ${totalMonto > 0 ? `
    <div class="req-split-card">
      <div class="req-split-head">
        <span>${icon("scale")} Dinero aprobado vs rechazado</span>
        <span class="req-split-pcts"><strong class="ok">${pctAprob}%</strong> / <strong class="bad">${100 - pctAprob}%</strong></span>
      </div>
      <div class="req-split-bar">
        <div class="req-split-ok" style="width:${pctAprob}%" title="Aprobado: ${fmtMoney(montoAprob)}"></div>
        <div class="req-split-bad" style="width:${100 - pctAprob}%" title="Rechazado: ${fmtMoney(montoRech)}"></div>
      </div>
      <div class="req-split-legend">
        <span><span class="dot ok"></span>Aprobado ${fmtMoney(montoAprob)}</span>
        <span><span class="dot bad"></span>Rechazado ${fmtMoney(montoRech)}</span>
      </div>
    </div>` : ""}

    <div class="table-wrap">
      <div class="table-filters">
        <input id="hist-buscar" type="text" class="filter-input"
          placeholder="Buscar por número, solicitante, descripción o proyecto..." style="flex:2;min-width:18rem">
        <select id="hist-resultado" class="select-sm" style="flex:1;min-width:9rem">
          <option value="">Todo resultado</option>
          <option value="aprobado">Aprobados</option>
          <option value="rechazado">Rechazados</option>
        </select>
        <select id="hist-urgencia" class="select-sm" style="flex:1;min-width:9rem">
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
            <th>Solicitante</th>
            <th>Decidido por</th>
            <th>Fecha decisión</th>
            <th>Monto</th>
            <th>Resultado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="hist-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("hist-tbody");

  function resultadoDe(r) {
    if (r.estado === "rechazado") {
      const nivel = r.fecha_aprobado_jefe ? "dueño" : "jefe";
      return { label: `Rechazado (${nivel})`, cls: "badge-danger", aprobado: false };
    }
    const est = SGIReq.ESTADO_LABEL?.[r.estado];
    return { label: est?.label || "Aprobado", cls: "badge-success", aprobado: true };
  }

  function fila(r) {
    const res = resultadoDe(r);
    const cat = (SGIReq.CATEGORIAS || []).find(c => c.value === r.categoria) || { label: r.categoria || "—", icon: "box" };
    const decididoPor = r.estado === "rechazado"
      ? (r.fecha_aprobado_jefe ? (r.aprobador_final || "Dueño") : (r.aprobador_jefe || "Jefe de área"))
      : [r.aprobador_jefe, r.aprobador_final].filter(Boolean).join(" → ") || "—";
    const fechaDecision = r.fecha_aprobado_final || r.fecha_aprobado_jefe || r.fecha_solicitud;
    return `
      <tr class="req-row">
        <td class="req-td-main">
          <div class="req-num-cell">
            <span class="req-cat-icon" title="${cat.label}">${icon(cat.icon)}</span>
            <div>
              <div class="rec-num">${r.numero}</div>
              <div class="rec-desc">${r.descripcion || "—"}</div>
            </div>
          </div>
        </td>
        <td data-label="Solicitante">${r.solicitante}</td>
        <td data-label="Decidido por">${decididoPor}</td>
        <td data-label="Fecha decisión">${fmtDate(fechaDecision)}</td>
        <td data-label="Monto" class="req-money">${fmtMoney(r.valor_total)}</td>
        <td data-label="Resultado"><div class="req-estado-cell"><span class="badge ${res.cls}">${res.label}</span>${SGIReq.miniFlowHTML ? SGIReq.miniFlowHTML(r) : ""}</div></td>
        <td class="req-td-actions">
          <div class="req-actions">
            <button class="btn btn-ghost btn-sm btn-hist-detalle" data-id="${r.id_requerimiento}">Ver detalle</button>
            <button class="btn btn-ghost btn-sm btn-hist-pdf" data-id="${r.id_requerimiento}" title="Ver PDF">${icon("file-text")}</button>
          </div>
        </td>
      </tr>`;
  }

  function aplicarFiltros() {
    const q   = (document.getElementById("hist-buscar").value || "").trim();
    const res = document.getElementById("hist-resultado").value;
    const urg = document.getElementById("hist-urgencia").value;
    Object.assign(_fHist, { q, resultado: res, urg });

    const visibles = _historial.filter(r => {
      if (res === "aprobado"  && r.estado === "rechazado") return false;
      if (res === "rechazado" && r.estado !== "rechazado") return false;
      if (urg && r.urgencia !== urg) return false;
      if (q) {
        if (window.SGISearch?.matches) {
          if (!SGISearch.matches(q, r.numero, r.solicitante, r.descripcion, r.proyecto)) return false;
        } else if (!`${r.numero} ${r.solicitante} ${r.descripcion || ""} ${r.proyecto || ""}`.toLowerCase().includes(q.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    if (visibles.length) {
      tbody.innerHTML = visibles.map(fila).join("");
    } else {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="req-empty">
            <div class="req-empty-icon">${icon("history")}</div>
            <p class="req-empty-title">${_historial.length ? "Nada coincide con los filtros" : "Aún no hay decisiones registradas"}</p>
            <p class="req-empty-sub">${_historial.length ? "Ajusta la búsqueda o los filtros." : "Cuando apruebes o rechaces requerimientos, quedarán registrados aquí."}</p>
          </div>
        </td></tr>`;
    }
    window.SGIUI?.hydrate();
  }

  document.getElementById("hist-buscar").value    = _fHist.q;
  document.getElementById("hist-resultado").value = _fHist.resultado;
  document.getElementById("hist-urgencia").value  = _fHist.urg;

  document.getElementById("hist-buscar").addEventListener("input",  aplicarFiltros);
  document.getElementById("hist-resultado").addEventListener("change", aplicarFiltros);
  document.getElementById("hist-urgencia").addEventListener("change", aplicarFiltros);

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-hist-detalle, .btn-hist-pdf");
    if (!btn) return;
    const r = _historial.find(x => String(x.id_requerimiento) === btn.dataset.id);
    if (!r) return;
    if (btn.classList.contains("btn-hist-pdf")) window.SGIReq?.abrirRequerimientoPDF?.(r);
    else abrirDetalleHistorial(r);
  });

  aplicarFiltros();
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle de un registro del historial (solo lectura)
// ─────────────────────────────────────────────────────────────────────────────
function abrirDetalleHistorial(r) {
  const SGIReq = window.SGIReq || {};
  const est = SGIReq.ESTADO_LABEL?.[r.estado] || { label: r.estado, cls: "badge-muted" };
  const urg = SGIReq.URGENCIA_LABEL?.[r.urgencia] || { label: r.urgencia || "—", cls: "badge-muted" };
  const cat = (SGIReq.CATEGORIAS || []).find(c => c.value === r.categoria) || { label: r.categoria || "—" };

  const filas = (r.items || []).map(it => `
    <tr>
      <td>${it.descripcion}</td>
      <td class="req-td-right">${fmtQty(it.cantidad_solicitada)} ${it.unidad || ""}</td>
      <td class="req-td-right">${fmtMoney(it.precio_unitario)}</td>
      <td class="req-td-right">${fmtMoney(Number(it.cantidad_solicitada) * Number(it.precio_unitario))}</td>
    </tr>`).join("");

  UI.openModal(`Registro · ${r.numero}`, `
    <div class="rec-modal">
      <div class="rec-modal-summary">
        <div class="rec-summary-item"><span class="lbl">Solicitante</span><span class="val">${r.solicitante}</span></div>
        <div class="rec-summary-item"><span class="lbl">Proyecto</span><span class="val">${r.proyecto || "—"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Categoría</span><span class="val">${cat.label}</span></div>
        <div class="rec-summary-item"><span class="lbl">Urgencia</span><span class="val"><span class="badge ${urg.cls}">${urg.label}</span></span></div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Recorrido &nbsp;<span class="badge ${est.cls}">${est.label}</span></span>
        ${SGIReq.timelineHTML ? SGIReq.timelineHTML(r) : ""}
        ${r.aprobador_jefe || r.aprobador_final ? `
          <div class="req-aprobaciones-info">
            ${r.aprobador_jefe ? `<span>${icon("user-check")} Jefe: <strong>${r.aprobador_jefe}</strong> · ${fmtDate(r.fecha_aprobado_jefe)}</span>` : ""}
            ${r.aprobador_final ? `<span>${icon("shield-check")} Dueño: <strong>${r.aprobador_final}</strong> · ${fmtDate(r.fecha_aprobado_final)}</span>` : ""}
          </div>` : ""}
        ${r.motivo_rechazo ? `
          <div class="req-rechazo-box">
            ${icon("x-circle")}
            <div><strong>Motivo del rechazo:</strong> ${r.motivo_rechazo}</div>
          </div>` : ""}
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
      <button class="btn btn-ghost" id="hist-det-pdf">${icon("file-text")} Ver PDF</button>
      <button class="btn btn-primary" onclick="UI.closeModal()">Cerrar</button>
    </div>
  `);
  document.getElementById("hist-det-pdf")?.addEventListener("click", () => window.SGIReq?.abrirRequerimientoPDF?.(r));
  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de revisión: detalle completo + aprobar / rechazar
// ─────────────────────────────────────────────────────────────────────────────
function abrirRevision(r) {
  const SGIReq = window.SGIReq || {};
  const urg   = SGIReq.URGENCIA_LABEL?.[r.urgencia] || { label: r.urgencia || "—", cls: "badge-muted" };
  const cat   = (SGIReq.CATEGORIAS || []).find(c => c.value === r.categoria) || { label: r.categoria || "—" };
  const nivel = NIVEL_LABEL[r.nivel] || NIVEL_LABEL.jefe;

  const filas = (r.items || []).map(it => `
    <tr>
      <td>${it.descripcion}</td>
      <td class="req-td-right">${fmtQty(it.cantidad_solicitada)} ${it.unidad || ""}</td>
      <td class="req-td-right">${fmtMoney(it.precio_unitario)}</td>
      <td class="req-td-right">${fmtMoney(Number(it.cantidad_solicitada) * Number(it.precio_unitario))}</td>
    </tr>`).join("");

  const infoJefe = r.nivel === "final" && r.aprobador_jefe
    ? `<div class="req-aprobaciones-info"><span>${icon("user-check")} Aprobado por el jefe: <strong>${r.aprobador_jefe}</strong> · ${fmtDate(r.fecha_aprobado_jefe)}</span></div>`
    : "";

  UI.openModal(`Revisar · ${r.numero}`, `
    <div class="rec-modal">
      <div class="rec-modal-summary">
        <div class="rec-summary-item"><span class="lbl">Solicitante</span><span class="val">${r.solicitante}</span></div>
        <div class="rec-summary-item"><span class="lbl">Proyecto</span><span class="val">${r.proyecto || "—"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Fecha</span><span class="val">${fmtDate(r.fecha_solicitud)}</span></div>
        <div class="rec-summary-item"><span class="lbl">Categoría</span><span class="val">${cat.label}</span></div>
        <div class="rec-summary-item"><span class="lbl">Urgencia</span><span class="val"><span class="badge ${urg.cls}">${urg.label}</span></span></div>
        <div class="rec-summary-item"><span class="lbl">Nivel</span><span class="val"><span class="badge ${nivel.cls}">${nivel.label}</span></span></div>
      </div>

      ${SGIReq.timelineHTML ? `<div class="form-section"><span class="form-section-label">Recorrido</span>${SGIReq.timelineHTML(r)}</div>` : ""}
      ${infoJefe}

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

      <div class="form-group form-group--full" id="apr-motivo-wrap" style="display:none;margin-top:0.5rem">
        <label>Motivo del rechazo *</label>
        <textarea id="apr-motivo" rows="2" placeholder="Explica por qué se rechaza esta solicitud..."></textarea>
      </div>

      <div id="apr-error" class="form-error" style="display:none"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Volver</button>
      <button class="btn btn-danger" id="apr-rechazar">Rechazar</button>
      <button class="btn btn-primary" id="apr-aprobar">${r.nivel === "final" ? "Aprobar y enviar a tesorería" : "Aprobar"}</button>
    </div>
  `);
  window.SGIUI?.hydrate();

  const errorEl = document.getElementById("apr-error");
  function fallar(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  document.getElementById("apr-aprobar").addEventListener("click", async function () {
    errorEl.style.display = "none";
    this.disabled = true;
    this.textContent = "Aprobando...";
    try {
      const ruta = r.nivel === "final" ? "aprobar-final" : "aprobar-jefe";
      await API.patch(`/requerimientos/${r.id_requerimiento}/${ruta}`);
      UI.closeModal();
      UI.toast(
        r.nivel === "final"
          ? `${r.numero} aprobado. Pasó a tesorería y se notificó al tesorero.`
          : `${r.numero} aprobado. Quedó pendiente de la aprobación final del dueño.`,
        "ok"
      );
      window.aprobacionesView();
    } catch (e) {
      this.disabled = false;
      this.textContent = r.nivel === "final" ? "Aprobar y enviar a tesorería" : "Aprobar";
      fallar(e.message || "No se pudo aprobar.");
    }
  });

  document.getElementById("apr-rechazar").addEventListener("click", async function () {
    errorEl.style.display = "none";
    const wrap = document.getElementById("apr-motivo-wrap");

    if (wrap.style.display === "none") {
      wrap.style.display = "";
      document.getElementById("apr-motivo").focus();
      this.textContent = "Confirmar rechazo";
      return;
    }

    const motivo = document.getElementById("apr-motivo").value.trim();
    if (motivo.length < 5) return fallar("Indica un motivo de al menos 5 caracteres.");

    this.disabled = true;
    this.textContent = "Rechazando...";
    try {
      await API.patch(`/requerimientos/${r.id_requerimiento}/rechazar`, { motivo });
      UI.closeModal();
      UI.toast(`${r.numero} rechazado. Se notificó al solicitante con el motivo.`, "ok");
      window.aprobacionesView();
    } catch (e) {
      this.disabled = false;
      this.textContent = "Confirmar rechazo";
      fallar(e.message || "No se pudo rechazar.");
    }
  });
}

})();
