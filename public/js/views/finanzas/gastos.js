(function () {

function _gastosParseInput(val) {
  return MoneyInput.parse(val);
}

const CATEGORIA_LABELS = {
  vehiculos: "Vehiculos",
  nomina:    "Nomina",
  servicios: "Servicios",
  otros:     "Otros",
};

let _gastosList      = [];
let _gastosProyectos = [];
let _gastosFilters   = { id_proyecto: "", categoria: "", fecha_desde: "", fecha_hasta: "" };
let _gastosEditId         = null;
let _gastosComprobanteUrl = null;
let _gastosBaucherFile    = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _fmtValor(v) {
  const n = Number(v);
  if (isNaN(n)) return "—";
  const formatted = Math.abs(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  return n < 0 ? `<span style="color:var(--success)">${formatted}</span>` : formatted;
}

function _gastosFiltered() {
  const { id_proyecto, categoria, fecha_desde, fecha_hasta } = _gastosFilters;
  return _gastosList.filter(g => {
    if (id_proyecto && String(g.id_proyecto) !== String(id_proyecto)) return false;
    if (categoria   && g.categoria !== categoria)                       return false;
    if (fecha_desde && g.fecha < fecha_desde)                          return false;
    if (fecha_hasta && g.fecha > fecha_hasta)                          return false;
    return true;
  });
}

function _gastosIsImageUrl(url) {
  if (!url) return false;
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url) || url.includes("/image/upload/");
}

window._gastosOpenPreviewModal = function(idOrUrl) {
  const url = typeof idOrUrl === "number"
    ? _gastosList.find(g => g.id_gasto === idOrUrl)?.comprobante_url
    : idOrUrl;
  if (!url) return;

  const existing = document.getElementById("gasto-preview-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "gasto-preview-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem;cursor:pointer;";

  if (_gastosIsImageUrl(url)) {
    overlay.innerHTML = `<img src="${url}" style="max-width:100%;max-height:90vh;border-radius:0.5rem;object-fit:contain;cursor:default;box-shadow:0 8px 40px rgba(0,0,0,0.5);" alt="Comprobante">`;
  } else {
    overlay.innerHTML = `<div style="background:var(--surface);border-radius:0.75rem;padding:2rem;text-align:center;cursor:default;min-width:18rem">
      <p style="margin-bottom:1rem;color:var(--text-muted)">Vista previa no disponible para este formato.</p>
      <a href="${url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Abrir archivo</a>
    </div>`;
  }

  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};

function _gastosUploadAreaHTML(existingUrl) {
  const iU    = window.SGIUI?.icon("upload-cloud") ?? "";
  const iX    = window.SGIUI?.icon("x")            ?? "✕";
  const iF    = window.SGIUI?.icon("file")         ?? "";
  const isImg = _gastosIsImageUrl(existingUrl);
  const hasUrl = !!existingUrl;

  let previewHtml = "";
  if (hasUrl) {
    if (isImg) {
      previewHtml = `
        <div class="baucher-img-preview-wrap">
          <img src="${existingUrl}" class="baucher-img-preview" alt="Comprobante" style="cursor:zoom-in">
          <button type="button" class="baucher-img-remove" id="gasto-baucher-remove">${iX}</button>
        </div>
        <div class="baucher-preview-footer">
          <span class="baucher-preview-name">${iF} Comprobante actual</span>
          <button type="button" class="btn btn-ghost btn-sm" id="gasto-baucher-change">${iU} Cambiar</button>
        </div>`;
    } else {
      previewHtml = `
        <div class="baucher-preview baucher-preview--file">
          <span class="baucher-preview-name">${iF} Comprobante actual</span>
          <div style="display:flex;gap:.5rem;flex-shrink:0">
            <a href="${existingUrl}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Ver</a>
            <button type="button" class="btn btn-ghost btn-sm" id="gasto-baucher-change">${iU} Cambiar</button>
            <span class="baucher-preview-remove" id="gasto-baucher-remove">${iX}</span>
          </div>
        </div>`;
    }
  }

  return `
    <div class="baucher-upload-area${hasUrl ? " has-preview" : ""}" id="gasto-baucher-area">
      <input type="file" id="gasto-baucher-input" accept="image/*,application/pdf">
      <div id="gasto-baucher-empty"${hasUrl ? ' style="display:none"' : ""}>
        <div class="baucher-upload-icon">${iU}</div>
        <div class="baucher-upload-label">Arrastra el comprobante aqui o haz clic para subir</div>
        <button type="button" class="btn btn-ghost btn-sm" id="gasto-baucher-click">${iU} Subir archivo</button>
      </div>
      <div id="gasto-baucher-preview"${!hasUrl ? ' style="display:none"' : ""}>${previewHtml}</div>
    </div>`;
}

function _gastosWireBaucher() {
  const input = document.getElementById("gasto-baucher-input");
  const area  = document.getElementById("gasto-baucher-area");
  if (!input || !area) return;

  let objUrl = null;

  function _showFile(f) {
    _gastosBaucherFile = f;
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }

    const emptyEl = document.getElementById("gasto-baucher-empty");
    const preview = document.getElementById("gasto-baucher-preview");
    const iX = window.SGIUI?.icon("x")            ?? "✕";
    const iF = window.SGIUI?.icon("file")         ?? "";
    const iU = window.SGIUI?.icon("upload-cloud") ?? "";

    if (f.type.startsWith("image/")) {
      objUrl = URL.createObjectURL(f);
      preview.innerHTML = `
        <div class="baucher-img-preview-wrap">
          <img src="${objUrl}" class="baucher-img-preview" alt="Vista previa" style="cursor:zoom-in">
          <button type="button" class="baucher-img-remove" id="gasto-baucher-remove">${iX}</button>
        </div>
        <div class="baucher-preview-footer">
          <span class="baucher-preview-name">${iF} ${f.name}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="gasto-baucher-change">${iU} Cambiar</button>
        </div>`;

      const capturedUrl = objUrl;
      preview.querySelector(".baucher-img-preview")?.addEventListener("click", () => {
        window._gastosOpenPreviewModal(capturedUrl);
      });
    } else {
      preview.innerHTML = `
        <div class="baucher-preview baucher-preview--file">
          <span class="baucher-preview-name">${iF} ${f.name}</span>
          <div style="display:flex;gap:.5rem;flex-shrink:0">
            <button type="button" class="btn btn-ghost btn-sm" id="gasto-baucher-change">${iU} Cambiar</button>
            <span class="baucher-preview-remove" id="gasto-baucher-remove">${iX}</span>
          </div>
        </div>`;
    }

    if (emptyEl) emptyEl.style.display = "none";
    preview.style.display = "block";
    area.classList.add("has-preview");
    window.SGIUI?.hydrate();

    document.getElementById("gasto-baucher-remove")?.addEventListener("click", () => {
      _gastosBaucherFile    = null;
      _gastosComprobanteUrl = null;
      if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
      preview.style.display = "none";
      preview.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "";
      area.classList.remove("has-preview");
      input.value = "";
    });
    document.getElementById("gasto-baucher-change")?.addEventListener("click", () => input.click());
  }

  document.getElementById("gasto-baucher-remove")?.addEventListener("click", () => {
    _gastosComprobanteUrl = null;
    const emptyEl = document.getElementById("gasto-baucher-empty");
    const preview = document.getElementById("gasto-baucher-preview");
    if (emptyEl) emptyEl.style.display = "";
    if (preview) { preview.style.display = "none"; preview.innerHTML = ""; }
    area.classList.remove("has-preview");
    input.value = "";
  });
  document.getElementById("gasto-baucher-change")?.addEventListener("click", () => input.click());
  document.getElementById("gasto-baucher-click")?.addEventListener("click",  () => input.click());

  const existingImg = document.querySelector("#gasto-baucher-preview .baucher-img-preview");
  if (existingImg && _gastosComprobanteUrl) {
    existingImg.addEventListener("click", () => window._gastosOpenPreviewModal(_gastosComprobanteUrl));
  }

  area.addEventListener("dragover",  e => { e.preventDefault(); area.classList.add("dragover"); });
  area.addEventListener("dragleave", () => area.classList.remove("dragover"));
  area.addEventListener("drop", e => {
    e.preventDefault(); area.classList.remove("dragover");
    if (e.dataTransfer.files[0]) _showFile(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", () => { if (input.files[0]) _showFile(input.files[0]); });
}

function _gastosResumenCards(lista) {
  const total  = lista.reduce((s, g) => s + Number(g.valor), 0);
  const debito = lista.filter(g => Number(g.valor) > 0).reduce((s, g) => s + Number(g.valor), 0);
  const ajuste = lista.filter(g => Number(g.valor) < 0).reduce((s, g) => s + Number(g.valor), 0);

  const byCategoria = {};
  for (const g of lista) {
    byCategoria[g.categoria] = (byCategoria[g.categoria] || 0) + Number(g.valor);
  }

  const catCards = Object.entries(byCategoria).map(([cat, val]) => `
    <div class="stat-card">
      <span class="stat-label">${CATEGORIA_LABELS[cat] || cat}</span>
      <span class="stat-value" style="font-size:1rem">${UI.fmt(val)}</span>
    </div>
  `).join("");

  return `
    <div class="stats-grid" style="margin-bottom:1.25rem">
      <div class="stat-card">
        <span class="stat-label">Total egresos</span>
        <span class="stat-value">${UI.fmt(debito)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Ajustes (creditos)</span>
        <span class="stat-value" style="color:var(--success)">${UI.fmt(Math.abs(ajuste))}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Saldo neto</span>
        <span class="stat-value" style="color:${total < 0 ? "var(--success)" : "var(--text)"}">${UI.fmt(total)}</span>
      </div>
      ${catCards}
    </div>
  `;
}

function _gastosTableHTML(lista) {
  if (!lista.length) {
    return SGIUI.emptyState({ title: "Sin gastos registrados", text: "Usa los filtros o registra un nuevo gasto." });
  }

  let saldo = 0;
  const rows = lista.map(g => {
    saldo += Number(g.valor);
    const esAjuste = Number(g.valor) < 0;
    return `
      <tr>
        <td>${UI.date(g.fecha)}</td>
        <td>${g.proyecto?.nombre || "—"}</td>
        <td><span class="badge badge-muted">${CATEGORIA_LABELS[g.categoria] || g.categoria}</span></td>
        <td style="max-width:18rem;white-space:normal">${g.descripcion}</td>
        <td style="color:var(--text-muted)">${g.detalle_recurso || "—"}</td>
        <td style="text-align:right;color:${esAjuste ? "var(--success)" : "var(--danger)"}">
          ${esAjuste ? "" : ""}${UI.fmt(Number(g.valor))}
        </td>
        <td style="text-align:right">${UI.fmt(saldo)}</td>
        <td>
          ${g.comprobante_url
            ? (_gastosIsImageUrl(g.comprobante_url)
                ? `<img src="${g.comprobante_url}" alt="Comprobante" style="width:2.25rem;height:2.25rem;object-fit:cover;border-radius:.375rem;cursor:pointer;border:1px solid var(--border);vertical-align:middle" onclick="_gastosOpenPreviewModal(${g.id_gasto})">`
                : `<a href="${g.comprobante_url}" target="_blank" rel="noopener" class="btn btn-sm" style="font-size:.75rem">Ver</a>`)
            : `<span style="color:var(--text-muted);font-size:.8rem">—</span>`}
        </td>
        <td>
          <button class="btn btn-sm" onclick="gastosOpenEdit(${g.id_gasto})">Editar</button>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proyecto</th>
            <th>Categoria</th>
            <th>Descripcion</th>
            <th>Recurso</th>
            <th style="text-align:right">Valor</th>
            <th style="text-align:right">Saldo acum.</th>
            <th>Comprobante</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function _gastosRenderTable() {
  const container = document.getElementById("gastos_table_container");
  if (!container) return;
  const lista = _gastosFiltered();
  container.innerHTML = _gastosResumenCards(lista) + _gastosTableHTML(lista);
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function _gastosFilterBar() {
  const proyOptions = _gastosProyectos.map(p =>
    `<option value="${p.id_proyecto}">${p.nombre}</option>`
  ).join("");

  const catOptions = Object.entries(CATEGORIA_LABELS).map(([val, label]) =>
    `<option value="${val}">${label}</option>`
  ).join("");

  return `
    <div class="table-wrap" style="margin-bottom:1rem">
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-end;padding:.5rem 0">
        <div class="form-group" style="margin:0;min-width:11rem;flex:1">
          <label>Proyecto</label>
          <select id="gf_proyecto" onchange="_gastosApplyFilter()">
            <option value="">Todos</option>
            ${proyOptions}
          </select>
        </div>
        <div class="form-group" style="margin:0;min-width:9rem">
          <label>Categoria</label>
          <select id="gf_categoria" onchange="_gastosApplyFilter()">
            <option value="">Todas</option>
            ${catOptions}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Desde</label>
          <input type="date" id="gf_desde" onchange="_gastosApplyFilter()">
        </div>
        <div class="form-group" style="margin:0">
          <label>Hasta</label>
          <input type="date" id="gf_hasta" onchange="_gastosApplyFilter()">
        </div>
        <button class="btn btn-sm" onclick="_gastosResetFilters()" style="margin-bottom:.1rem">Limpiar</button>
      </div>
    </div>
  `;
}

window._gastosApplyFilter = function() {
  _gastosFilters.id_proyecto = document.getElementById("gf_proyecto")?.value || "";
  _gastosFilters.categoria   = document.getElementById("gf_categoria")?.value || "";
  _gastosFilters.fecha_desde = document.getElementById("gf_desde")?.value || "";
  _gastosFilters.fecha_hasta = document.getElementById("gf_hasta")?.value || "";
  _gastosRenderTable();
};

window._gastosResetFilters = function() {
  _gastosFilters = { id_proyecto: "", categoria: "", fecha_desde: "", fecha_hasta: "" };
  ["gf_proyecto","gf_categoria","gf_desde","gf_hasta"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  _gastosRenderTable();
};

// ─── Export ───────────────────────────────────────────────────────────────────

window._gastosExport = async function() {
  const lista = _gastosFiltered();
  if (!lista.length) { UI.toast("No hay datos para exportar", "error"); return; }

  const btn = document.getElementById("gastos_export_btn");
  if (btn) { btn.disabled = true; btn.textContent = "Exportando..."; }

  try {
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload  = resolve;
        s.onerror = () => reject(new Error("No se pudo cargar la libreria de Excel"));
        document.head.appendChild(s);
      });
    }

    let saldo = 0;
    const rows = lista.map(g => {
      const valor  = Number(g.valor);
      saldo       += valor;
      const fecha  = new Date(g.fecha + "T12:00:00");
      const mes    = fecha.toLocaleString("es-CO", { month: "long" }).toUpperCase();
      const debito = valor > 0 ? valor : 0;
      const credito= valor < 0 ? Math.abs(valor) : 0;
      return {
        MES:                  mes,
        FECHA:                g.fecha,
        TIPO:                 valor >= 0 ? "Gasto" : "Ajuste",
        PROYECTO:             g.proyecto?.nombre || "",
        CATEGORIA:            CATEGORIA_LABELS[g.categoria] || g.categoria,
        DETALLE:              g.descripcion,
        RECURSO:              g.detalle_recurso || "",
        MEDIO_PAGO:           g.medio_pago === "transferencia" ? "Transferencia" : "Efectivo",
        CUENTA_ORIGEN:        g.cuenta_origen || "",
        RESPONSABLE_ENTREGA:  g.responsable_entrega || "",
        RESPONSABLE_RECIBE:   g.responsable_recibe  || "",
        DEBITO:               debito || "",
        CREDITO:              credito || "",
        SALDO:                saldo,
        COMPROBANTE:          g.comprobante_url || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 8  },
      { wch: 22 }, { wch: 14 }, { wch: 40 },
      { wch: 20 }, { wch: 14 }, { wch: 22 },
      { wch: 22 }, { wch: 24 },
      { wch: 14 }, { wch: 14 }, { wch: 16 },
      { wch: 40 },
    ];

    // Formato de moneda en DEBITO (L), CREDITO (M), SALDO (N)
    const moneyFmt = '#,##0';
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      ["L","M","N"].forEach(col => {
        const cell = ws[`${col}${r + 1}`];
        if (cell && cell.v !== "") { cell.t = "n"; cell.z = moneyFmt; }
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");

    const { id_proyecto, categoria, fecha_desde, fecha_hasta } = _gastosFilters;
    const suffix = [
      fecha_desde || "",
      fecha_hasta ? `al_${fecha_hasta}` : "",
      id_proyecto ? `proy${id_proyecto}` : "",
      categoria   || "",
    ].filter(Boolean).join("_");

    XLSX.writeFile(wb, `gastos${suffix ? "_" + suffix : ""}.xlsx`);
    UI.toast("Archivo descargado", "ok");
  } catch (err) {
    UI.toast(err.message || "Error al exportar", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Exportar Excel"; }
  }
};

// ─── Main view ────────────────────────────────────────────────────────────────

window.gastosView = async function() {
  const vc        = document.getElementById("viewContainer");
  const canCreate = AppState.can("gastos", "crear");
  vc.innerHTML    = UI.loader();

  _gastosList      = [];
  _gastosProyectos = [];
  _gastosFilters   = { id_proyecto: "", categoria: "", fecha_desde: "", fecha_hasta: "" };

  const [gastos, proyectos] = await Promise.all([
    API.get("/gastos").catch(() => []),
    API.get("/proyectos").catch(() => []),
  ]);

  _gastosList      = gastos;
  _gastosProyectos = proyectos;

  const lista = _gastosFiltered();

  vc.innerHTML = `
    ${SGIUI.pageHeader({
      kicker:  "Finanzas",
      title:   "Gastos Operativos",
      actions: `
        <button class="btn btn-sm" id="gastos_export_btn" onclick="_gastosExport()">Exportar Excel</button>
        ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="gastosOpenCreate()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo gasto</button>` : ""}
      `,
    })}
    ${_gastosFilterBar()}
    <div id="gastos_table_container">
      ${_gastosResumenCards(lista)}
      ${_gastosTableHTML(lista)}
    </div>
  `;

  SGIUI.hydrate();
};

// ─── Form modal ───────────────────────────────────────────────────────────────

function _gastosFormHTML(gasto) {
  const proyOptions = _gastosProyectos.map(p =>
    `<option value="${p.id_proyecto}" ${gasto?.id_proyecto == p.id_proyecto ? "selected" : ""}>${p.nombre}</option>`
  ).join("");

  const catOptions = Object.entries(CATEGORIA_LABELS).map(([val, label]) =>
    `<option value="${val}" ${gasto?.categoria === val ? "selected" : ""}>${label}</option>`
  ).join("");

  return `
    <div style="display:flex;flex-direction:column;gap:.875rem">
      <div class="form-group" style="margin:0">
        <label>Proyecto <span style="color:var(--danger)">*</span></label>
        <select id="gasto_proyecto">
          <option value="">— Seleccione —</option>
          ${proyOptions}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group" style="margin:0">
          <label>Fecha <span style="color:var(--danger)">*</span></label>
          <input type="date" id="gasto_fecha" value="${gasto?.fecha || ""}">
        </div>
        <div class="form-group" style="margin:0">
          <label>Categoria <span style="color:var(--danger)">*</span></label>
          <select id="gasto_categoria">
            <option value="">— Seleccione —</option>
            ${catOptions}
          </select>
        </div>
      </div>
      <div class="form-group" style="margin:0">
        <label>Descripcion <span style="color:var(--danger)">*</span></label>
        <input type="text" id="gasto_descripcion" placeholder="Ej: Gasolina corriente factura FEAC19697" value="${gasto?.descripcion || ""}">
      </div>
      <div class="form-group" style="margin:0">
        <label>Recurso / Detalle</label>
        <input type="text" id="gasto_recurso" placeholder="Ej: Finca, vehiculo, contratista..." value="${gasto?.detalle_recurso || ""}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group" style="margin:0">
          <label>Tipo <span style="color:var(--danger)">*</span></label>
          <select id="gasto_tipo">
            <option value="egreso" ${!gasto || Number(gasto.valor) >= 0 ? "selected" : ""}>Egreso (debito)</option>
            <option value="ajuste" ${gasto && Number(gasto.valor) < 0  ? "selected" : ""}>Ajuste (credito)</option>
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Valor <span style="color:var(--danger)">*</span></label>
          <input type="text" id="gasto_valor"
            placeholder="Ej: 290.000"
            value="${gasto ? MoneyInput.format(Math.abs(Number(gasto.valor))) : ""}">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group" style="margin:0">
          <label>Medio de pago <span style="color:var(--danger)">*</span></label>
          <select id="gasto_medio_pago" onchange="_gastosMedioPagoToggle()">
            <option value="efectivo"      ${(gasto?.medio_pago || "efectivo") === "efectivo"      ? "selected" : ""}>Efectivo</option>
            <option value="transferencia" ${gasto?.medio_pago === "transferencia" ? "selected" : ""}>Transferencia</option>
          </select>
        </div>
        <div class="form-group" style="margin:0" id="gasto_cuenta_wrap"
          style="display:${gasto?.medio_pago === 'transferencia' ? 'block' : 'none'}">
          <label>Cuenta de origen</label>
          <input type="text" id="gasto_cuenta_origen"
            placeholder="Ej: Bancolombia 123-456"
            value="${gasto?.cuenta_origen || ""}">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group" style="margin:0">
          <label>Responsable entrega</label>
          <input type="text" id="gasto_resp_entrega"
            placeholder="Quien dio el dinero"
            value="${gasto?.responsable_entrega || ""}">
        </div>
        <div class="form-group" style="margin:0">
          <label>Responsable / Empresa recibe</label>
          <input type="text" id="gasto_resp_recibe"
            placeholder="Quien o que empresa recibio"
            value="${gasto?.responsable_recibe || [window.currentUser?.nombres, window.currentUser?.apellidos].filter(Boolean).join(" ")}">
        </div>
      </div>
      <div class="form-group" style="margin:0">
        <label>Comprobante</label>
        ${_gastosUploadAreaHTML(gasto?.comprobante_url ?? null)}
      </div>
      <div id="gasto_error" style="display:none;color:var(--danger);font-size:.875rem"></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end">
        <button class="btn btn-sm" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary btn-sm" id="gasto_submit_btn" onclick="_gastosSubmit()">
          ${gasto ? "Guardar cambios" : "Registrar gasto"}
        </button>
      </div>
    </div>
  `;
}

window._gastosMedioPagoToggle = function() {
  const medio = document.getElementById("gasto_medio_pago")?.value;
  const wrap  = document.getElementById("gasto_cuenta_wrap");
  if (wrap) wrap.style.display = medio === "transferencia" ? "block" : "none";
};

window.gastosOpenCreate = function() {
  _gastosEditId         = null;
  _gastosComprobanteUrl = null;
  _gastosBaucherFile    = null;
  UI.openModal("Nuevo gasto operativo", _gastosFormHTML(null));
  SGIUI.hydrate();
  _gastosWireBaucher();
  const valorEl = document.getElementById("gasto_valor");
  if (valorEl) MoneyInput.init(valorEl);
};

window.gastosOpenEdit = function(id) {
  const gasto = _gastosList.find(g => g.id_gasto === id);
  if (!gasto) return;
  _gastosEditId         = id;
  _gastosComprobanteUrl = gasto.comprobante_url || null;
  _gastosBaucherFile    = null;
  UI.openModal("Editar gasto", _gastosFormHTML(gasto));
  SGIUI.hydrate();
  _gastosWireBaucher();
  const valorEl = document.getElementById("gasto_valor");
  if (valorEl) MoneyInput.init(valorEl);
};

window._gastosSubmit = async function() {
  const errEl  = document.getElementById("gasto_error");
  const btn    = document.getElementById("gasto_submit_btn");
  errEl.style.display = "none";

  const id_proyecto = document.getElementById("gasto_proyecto").value;
  const fecha       = document.getElementById("gasto_fecha").value;
  const categoria   = document.getElementById("gasto_categoria").value;
  const descripcion = document.getElementById("gasto_descripcion").value.trim();
  const recurso          = document.getElementById("gasto_recurso").value.trim();
  const tipo             = document.getElementById("gasto_tipo").value;
  const valorRaw         = document.getElementById("gasto_valor").value;
  const medio_pago       = document.getElementById("gasto_medio_pago").value;
  const cuenta_origen    = document.getElementById("gasto_cuenta_origen")?.value.trim() || null;
  const resp_entrega     = document.getElementById("gasto_resp_entrega").value.trim();
  const resp_recibe      = document.getElementById("gasto_resp_recibe").value.trim();
  const valorAbs = _gastosParseInput(valorRaw);

  if (!id_proyecto || !fecha || !categoria || !descripcion || !valorRaw || valorAbs === 0) {
    errEl.textContent = "Completa todos los campos obligatorios.";
    errEl.style.display = "block";
    return;
  }

  const valor = tipo === "ajuste" ? -valorAbs : valorAbs;

  btn.disabled = true;
  btn.textContent = "Guardando...";

  let comprobanteUrl = _gastosComprobanteUrl;

  if (_gastosBaucherFile) {
    btn.textContent = "Subiendo comprobante...";
    try {
      const formData = new FormData();
      formData.append("baucher", _gastosBaucherFile);
      const token = localStorage.getItem("fb_token");
      const res = await fetch("/api/v1/uploads/baucher", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al subir archivo");
      comprobanteUrl = result.url;
      btn.textContent = "Guardando...";
    } catch (err) {
      errEl.textContent = "Error al subir comprobante: " + err.message;
      errEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = _gastosEditId ? "Guardar cambios" : "Registrar gasto";
      return;
    }
  }

  const payload = {
    id_proyecto:          Number(id_proyecto),
    fecha,
    descripcion,
    valor,
    categoria,
    detalle_recurso:      recurso || null,
    medio_pago,
    cuenta_origen:        medio_pago === "transferencia" ? (cuenta_origen || null) : null,
    responsable_entrega:  resp_entrega || null,
    responsable_recibe:   resp_recibe  || null,
    comprobante_url:      comprobanteUrl || null,
  };

  try {
    if (_gastosEditId) {
      const updated = await API.put(`/gastos/${_gastosEditId}`, payload);
      const idx = _gastosList.findIndex(g => g.id_gasto === _gastosEditId);
      if (idx !== -1) _gastosList[idx] = { ..._gastosList[idx], ...updated };
    } else {
      const created = await API.post("/gastos", payload);
      _gastosList.unshift(created);
    }

    UI.closeModal();
    UI.toast(_gastosEditId ? "Gasto actualizado" : "Gasto registrado", "ok");
    _gastosRenderTable();
  } catch (err) {
    errEl.textContent = err.message || "Error al guardar.";
    errEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = _gastosEditId ? "Guardar cambios" : "Registrar gasto";
  }
};


})();