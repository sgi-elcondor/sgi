(function () {

const icon     = (name) => window.SGIUI?.icon(name) ?? "";
const fmtMoney = n => Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtDate  = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-CO") : "—";
const fmtQty   = n => Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });

let _pendientes    = [];
let _desembolsados = [];
let _tab           = "pendientes";
const _fPend = { q: "", urg: "" };
const _fHist = { q: "" };

window.desembolsosView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  let data;
  try {
    data = await API.get("/requerimientos/desembolsos");
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }

  const URG_WEIGHT = { alta: 0, media: 1, baja: 2 };
  _pendientes = (data || [])
    .filter(r => r.estado === "pendiente_tesoreria")
    .sort((a, b) => (URG_WEIGHT[a.urgencia] ?? 1) - (URG_WEIGHT[b.urgencia] ?? 1) || a.id_requerimiento - b.id_requerimiento);
  _desembolsados = (data || [])
    .filter(r => r.estado !== "pendiente_tesoreria")
    .sort((a, b) => b.id_requerimiento - a.id_requerimiento);

  render(vc);
};

function render(vc) {
  vc.innerHTML = `
    <section class="page-shell">
      ${window.SGIUI?.pageHeader({
        kicker:   "Tesorería",
        title:    "Desembolsos",
        subtitle: "Registra los pagos de los requerimientos aprobados y consulta lo ya desembolsado.",
        meta:     _pendientes.length ? `<span class="results-chip">${icon("banknote")} ${_pendientes.length} por desembolsar</span>` : "",
      }) ?? ""}

      <div class="req-tabs">
        <button class="req-tab ${_tab === "pendientes" ? "active" : ""}" data-tab="pendientes">
          ${icon("inbox")} Pendientes <span class="req-tab-count">${_pendientes.length}</span>
        </button>
        <button class="req-tab ${_tab === "historial" ? "active" : ""}" data-tab="historial">
          ${icon("history")} Desembolsados <span class="req-tab-count">${_desembolsados.length}</span>
        </button>
      </div>

      <div id="des-tab-content"></div>
    </section>`;

  vc.querySelectorAll(".req-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      _tab = btn.dataset.tab;
      render(vc);
    });
  });

  if (_tab === "pendientes") renderPendientes();
  else renderHistorial();

  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Pendientes de desembolso
