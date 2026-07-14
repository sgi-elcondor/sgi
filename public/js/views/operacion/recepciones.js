(function () {

const ESTADO_LABEL = {
  desembolsado:     { label: "Desembolsado",     cls: "badge-warning" },
  recibido_parcial: { label: "Recibido parcial", cls: "badge-info"    },
  en_inventario:    { label: "En inventario",    cls: "badge-success" },
  entregado:        { label: "Entregado",        cls: "badge-success" },
  cancelado:        { label: "Cancelado",        cls: "badge-danger"  },
  pendiente:        { label: "Pendiente",        cls: "badge-muted"   },
};

const icon     = (name) => window.SGIUI?.icon(name) ?? "";
const fmtMoney = n => Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtDate  = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-CO") : "—";
const fmtQty   = n => Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });

let _pendientes = [];
let _historial  = [];
let _tab        = "pendientes";
const _fPend    = { q: "", est: "" };
const _fHist    = { q: "", est: "" };

// Days since disbursement with no delivery yet: the supplier was already paid.
function atrasoHTML(r) {
  if (r.estado !== "desembolsado" || !r.fecha_desembolso) return "";
  const dias = Math.floor((Date.now() - new Date(r.fecha_desembolso + "T12:00:00")) / 86400000);
  if (dias <= 0) return "";
  const cls = dias > 7 ? "req-wait-danger" : dias > 3 ? "req-wait-warn" : "";
  return `<div class="req-wait ${cls}">${dias} día${dias === 1 ? "" : "s"} sin entrega</div>`;
}

window.recepcionesView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const canCreate = AppState.can("recepciones", "crear");

  try {
    [_pendientes, _historial] = await Promise.all([
      API.get("/recepciones/pendientes"),
      API.get("/recepciones/historial").catch(() => []),
    ]);
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }

  _pendientes = _pendientes || [];
  _historial  = _historial || [];

  // Deep link from a pickup QR (/app#entrega=REQ-...): jump straight to the
  // Entregas tab with the authorization pre-loaded.
  if (window._entregaParam) {
    const numero = window._entregaParam;
    window._entregaParam = null;
    _tab = "entregas";
    render(vc, canCreate);
    buscarAutorizacion(numero);
    return;
  }

  render(vc, canCreate);
};

function render(vc, canCreate) {
  vc.innerHTML = `
    <section class="page-shell">
      ${window.SGIUI?.pageHeader({
        kicker:   "Inventario",
        title:    "Recepción de Materiales",
        subtitle: "Registra las entregas que llegan a bodega y consulta lo ya recepcionado.",
        meta:     _pendientes.length ? `<span class="results-chip">${icon("package")} ${_pendientes.length} por recibir</span>` : "",
      }) ?? ""}

      <div class="req-tabs">
        <button class="req-tab ${_tab === "pendientes" ? "active" : ""}" data-tab="pendientes">
          ${icon("inbox")} Pendientes <span class="req-tab-count">${_pendientes.length}</span>
        </button>
        <button class="req-tab ${_tab === "entregas" ? "active" : ""}" data-tab="entregas">
          ${icon("handshake")} Entregas <span class="req-tab-count">${_historial.filter(r => r.estado === "en_inventario").length}</span>
        </button>
        <button class="req-tab ${_tab === "registros" ? "active" : ""}" data-tab="registros">
          ${icon("history")} Registros <span class="req-tab-count">${_historial.length}</span>
        </button>
      </div>

      <div id="rec-tab-content"></div>
    </section>`;

  vc.querySelectorAll(".req-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      _tab = btn.dataset.tab;
      render(vc, canCreate);
    });
  });

  if (_tab === "pendientes") renderPendientes(canCreate);
  else if (_tab === "entregas") renderEntregas(canCreate);
  else renderRegistros();

  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Entregas (INV-02) — autorización pre-cargada para entregar al peticionario
