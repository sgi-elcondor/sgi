(function () {

  // Tracks which view opened the payment modal, to refresh the right one afterwards
  let pagoOrigen   = "pagos";
  let _baucherFile = null;
  let _baucherUrl  = null;
  let _pagosAll    = [];

  const EXPORT_ROLES = ["admin", "gerencia", "auxiliar_contable"];

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
      if (!gs.has(k)) gs.set(k, { id_venta: f.id_venta, codigo_venta: f.codigo_venta, comprador: f.comprador, proyecto: f.proyecto, codigo_lote: f.codigo_lote, facturas: [] });
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
            Venta ${SGIUI.ventaCode(g)} &mdash; <span style="font-weight:500">${g.comprador}</span> &bull; ${g.proyecto} &bull; ${g.codigo_lote}
          </span>
          <span style="font-size:.75rem;font-weight:600;background:var(--border);padding:1px 7px;border-radius:10px;color:var(--text-muted)">
            ${count} factura${count !== 1 ? "s" : ""}
          </span>
        </div>
        <div id="pfg-body-${key}" style="display:block">
          ${g.facturas.map(f => `
            <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-top:1px solid var(--border);cursor:pointer">
              <input type="radio" name="factura_sel" value="${f.id_factura}"
                data-valor="${f.valor_a_pagar ?? f.valor_facturado}" style="flex-shrink:0">
              <span style="flex:1;font-size:.83rem;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                <span>
                  Factura <strong>${fmtFactNum(f.numero_factura)}</strong>
                  &bull; Cuota #${f.numero_cuota ?? "—"}
                  &bull; Vence: ${UI.date(f.fecha_vencimiento)}
                </span>
                <span style="font-weight:600;white-space:nowrap">${UI.fmt(f.valor_a_pagar ?? f.valor_facturado)}</span>
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

    _pagosAll = data;
    const canExport = EXPORT_ROLES.includes(window.currentUser?.rol);

    window._pagosMap = {};
    data.forEach(p => { window._pagosMap[p.id_pago] = p; });

    const ventasMap = new Map();
    data.forEach(p => {
      const key = p.id_venta ?? "none";
      if (!ventasMap.has(key)) {
        ventasMap.set(key, { id_venta: p.id_venta, codigo_venta: p.codigo_venta, comprador: p.comprador, proyecto: p.proyecto, codigo_lote: p.codigo_lote, pagos: [] });
      }
      ventasMap.get(key).pagos.push(p);
    });

    const grupos = [...ventasMap.values()].sort((a, b) => (b.id_venta || 0) - (a.id_venta || 0));
    window._pagosGrupos = grupos;

    const proyectos    = [...new Set(grupos.map(g => g.proyecto))].filter(p => p !== "—").sort();
    const optsProyecto = proyectos.map(p => `<option value="${p}">${p}</option>`).join("");

    function filaVenta(g) {
      const total = g.pagos.filter(p => p.estado === 'aceptado' && p.numero_recibo).reduce((s, p) => s + Number(p.valor_pago || 0), 0);
      return `<tr data-grupo-key="${g.id_venta ?? "none"}" style="cursor:pointer">
        <td>${g.id_venta ? `<strong>${SGIUI.ventaCode(g)}</strong>` : "—"}</td>
        <td>${g.comprador}</td>
        <td>${g.proyecto !== "—" ? `${g.proyecto} · <strong>${g.codigo_lote}</strong>` : "—"}</td>
        <td style="text-align:center"><strong>${g.pagos.length}</strong></td>
        <td style="text-align:right">${UI.fmt(total)}</td>
        <td><button class="btn btn-ghost btn-sm btn-ver-pagos">Ver <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></td>
      </tr>`;
    }

    const aceptados  = data.filter(p => p.estado === "aceptado");
    const enRevision = data.filter(p => p.estado === "pendiente_revision").length;
    const valorAcept = aceptados.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    vc.innerHTML = `
      ${window.SGIUI.statCards([
        { label: "Pagos",          value: data.length,        sub: "Total registrados" },
        { label: "Aceptados",      value: aceptados.length,   sub: "Validados" },
        { label: "En revisión",    value: enRevision,         sub: "Pendientes de validar", tone: enRevision ? "warning" : "" },
        { label: "Valor aceptado", value: window.SGIUI.fmtCompactMoney(valorAcept), title: UI.fmt(valorAcept), sub: "Ingresos confirmados" },
      ])}
      <div class="table-wrap">
        <div class="table-header">
          <div class="table-header-titles">
            <h3>Pagos por Venta</h3>
            <span class="count-chip" id="pv-count">${grupos.length} venta${grupos.length === 1 ? "" : "s"}</span>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
            ${canExport ? `
              <button class="btn btn-ghost btn-sm" id="pv-export-excel">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Exportar Excel
              </button>
              <button class="btn btn-ghost btn-sm" id="pv-export-pdf">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9" x2="10" y2="9"/></svg>
                Exportar PDF
              </button>` : ""}
            ${canWrite ? `<button class="btn btn-primary btn-sm" onclick="pagoForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar Pago</button>` : ""}
          </div>
        </div>
        ${window.SGIUI.filterBar({
          fields: [
            { type: "select", id: "pv-proyecto", label: "Proyecto",
              options: [{ value: "", label: "Todos los proyectos" }, ...proyectos.map(p => ({ value: p, label: p }))] },
            { type: "select", id: "pv-estado", label: "Estado del pago", options: [
              { value: "", label: "Todos" },
              { value: "aceptado", label: "Aceptado" },
              { value: "pendiente_revision", label: "En revisión" },
              { value: "rechazado", label: "Rechazado" },
            ] },
            { type: "search", id: "pv-comprador", label: "Buscar", placeholder: "Comprador, lote, proyecto o N° de pago…", grow: true },
          ],
          actions: `<button class="btn btn-ghost btn-sm" id="pv-limpiar">Limpiar</button>`,
        })}
        <div class="sticky-table-scroll">
          <table>
            <thead><tr>
              <th>Venta</th><th>Comprador</th><th>Proyecto / Lote</th>
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
      const fEstado   = document.getElementById("pv-estado").value;
      const fBuscar   = document.getElementById("pv-comprador").value;
      const visibles  = grupos.filter(g => {
        if (fProyecto && g.proyecto !== fProyecto) return false;
        if (fEstado && !g.pagos.some(p => p.estado === fEstado)) return false;
        const nums = g.pagos.map(p => p.numero_pago || "").join(" ");
        if (!SGISearch.matches(fBuscar, g.comprador, g.codigo_lote, g.proyecto, nums)) return false;
        return true;
      });
      tbody.innerHTML = visibles.map(filaVenta).join("");
      document.getElementById("pagos-grupos-empty").style.display = visibles.length ? "none" : "block";
      const cnt = document.getElementById("pv-count");
      if (cnt) cnt.textContent = `${visibles.length} venta${visibles.length === 1 ? "" : "s"}`;
    }

    document.getElementById("pv-proyecto").addEventListener("change", aplicarFiltros);
    document.getElementById("pv-estado").addEventListener("change", aplicarFiltros);
    document.getElementById("pv-comprador").addEventListener("input", aplicarFiltros);
    document.getElementById("pv-limpiar").addEventListener("click", () => {
      ["pv-proyecto", "pv-estado", "pv-comprador"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
      aplicarFiltros();
    });

    if (canExport) {
      document.getElementById("pv-export-excel")?.addEventListener("click", () => exportPagosExcel(_pagosVisibles()));
      document.getElementById("pv-export-pdf")?.addEventListener("click", () => exportPagosPDF(_pagosVisibles()));
    }

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
    <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="verPagoDetalle(${p.id_pago})">Ver</button></td>
  </tr>`;
}

    const totalPagado = grupo.pagos
      .filter(p => p.estado === 'aceptado' && p.numero_recibo)
      .reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="_volverPagosView()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Volver</button>
            <h3>Pagos &mdash; Venta ${grupo.id_venta ? SGIUI.ventaCode(grupo) : "sin venta"}</h3>
          </div>
          ${canWrite ? `<button class="btn btn-primary btn-sm" onclick="pagoForm(${grupo.id_venta ?? "null"})"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar Pago</button>` : ""}
        </div>
        <div style="background:var(--surface-2,#f0f4f8);border-radius:8px;padding:12px 16px;margin-bottom:1rem;font-size:.88rem;display:flex;gap:24px;flex-wrap:wrap">
          <span><span style="color:var(--text-muted)">Cliente:</span> <strong>${grupo.comprador}</strong></span>
          <span><span style="color:var(--text-muted)">Proyecto:</span> <strong>${grupo.proyecto}</strong></span>
          <span><span style="color:var(--text-muted)">Lote:</span> <strong>${grupo.codigo_lote}</strong></span>
          <span><span style="color:var(--text-muted)">Total pagado:</span> <strong>${UI.fmt(totalPagado)}</strong></span>
        </div>
        <div class="sticky-table-scroll">
          <table>
            <thead><tr>
              <th>N° Pago</th><th>Fecha</th><th style="text-align:right">Valor</th><th>Método</th>
              <th>Factura</th><th>Cuota</th><th>Referencia</th><th>Estado</th><th>Recibo</th><th></th>
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

  // ── Payment detail (Task 14) ────────────────────────────────────────────────────
  // Shows the baucher photo, the payment data and lets the aux open the linked factura and
  // recibo PDFs, reusing the existing builders (verFacturaPDF / verReciboPDF). RN-02: the
  // recibo only exists once the pago is accepted.
  window.verPagoDetalle = async function(idPago, opts = {}) {
    UI.openModal("Detalle del pago", UI.loader());

    // RN-19: the comprador opens their own pago via the mis-pagos endpoint; the aux via /pagos.
    const endpoint = opts.mine ? `/pagos/mis-pagos/${idPago}` : `/pagos/${idPago}`;
    let p;
    try { p = await API.get(endpoint); }
    catch (e) {
      const eb = document.getElementById("modalBody");
      if (eb) eb.innerHTML = `<p style="color:var(--danger);padding:1rem">${e.message}</p>`;
      return;
    }

    window._pagoDetalleActual = p;
    if (p.factura) { window._facturasMap = window._facturasMap || {}; window._facturasMap[p.factura.id_factura] = p.factura; }
    if (p.recibo)  { window._recibosMap  = window._recibosMap  || {}; window._recibosMap[p.recibo.id_recibo]   = p.recibo; }

    const metodoLabel = {
      transferencia: "Transferencia / electrónico",
      efectivo:      "Efectivo",
      cheque:        "Cheque",
      permuta:       "Permuta",
    }[p.metodo_pago] || (p.metodo_pago || "—");

    const baucher = p.url_baucher;
    const esPdf   = baucher && /\.pdf($|\?)/i.test(baucher);
    const baucherHTML = baucher
      ? (esPdf
          ? `<a href="${baucher}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Abrir comprobante (PDF)</a>`
          : `<a href="${baucher}" target="_blank" rel="noopener" title="Abrir en tamaño completo" style="display:block">
               <img src="${baucher}" alt="Comprobante de pago" style="max-width:100%;max-height:340px;border:1px solid var(--border);border-radius:8px;object-fit:contain;background:var(--surface-2,#f0f4f8)">
             </a>`)
      : `<div style="padding:1rem;border:1px dashed var(--border);border-radius:8px;color:var(--text-muted);font-size:.85rem;text-align:center">Sin comprobante adjunto</div>`;

    const row = (label, value) => `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:1px solid var(--border);font-size:.86rem">
        <span style="color:var(--text-muted)">${label}</span>
        <span style="font-weight:600;text-align:right">${value}</span>
      </div>`;

    const facturaBtn = p.factura
      ? `<button class="btn btn-ghost btn-sm" onclick="_verFacturaDesdePago()">Ver factura (PDF)</button>`
      : `<span style="font-size:.8rem;color:var(--text-muted)">Sin factura vinculada</span>`;
    const reciboBtn = p.recibo
      ? `<button class="btn btn-ghost btn-sm" onclick="_verReciboDesdePago()">Ver recibo (PDF)</button>`
      : `<span style="font-size:.8rem;color:var(--text-muted)">${p.estado === "aceptado" ? "Recibo no disponible" : "El recibo se genera al aceptar el pago"}</span>`;

    const body = document.getElementById("modalBody");
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <strong style="font-family:monospace">${p.numero_pago || `#${p.id_pago}`}</strong>
        ${p.estado ? UI.badge(p.estado) : ""}
        <span style="color:var(--text-muted);font-size:.84rem">Venta ${SGIUI.ventaCode(p)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
        <div>
          <div style="font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);font-weight:700;margin-bottom:8px">Comprobante (baucher)</div>
          ${baucherHTML}
        </div>
        <div>
          ${row("Fecha del pago", UI.date(p.fecha_pago))}
          ${row("Valor", UI.fmt(p.valor_pago))}
          ${row("Método", metodoLabel)}
          ${p.numero_cuenta_origen ? row("Cuenta / Cel. origen", p.numero_cuenta_origen) : ""}
          ${row("Referencia", p.referencia || "—")}
          ${row("Cuota", p.numero_cuota != null ? `#${p.numero_cuota}` : "—")}
          ${row("Factura", fmtFactNum(p.factura?.numero_factura))}
          ${row("Recibo", p.recibo?.numero_recibo || "—")}
          ${row("Comprador", p.comprador || "—")}
          ${row("Proyecto / Lote", `${p.proyecto || "—"} · ${p.codigo_lote || "—"}`)}
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
        ${facturaBtn}
        <button class="btn btn-ghost btn-sm" onclick="_verPagoDesdePago()">Ver pago (PDF)</button>
        ${reciboBtn}
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="UI.closeModal()">Cerrar</button>
      </div>`;
  };

  window._verFacturaDesdePago = function() {
    const p = window._pagoDetalleActual;
    if (!p?.factura) return UI.toast("Sin factura vinculada", "error");
    window._facturasMap = window._facturasMap || {};
    window._facturasMap[p.factura.id_factura] = p.factura;
    if (typeof window.verFacturaPDF === "function") window.verFacturaPDF(p.factura.id_factura);
    else UI.toast("No se pudo abrir la factura", "error");
  };

  window._verReciboDesdePago = function() {
    const p = window._pagoDetalleActual;
    if (!p?.recibo) return UI.toast("Sin recibo vinculado", "error");
    window._recibosMap = window._recibosMap || {};
    window._recibosMap[p.recibo.id_recibo] = p.recibo;
    if (typeof window.verReciboPDF === "function") window.verReciboPDF(p.recibo.id_recibo);
    else UI.toast("No se pudo abrir el recibo", "error");
  };

  function _buildPagoHTML(p) {
    const metodoLabel = {
      transferencia: "Transferencia / electrónico",
      efectivo:      "Efectivo",
      cheque:        "Cheque",
      permuta:       "Permuta",
    }[p.metodo_pago] || (p.metodo_pago || "—");

    const estadoInfo = {
      aceptado:            { label: "Aceptado",    badge: "success" },
      pendiente_revision:  { label: "En revisión", badge: "warning" },
      rechazado:           { label: "Rechazado",   badge: "danger" },
    }[p.estado] || { label: (p.estado || "—"), badge: "muted" };

    const valor      = Number(p.valor_pago || 0);
    const valorTxt   = "$ " + valor.toLocaleString("es-CO", { minimumFractionDigits: 0 });
    const valorWords = (window.SGIExport && window.SGIExport.numToWordsES)
      ? window.SGIExport.numToWordsES(valor)
      : "";

    const fmtD = (window.SGIExport && window.SGIExport.fmtDate) ? window.SGIExport.fmtDate : (x => x || "");
    const fechaPago = fmtD(p.fecha_pago);

    const waNumber = (window.SGIExport && window.SGIExport.CONTACT && window.SGIExport.CONTACT.whatsapp) || "573001234567";
    const waMsg    = `Hola, quiero obtener mas informacion acerca del pago: ${p.numero_pago || ""} por un valor de: ${valorTxt} realizado en la fecha: ${fechaPago} a nombre de: ${p.comprador || ""}.`.trim();
    const waUrl    = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
    const qrUrl    = window.SGIExport.qrDataUri(waUrl);

    return window.SGIExport.comprobanteHTML({
      docTitle: `Pago ${p.numero_pago || ""} — El Cóndor S.A.S.`,
      badge:    "Registro de Pago",
      fields: [
        { icon: "check",    label: "Estado del pago",     value: estadoInfo.label, badge: estadoInfo.badge },
        { icon: "hash",     label: "N° de pago",          value: p.numero_pago },
        { icon: "user",     label: "Comprador",           value: p.comprador },
        { icon: "briefcase",label: "N° de venta",         value: p.id_venta != null ? SGIUI.ventaCode(p) : "" },
        { icon: "pin",      label: "Proyecto / Lote",     value: [p.proyecto, p.codigo_lote].filter(x => x && x !== "—").join(" · ") },
        { icon: "calendar", label: "Fecha del pago",      value: fechaPago },
        { icon: "card",     label: "Método",              value: p.metodo_pago ? metodoLabel : "" },
        { icon: "coins",    label: "Cuenta / Cel. origen",value: p.numero_cuenta_origen },
        { icon: "tag",      label: "Referencia",          value: p.referencia },
      ],
      trace: [
        { label: "Cuota",   value: p.numero_cuota != null ? `#${p.numero_cuota}` : "" },
        { label: "Factura", value: p.factura?.numero_factura ? fmtFactNum(p.factura.numero_factura) : "" },
        { label: "Pago",    value: p.numero_pago || "", current: true },
        { label: "Recibo",  value: p.recibo?.numero_recibo || "" },
      ],
      totalLabel: "Valor del pago",
      totalValue: valorTxt,
      totalWords: valorWords,
      qrUrl,
      qrCaption: "<strong>¿Dudas con este pago?</strong><br>Escanea el código QR para escribirnos por WhatsApp.",
    });
  }

  function _openPagoPDF(p) {
    if (!p) return UI.toast("Sin datos del pago", "error");
    if (!(window.SGIExport && window.SGIExport.comprobanteHTML)) return UI.toast("No se pudo generar el comprobante", "error");
    const win = window.open("", "_blank", "width=780,height=720,scrollbars=yes");
    if (!win) return UI.toast("El navegador bloqueó la ventana emergente. Permita ventanas emergentes para este sitio.", "error");
    win.document.write(_buildPagoHTML(p));
    win.document.close();
  }

  window._verPagoDesdePago = function() {
    _openPagoPDF(window._pagoDetalleActual);
  };

  // Direct PDF access from a list (e.g. the comprador's "Mis Pagos"), without
  // opening the detail modal first. Reuses the same detail endpoint to guarantee
  // the full document chain is available. RN-19: comprador uses { mine: true }.
  window.verPagoPDF = async function(idPago, opts = {}) {
    const cached = window._pagoDetalleActual;
    if (cached && cached.id_pago === idPago) return _openPagoPDF(cached);
    const endpoint = opts.mine ? `/pagos/mis-pagos/${idPago}` : `/pagos/${idPago}`;
    let p;
    try { p = await API.get(endpoint); }
    catch (e) { return UI.toast(e.message || "No se pudo cargar el pago", "error"); }
    _openPagoPDF(p);
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

    const ctxCode = idVentaCtx
      ? (facturas.find(f => f.id_venta === idVentaCtx)?.codigo_venta || `#${idVentaCtx}`)
      : "";
    const ctxLabel = idVentaCtx && !cuotaCtx
      ? ` <span style="color:var(--text-muted);font-weight:400;font-size:.79rem">— Venta ${ctxCode}</span>`
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
          <div class="form-group">
            <label>Referencia / N° transacción *</label>
            <input id="pf_ref_trans" type="text" placeholder="Ej: TRF-123456">
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
          <label id="pf-baucher-label">Comprobante de pago (baucher)</label>
          <div class="baucher-upload-area" id="pf-baucher-area">
            <input type="file" id="pf-baucher-input" accept="image/jpeg,image/png,image/webp,application/pdf">
            <div id="pf-baucher-empty">
              <div class="baucher-upload-icon">${iU}</div>
              <div class="baucher-upload-label">Arrastra el soporte aquí o haz clic para subir</div>
              <button type="button" class="btn btn-ghost btn-sm" id="pf-baucher-click">${iU} Subir archivo</button>
            </div>
            <div id="pf-baucher-preview" style="display:none"></div>
          </div>
        </div>

        <div class="form-group" style="grid-column:1/-1">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--border)">
            <span style="color:var(--text-muted)">Valor a pagar:</span>
            <strong id="pf_valor" style="font-size:1.1rem">${cuotaFactura ? UI.fmt(cuotaFactura.valor_a_pagar ?? cuotaFactura.valor_facturado) : "—"}</strong>
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
        const lbl = document.getElementById("pf-baucher-label");
        if (lbl) lbl.textContent = m === "transferencia" ? "Comprobante de pago (baucher)" : "Imagen de soporte (opcional)";
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
    if (_baucherFile) {
      if (btn) btn.textContent = "Subiendo soporte...";
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

    const cuotas = [{ id_cuota: factura.id_cuota, id_factura: factura.id_factura, valor_aplicado: Number(factura.valor_a_pagar ?? factura.valor_facturado) }];

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
      UI.toast("Pago registrado. Queda en revisión: acéptalo en Validación de pagos para emitir el recibo.", "ok");
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

  // ── Exportación ───────────────────────────────────────────────────────────────

  // Payments matching the master list filters, at the pago grain.
  function _pagosVisibles() {
    const fProyecto = document.getElementById("pv-proyecto")?.value || "";
    const fEstado   = document.getElementById("pv-estado")?.value || "";
    const fBuscar   = document.getElementById("pv-comprador")?.value || "";
    return _pagosAll.filter(p => {
      if (fProyecto && p.proyecto !== fProyecto) return false;
      if (fEstado && p.estado !== fEstado) return false;
      if (!SGISearch.matches(fBuscar, p.comprador, p.codigo_lote, p.proyecto, p.numero_pago || "", SGIUI.ventaCode(p))) return false;
      return true;
    });
  }

  function _cuotaLabelExport(p) {
    if (p.tipo_pago === "abono_extraordinario") return "Abono al total";
    return p.numero_cuota != null ? `#${p.numero_cuota}` : "—";
  }

  async function exportPagosExcel(rows) {
    if (window.SGILibs) await window.SGILibs.ensureExport();
    const SX = window.SGIExport.xlsx;
    const wb = SX.setup();

    const aceptados  = rows.filter(p => p.estado === "aceptado");
    const enRevision = rows.filter(p => p.estado === "pendiente_revision").length;
    const valorAcept = aceptados.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    const ws = wb.addWorksheet("Pagos", { tabColor: { argb: SX.C.primary } });
    ws.columns = [
      { width: 16 }, { width: 28 }, { width: 22 }, { width: 16 }, { width: 20 },
      { width: 14 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 12 },
      { width: 22 }, { width: 18 }, { width: 20 },
    ];

    SX.masthead(ws, {
      title:     "Pagos Registrados",
      subtitle:  "Estado actual aplicando los filtros activos al momento de exportar",
      mergeCols: 13,
    });

    SX.kpiRow(ws, [
      { label: "Pagos",          value: rows.length },
      { label: "Aceptados",      value: aceptados.length },
      { label: "En revisión",    value: enRevision },
      { label: "Valor aceptado", value: valorAcept, money: true },
    ]);

    ws.addRow([]).height = 4;
    const hRow = ws.addRow([
      "Venta", "Comprador", "Proyecto", "Lote", "N° Pago", "Fecha", "Valor",
      "Método", "Factura", "Cuota", "Referencia", "Estado", "Recibo",
    ]);
    SX.styleHeader(hRow);
    const headerRowNum = hRow.number;

    rows.forEach((p, i) => {
      const r = ws.addRow([
        p.id_venta ? SGIUI.ventaCode(p) : "—",
        p.comprador   || "—",
        p.proyecto    || "—",
        p.codigo_lote || "—",
        p.numero_pago || `#${p.id_pago}`,
        p.fecha_pago ? UI.date(p.fecha_pago) : "—",
        Number(p.valor_pago || 0),
        p.metodo_pago || "—",
        fmtFactNum(p.numero_factura),
        _cuotaLabelExport(p),
        p.referencia || "—",
        p.estado || "—",
        p.numero_recibo || "—",
      ]);
      SX.styleBody(r, i % 2 !== 0);
      r.getCell(7).numFmt = SX.NF.money;
      r.getCell(7).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    });

    ws.views = [{ state: "frozen", ySplit: headerRowNum }];
    ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: 13 } };

    await SX.download(wb, `pagos_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportPagosPDF(rows) {
    if (window.SGILibs) await window.SGILibs.ensureExport();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const SX  = window.SGIExport.pdf;

    const aceptados  = rows.filter(p => p.estado === "aceptado");
    const enRevision = rows.filter(p => p.estado === "pendiente_revision").length;
    const valorAcept = aceptados.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
    const valorTotal = rows.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    let y = SX.brand(doc);
    y = SX.title(doc, y + 2, {
      title:    "Pagos Registrados",
      subtitle: `${rows.length} pago${rows.length === 1 ? "" : "s"} en la vista exportada`,
    });
    y = SX.kpiCards(doc, y + 2, [
      { label: "Pagos",          value: String(rows.length),      desc: "Registrados en la vista" },
      { label: "Aceptados",      value: String(aceptados.length), desc: "Validados" },
      { label: "En revisión",    value: String(enRevision),       desc: "Pendientes de validar" },
      { label: "Valor aceptado", value: UI.fmt(valorAcept),       desc: "Ingresos confirmados" },
    ], { perRow: 4 });
    y = SX.section(doc, y + 6, { kicker: "Detalle", title: "Listado de pagos" });

    doc.autoTable({
      startY: y,
      head: [["Venta", "Comprador", "Proyecto / Lote", "N° Pago", "Fecha", "Valor", "Método", "Estado", "Recibo"]],
      body: rows.map(p => [
        p.id_venta ? SGIUI.ventaCode(p) : "—",
        p.comprador || "—",
        `${p.proyecto || "—"}${p.codigo_lote ? " · " + p.codigo_lote : ""}`,
        p.numero_pago || `#${p.id_pago}`,
        p.fecha_pago ? UI.date(p.fecha_pago) : "—",
        UI.fmt(p.valor_pago),
        p.metodo_pago || "—",
        p.estado || "—",
        p.numero_recibo || "—",
      ]),
      foot: [[
        `Total · ${rows.length} pago${rows.length === 1 ? "" : "s"}`,
        "", "", "", "",
        UI.fmt(valorTotal),
        "", "", "",
      ]],
      showFoot: "lastPage",
      ...SX.tableTheme(),
      footStyles: SX.footStyles(),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 42 },
        2: { cellWidth: 44 },
        3: { cellWidth: 32 },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 28, halign: "right"  },
        6: { cellWidth: 22, halign: "center" },
        7: { cellWidth: 24, halign: "center" },
        8: { cellWidth: 30 },
      },
      ...SX.statusColumn(7, e => {
        const n = String(e).toLowerCase();
        if (n.includes("aceptado"))  return "success";
        if (n.includes("revision"))  return "warning";
        if (n.includes("rechazado")) return "danger";
        return "muted";
      }),
    });

    SX.footer(doc);
    doc.save(`pagos_sgi_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ── Entry point ───────────────────────────────────────────────────────────────

  window.pagosView = async function() {
    if (AppState.can("pagos", "crear"))     return loadPagosView();
    if (AppState.can("mis_pagos", "crear")) return pagosUploadView();
    return loadPagosView();
  };

})();