// ─────────────────────────────────────────────────────────────────────────────
function renderPendientes() {
  const cont = document.getElementById("des-tab-content");
  const SGIReq = window.SGIReq || {};

  const monto = _pendientes.reduce((s, r) => s + Number(r.valor_total || 0), 0);
  const urgentes = _pendientes.filter(r => r.urgencia === "alta").length;

  cont.innerHTML = `
    <div class="req-kpi-row">
      <div class="req-kpi warning">
        <span class="req-kpi-icon">${icon("inbox")}</span>
        <div><span class="req-kpi-val">${_pendientes.length}</span><span class="req-kpi-label">Por desembolsar</span></div>
      </div>
      <div class="req-kpi accent">
        <span class="req-kpi-icon">${icon("coins")}</span>
        <div><span class="req-kpi-val">${fmtMoney(monto)}</span><span class="req-kpi-label">Monto estimado total</span></div>
      </div>
      ${urgentes ? `
      <div class="req-kpi danger">
        <span class="req-kpi-icon">${icon("flame")}</span>
        <div><span class="req-kpi-val">${urgentes}</span><span class="req-kpi-label">Urgencia alta</span></div>
      </div>` : ""}
    </div>

    <div class="table-wrap">
      <div class="table-filters">
        <input id="des-buscar" type="text" class="filter-input"
          placeholder="Buscar por número, solicitante, descripción o proyecto..." style="flex:2;min-width:18rem">
        <select id="des-urgencia" class="select-sm" style="flex:1;min-width:9rem">
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
            <th>Aprobación final</th>
            <th>Urgencia</th>
            <th>Monto estimado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="des-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("des-tbody");

  function fila(r) {
    const urg = SGIReq.URGENCIA_LABEL?.[r.urgencia] || { label: r.urgencia || "—", cls: "badge-muted" };
    const cat = (SGIReq.CATEGORIAS || []).find(c => c.value === r.categoria) || { label: r.categoria || "—", icon: "box" };
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
        <td data-label="Aprobación final">${fmtDate(r.fecha_aprobado_final)}${r.aprobador_final ? `<div class="req-wait">por ${r.aprobador_final}</div>` : ""}</td>
        <td data-label="Urgencia"><span class="badge ${urg.cls}">${urg.label}</span></td>
        <td data-label="Monto estimado" class="req-money">${fmtMoney(r.valor_total)}</td>
        <td class="req-td-actions">
          <div class="req-actions">
            <button class="btn btn-primary btn-sm btn-des-registrar" data-id="${r.id_requerimiento}">Registrar desembolso</button>
          </div>
        </td>
      </tr>`;
  }

  function aplicarFiltros() {
    const q   = (document.getElementById("des-buscar").value || "").trim();
    const urg = document.getElementById("des-urgencia").value;
    Object.assign(_fPend, { q, urg });

    const visibles = _pendientes.filter(r => {
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
            <div class="req-empty-icon req-empty-ok">${icon("check-circle")}</div>
            <p class="req-empty-title">${_pendientes.length ? "Nada coincide con los filtros" : "¡Estás al día!"}</p>
            <p class="req-empty-sub">${_pendientes.length ? "Ajusta la búsqueda o los filtros." : "No hay requerimientos esperando desembolso."}</p>
          </div>
        </td></tr>`;
    }
    window.SGIUI?.hydrate();
  }

  document.getElementById("des-buscar").value   = _fPend.q;
  document.getElementById("des-urgencia").value = _fPend.urg;
  document.getElementById("des-buscar").addEventListener("input",  aplicarFiltros);
  document.getElementById("des-urgencia").addEventListener("change", aplicarFiltros);

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-des-registrar");
    if (!btn) return;
    const r = _pendientes.find(x => String(x.id_requerimiento) === btn.dataset.id);
    if (r) abrirModalDesembolso(r);
  });

  aplicarFiltros();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Historial de desembolsados
// ─────────────────────────────────────────────────────────────────────────────
function renderHistorial() {
  const cont = document.getElementById("des-tab-content");
  const SGIReq = window.SGIReq || {};

  const totalReal = _desembolsados.reduce((s, r) => s + Number(r.valor_desembolsado ?? r.valor_total ?? 0), 0);
  const totalEst  = _desembolsados.reduce((s, r) => s + Number(r.valor_total || 0), 0);
  const diff      = totalReal - totalEst;

  cont.innerHTML = `
    <div class="req-kpi-row">
      <div class="req-kpi success">
        <span class="req-kpi-icon">${icon("banknote")}</span>
        <div><span class="req-kpi-val">${fmtMoney(totalReal)}</span><span class="req-kpi-label">Total desembolsado</span></div>
      </div>
      <div class="req-kpi">
        <span class="req-kpi-icon">${icon("clipboard-list")}</span>
        <div><span class="req-kpi-val">${_desembolsados.length}</span><span class="req-kpi-label">Operaciones</span></div>
      </div>
      <div class="req-kpi ${diff > 0 ? "danger" : "accent"}">
        <span class="req-kpi-icon">${icon("scale")}</span>
        <div><span class="req-kpi-val">${diff === 0 ? "Sin diferencia" : (diff > 0 ? "+" : "−") + fmtMoney(Math.abs(diff))}</span><span class="req-kpi-label">Real vs estimado</span></div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-filters">
        <input id="hist-buscar" type="text" class="filter-input"
          placeholder="Buscar por número, solicitante, descripción o proyecto..." style="flex:2;min-width:18rem">
      </div>

      <table class="req-table">
        <thead>
          <tr>
            <th>N° Requerimiento</th>
            <th>Solicitante</th>
            <th>Desembolso</th>
            <th>Estimado</th>
            <th>Pagado</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="hist-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("hist-tbody");

  function fila(r) {
    const est = SGIReq.ESTADO_LABEL?.[r.estado] || { label: r.estado, cls: "badge-muted" };
    const cat = (SGIReq.CATEGORIAS || []).find(c => c.value === r.categoria) || { label: r.categoria || "—", icon: "box" };
    const real = Number(r.valor_desembolsado ?? r.valor_total ?? 0);
    const d    = real - Number(r.valor_total || 0);
    const diffHTML = d === 0 ? ""
      : `<div class="req-wait ${d > 0 ? "req-wait-danger" : ""}" title="Diferencia contra lo estimado">${d > 0 ? "+" : "−"}${fmtMoney(Math.abs(d))}</div>`;
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
        <td data-label="Desembolso">${fmtDate(r.fecha_desembolso)}${r.desembolsador ? `<div class="req-wait">por ${r.desembolsador}</div>` : ""}</td>
        <td data-label="Estimado" class="req-money">${fmtMoney(r.valor_total)}</td>
        <td data-label="Pagado" class="req-money">${fmtMoney(real)}${diffHTML}</td>
        <td data-label="Estado"><div class="req-estado-cell"><span class="badge ${est.cls}">${est.label}</span>${SGIReq.miniFlowHTML ? SGIReq.miniFlowHTML(r) : ""}</div></td>
        <td class="req-td-actions">
          <div class="req-actions">
            ${r.comprobante_desembolso_url ? `<button class="btn btn-ghost btn-sm btn-des-comprobante" data-url="${r.comprobante_desembolso_url}" title="Ver comprobante">${icon("paperclip")}</button>` : ""}
            <button class="btn btn-ghost btn-sm btn-des-trace" data-id="${r.id_requerimiento}" title="Trazabilidad">${icon("route")}</button>
            <button class="btn btn-ghost btn-sm btn-des-pdf" data-id="${r.id_requerimiento}" title="Ver PDF">${icon("file-text")}</button>
          </div>
        </td>
      </tr>`;
  }

  function aplicarFiltros() {
    const q = (document.getElementById("hist-buscar").value || "").trim();
    _fHist.q = q;

    const visibles = _desembolsados.filter(r => {
      if (!q) return true;
      if (window.SGISearch?.matches) {
        return SGISearch.matches(q, r.numero, r.solicitante, r.descripcion, r.proyecto);
      }
      return `${r.numero} ${r.solicitante} ${r.descripcion || ""} ${r.proyecto || ""}`.toLowerCase().includes(q.toLowerCase());
    });

    if (visibles.length) {
      tbody.innerHTML = visibles.map(fila).join("");
    } else {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="req-empty">
            <div class="req-empty-icon">${icon("history")}</div>
            <p class="req-empty-title">${_desembolsados.length ? "Nada coincide con la búsqueda" : "Aún no hay desembolsos"}</p>
            <p class="req-empty-sub">${_desembolsados.length ? "Ajusta la búsqueda." : "Cuando registres pagos, quedarán aquí con su comprobante."}</p>
          </div>
        </td></tr>`;
    }
    window.SGIUI?.hydrate();
  }

  document.getElementById("hist-buscar").value = _fHist.q;
  document.getElementById("hist-buscar").addEventListener("input", aplicarFiltros);

  tbody.addEventListener("click", e => {
    const comp = e.target.closest(".btn-des-comprobante");
    if (comp) { window.open(comp.dataset.url, "_blank"); return; }
    const trace = e.target.closest(".btn-des-trace");
    if (trace) { window.SGIReq?.abrirTrazabilidad?.(Number(trace.dataset.id)); return; }
    const pdf = e.target.closest(".btn-des-pdf");
    if (!pdf) return;
    const r = _desembolsados.find(x => String(x.id_requerimiento) === pdf.dataset.id);
    if (r) window.SGIReq?.abrirRequerimientoPDF?.(r);
  });

  aplicarFiltros();
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: registrar el desembolso (valor real + comprobante obligatorio)
// ─────────────────────────────────────────────────────────────────────────────
function abrirModalDesembolso(r) {
  const SGIReq = window.SGIReq || {};
  const hoy = new Date().toISOString().slice(0, 10);

  const filas = (r.items || []).map(it => `
    <tr>
      <td>${it.descripcion}</td>
      <td class="req-td-right">${fmtQty(it.cantidad_solicitada)} ${it.unidad || ""}</td>
      <td class="req-td-right">${fmtMoney(Number(it.cantidad_solicitada) * Number(it.precio_unitario))}</td>
    </tr>`).join("");

  UI.openModal(`Registrar desembolso · ${r.numero}`, `
    <div class="rec-modal">
      <div class="rec-modal-summary">
        <div class="rec-summary-item"><span class="lbl">Solicitante</span><span class="val">${r.solicitante}</span></div>
        <div class="rec-summary-item"><span class="lbl">Proyecto</span><span class="val">${r.proyecto || "—"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Aprobación final</span><span class="val">${fmtDate(r.fecha_aprobado_final)}${r.aprobador_final ? " · " + r.aprobador_final : ""}</span></div>
        <div class="rec-summary-item"><span class="lbl">Monto estimado</span><span class="val">${fmtMoney(r.valor_total)}</span></div>
      </div>

      ${!r.id_proyecto ? `
      <div class="req-rechazo-box" style="margin-top:0.75rem">
        ${icon("alert-triangle")}
        <div>Este requerimiento no tiene proyecto asociado: el gasto automático podría no crearse y tendrías que registrarlo manualmente en Gastos.</div>
      </div>` : ""}

      <div class="form-section">
        <span class="form-section-label">Ítems aprobados</span>
        <table class="rec-items-table">
          <thead><tr><th>Ítem</th><th class="req-td-right">Cantidad</th><th class="req-td-right">Subtotal est.</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>

      <div class="form-section">
        <span class="form-section-label">Datos del pago</span>
        <div class="form-grid">
          <div class="form-group">
            <label>Valor desembolsado *</label>
            <input id="des-valor" type="number" min="1" step="any" value="${Number(r.valor_total || 0)}" />
          </div>
          <div class="form-group">
            <label>Fecha *</label>
            <input id="des-fecha" type="date" value="${hoy}" />
          </div>
          <div class="form-group form-group--full">
            <label>Empresa aliada (proveedor)</label>
            <input id="des-empresa" type="text" list="des-empresa-list"
              placeholder="Busca por razón social o NIT (opcional)" autocomplete="off" />
            <datalist id="des-empresa-list"></datalist>
          </div>
          <div class="form-group form-group--full">
            <label>Comprobante del pago *</label>
            <input id="des-comprobante" type="file" accept="image/*,application/pdf" />
            <div id="des-comprobante-status" class="rec-baucher-status"></div>
          </div>
          <div class="form-group form-group--full">
            <label>Observaciones</label>
            <textarea id="des-obs" rows="2" placeholder="Notas del pago (opcional): transferencia, proveedor, etc."></textarea>
          </div>
        </div>
        <div class="req-total-strip">
          <span>Se registrará como gasto</span>
          <strong id="des-total">${fmtMoney(r.valor_total)}</strong>
        </div>
      </div>

      <div id="des-error" class="form-error" style="display:none"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="des-submit">${icon("banknote")} Registrar desembolso</button>
    </div>
  `);
  window.SGIUI?.hydrate();

  document.getElementById("des-valor").addEventListener("input", function () {
    document.getElementById("des-total").textContent = fmtMoney(Number(this.value) || 0);
  });

  let empresaCtl = null;
  if (window.SGIEmpresas?.wireEmpresaAutocomplete) {
    window.SGIEmpresas.wireEmpresaAutocomplete("des-empresa", "des-empresa-list", null)
      .then(ctl => { empresaCtl = ctl; });
  }

  document.getElementById("des-submit").addEventListener("click", () => guardarDesembolso(r, () => empresaCtl?.getId?.() ?? null));
}

async function guardarDesembolso(r, getEmpresaId) {
  const errorEl = document.getElementById("des-error");
  errorEl.style.display = "none";

  const valor = Number(document.getElementById("des-valor").value);
  const fecha = document.getElementById("des-fecha").value;
  const file  = document.getElementById("des-comprobante").files[0];
  const obs   = document.getElementById("des-obs").value.trim();

  function fallar(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  if (!(valor > 0)) return fallar("El valor desembolsado debe ser mayor a cero.");
  if (!fecha)       return fallar("La fecha es obligatoria.");
  if (!file)        return fallar("El comprobante del pago es obligatorio.");

  const btn = document.getElementById("des-submit");
  btn.disabled = true;
  btn.textContent = "Registrando...";

  try {
    const status = document.getElementById("des-comprobante-status");
    status.textContent = "Subiendo comprobante...";
    const fd = new FormData();
    fd.append("baucher", file);
    const up = await fetch("/api/v1/uploads/baucher", {
      method:  "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("fb_token")}` },
      body:    fd,
    });
    const upData = await up.json();
    if (!up.ok) throw new Error(upData.error || "Error al subir el comprobante");
    status.textContent = "Comprobante subido.";

    const resp = await API.patch(`/requerimientos/${r.id_requerimiento}/desembolsar`, {
      valor, fecha, comprobante_url: upData.url, observaciones: obs || null,
      id_empresa: getEmpresaId ? getEmpresaId() : null,
    });

    UI.closeModal();
    if (resp.gasto_warning) {
      UI.toast(`${r.numero} desembolsado, pero: ${resp.gasto_warning}`, "info");
    } else {
      UI.toast(`${r.numero} desembolsado. Gasto #${resp.id_gasto} creado y almacenista notificado.`, "ok");
    }
    window.desembolsosView();
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = `${icon("banknote")} Registrar desembolso`;
    window.SGIUI?.hydrate();
    fallar(e.message || "No se pudo registrar el desembolso.");
  }
}

})();