// ─────────────────────────────────────────────────────────────────────────────
function renderEntregas(canCreate) {
  const cont = document.getElementById("rec-tab-content");
  const listos = _historial.filter(r => r.estado === "en_inventario");
  const valorListo = listos.reduce((s, r) => s + Number(r.valor_total || 0), 0);

  cont.innerHTML = `
    <div class="req-kpi-row">
      <div class="req-kpi success">
        <span class="req-kpi-icon">${icon("handshake")}</span>
        <div><span class="req-kpi-val">${listos.length}</span><span class="req-kpi-label">Listos para entregar</span></div>
      </div>
      <div class="req-kpi accent">
        <span class="req-kpi-icon">${icon("coins")}</span>
        <div><span class="req-kpi-val">${fmtMoney(valorListo)}</span><span class="req-kpi-label">Valor en bodega</span></div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-filters">
        <input id="ent-numero" type="text" class="filter-input"
          placeholder="Escanea el QR del peticionario o escribe el número (REQ-...)" style="flex:2;min-width:18rem">
        <button class="btn btn-primary" id="ent-buscar">${icon("search")} Cargar autorización</button>
      </div>

      <table class="req-table">
        <thead>
          <tr>
            <th>N° Requerimiento</th>
            <th>Solicitante</th>
            <th>Proyecto</th>
            <th>Recepción completa</th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="ent-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("ent-tbody");

  if (listos.length) {
    tbody.innerHTML = listos.map(r => `
      <tr class="req-row">
        <td class="req-td-main">
          <div class="rec-num">${r.numero}</div>
          <div class="rec-desc">${r.descripcion || "—"}</div>
        </td>
        <td data-label="Solicitante">${r.solicitante || "—"}</td>
        <td data-label="Proyecto">${r.proyecto}${r.sigla ? ` <span class="rec-sigla">(${r.sigla})</span>` : ""}</td>
        <td data-label="Recepción completa">${fmtDate(r.ultima_entrega)}</td>
        <td data-label="Valor" class="req-money">${fmtMoney(r.valor_total)}</td>
        <td class="req-td-actions">
          <div class="req-actions">
            ${canCreate ? `<button class="btn btn-primary btn-sm btn-ent-abrir" data-numero="${r.numero}">Entregar</button>` : ""}
          </div>
        </td>
      </tr>`).join("");
  } else {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="req-empty">
          <div class="req-empty-icon req-empty-ok">${icon("check-circle")}</div>
          <p class="req-empty-title">Nada por entregar</p>
          <p class="req-empty-sub">Cuando un requerimiento complete su recepción, aparecerá aquí listo para que el peticionario lo reclame.</p>
        </div>
      </td></tr>`;
  }

  const buscar = () => {
    const numero = document.getElementById("ent-numero").value.trim();
    if (!numero) return UI.toast("Escribe o escanea el número del requerimiento.", "info");
    buscarAutorizacion(numero);
  };
  document.getElementById("ent-buscar").addEventListener("click", buscar);
  document.getElementById("ent-numero").addEventListener("keydown", e => { if (e.key === "Enter") buscar(); });

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-ent-abrir");
    if (btn) buscarAutorizacion(btn.dataset.numero);
  });

  window.SGIUI?.hydrate();
}

async function buscarAutorizacion(numero) {
  let a;
  try {
    a = await API.get(`/requerimientos/autorizacion?numero=${encodeURIComponent(numero)}`);
  } catch (e) {
    UI.toast(e.message || "No se encontró la autorización.", "error");
    return;
  }
  abrirAutorizacion(a);
}

