(function () {

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
            <span id="pfg-arrow-${key}" style="display:inline-flex;align-items:center;width:12px;margin-right:4px"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
            Venta #${g.id_venta ?? "—"} &mdash; <span style="font-weight:500">${g.comprador}</span> &bull; ${g.proyecto} &bull; ${g.codigo_lote}
          </span>
          <span style="font-size:.75rem;font-weight:600;background:var(--border);padding:1px 7px;border-radius:10px;color:var(--text-muted)">
            ${count} factura${count !== 1 ? "s" : ""}
          </span>
        </div>
        <div id="pfg-body-${key}" style="display:none">
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
      const total = g.pagos.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
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
      return `<tr>
        <td style="font-family:monospace;font-size:.82rem;white-space:nowrap">${p.numero_pago || `#${p.id_pago}`}</td>
        <td>${UI.date(p.fecha_pago)}</td>
        <td style="text-align:right;font-weight:600">${UI.fmt(p.valor_pago)}</td>
        <td>${p.metodo_pago || "—"}</td>
        <td style="font-family:monospace;font-size:.82rem;white-space:nowrap">${fmtFactNum(p.numero_factura)}</td>
        <td>${p.numero_cuota != null ? `#${p.numero_cuota}` : "—"}</td>
        <td style="max-width:120px;font-size:.82rem">${p.referencia || "—"}</td>
        <td>${p.estado ? UI.badge(p.estado) : "—"}</td>
        <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${p.numero_recibo || "—"}</td>
      </tr>`;
    }

    const totalPagado = grupo.pagos.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

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

  window.pagoForm = async function(idVentaCtx = null) {
    let facturas = [];
    try {
      const todas = await API.get("/facturas");
      facturas = todas.filter(f => f.estado === "emitida");
      if (idVentaCtx) facturas = facturas.filter(f => f.id_venta === idVentaCtx);
    } catch (e) { facturas = []; }
    window._pagoFacturas = facturas;

    const ctxLabel = idVentaCtx
      ? ` <span style="color:var(--text-muted);font-weight:400;font-size:.79rem">— Venta #${idVentaCtx}</span>`
      : "";

    UI.openModal("Registrar Pago", `
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label>Factura a pagar *${ctxLabel}</label>
          <input type="text" id="pf_factura_buscar" placeholder="Filtrar por comprador o lote..."
                 oninput="_filtrarFacturasPago()" autocomplete="off" style="margin-bottom:6px">
          <input type="hidden" id="pf_id_factura">
          <div id="pf_factura_lista"
               style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">
            ${facturasListaHTML(facturas, "")}
          </div>
        </div>
        <div class="form-group">
          <label>Fecha *</label>
          <input id="pf_fecha" type="date" value="${new Date().toISOString().split("T")[0]}">
        </div>
        <div class="form-group">
          <label>Método de pago *</label>
          <select id="pf_metodo">
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Referencia</label>
          <input id="pf_ref" placeholder="Nro. comprobante o transacción">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--border)">
            <span style="color:var(--text-muted)">Valor a pagar:</span>
            <strong id="pf_valor" style="font-size:1.1rem">—</strong>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button id="pf_btn_guardar" class="btn btn-primary" onclick="guardarPago()">Guardar</button>
      </div>`);

    document.getElementById("pf_factura_lista")?.addEventListener("change", e => {
      if (e.target.type !== "radio") return;
      document.getElementById("pf_id_factura").value  = e.target.value;
      document.getElementById("pf_valor").textContent = UI.fmt(+e.target.dataset.valor);
    });
  };

  window.guardarPago = async function() {
    const id_factura  = document.getElementById("pf_id_factura")?.value;
    const fecha_pago  = document.getElementById("pf_fecha")?.value;
    const metodo_pago = document.getElementById("pf_metodo")?.value;
    const referencia  = document.getElementById("pf_ref")?.value.trim();

    if (!id_factura) return UI.toast("Seleccione una factura", "error");
    if (!fecha_pago) return UI.toast("Ingrese la fecha de pago", "error");

    const btn = document.getElementById("pf_btn_guardar");
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }

    try {
      await API.post("/pagos", { fecha_pago, metodo_pago, referencia: referencia || null, id_factura: +id_factura });
      UI.closeModal();
      UI.toast("Pago registrado. Recibo generado automáticamente.", "ok");
      loadPagosView();
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
