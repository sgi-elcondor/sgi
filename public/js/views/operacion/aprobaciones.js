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

window.aprobacionesView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const puedeJefe  = AppState.can("requerimientos", "aprobar_jefe");
  const puedeFinal = AppState.can("requerimientos", "aprobar_final");
  const ambosNiveles = puedeJefe && puedeFinal;

  let data;
  try {
    data = await API.get("/requerimientos/aprobaciones");
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }

  const SGIReq = window.SGIReq || {};
  const URG_WEIGHT = { alta: 0, media: 1, baja: 2 };

  _pendientes = (data || []).sort((a, b) =>
    (URG_WEIGHT[a.urgencia] ?? 1) - (URG_WEIGHT[b.urgencia] ?? 1) ||
    a.id_requerimiento - b.id_requerimiento
  );

  const deJefe  = _pendientes.filter(r => r.nivel === "jefe").length;
  const deFinal = _pendientes.filter(r => r.nivel === "final").length;
  const montoPendiente = _pendientes.reduce((s, r) => s + Number(r.valor_total || 0), 0);

  const subtitle = ambosNiveles
    ? "Requerimientos esperando tu aprobación de jefe y la aprobación final."
    : puedeFinal
      ? "Requerimientos aprobados por el jefe que esperan tu aprobación final para pasar a tesorería."
      : "Requerimientos de tu equipo esperando tu aprobación.";

  vc.innerHTML = `
    <section class="page-shell">
      ${window.SGIUI?.pageHeader({
        kicker:   "Operación",
        title:    "Aprobaciones",
        subtitle,
        meta:     _pendientes.length ? `<span class="results-chip">${icon("clipboard-check")} ${_pendientes.length} pendiente(s)</span>` : "",
      }) ?? ""}

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
      </div>
    </section>`;

  const tbody = document.getElementById("apr-tbody");

  function fila(r) {
    const urg   = SGIReq.URGENCIA_LABEL?.[r.urgencia] || { label: r.urgencia || "—", cls: "badge-muted" };
    const cat   = (SGIReq.CATEGORIAS || []).find(c => c.value === r.categoria) || { label: r.categoria || "—", icon: "box" };
    const nivel = NIVEL_LABEL[r.nivel] || NIVEL_LABEL.jefe;
    const nItems = (r.items || []).length;
    return `
      <tr class="req-row ${r.urgencia === "alta" ? "req-row-alta" : ""}" data-req-id="${r.id_requerimiento}">
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

    const visibles = _pendientes.filter(r => {
      if (nivel && r.nivel !== nivel) return false;
      if (urg && r.urgencia !== urg) return false;
      if (q) {
        if (window.SGISearch?.matches) {
          if (!SGISearch.matches(q, r.numero, r.solicitante, r.descripcion, r.proyecto)) return false;
        } else {
          const blob = `${r.numero} ${r.solicitante} ${r.descripcion || ""} ${r.proyecto || ""}`.toLowerCase();
          if (!blob.includes(q.toLowerCase())) return false;
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
  window.SGIUI?.hydrate();
};

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