function abrirAutorizacion(a) {
  const filas = (a.items || []).map(it => `
    <tr>
      <td>${it.descripcion}</td>
      <td class="req-td-right">${fmtQty(it.cantidad_recibida)} ${it.unidad || ""}</td>
    </tr>`).join("");

  UI.openModal(`Autorización de entrega · ${a.numero}`, `
    <div class="rec-modal">
      <div class="ent-autorizado">
        ${icon("badge-check")}
        <div>
          <strong>Autorizado para entrega</strong>
          <p>Recepción completa e inventario disponible. Verifica la identidad de quien reclama y confirma.</p>
        </div>
      </div>

      <div class="rec-modal-summary" style="margin-top:0.75rem">
        <div class="rec-summary-item"><span class="lbl">Solicitante</span><span class="val">${a.solicitante}</span></div>
        ${a.solicitante_documento ? `<div class="rec-summary-item"><span class="lbl">Documento</span><span class="val">${a.solicitante_documento}</span></div>` : ""}
        ${a.solicitante_telefono ? `<div class="rec-summary-item"><span class="lbl">Teléfono</span><span class="val">${a.solicitante_telefono}</span></div>` : ""}
        <div class="rec-summary-item"><span class="lbl">Proyecto</span><span class="val">${a.proyecto || "—"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Descripción</span><span class="val">${a.descripcion || "—"}</span></div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Material a entregar (cantidades recibidas)</span>
        <table class="rec-items-table">
          <thead><tr><th>Ítem</th><th class="req-td-right">Cantidad</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>

      <div class="form-group form-group--full">
        <label>¿Quién recibe? (opcional — si no es el solicitante)</label>
        <input id="ent-receptor" type="text" placeholder="Nombre y/o cédula de quien retira" />
      </div>

      <div id="ent-error" class="form-error" style="display:none"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="ent-confirmar">${icon("handshake")} Confirmar entrega</button>
    </div>
  `);
  window.SGIUI?.hydrate();

  document.getElementById("ent-confirmar").addEventListener("click", async function () {
    const errorEl = document.getElementById("ent-error");
    errorEl.style.display = "none";
    this.disabled = true;
    this.textContent = "Entregando...";

    try {
      const receptor = document.getElementById("ent-receptor").value.trim();
      await API.patch(`/requerimientos/${a.id_requerimiento}/entregar`, { receptor: receptor || null });
      UI.closeModal();
      UI.toast(`${a.numero} entregado. Stock descontado y peticionario notificado.`, "ok");
      recepcionesView();
    } catch (e) {
      this.disabled = false;
      this.innerHTML = `${icon("handshake")} Confirmar entrega`;
      window.SGIUI?.hydrate();
      errorEl.textContent = e.message || "No se pudo registrar la entrega.";
      errorEl.style.display = "block";
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Pendientes de recepción
// ─────────────────────────────────────────────────────────────────────────────
function renderPendientes(canCreate) {
  const cont = document.getElementById("rec-tab-content");

  const sinRecibir = _pendientes.filter(r => r.estado === "desembolsado").length;
  const parciales  = _pendientes.filter(r => r.estado === "recibido_parcial").length;
  const itemsPend  = _pendientes.reduce((s, r) => s + (r.items || []).filter(it => it.cantidad_pendiente > 0).length, 0);

  cont.innerHTML = `
    <div class="req-kpi-row">
      <div class="req-kpi warning">
        <span class="req-kpi-icon">${icon("truck")}</span>
        <div><span class="req-kpi-val">${sinRecibir}</span><span class="req-kpi-label">Sin recibir</span></div>
      </div>
      <div class="req-kpi">
        <span class="req-kpi-icon">${icon("package-open")}</span>
        <div><span class="req-kpi-val">${parciales}</span><span class="req-kpi-label">Recibidos parcial</span></div>
      </div>
      <div class="req-kpi accent">
        <span class="req-kpi-icon">${icon("boxes")}</span>
        <div><span class="req-kpi-val">${itemsPend}</span><span class="req-kpi-label">Ítems por recibir</span></div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-filters">
        <input id="rec-buscar" type="text" class="filter-input"
          placeholder="Buscar por número, proyecto o descripción..." style="flex:2;min-width:18rem">
        <select id="rec-estado" class="select-sm" style="flex:1;min-width:10rem">
          <option value="">Todos los estados</option>
          <option value="desembolsado">Desembolsado</option>
          <option value="recibido_parcial">Recibido parcial</option>
        </select>
      </div>

      <table class="req-table">
        <thead>
          <tr>
            <th>N° Requerimiento</th>
            <th>Proyecto</th>
            <th>Desembolso</th>
            <th>Valor</th>
            <th>Progreso</th>
            <th>Estado</th>
            ${canCreate ? "<th></th>" : ""}
          </tr>
        </thead>
        <tbody id="rec-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("rec-tbody");
  const colCount = canCreate ? 7 : 6;

  function fila(r) {
    const est = ESTADO_LABEL[r.estado] || { label: r.estado, cls: "badge-muted" };
    return `
      <tr class="req-row">
        <td class="req-td-main">
          <div class="rec-num">${r.numero}</div>
          <div class="rec-desc">${r.descripcion || "—"}</div>
        </td>
        <td data-label="Proyecto">${r.proyecto}${r.sigla ? ` <span class="rec-sigla">(${r.sigla})</span>` : ""}</td>
        <td data-label="Desembolso"><div>${fmtDate(r.fecha_desembolso)}${atrasoHTML(r)}</div></td>
        <td data-label="Valor" class="req-money">${fmtMoney(r.valor_total)}</td>
        <td data-label="Progreso">
          <div class="rec-progress-wrap" title="${r.progreso_pct}% recibido">
            <div class="rec-progress-bar"><div class="rec-progress-fill" style="width:${Math.min(100, r.progreso_pct)}%"></div></div>
            <span class="rec-progress-text">${r.progreso_pct}%</span>
          </div>
        </td>
        <td data-label="Estado"><span class="badge ${est.cls}">${est.label}</span></td>
        ${canCreate ? `<td class="req-td-actions"><div class="req-actions"><button class="btn btn-primary btn-sm btn-rec-registrar" data-id="${r.id_requerimiento}">Registrar recepción</button></div></td>` : ""}
      </tr>`;
  }

  function aplicarFiltros() {
    const q   = (document.getElementById("rec-buscar").value || "").trim();
    const est = document.getElementById("rec-estado").value;
    Object.assign(_fPend, { q, est });

    const visibles = _pendientes.filter(r => {
      if (est && r.estado !== est) return false;
      if (q) {
        if (window.SGISearch?.matches) {
          if (!SGISearch.matches(q, r.numero, r.proyecto, r.sigla, r.descripcion)) return false;
        } else if (!`${r.numero} ${r.proyecto} ${r.sigla} ${r.descripcion || ""}`.toLowerCase().includes(q.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    if (visibles.length) {
      tbody.innerHTML = visibles.map(fila).join("");
    } else {
      tbody.innerHTML = `
        <tr><td colspan="${colCount}">
          <div class="req-empty">
            <div class="req-empty-icon req-empty-ok">${icon("check-circle")}</div>
            <p class="req-empty-title">${_pendientes.length ? "Nada coincide con los filtros" : "¡Todo recibido!"}</p>
            <p class="req-empty-sub">${_pendientes.length ? "Ajusta la búsqueda o los filtros." : "No hay requerimientos pendientes de recepción."}</p>
          </div>
        </td></tr>`;
    }
    window.SGIUI?.hydrate();
  }

  document.getElementById("rec-buscar").value = _fPend.q;
  document.getElementById("rec-estado").value = _fPend.est;
  document.getElementById("rec-buscar").addEventListener("input",  aplicarFiltros);
  document.getElementById("rec-estado").addEventListener("change", aplicarFiltros);

  if (canCreate) {
    tbody.addEventListener("click", e => {
      const btn = e.target.closest(".btn-rec-registrar");
      if (!btn) return;
      const r = _pendientes.find(x => String(x.id_requerimiento) === btn.dataset.id);
      if (r) abrirModalRecepcion(r);
    });
  }

  aplicarFiltros();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Registros (lo recepcionado, completo o parcial)
// ─────────────────────────────────────────────────────────────────────────────
function renderRegistros() {
  const cont = document.getElementById("rec-tab-content");

  const completos  = _historial.filter(r => r.estado === "en_inventario").length;
  const parciales  = _historial.filter(r => r.estado === "recibido_parcial").length;
  const entregas   = _historial.reduce((s, r) => s + (r.entregas || 0), 0);
  const itemsFalta = _historial.reduce((s, r) => s + (r.items || []).filter(it => it.cantidad_pendiente > 0).length, 0);

  cont.innerHTML = `
    <div class="req-kpi-row">
      <div class="req-kpi success">
        <span class="req-kpi-icon">${icon("package-check")}</span>
        <div><span class="req-kpi-val">${completos}</span><span class="req-kpi-label">En inventario</span></div>
      </div>
      <div class="req-kpi warning">
        <span class="req-kpi-icon">${icon("package-open")}</span>
        <div><span class="req-kpi-val">${parciales}</span><span class="req-kpi-label">Parciales (falta material)</span></div>
      </div>
      <div class="req-kpi">
        <span class="req-kpi-icon">${icon("truck")}</span>
        <div><span class="req-kpi-val">${entregas}</span><span class="req-kpi-label">Entregas registradas</span></div>
      </div>
      ${itemsFalta ? `
      <div class="req-kpi danger">
        <span class="req-kpi-icon">${icon("boxes")}</span>
        <div><span class="req-kpi-val">${itemsFalta}</span><span class="req-kpi-label">Ítems aún pendientes</span></div>
      </div>` : ""}
    </div>

    <div class="table-wrap">
      <div class="table-filters">
        <input id="hist-buscar" type="text" class="filter-input"
          placeholder="Buscar por número, proyecto o descripción..." style="flex:2;min-width:18rem">
        <select id="hist-estado" class="select-sm" style="flex:1;min-width:10rem">
          <option value="">Todo resultado</option>
          <option value="en_inventario">En inventario (completo)</option>
          <option value="recibido_parcial">Recibido parcial</option>
          <option value="entregado">Entregado</option>
        </select>
        <button class="btn btn-ghost" id="hist-excel" title="Exportar registros a Excel">${icon("file-spreadsheet")} Excel</button>
      </div>

      <table class="req-table">
        <thead>
          <tr>
            <th>N° Requerimiento</th>
            <th>Proyecto</th>
            <th>Entregas</th>
            <th>Última entrega</th>
            <th>Progreso</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="hist-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("hist-tbody");

  function fila(r) {
    const est = ESTADO_LABEL[r.estado] || { label: r.estado, cls: "badge-muted" };
    return `
      <tr class="req-row">
        <td class="req-td-main">
          <div class="rec-num">${r.numero}</div>
          <div class="rec-desc">${r.descripcion || "—"}</div>
        </td>
        <td data-label="Proyecto">${r.proyecto}${r.sigla ? ` <span class="rec-sigla">(${r.sigla})</span>` : ""}</td>
        <td data-label="Entregas">${r.entregas || 0} entrega${(r.entregas || 0) === 1 ? "" : "s"}</td>
        <td data-label="Última entrega">${fmtDate(r.ultima_entrega)}</td>
        <td data-label="Progreso">
          <div class="rec-progress-wrap" title="${r.progreso_pct}% recibido">
            <div class="rec-progress-bar"><div class="rec-progress-fill" style="width:${Math.min(100, r.progreso_pct)}%"></div></div>
            <span class="rec-progress-text">${r.progreso_pct}%</span>
          </div>
        </td>
        <td data-label="Estado"><span class="badge ${est.cls}">${est.label}</span></td>
        <td class="req-td-actions">
          <div class="req-actions">
            <button class="btn btn-ghost btn-sm btn-hist-entregas" data-id="${r.id_requerimiento}">Ver entregas</button>
            <button class="btn btn-ghost btn-sm btn-hist-trace" data-id="${r.id_requerimiento}" title="Trazabilidad">${icon("route")}</button>
            <button class="btn btn-ghost btn-sm btn-hist-acta" data-id="${r.id_requerimiento}" title="Acta de recepción (PDF)">${icon("file-text")}</button>
          </div>
        </td>
      </tr>`;
  }

  function aplicarFiltros() {
    const q   = (document.getElementById("hist-buscar").value || "").trim();
    const est = document.getElementById("hist-estado").value;
    Object.assign(_fHist, { q, est });

    const visibles = _historial.filter(r => {
      if (est && r.estado !== est) return false;
      if (q) {
        if (window.SGISearch?.matches) {
          if (!SGISearch.matches(q, r.numero, r.proyecto, r.sigla, r.descripcion)) return false;
        } else if (!`${r.numero} ${r.proyecto} ${r.sigla} ${r.descripcion || ""}`.toLowerCase().includes(q.toLowerCase())) {
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
            <p class="req-empty-title">${_historial.length ? "Nada coincide con los filtros" : "Aún no hay recepciones registradas"}</p>
            <p class="req-empty-sub">${_historial.length ? "Ajusta la búsqueda o los filtros." : "Cuando registres entregas, el historial aparecerá aquí."}</p>
          </div>
        </td></tr>`;
    }
    window.SGIUI?.hydrate();
  }

  document.getElementById("hist-buscar").value = _fHist.q;
  document.getElementById("hist-estado").value = _fHist.est;
  document.getElementById("hist-buscar").addEventListener("input",  aplicarFiltros);
  document.getElementById("hist-estado").addEventListener("change", aplicarFiltros);

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-hist-entregas, .btn-hist-acta, .btn-hist-trace");
    if (!btn) return;
    const r = _historial.find(x => String(x.id_requerimiento) === btn.dataset.id);
    if (!r) return;
    if (btn.classList.contains("btn-hist-acta")) abrirActaPDF(r);
    else if (btn.classList.contains("btn-hist-trace")) window.SGIReq?.abrirTrazabilidad?.(r.id_requerimiento);
    else abrirEntregas(r);
  });

  document.getElementById("hist-excel").addEventListener("click", async function () {
    this.disabled = true;
    try { await exportRegistrosExcel(); }
    catch (e) { UI.toast(e.message || "No se pudo exportar.", "error"); }
    finally { this.disabled = false; }
  });

  aplicarFiltros();
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel de Registros: resumen + balance por ítem
// ─────────────────────────────────────────────────────────────────────────────
async function exportRegistrosExcel() {
  if (!_historial.length) return UI.toast("No hay registros para exportar.", "info");
  if (window.SGILibs) await window.SGILibs.ensureExport();

  const SX = window.SGIExport.xlsx;
  const wb = SX.setup();

  const completos = _historial.filter(r => r.estado === "en_inventario").length;
  const parciales = _historial.filter(r => r.estado === "recibido_parcial").length;
  const entregas  = _historial.reduce((s, r) => s + (r.entregas || 0), 0);
  const valor     = _historial.reduce((s, r) => s + Number(r.valor_total || 0), 0);

  // ── Hoja 1: Registros ─────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Registros", { tabColor: { argb: SX.C.primary } });
  ws1.columns = [
    { key: "a", width: 20 }, { key: "b", width: 34 }, { key: "c", width: 22 },
    { key: "d", width: 18 }, { key: "e", width: 15 }, { key: "f", width: 12 },
    { key: "g", width: 18 }, { key: "h", width: 16 },
  ];

  SX.masthead(ws1, {
    title:     "Registros de Recepción",
    subtitle:  "Historial de requerimientos recepcionados (completos y parciales)",
    mergeCols: 8,
  });

  SX.kpiRow(ws1, [
    { label: "En inventario",  value: completos },
    { label: "Parciales",      value: parciales },
    { label: "Entregas",       value: entregas },
    { label: "Valor total",    value: valor, money: true },
  ]);

  SX.sectionHeader(ws1, "Requerimientos recepcionados", { mergeCols: 8 });
  const head1 = ws1.addRow(["N° Requerimiento", "Descripción", "Proyecto", "Entregas", "Última entrega", "Progreso", "Estado", "Valor"]);
  SX.styleHeader(head1);

  _historial.forEach((r, i) => {
    const row = ws1.addRow([
      r.numero,
      r.descripcion || "—",
      r.proyecto + (r.sigla ? ` (${r.sigla})` : ""),
      r.entregas || 0,
      r.ultima_entrega ? new Date(r.ultima_entrega + "T12:00:00") : "—",
      (r.progreso_pct || 0) / 100,
      r.estado === "en_inventario" ? "En inventario" : "Recibido parcial",
      Number(r.valor_total || 0),
    ]);
    SX.styleBody(row, i % 2 !== 0);
    row.getCell(5).numFmt = "dd/mm/yyyy";
    row.getCell(6).numFmt = "0%";
    row.getCell(8).numFmt = '"$" #,##0';
    row.getCell(7).font = {
      name: "Calibri", size: 11, bold: true,
      color: { argb: r.estado === "en_inventario" ? "FF15803D" : "FFC53C00" },
    };
  });

  // ── Hoja 2: Balance por ítem ──────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Balance por ítem", { tabColor: { argb: SX.C.primary } });
  ws2.columns = [
    { key: "a", width: 20 }, { key: "b", width: 36 }, { key: "c", width: 10 },
    { key: "d", width: 13 }, { key: "e", width: 13 }, { key: "f", width: 13 },
    { key: "g", width: 14 },
  ];

  SX.masthead(ws2, {
    title:     "Balance de materiales por ítem",
    subtitle:  "Cantidades solicitadas, recibidas y pendientes de cada material",
    mergeCols: 7,
  });

  const head2 = ws2.addRow(["N° Requerimiento", "Ítem", "Unidad", "Solicitado", "Recibido", "Pendiente", "Estado ítem"]);
  SX.styleHeader(head2);

  let zebra = 0;
  _historial.forEach(r => {
    (r.items || []).forEach(it => {
      const ok = it.cantidad_pendiente <= 0;
      const row = ws2.addRow([
        r.numero,
        it.descripcion,
        it.unidad || "—",
        it.cantidad_solicitada,
        it.cantidad_recibida,
        it.cantidad_pendiente,
        ok ? "Completo" : "Pendiente",
      ]);
      SX.styleBody(row, zebra++ % 2 !== 0);
      row.getCell(7).font = {
        name: "Calibri", size: 11, bold: true,
        color: { argb: ok ? "FF15803D" : "FFDC2626" },
      };
    });
  });

  await SX.download(wb, `recepciones_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  UI.toast("Excel de registros descargado.", "ok");
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle de entregas de un requerimiento (balance por ítem + cada entrega)
// ─────────────────────────────────────────────────────────────────────────────
async function abrirEntregas(r) {
  let det;
  try {
    det = await API.get(`/recepciones/${r.id_requerimiento}`);
  } catch (e) {
    UI.toast(e.message || "No se pudo cargar el detalle.", "error");
    return;
  }

  const est = ESTADO_LABEL[det.estado] || { label: det.estado, cls: "badge-muted" };

  const filasItems = (det.items || []).map(it => {
    const completo = it.cantidad_pendiente <= 0;
    return `
      <tr>
        <td>${it.descripcion}</td>
        <td class="req-td-right">${fmtQty(it.cantidad_solicitada)} ${it.unidad || ""}</td>
        <td class="req-td-right" style="color:var(--success)">${fmtQty(it.cantidad_recibida)}</td>
        <td class="req-td-right ${completo ? "" : "req-wait-danger"}" style="font-weight:700">${completo ? "✓" : fmtQty(it.cantidad_pendiente)}</td>
      </tr>`;
  }).join("");

  const entregasHTML = (det.recepciones || []).length
    ? det.recepciones.map((rc, i) => `
      <div class="rec-entrega">
        <div class="rec-entrega-head">
          <span class="rec-entrega-num">${icon("truck")} Entrega ${i + 1}</span>
          <span class="rec-entrega-meta">${fmtDate(rc.fecha)} · ${rc.almacenista}</span>
          ${rc.comprobante_url ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${rc.comprobante_url}','_blank')" title="Ver comprobante">${icon("paperclip")}</button>` : ""}
        </div>
        <div class="rec-entrega-items">
          ${(rc.detalle || []).map(d => `<span class="req-chip-items">${d.descripcion}: ${fmtQty(d.cantidad)} ${d.unidad || ""}</span>`).join(" ")}
        </div>
        ${rc.observaciones ? `<div class="rec-entrega-obs">${rc.observaciones}</div>` : ""}
      </div>`).join("")
    : `<p class="rec-hint">Sin entregas registradas.</p>`;

  UI.openModal(`Entregas · ${det.numero}`, `
    <div class="rec-modal">
      <div class="rec-modal-summary">
        <div class="rec-summary-item"><span class="lbl">Proyecto</span><span class="val">${det.proyecto || "—"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Desembolso</span><span class="val">${fmtDate(det.fecha_desembolso)}</span></div>
        <div class="rec-summary-item"><span class="lbl">Progreso</span><span class="val">${det.progreso_pct}%</span></div>
        <div class="rec-summary-item"><span class="lbl">Estado</span><span class="val"><span class="badge ${est.cls}">${est.label}</span></span></div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Balance por ítem</span>
        <table class="rec-items-table">
          <thead>
            <tr><th>Ítem</th><th class="req-td-right">Solicitado</th><th class="req-td-right">Recibido</th><th class="req-td-right">Pendiente</th></tr>
          </thead>
          <tbody>${filasItems}</tbody>
        </table>
      </div>

      <div class="form-section">
        <span class="form-section-label">Entregas registradas (${(det.recepciones || []).length})</span>
        ${entregasHTML}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="rec-det-trace">${icon("route")} Trazabilidad</button>
      <button class="btn btn-ghost" id="rec-det-acta">${icon("file-text")} Acta PDF</button>
      <button class="btn btn-primary" onclick="UI.closeModal()">Cerrar</button>
    </div>
  `);
  document.getElementById("rec-det-acta")?.addEventListener("click", () => {
    const win = window.open("", "_blank", "width=780,height=720,scrollbars=yes");
    if (!win) return UI.toast("El navegador bloqueó la ventana emergente.", "error");
    win.document.write(_buildActaRecepcionHTML(det));
    win.document.close();
  });
  document.getElementById("rec-det-trace")?.addEventListener("click", () => window.SGIReq?.abrirTrazabilidad?.(det.id_requerimiento));
  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// Acta de Recepción en PDF (formato unificado de comprobantes)
// ─────────────────────────────────────────────────────────────────────────────
function _buildActaRecepcionHTML(det) {
  const SX = window.SGIExport;
  const fmtD = SX.fmtDate || (x => x || "");

  const completa = det.estado === "en_inventario";
  const estadoInfo = completa
    ? { label: "En inventario",    badge: "success" }
    : { label: "Recibido parcial", badge: "warning" };

  const items      = det.items || [];
  const totalSol   = items.reduce((s, it) => s + Number(it.cantidad_solicitada), 0);
  const totalRec   = items.reduce((s, it) => s + Number(it.cantidad_recibida), 0);
  const completos  = items.filter(it => it.cantidad_pendiente <= 0).length;
  const pct        = det.progreso_pct ?? (totalSol ? Math.round((totalRec / totalSol) * 100) : 0);

  const recepciones = det.recepciones || [];
  const ultima      = recepciones.length ? recepciones[recepciones.length - 1].fecha : null;
  const almacenistas = [...new Set(recepciones.map(rc => rc.almacenista).filter(x => x && x !== "—"))].join(", ");

  const balanceHTML = `
    <div class="cmp-extra">
      <div class="cmp-extra-title">Balance de materiales</div>
      <table class="cmp-mini">
        <thead>
          <tr><th>Ítem</th><th class="r">Solicitado</th><th class="r">Recibido</th><th class="r">Pendiente</th></tr>
        </thead>
        <tbody>
          ${items.map(it => {
            const ok = it.cantidad_pendiente <= 0;
            return `
            <tr>
              <td>${it.descripcion}</td>
              <td class="r">${fmtQty(it.cantidad_solicitada)} ${it.unidad || ""}</td>
              <td class="r" style="color:#15803d;font-weight:600">${fmtQty(it.cantidad_recibida)}</td>
              <td class="r" style="${ok ? "color:#15803d;font-weight:700" : "color:#dc2626;font-weight:700"}">${ok ? "Completo ✓" : fmtQty(it.cantidad_pendiente) + " " + (it.unidad || "")}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  const entregasHTML = recepciones.length ? `
    <div class="cmp-extra">
      <div class="cmp-extra-title">Historial de entregas</div>
      <table class="cmp-mini">
        <thead>
          <tr><th>#</th><th>Fecha</th><th>Recibió</th><th>Materiales</th></tr>
        </thead>
        <tbody>
          ${recepciones.map((rc, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${fmtD(rc.fecha)}</td>
              <td>${rc.almacenista || "—"}</td>
              <td>${(rc.detalle || []).map(d => `${d.descripcion} × ${fmtQty(d.cantidad)}`).join(", ") || "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  const waNumber = (SX.CONTACT && SX.CONTACT.whatsapp) || "573001234567";
  const waMsg    = `Hola, quiero informacion sobre la recepcion del requerimiento ${det.numero} (${estadoInfo.label}, avance ${pct}%).`;
  const qrUrl    = SX.qrDataUri(`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`);

  return SX.comprobanteHTML({
    docTitle: `Recepcion ${det.numero} — El Cóndor S.A.S.`,
    badge:    "Acta de Recepción de Materiales",
    fields: [
      { icon: "check",    label: "Estado",              value: estadoInfo.label, badge: estadoInfo.badge },
      { icon: "hash",     label: "N° requerimiento",    value: det.numero },
      { icon: "pin",      label: "Proyecto / obra",     value: det.proyecto && det.proyecto !== "—" ? `${det.proyecto}${det.sigla ? " (" + det.sigla + ")" : ""}` : "" },
      { icon: "calendar", label: "Fecha de desembolso", value: fmtD(det.fecha_desembolso) },
      { icon: "clock",    label: "Última entrega",      value: fmtD(ultima) },
      { icon: "user",     label: "Recibido por",        value: almacenistas },
      { icon: "file",     label: "Entregas registradas", value: recepciones.length ? String(recepciones.length) : "" },
    ],
    extraHTML: balanceHTML,
    totalLabel: "Avance de la recepción",
    totalValue: `${pct}%`,
    totalWords: `${completos} de ${items.length} ítems completos · ${fmtQty(totalRec)} de ${fmtQty(totalSol)} unidades recibidas`,
    afterTotalHTML: entregasHTML,
    stamp: completa
      ? { label: "Entrega Completa", variant: "success" }
      : { label: "Entrega Parcial",  variant: "info" },
    qrUrl,
    qrCaption: "<strong>¿Dudas con esta recepción?</strong><br>Escanea el código QR para escribirnos por WhatsApp.",
  });
}

async function abrirActaPDF(r) {
  if (!(window.SGIExport && window.SGIExport.comprobanteHTML)) {
    return UI.toast("No se pudo generar el acta", "error");
  }
  let det;
  try {
    det = await API.get(`/recepciones/${r.id_requerimiento}`);
  } catch (e) {
    return UI.toast(e.message || "No se pudo cargar el detalle.", "error");
  }
  const win = window.open("", "_blank", "width=780,height=720,scrollbars=yes");
  if (!win) return UI.toast("El navegador bloqueó la ventana emergente. Permita ventanas emergentes para este sitio.", "error");
  win.document.write(_buildActaRecepcionHTML(det));
  win.document.close();
}

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
