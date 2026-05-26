(function () {

  // Tracks which view opened the payment modal, to refresh the right one afterwards
  let pagoOrigen   = "pagos";
  let _baucherFile = null;
  let _baucherUrl  = null;

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-͟]/g, "");
  }

  function fmtFactNum(v) {
    if (!v) return "—";
    const s = String(v);
    if (/^\d{7,9}$/.test(s)) {
      const p = s.padStart(9, "0");
      return `20${p.slice(0, 2)}-${p.slice(2, 6)}-${p.slice(6)}`;
    }
    return s;
  }

  function facturasListaHTML(facturas, filtro) {
    const q = norm(filtro);
    const visibles = q
      ? facturas.filter(f => norm(f.comprador).includes(q) || norm(f.codigo_lote).includes(q))
      : facturas;

    if (!visibles.length) {
      return `<p style="color:var(--text-muted);text-align:center;padding:12px;font-size:.84rem">Sin facturas emitidas pendientes</p>`;
    }

    const gs = new Map();
    visibles.forEach(f => {
      const k = f.id_venta ?? "none";
      if (!gs.has(k)) gs.set(k, { id_venta: f.id_venta, comprador: f.comprador, proyecto: f.proyecto, codigo_lote: f.codigo_lote, facturas: [] });
      gs.get(k).facturas.push(f);
    });

    return [...gs.values()].map(g => {
      const key   = g.id_venta ?? "none";
      const count = g.facturas.length;
      return `
      <div style="margin-bottom:4px;border:1px solid var(--border);border-radius:6px;overflow:hidden">
        <div onclick="_toggleGrupoFacturaPago('${key}')"
             style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;font-size:.79rem;font-weight:700;background:var(--surface-2,#f0f4f8);color:var(--text-muted);cursor:pointer;user-select:none">
          <span>
            <span id="pfg-arrow-${key}" style="display:inline-flex;align-items:center;width:12px;margin-right:4px"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
            Venta #${g.id_venta ?? "—"} &mdash; <span style="font-weight:500">${g.comprador}</span> &bull; ${g.proyecto} &bull; ${g.codigo_lote}
          </span>
          <span style="font-size:.75rem;font-weight:600;background:var(--border);padding:1px 7px;border-radius:10px;color:var(--text-muted)">
            ${count} factura${count !== 1 ? "s" : ""}
          </span>
        </div>
        <div id="pfg-body-${key}" style="display:block">
          ${g.facturas.map(f => `
            <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-top:1px solid var(--border);cursor:pointer">
              <input type="radio" name="factura_sel" value="${f.id_factura}"
                data-valor="${f.valor_facturado}" style="flex-shrink:0">
              <span style="flex:1;font-size:.83rem;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                <span>
                  Factura <strong>${fmtFactNum(f.numero_factura)}</strong>
                  &bull; Cuota #${f.numero_cuota ?? "—"}
                  &bull; Vence: ${UI.date(f.fecha_vencimiento)}
                </span>
                <span style="font-weight:600;white-space:nowrap">${UI.fmt(f.valor_facturado)}</span>
              </span>
            </label>`).join("")}
        </div>
      </div>`;
    }).join("");
  }

  // Exposed for inline onclick / oninput in generated HTML
  window._toggleGrupoFacturaPago = function(key) {
    const body  = document.getElementById(`pfg-body-${key}`);
    const arrow = document.getElementById(`pfg-arrow-${key}`);
    if (!body) return;
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "block";
    if (arrow) arrow.innerHTML = open ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  };

  window._filtrarFacturasPago = function() {
    const lista = document.getElementById("pf_factura_lista");
    if (!lista) return;
    lista.innerHTML = facturasListaHTML(
      window._pagoFacturas || [],
      document.getElementById("pf_factura_buscar")?.value || ""
    );
  };

  // ── Main list view ────────────────────────────────────────────────────────────

  async function loadPagosView() {
    const canWrite = AppState.can("pagos", "crear");
    const vc       = document.getElementById("viewContainer");
    vc.innerHTML   = UI.loader();

    const data = await API.get("/pagos").catch(e => {
      vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
      return null;
    });
    if (!data) return;

    window._pagosMap = {};
    data.forEach(p => { window._pagosMap[p.id_pago] = p; });

    const ventasMap = new Map();
    data.forEach(p => {
      const key = p.id_venta ?? "none";
      if (!ventasMap.has(key)) {
        ventasMap.set(key, { id_venta: p.id_venta, comprador: p.comprador, proyecto: p.proyecto, codigo_lote: p.codigo_lote, pagos: [] });
      }
      ventasMap.get(key).pagos.push(p);
    });

    const grupos = [...ventasMap.values()].sort((a, b) => (b.id_venta || 0) - (a.id_venta || 0));
    window._pagosGrupos = grupos;

    const proyectos    = [...new Set(grupos.map(g => g.proyecto))].filter(p => p !== "—").sort();
    const optsProyecto = proyectos.map(p => `<option value="${p}">${p}</option>`).join("");

    function filaVenta(g) {
      const total = g.pagos.filter(p => p.estado === 'aceptado').reduce((s, p) => s + Number(p.valor_pago || 0), 0);
      return `<tr data-grupo-key="${g.id_venta ?? "none"}" style="cursor:pointer">
        <td>${g.id_venta ? `<strong>#${g.id_venta}</strong>` : "—"}</td>
        <td>${g.comprador}</td>
        <td>${g.proyecto !== "—" ? `${g.proyecto} · <strong>${g.codigo_lote}</strong>` : "—"}</td>
        <td style="text-align:center"><strong>${g.pagos.length}</strong></td>
        <td style="text-align:right">${UI.fmt(total)}</td>
        <td><button class="btn btn-ghost btn-sm btn-ver-pagos">Ver <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></td>
      </tr>`;
    }

    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header">
          <h3>Pagos por Venta</h3>
          ${canWrite ? `<button class="btn btn-primary btn-sm" onclick="pagoForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar Pago</button>` : ""}
        </div>
        <div class="table-filters">
          <select id="pv-proyecto" class="select-sm" style="flex:1;min-width:160px;">
            <option value="">Todos los proyectos</option>
            ${optsProyecto}
          </select>
          <input id="pv-comprador" type="text" placeholder="Buscar comprador..."
            style="flex:2;min-width:180px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:.83rem">
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead><tr>
              <th>Venta #</th><th>Comprador</th><th>Proyecto / Lote</th>
              <th style="text-align:center">Pagos</th>
              <th style="text-align:right">Total pagado</th><th></th>
            </tr></thead>
            <tbody id="pagos-grupos-tbody">${grupos.map(filaVenta).join("")}</tbody>
          </table>
          <p id="pagos-grupos-empty" style="display:none;text-align:center;color:var(--text-muted);padding:1.5rem">
            No hay ventas con pagos que coincidan con los filtros.
          </p>
        </div>
      </div>`;

    const tbody = document.getElementById("pagos-grupos-tbody");

    function aplicarFiltros() {
      const fProyecto = document.getElementById("pv-proyecto").value;
      const fComp     = norm(document.getElementById("pv-comprador").value);
      const visibles  = grupos.filter(g => {
        if (fProyecto && g.proyecto !== fProyecto)             return false;
        if (fComp && !norm(g.comprador).includes(fComp))      return false;
        return true;
      });
      tbody.innerHTML = visibles.map(filaVenta).join("");
      document.getElementById("pagos-grupos-empty").style.display = visibles.length ? "none" : "block";
    }

    document.getElementById("pv-proyecto").addEventListener("change", aplicarFiltros);
    document.getElementById("pv-comprador").addEventListener("input", aplicarFiltros);

    tbody.addEventListener("click", e => {
      const btn = e.target.closest(".btn-ver-pagos");
      if (!btn) return;
      const row = btn.closest("tr[data-grupo-key]");
      if (!row) return;
      const key = row.dataset.grupoKey;
      const g   = grupos.find(g => String(g.id_venta ?? "none") === key);
      if (g) window.pagosDeVentaView(g);
    });
  }

  // ── Detail view ───────────────────────────────────────────────────────────────

  window.pagosDeVentaView = function(grupo) {
    const canWrite     = AppState.can("pagos", "crear");
    const vc           = document.getElementById("viewContainer");
    window._pagosDetalleGrupo = grupo;

    function filaPago(p) {
  const esAbonoExtraordinario = p.tipo_pago === "abono_extraordinario";

  const cuotaLabel = esAbonoExtraordinario
    ? `<span class="badge badge-info">Abono al total</span>`
    : (p.numero_cuota != null ? `#${p.numero_cuota}` : "—");

  return `<tr>
    <td style="font-family:monospace;font-size:.82rem;white-space:nowrap">${p.numero_pago || `#${p.id_pago}`}</td>
    <td>${UI.date(p.fecha_pago)}</td>
    <td style="text-align:right;font-weight:600">${UI.fmt(p.valor_pago)}</td>
    <td>${p.metodo_pago || "—"}</td>
    <td style="font-family:monospace;font-size:.82rem;white-space:nowrap">${fmtFactNum(p.numero_factura)}</td>
    <td>${cuotaLabel}</td>
    <td style="max-width:120px;font-size:.82rem">${p.referencia || "—"}</td>
    <td>${p.estado ? UI.badge(p.estado) : "—"}</td>
    <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${p.numero_recibo || "—"}</td>
  </tr>`;
}

    const totalPagado = grupo.pagos
      .filter(p => p.estado === 'aceptado')
      .reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="_volverPagosView()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Volver</button>
            <h3>Pagos &mdash; Venta #${grupo.id_venta ?? "sin venta"}</h3>
          </div>
          ${canWrite ? `<button class="btn btn-primary btn-sm" onclick="pagoForm(${grupo.id_venta ?? "null"})"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar Pago</button>` : ""}
        </div>
        <div style="background:var(--surface-2,#f0f4f8);border-radius:8px;padding:12px 16px;margin-bottom:1rem;font-size:.88rem;display:flex;gap:24px;flex-wrap:wrap">
          <span><span style="color:var(--text-muted)">Cliente:</span> <strong>${grupo.comprador}</strong></span>
          <span><span style="color:var(--text-muted)">Proyecto:</span> <strong>${grupo.proyecto}</strong></span>
          <span><span style="color:var(--text-muted)">Lote:</span> <strong>${grupo.codigo_lote}</strong></span>
          <span><span style="color:var(--text-muted)">Total pagado:</span> <strong>${UI.fmt(totalPagado)}</strong></span>
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead><tr>
              <th>N° Pago</th><th>Fecha</th><th style="text-align:right">Valor</th><th>Método</th>
              <th>Factura</th><th>Cuota</th><th>Referencia</th><th>Estado</th><th>Recibo</th>
            </tr></thead>
            <tbody>${grupo.pagos.map(filaPago).join("")}</tbody>
          </table>
          ${!grupo.pagos.length
            ? `<p style="text-align:center;color:var(--text-muted);padding:1.5rem">Sin pagos registrados para esta venta</p>`
            : ""}
        </div>
      </div>`;
  };

  window._volverPagosView = function() {
    loadPagosView();
  };

  // ── Payment form ──────────────────────────────────────────────────────────────

  function _wireBaucherAdmin() {
    const input  = document.getElementById("pf-baucher-input");
    const area   = document.getElementById("pf-baucher-area");
    const btnClick = document.getElementById("pf-baucher-click");
    if (!input || !area) return;

    let objUrl = null;

    function setFile(f) {
      _baucherFile = f;
      _baucherUrl  = null;
      if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }

      const emptyEl = document.getElementById("pf-baucher-empty");
      const preview = document.getElementById("pf-baucher-preview");
      const iconX   = window.SGIUI?.icon("x")            ?? "✕";
      const iconF   = window.SGIUI?.icon("file")          ?? "";
      const iconU   = window.SGIUI?.icon("upload-cloud")  ?? "";
      const isImage = f.type.startsWith("image/");

      if (isImage) {
        objUrl = URL.createObjectURL(f);
        preview.innerHTML = `
          <div class="baucher-img-preview-wrap">
            <img src="${objUrl}" class="baucher-img-preview" alt="Vista previa">
            <button type="button" class="baucher-img-remove" id="pf-baucher-remove">${iconX}</button>
          </div>
          <div class="baucher-preview-footer">
            <span class="baucher-preview-name">${iconF} ${f.name}</span>
            <button type="button" class="btn btn-ghost btn-sm" id="pf-baucher-change">${iconU} Cambiar</button>
          </div>`;
      } else {
        preview.innerHTML = `
          <div class="baucher-preview baucher-preview--file">
            <span class="baucher-preview-name">${iconF} ${f.name}</span>
            <div style="display:flex;gap:.5rem;flex-shrink:0">
              <button type="button" class="btn btn-ghost btn-sm" id="pf-baucher-change">${iconU} Cambiar</button>
              <span class="baucher-preview-remove" id="pf-baucher-remove">${iconX}</span>
            </div>
          </div>`;
      }

      if (emptyEl) emptyEl.style.display = "none";
      preview.style.display = "block";
      area.classList.add("has-preview");
      window.SGIUI?.hydrate();

      document.getElementById("pf-baucher-remove")?.addEventListener("click", () => {
        _baucherFile = null; _baucherUrl = null;
        if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
        preview.style.display = "none";
        preview.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "";
        area.classList.remove("has-preview");
        input.value = "";
      });

      document.getElementById("pf-baucher-change")?.addEventListener("click", () => input.click());
    }

    btnClick?.addEventListener("click", () => input.click());
    area.addEventListener("dragover",  e => { e.preventDefault(); area.classList.add("dragover"); });
    area.addEventListener("dragleave", () => area.classList.remove("dragover"));
    area.addEventListener("drop", e => {
      e.preventDefault(); area.classList.remove("dragover");
      if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
    });
    input.addEventListener("change", () => { if (input.files[0]) setFile(input.files[0]); });
  }

  window.pagoForm = async function(idVentaCtx = null, cuotaCtx = null) {
    const hoy = new Date().toISOString().split("T")[0];
    let facturas     = [];
    let cuotaFactura = null;

    try {
      const todas = await API.get("/facturas");
      facturas = todas.filter(f => f.estado === "emitida");
      if (idVentaCtx && !cuotaCtx) facturas = facturas.filter(f => f.id_venta === idVentaCtx);
    } catch (e) { facturas = []; }

    if (cuotaCtx) {
      cuotaFactura = cuotaCtx.id_fraccion
        ? facturas.find(f => f.id_cuota === cuotaCtx.id_cuota && f.id_fraccion === cuotaCtx.id_fraccion)
        : facturas.find(f => f.id_cuota === cuotaCtx.id_cuota);

      if (!cuotaFactura) {
        try {
          const nueva = await API.post("/facturas", {
            id_cuota:        cuotaCtx.id_cuota,
            fecha_emision:   hoy,
            valor_facturado: cuotaCtx.valor_cuota,
          });
          cuotaFactura = {
            id_factura:      nueva.id_factura,
            numero_factura:  nueva.numero_factura,
            valor_facturado: nueva.valor_facturado,
            id_cuota:        cuotaCtx.id_cuota,
            numero_cuota:    cuotaCtx.numero_cuota ?? "—",
            comprador:       cuotaCtx.comprador    ?? "—",
            proyecto:        cuotaCtx.proyecto     ?? "—",
            codigo_lote:     cuotaCtx.codigo_lote  ?? "—",
          };
        } catch (e) {
          UI.toast(e.message || "Error al emitir la factura", "error");
          return;
        }
      }
      facturas = [cuotaFactura];
    }

    pagoOrigen = cuotaCtx ? "cuotas" : "pagos";
    window._pagoFacturas = facturas;
    _baucherFile = null;
    _baucherUrl  = null;

    let fracciones = [];
    if (cuotaCtx?.tiene_fracciones) {
      try { fracciones = await API.get(`/cuotas/${cuotaCtx.id_cuota}/fracciones`); } catch (_) {}
    }

    const ctxLabel = idVentaCtx && !cuotaCtx
      ? ` <span style="color:var(--text-muted);font-weight:400;font-size:.79rem">— Venta #${idVentaCtx}</span>`
      : "";

    const facturaSelectorHTML = cuotaFactura
      ? `<div class="form-group" style="grid-column:1/-1">
          <label>Factura de la cuota</label>
          <div class="summary-card">
            <div class="summary-card-head">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Factura ${fmtFactNum(cuotaFactura.numero_factura)}
            </div>
            <div class="summary-card-grid">
              <div class="summary-item"><span class="summary-item-label">Comprador</span><span class="summary-item-value">${cuotaFactura.comprador}</span></div>
              <div class="summary-item"><span class="summary-item-label">Proyecto</span><span class="summary-item-value">${cuotaFactura.proyecto}</span></div>
              <div class="summary-item"><span class="summary-item-label">Lote</span><span class="summary-item-value">${cuotaFactura.codigo_lote}</span></div>
              <div class="summary-item"><span class="summary-item-label">Cuota</span><span class="summary-item-value">#${cuotaFactura.numero_cuota ?? "—"}</span></div>
            </div>
          </div>
          <input type="hidden" id="pf_id_factura" value="${cuotaFactura.id_factura}">
        </div>`
      : `<div class="form-group" style="grid-column:1/-1">
          <label>Factura a pagar *${ctxLabel}</label>
          <input type="text" id="pf_factura_buscar" placeholder="Filtrar por comprador o lote..."
                 oninput="_filtrarFacturasPago()" autocomplete="off" style="margin-bottom:6px">
          <input type="hidden" id="pf_id_factura">
          <div id="pf_factura_lista"
               style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">
            ${facturasListaHTML(facturas, "")}
          </div>
        </div>`;

    const fraccionesHTML = fracciones.length > 0 ? `
      <div class="form-group" style="grid-column:1/-1">
        <label style="display:flex;align-items:center;gap:.5rem">
          Subdivisiones de la cuota
          <span class="badge badge-info" style="font-size:.7rem">${fracciones.length} partes</span>
        </label>
        <table style="width:100%;border-collapse:collapse;font-size:.84rem;margin-top:.375rem">
          <thead>
            <tr style="font-size:.75rem;color:var(--text-muted);border-bottom:1px solid var(--border)">
              <th style="padding:0 .75rem .375rem 0;text-align:center;font-weight:500">Nro.</th>
              <th style="padding:0 .75rem .375rem 0;text-align:right;font-weight:500">Valor</th>
              <th style="padding:0 .75rem .375rem 0;text-align:center;font-weight:500">Fecha propuesta</th>
              <th style="padding:0 0 .375rem;text-align:left;font-weight:500">Notas</th>
            </tr>
          </thead>
          <tbody>
            ${fracciones.map(f => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:.3rem .75rem .3rem 0;text-align:center">${f.numero_fraccion}</td>
                <td style="padding:.3rem .75rem .3rem 0;text-align:right;font-weight:600">${UI.fmt(f.valor_fraccion)}</td>
                <td style="padding:.3rem .75rem .3rem 0;text-align:center">${f.fecha_propuesta ? UI.date(f.fecha_propuesta) : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td style="padding:.3rem 0;color:var(--text-muted);font-size:.81rem">${f.notas || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '';

    const iU = window.SGIUI?.icon("upload-cloud") ?? "";
    const iF = window.SGIUI?.icon("file")          ?? "";

    UI.openModal(cuotaCtx ? `Pagar Cuota #${cuotaCtx.numero_cuota ?? ""}` : "Registrar Pago", `
      <div class="form-grid">
        ${facturaSelectorHTML}
        ${fraccionesHTML}

        <div class="form-group" style="grid-column:1/-1">
          <label>Método de pago *</label>
          <div class="pago-method-tabs">
            <button type="button" class="pago-method-tab active" data-method="transferencia">${window.SGIUI?.icon("smartphone") ?? ""} Electrónico</button>
            <button type="button" class="pago-method-tab" data-method="efectivo">${window.SGIUI?.icon("banknote") ?? ""} Efectivo</button>
            <button type="button" class="pago-method-tab" data-method="permuta">${window.SGIUI?.icon("arrow-left-right") ?? ""} Permuta</button>
          </div>
        </div>

        <div id="pf-fields-transferencia" style="grid-column:1/-1">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label>Fecha del pago *</label>
              <input id="pf_fecha_trans" type="date" value="${hoy}">
            </div>
            <div class="form-group">
              <label>N° cuenta / celular origen</label>
              <input id="pf_cuenta" type="text" placeholder="Ej: 3001234567">
            </div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Referencia / N° transacción *</label>
            <input id="pf_ref_trans" type="text" placeholder="Ej: TRF-123456">
          </div>
          <div class="form-group">
            <label>Comprobante de pago (baucher)</label>
            <div class="baucher-upload-area" id="pf-baucher-area">
              <input type="file" id="pf-baucher-input" accept="image/jpeg,image/png,image/webp,application/pdf">
              <div id="pf-baucher-empty">
                <div class="baucher-upload-icon">${iU}</div>
                <div class="baucher-upload-label">Arrastra el baucher aquí o haz clic para subir</div>
                <button type="button" class="btn btn-ghost btn-sm" id="pf-baucher-click">${iU} Subir archivo</button>
              </div>
              <div id="pf-baucher-preview" style="display:none"></div>
            </div>
          </div>
        </div>

        <div id="pf-fields-efectivo" style="grid-column:1/-1;display:none">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label>Fecha de recepción *</label>
              <input id="pf_fecha_efect" type="date" value="${hoy}">
            </div>
            <div class="form-group">
              <label>N° recibo físico *</label>
              <input id="pf_ref_efect" type="text" placeholder="Ej: RC-001">
            </div>
          </div>
          <div class="form-group">
            <label>Observaciones</label>
            <textarea id="pf_obs_efect" rows="2" style="resize:vertical;min-height:4rem" placeholder="Detalles adicionales del recibo en efectivo"></textarea>
          </div>
        </div>

        <div id="pf-fields-permuta" style="grid-column:1/-1;display:none">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label>Fecha de la permuta *</label>
              <input id="pf_fecha_perm" type="date" value="${hoy}">
            </div>
            <div class="form-group">
              <label>N° documento / referencia</label>
              <input id="pf_ref_perm" type="text" placeholder="Ej: CONT-001">
            </div>
          </div>
          <div class="form-group">
            <label>Descripción del bien o activo *</label>
            <textarea id="pf_desc_perm" rows="2" style="resize:vertical;min-height:4rem" placeholder="Ej: Vehículo Toyota Corolla 2020, placas ABC123"></textarea>
          </div>
        </div>

        <div class="form-group" style="grid-column:1/-1">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--border)">
            <span style="color:var(--text-muted)">Valor a pagar:</span>
            <strong id="pf_valor" style="font-size:1.1rem">${cuotaFactura ? UI.fmt(cuotaFactura.valor_facturado) : "—"}</strong>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button id="pf_btn_guardar" class="btn btn-primary" onclick="guardarPago()">Guardar</button>
      </div>`);

    document.querySelectorAll(".pago-method-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pago-method-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const m = btn.dataset.method;
        document.getElementById("pf-fields-transferencia").style.display = m === "transferencia" ? "block" : "none";
        document.getElementById("pf-fields-efectivo").style.display      = m === "efectivo"      ? "block" : "none";
        document.getElementById("pf-fields-permuta").style.display       = m === "permuta"       ? "block" : "none";
      });
    });

    _wireBaucherAdmin();

    if (!cuotaFactura) {
      document.getElementById("pf_factura_lista")?.addEventListener("change", e => {
        if (e.target.type !== "radio") return;
        document.getElementById("pf_id_factura").value  = e.target.value;
        document.getElementById("pf_valor").textContent = UI.fmt(+e.target.dataset.valor);
      });
      if (facturas.length === 1) {
        const onlyRadio = document.querySelector("#pf_factura_lista input[type=radio]");
        if (onlyRadio) {
          onlyRadio.checked = true;
          document.getElementById("pf_id_factura").value  = onlyRadio.value;
          document.getElementById("pf_valor").textContent = UI.fmt(+onlyRadio.dataset.valor);
        }
      }
    }
  };

  window.guardarPago = async function() {
    const id_factura = document.getElementById("pf_id_factura")?.value;
    const metodo     = document.querySelector(".pago-method-tab.active")?.dataset.method || "transferencia";

    if (!id_factura) return UI.toast("Seleccione una factura", "error");

    const factura = (window._pagoFacturas || []).find(f => String(f.id_factura) === String(id_factura));
    if (!factura?.id_cuota) return UI.toast("No se encontró la cuota de la factura seleccionada", "error");

    let fecha_pago, referencia, numero_cuenta_origen = null;

    if (metodo === "transferencia") {
      fecha_pago           = document.getElementById("pf_fecha_trans")?.value;
      referencia           = document.getElementById("pf_ref_trans")?.value.trim();
      numero_cuenta_origen = document.getElementById("pf_cuenta")?.value.trim() || null;
      if (!fecha_pago) return UI.toast("Ingrese la fecha del pago", "error");
      if (!referencia) return UI.toast("La referencia de la transacción es obligatoria", "error");
    } else if (metodo === "efectivo") {
      fecha_pago     = document.getElementById("pf_fecha_efect")?.value;
      const ref      = document.getElementById("pf_ref_efect")?.value.trim();
      const obs      = document.getElementById("pf_obs_efect")?.value.trim();
      if (!fecha_pago) return UI.toast("Ingrese la fecha de recepción", "error");
      if (!ref)        return UI.toast("El número de recibo físico es obligatorio", "error");
      referencia = obs ? `${ref} — ${obs}` : ref;
    } else if (metodo === "permuta") {
      fecha_pago   = document.getElementById("pf_fecha_perm")?.value;
      const desc   = document.getElementById("pf_desc_perm")?.value.trim();
      const ref    = document.getElementById("pf_ref_perm")?.value.trim();
      if (!fecha_pago) return UI.toast("Ingrese la fecha de la permuta", "error");
      if (!desc)       return UI.toast("Ingrese la descripción del bien o activo", "error");
      referencia = ref ? `${desc} — ${ref}` : desc;
    }

    const btn = document.getElementById("pf_btn_guardar");
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }

    let url_baucher = null;
    if (metodo === "transferencia" && _baucherFile) {
      if (btn) btn.textContent = "Subiendo baucher...";
      try {
        let token = localStorage.getItem("fb_token") || "";
        try {
          const fbUser = window._firebaseAuth?.currentUser;
          if (fbUser) token = await fbUser.getIdToken(false);
        } catch (_) {}
        const fd = new FormData();
        fd.append("baucher", _baucherFile);
        const res = await fetch("/api/v1/uploads/baucher", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) throw new Error(`Error ${res.status} al subir el baucher`);
        const d = await res.json().catch(() => null);
        if (!d?.url) throw new Error("El servidor no devolvió la URL del baucher");
        url_baucher = d.url;
        _baucherUrl = url_baucher;
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = "Guardar"; }
        UI.toast(e.message || "Error al subir el baucher", "error");
        return;
      }
    }

    if (btn) btn.textContent = "Guardando...";

    const cuotas = [{ id_cuota: factura.id_cuota, id_factura: factura.id_factura, valor_aplicado: Number(factura.valor_facturado) }];

    try {
      await API.post("/pagos", {
        fecha_pago,
        metodo_pago:          metodo,
        referencia:           referencia || null,
        cuotas,
        url_baucher:          url_baucher          || null,
        numero_cuenta_origen: numero_cuenta_origen || null,
      });
      UI.closeModal();
      UI.toast("Pago registrado. Recibo generado automáticamente.", "ok");
      if (pagoOrigen === "cuotas" && typeof window.cuotasView === "function") {
        window.cuotasView();
      } else {
        loadPagosView();
      }
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = "Guardar"; }
      UI.toast(e.message || "Error al registrar el pago.", "error");
    }
  };

  // ── Upload view (comprador) ───────────────────────────────────────────────────

  function pagosUploadView() {
    if (typeof window.compradorRecibosView === "function") {
      window.compradorRecibosView();
      return;
    }
    const vc = document.getElementById("viewContainer");
    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header"><h3>Registrar Pago</h3></div>
        <div style="padding:24px 0">
          <p style="color:var(--text-muted);margin-bottom:16px">
            Selecciona la factura que deseas pagar y registra el comprobante.
          </p>
          <button class="btn btn-primary" onclick="pagoForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar Pago</button>
        </div>
      </div>`;
  }

  // ── Entry point ───────────────────────────────────────────────────────────────

  window.pagosView = async function() {
    if (AppState.can("pagos", "crear"))     return loadPagosView();
    if (AppState.can("mis_pagos", "crear")) return pagosUploadView();
    return loadPagosView();
  };

})();
