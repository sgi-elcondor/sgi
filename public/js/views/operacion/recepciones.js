(function () {

const ESTADO_LABEL = {
  desembolsado:     { label: "Desembolsado",     cls: "badge-warning" },
  recibido_parcial: { label: "Recibido parcial", cls: "badge-info"    },
  en_inventario:    { label: "En inventario",    cls: "badge-success" },
  cancelado:        { label: "Cancelado",        cls: "badge-danger"  },
  pendiente:        { label: "Pendiente",        cls: "badge-muted"   },
};

const fmtMoney = n => Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtDate  = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-CO") : "—";
const fmtQty   = n => Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });

let _requerimientos = [];

window.recepcionesView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const canCreate = AppState.can("recepciones", "crear");

  const data = await API.get("/recepciones/pendientes").catch(e => {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    return null;
  });
  if (!data) return;

  _requerimientos = data;

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <div class="table-header-titles">
          <h3>Requerimientos pendientes</h3>
          <span class="count-chip" id="rec-count">${data.length} ${data.length === 1 ? "requerimiento" : "requerimientos"}</span>
        </div>
      </div>

      <div class="table-filters">
        <input id="rec-buscar" type="text" class="filter-input"
          placeholder="Buscar por número, proyecto o descripción..." style="flex:2;min-width:18rem">
        <select id="rec-estado" class="select-sm" style="flex:1;min-width:10rem">
          <option value="">Todos los estados</option>
          <option value="desembolsado">Desembolsado</option>
          <option value="recibido_parcial">Recibido parcial</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>N° Requerimiento</th>
            <th>Proyecto</th>
            <th>Desembolso</th>
            <th>Valor</th>
            <th>Progreso</th>
            <th>Estado</th>
            ${canCreate ? "<th>Acciones</th>" : ""}
          </tr>
        </thead>
        <tbody id="rec-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("rec-tbody");
  const count = document.getElementById("rec-count");
  const colCount = canCreate ? 7 : 6;

  function filaRequerimiento(r) {
    const est = ESTADO_LABEL[r.estado] || { label: r.estado, cls: "badge-muted" };
    const accionesCell = canCreate
      ? `<td><button class="btn btn-primary btn-sm btn-rec-registrar" data-id="${r.id_requerimiento}">Registrar recepción</button></td>`
      : "";
    return `
      <tr>
        <td>
          <div class="rec-num">${r.numero}</div>
          <div class="rec-desc">${r.descripcion || "—"}</div>
        </td>
        <td>${r.proyecto}${r.sigla ? ` <span class="rec-sigla">(${r.sigla})</span>` : ""}</td>
        <td>${fmtDate(r.fecha_desembolso)}</td>
        <td class="rec-money">${fmtMoney(r.valor_total)}</td>
        <td>
          <div class="rec-progress-wrap" title="${r.progreso_pct}% recibido">
            <div class="rec-progress-bar"><div class="rec-progress-fill" style="width:${Math.min(100, r.progreso_pct)}%"></div></div>
            <span class="rec-progress-text">${r.progreso_pct}%</span>
          </div>
        </td>
        <td><span class="badge ${est.cls}">${est.label}</span></td>
        ${accionesCell}
      </tr>`;
  }

  function aplicarFiltros() {
    const q   = (document.getElementById("rec-buscar").value || "").toLowerCase().trim();
    const est = document.getElementById("rec-estado").value;

    const visibles = _requerimientos.filter(r => {
      if (est && r.estado !== est) return false;
      if (q) {
        const blob = `${r.numero} ${r.proyecto} ${r.sigla} ${r.descripcion || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    if (visibles.length) {
      tbody.innerHTML = visibles.map(filaRequerimiento).join("");
    } else {
      const msg = _requerimientos.length
        ? "No hay requerimientos que coincidan con los filtros."
        : "No hay requerimientos pendientes de recepción.";
      tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-row">${msg}</td></tr>`;
    }
    count.textContent = `${visibles.length} ${visibles.length === 1 ? "requerimiento" : "requerimientos"}`;
  }

  document.getElementById("rec-buscar").addEventListener("input",  aplicarFiltros);
  document.getElementById("rec-estado").addEventListener("change", aplicarFiltros);

  if (canCreate) {
    tbody.addEventListener("click", e => {
      const btn = e.target.closest(".btn-rec-registrar");
      if (!btn) return;
      const r = _requerimientos.find(x => String(x.id_requerimiento) === btn.dataset.id);
      if (r) abrirModalRecepcion(r);
    });
  }

  aplicarFiltros();
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal de registro de recepción
// ─────────────────────────────────────────────────────────────────────────────
function abrirModalRecepcion(r) {
  const itemsConPendiente = r.items.filter(it => it.cantidad_pendiente > 0);

  if (!itemsConPendiente.length) {
    UI.toast("Este requerimiento ya tiene todos sus ítems recibidos completos.", "info");
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const filasItems = itemsConPendiente.map(it => `
    <tr data-id-item="${it.id_item}">
      <td class="rec-item-desc">
        <div class="rec-item-name">${it.descripcion}</div>
        <div class="rec-item-meta">
          Solicitado: ${fmtQty(it.cantidad_solicitada)} ${it.unidad} ·
          Recibido: ${fmtQty(it.cantidad_recibida)} ${it.unidad}
        </div>
      </td>
      <td class="rec-item-pendiente">
        <strong>${fmtQty(it.cantidad_pendiente)}</strong>
        <span class="rec-item-unidad">${it.unidad}</span>
      </td>
      <td class="rec-item-input-cell">
        <input type="number" class="rec-item-cantidad" step="any" min="0" max="${it.cantidad_pendiente}"
               placeholder="0" />
      </td>
    </tr>`).join("");

  UI.openModal(`Registrar recepción · ${r.numero}`, `
    <div class="rec-modal">
      <div class="rec-modal-summary">
        <div class="rec-summary-item"><span class="lbl">Proyecto</span><span class="val">${r.proyecto}</span></div>
        <div class="rec-summary-item"><span class="lbl">Descripción</span><span class="val">${r.descripcion || "—"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Valor total</span><span class="val">${fmtMoney(r.valor_total)}</span></div>
        <div class="rec-summary-item"><span class="lbl">Estado actual</span><span class="val">${(ESTADO_LABEL[r.estado] || {}).label || r.estado}</span></div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Materiales a recibir</span>
        <p class="rec-hint">Ingresa la cantidad que recibes ahora para cada ítem. Puedes recibir solo algunos (entrega parcial); los demás quedan pendientes.</p>
        <table class="rec-items-table">
          <thead>
            <tr>
              <th>Material</th>
              <th class="rec-items-th-right">Pendiente</th>
              <th class="rec-items-th-right">Recibido ahora</th>
            </tr>
          </thead>
          <tbody>${filasItems}</tbody>
        </table>
      </div>

      <div class="form-section">
        <span class="form-section-label">Detalles de la entrega</span>
        <div class="form-grid">
          <div class="form-group"><label>Fecha *</label><input id="rec-fecha" type="date" value="${hoy}" /></div>
          <div class="form-group form-group--full"><label>Observaciones</label><textarea id="rec-obs" rows="2" placeholder="Notas sobre la entrega (opcional)"></textarea></div>
          <div class="form-group form-group--full">
            <label>Comprobante de entrega (opcional)</label>
            <input id="rec-baucher" type="file" accept="image/*,application/pdf" />
            <div id="rec-baucher-status" class="rec-baucher-status"></div>
          </div>
        </div>
      </div>

      <div id="rec-error" class="form-error" style="display:none"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="rec-submit">Registrar recepción</button>
    </div>
  `);

  document.getElementById("rec-submit").addEventListener("click", () => guardarRecepcion(r));
}

async function guardarRecepcion(r) {
  const errorEl = document.getElementById("rec-error");
  errorEl.style.display = "none";

  const fecha  = document.getElementById("rec-fecha").value;
  const obs    = document.getElementById("rec-obs").value.trim();
  const file   = document.getElementById("rec-baucher").files[0];

  if (!fecha) {
    errorEl.textContent = "La fecha es obligatoria.";
    errorEl.style.display = "block";
    return;
  }

  // Recolectar cantidades por ítem
  const items = [];
  document.querySelectorAll("tr[data-id-item]").forEach(tr => {
    const idItem    = Number(tr.dataset.idItem);
    const cantidad  = Number(tr.querySelector(".rec-item-cantidad").value);
    if (Number.isFinite(cantidad) && cantidad > 0) {
      items.push({ id_item: idItem, cantidad });
    }
  });

  if (!items.length) {
    errorEl.textContent = "Debes registrar al menos una cantidad mayor a cero.";
    errorEl.style.display = "block";
    return;
  }

  const btn = document.getElementById("rec-submit");
  btn.disabled = true;
  btn.textContent = "Registrando...";

  try {
    let comprobante_url = null;

    if (file) {
      const status = document.getElementById("rec-baucher-status");
      status.textContent = "Subiendo comprobante...";
      const fd = new FormData();
      fd.append("baucher", file);
      const res = await fetch("/api/v1/uploads/baucher", {
        method:  "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("fb_token")}` },
        body:    fd,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al subir el comprobante");
      comprobante_url = result.url;
      status.textContent = "Comprobante subido.";
    }

    const r2 = await API.post("/recepciones", {
      id_requerimiento: r.id_requerimiento,
      fecha,
      observaciones:    obs || null,
      comprobante_url,
      items,
    });

    UI.closeModal();

    const msg = r2.estado_nuevo === "en_inventario"
      ? `Recepción registrada. ${r.numero} pasó a "En inventario".`
      : "Recepción parcial registrada.";
    UI.toast(msg, "ok");

    recepcionesView();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Registrar recepción";
    errorEl.textContent = e.message || "Error al registrar la recepción.";
    errorEl.style.display = "block";
  }
}

})();
