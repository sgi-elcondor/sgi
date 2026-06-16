(function () {

// When set, the invoice form was opened from the "pay cuota" flow;
// after saving, the payment modal is resumed for this cuota.
let facturaPagoCuota = null;

function _fNorm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-͟]/g, "");
}

function _fmtMiles(n) { return MoneyInput.format(n); }

function _fmtNumFactura(v) {
  if (!v) return "—";
  const s = String(v);
  if (/^\d{7,9}$/.test(s)) {
    const p = s.padStart(9, "0");
    return `20${p.slice(0, 2)}-${p.slice(2, 6)}-${p.slice(6)}`;
  }
  return s;
}

window._toggleGrupoCuota = function(key) {
  const body  = document.getElementById(`gc-body-${key}`);
  const arrow = document.getElementById(`gc-arrow-${key}`);
  if (!body) return;
  const open = body.style.display !== "none";
  body.style.display  = open ? "none" : "block";
  if (arrow) arrow.innerHTML = open ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
};

function _cuotasAgrupadasHTML(cuotas, filtro) {
  const q        = _fNorm(filtro);
  const visibles = q
    ? cuotas.filter(c =>
        _fNorm(c.comprador).includes(q) ||
        _fNorm(c.codigo_lote).includes(q) ||
        _fNorm(c.documento).includes(q))
    : cuotas;
  if (!visibles.length) {
    return `<p style="color:var(--text-muted);text-align:center;padding:12px;font-size:.84rem">Sin cuotas pendientes</p>`;
  }
  const grupos = new Map();
  visibles.forEach(c => {
    const k = c.id_venta ?? "none";
    if (!grupos.has(k)) grupos.set(k, { id_venta: c.id_venta, comprador: c.comprador, codigo_lote: c.codigo_lote, proyecto: c.proyecto, cuotas: [] });
    grupos.get(k).cuotas.push(c);
  });
  return [...grupos.values()].map(g => {
    const key   = g.id_venta ?? "none";
    const count = g.cuotas.length;
    return `
    <div style="margin-bottom:4px;border:1px solid var(--border);border-radius:6px;overflow:hidden">
      <div onclick="_toggleGrupoCuota('${key}')"
           style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;font-size:.79rem;font-weight:700;background:var(--surface-2,#f0f4f8);color:var(--text-muted);cursor:pointer;user-select:none">
        <span>
          <span id="gc-arrow-${key}" style="display:inline-flex;align-items:center;width:12px;margin-right:4px"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          Venta ${SGIUI.ventaCode(g)} &mdash; <span style="font-weight:500">${g.comprador}</span> &bull; ${g.proyecto} &bull; ${g.codigo_lote}
        </span>
        <span style="font-size:.75rem;font-weight:600;background:var(--border);padding:1px 7px;border-radius:10px;color:var(--text-muted)">
          ${count} ítem${count !== 1 ? "s" : ""}
        </span>
      </div>
      <div id="gc-body-${key}" style="display:none">
        ${g.cuotas.map(c => {
          const esFraccion = !!c.id_fraccion;
          const label = esFraccion
            ? `Cuota <strong>#${c.numero_cuota}</strong> &bull; Fracción <strong>${c.numero_fraccion}/${c.total_fracciones}</strong> &bull; Vence: ${UI.date(c.fecha_vencimiento)}`
            : `Cuota <strong>#${c.numero_cuota}</strong> &bull; Vence: ${UI.date(c.fecha_vencimiento)}`;
          return `
          <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-top:1px solid var(--border);cursor:pointer${esFraccion ? ";padding-left:24px" : ""}">
            <input type="radio" name="cuota_sel" value="${c.id_cuota}"
              data-valor="${c.valor_cuota}"
              data-id-venta="${c.id_venta||0}"
              data-num-cuota="${c.numero_cuota||0}"
              data-fraccion="${c.id_fraccion||""}"
              style="flex-shrink:0">
            <span style="flex:1;font-size:.83rem;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <span>${label}</span>
              <span style="display:flex;gap:6px;align-items:center;white-space:nowrap">
                ${UI.fmt(c.valor_cuota)}
                ${esFraccion ? `<span class="badge badge-info" style="font-size:.7rem">Fracción</span>` : `&nbsp;${UI.badge(c.estado)}`}
              </span>
            </span>
          </label>`;
        }).join("")}
      </div>
    </div>`;
  }).join("");
}

window._filtrarCuotasFactura = function() {
  const lista = document.getElementById("f_cuota_lista");
  if (!lista) return;
  lista.innerHTML = _cuotasAgrupadasHTML(
    window._facturaCuotas || [],
    document.getElementById("f_cuota_buscar")?.value || ""
  );
};

function _fmtCOP(n) {
  return "$ " + Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
}

function _buildFacturaHTML(f) {
  const numDisplay = _fmtNumFactura(f.numero_factura);

  const valor      = Number(f.valor_facturado || 0);
  const valorTxt   = _fmtCOP(valor);
  const valorWords = (window.SGIExport && window.SGIExport.numToWordsES)
    ? window.SGIExport.numToWordsES(valor)
    : "";

  const estadoMap = {
    emitida:             { label: "Emitida",              badge: "info" },
    pagada:              { label: "Pagada",               badge: "success", stamp: { label: "Pagada",  variant: "success" } },
    parcialmente_pagada: { label: "Parcialmente pagada",  badge: "warning" },
    anulada:             { label: "Anulada",              badge: "danger",  stamp: { label: "Anulada", variant: "danger" } },
  };
  const estado = estadoMap[f.estado] || { label: (f.estado || "—"), badge: "muted" };

  const fmtD = (window.SGIExport && window.SGIExport.fmtDate) ? window.SGIExport.fmtDate : (x => x || "");
  const fechaEmision = fmtD(f.fecha_emision);

  const waNumber = (window.SGIExport && window.SGIExport.CONTACT && window.SGIExport.CONTACT.whatsapp) || "573001234567";
  const waMsg    = `Hola, quiero obtener mas informacion acerca de la factura: ${numDisplay} por un valor de: ${valorTxt} emitida en la fecha: ${fechaEmision} a nombre de: ${f.comprador || ""}.`.trim();
  const waUrl    = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
  const qrUrl    = window.SGIExport.qrDataUri(waUrl);

  if (window.SGIExport && window.SGIExport.comprobanteHTML) {
    return window.SGIExport.comprobanteHTML({
      docTitle: `Factura ${numDisplay} — El Cóndor S.A.S.`,
      badge:    "Factura de Venta",
      fields: [
        { icon: "check",    label: "Estado de la factura", value: estado.label, badge: estado.badge },
        { icon: "receipt",  label: "N° de factura",        value: numDisplay },
        { icon: "user",     label: "Cliente",              value: f.comprador },
        { icon: "briefcase",label: "N° de venta",          value: f.id_venta != null ? SGIUI.ventaCode(f) : "" },
        { icon: "pin",      label: "Proyecto / Lote",      value: [f.proyecto, f.codigo_lote].filter(x => x && x !== "—").join(" · ") },
        { icon: "calendar", label: "Fecha de emisión",     value: fechaEmision },
        { icon: "clock",    label: "Fecha de vencimiento", value: fmtD(f.fecha_vencimiento) },
      ],
      trace: [
        { label: "Cuota",   value: f.numero_cuota != null ? `#${f.numero_cuota}` : "" },
        { label: "Factura", value: numDisplay, current: true },
        { label: "Pago",    value: f.numero_pago || "" },
        { label: "Recibo",  value: f.numero_recibo || "" },
      ],
      extraHTML: f.observaciones
        ? `<div class="cmp-extra"><div class="cmp-extra-title">Observaciones</div><div class="cmp-stat-row" style="display:block;color:var(--soft);line-height:1.6">${f.observaciones}</div></div>`
        : "",
      totalLabel: "Valor a pagar",
      totalValue: valorTxt,
      totalWords: valorWords,
      stamp:      estado.stamp || null,
      qrUrl,
      qrCaption: "<strong>¿Dudas con tu factura?</strong><br>Escanea el código QR para escribirnos por WhatsApp.",
    });
  }

}

window.verFacturaPDF = function(id) {
  const f = (window._facturasMap || {})[id];
  if (!f) return UI.toast("Factura no encontrada", "error");
  const win = window.open("", "_blank", "width=780,height=720,scrollbars=yes");
  if (!win) return UI.toast("El navegador bloqueó la ventana emergente. Permita ventanas emergentes para este sitio.", "error");
  win.document.write(_buildFacturaHTML(f));
  win.document.close();
};

// ── Vista principal: agrupada por venta ──────────────────────────────────────
window.facturasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const puedeEscribir = AppState.can('facturas', 'crear');

  const [data, sinFactura, solicitudes] = await Promise.all([
    API.get("/facturas").catch(e => {
      vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
      return null;
    }),
    API.get("/facturas/cuotas-sin-factura").catch(() => []),
    API.get("/facturas/solicitudes").catch(() => []),
  ]);
  if (!data) return;

  window._facturasMap = {};
  data.forEach(f => { window._facturasMap[f.id_factura] = f; });

  // Group by id_venta
  const ventasMap = new Map();
  data.forEach(f => {
    const key = f.id_venta ?? "none";
    if (!ventasMap.has(key)) {
      ventasMap.set(key, {
        id_venta:     f.id_venta,
        codigo_venta: f.codigo_venta,
        comprador:    f.comprador,
        proyecto:     f.proyecto,
        codigo_lote:  f.codigo_lote,
        facturas:     [],
      });
    }
    ventasMap.get(key).facturas.push(f);
  });
  const grupos = [...ventasMap.values()].sort((a, b) => (b.id_venta || 0) - (a.id_venta || 0));
  window._facturasGrupos = grupos;

  const proyectos    = [...new Set(grupos.map(g => g.proyecto))].filter(p => p !== "—").sort();
  const optsProyecto = proyectos.map(p => `<option value="${p}">${p}</option>`).join("");

  function filaVenta(g) {
    const emitidas = g.facturas.filter(f => f.estado === "emitida").length;
    const pagadas  = g.facturas.filter(f => f.estado === "pagada").length;
    const anuladas = g.facturas.filter(f => f.estado === "anulada").length;
    const total    = g.facturas.filter(f => f.estado === "emitida").reduce((s, f) => s + Number(f.valor_facturado || 0), 0);
    const badges   = [
      emitidas ? `<span class="badge badge-info">${emitidas} emitida${emitidas>1?"s":""}</span>` : "",
      pagadas  ? `<span class="badge badge-success">${pagadas} pagada${pagadas>1?"s":""}</span>` : "",
      anuladas ? `<span class="badge badge-danger">${anuladas} anulada${anuladas>1?"s":""}</span>` : "",
    ].filter(Boolean).join(" ");
    return `<tr data-grupo-key="${g.id_venta ?? "none"}" style="cursor:pointer">
      <td>${g.id_venta ? `<strong>${SGIUI.ventaCode(g)}</strong>` : "—"}</td>
      <td>${g.comprador}</td>
      <td>${g.proyecto !== "—" ? `${g.proyecto} · <strong>${g.codigo_lote}</strong>` : "—"}</td>
      <td style="text-align:center"><strong>${g.facturas.length}</strong></td>
      <td>${badges}</td>
      <td style="text-align:right">${UI.fmt(total)}</td>
      <td><button class="btn btn-ghost btn-sm btn-ver-facturas">Ver <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></td>
    </tr>`;
  }

  const solicitudesHtml = (puedeEscribir && solicitudes.length)
    ? `<div class="facturas-sin-banner" id="solicitudes-banner">
        <div class="fsb-head">
          <div class="fsb-head-info">
            <span class="fsb-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </span>
            <div>
              <strong class="fsb-title">${solicitudes.length} solicitud${solicitudes.length>1?"es":""} de pago</strong>
              <span class="fsb-sub">Compradores que quieren pagar y necesitan factura. Emítela para habilitar su pago.</span>
            </div>
          </div>
        </div>
        <div class="fsb-table-wrap">
          <table class="fsb-table">
            <thead>
              <tr>
                <th>Comprador</th>
                <th>Proyecto / Lote</th>
                <th class="fsb-center">Cuota #</th>
                <th>Vencimiento</th>
                <th class="fsb-right">Valor</th>
                <th>Nota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${solicitudes.map(s => `
                <tr data-solicitud="${s.id_solicitud}">
                  <td>${s.comprador}</td>
                  <td>${s.proyecto} · <strong>${s.codigo_lote}</strong></td>
                  <td class="fsb-center">${s.numero_cuota ?? "—"}</td>
                  <td>${UI.date(s.fecha_vencimiento)}</td>
                  <td class="fsb-right">${UI.fmt(s.valor_cuota)}</td>
                  <td style="font-size:.82rem;color:var(--text-muted)">${s.nota || "—"}</td>
                  <td class="fsb-right" style="white-space:nowrap">
                    <button class="btn btn-primary btn-sm btn-emitir-solicitud">Emitir</button>
                    <button class="btn btn-ghost btn-sm btn-descartar-solicitud">Descartar</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`
    : "";

  const bannerHtml = sinFactura.length
    ? `<div class="facturas-sin-banner" id="sin-factura-banner">
        <div class="fsb-head">
          <div class="fsb-head-info">
            <span class="fsb-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <div>
              <strong class="fsb-title">${sinFactura.length} cuota${sinFactura.length>1?"s":""} vencida${sinFactura.length>1?"s":""} sin factura</strong>
              <span class="fsb-sub">Emite sus facturas para poder registrar el pago.</span>
            </div>
          </div>
          ${puedeEscribir ? `<button class="btn btn-primary btn-sm btn-generar-todas">Generar todas</button>` : ""}
        </div>
        <div class="fsb-table-wrap">
          <table class="fsb-table">
            <thead>
              <tr>
                <th>Comprador</th>
                <th>Proyecto / Lote</th>
                <th class="fsb-center">Cuota #</th>
                <th>Vencimiento</th>
                <th class="fsb-right">Valor</th>
                <th>Estado</th>
                ${puedeEscribir ? `<th></th>` : ""}
              </tr>
            </thead>
            <tbody>
              ${sinFactura.map(c => `
                <tr data-cuota="${encodeURIComponent(JSON.stringify(c))}">
                  <td>${c.comprador}</td>
                  <td>${c.proyecto} · <strong>${c.codigo_lote}</strong></td>
                  <td class="fsb-center">${c.tiene_fracciones ? `${c.numero_cuota} <span style="color:var(--text-muted);font-size:.78rem">· Frac ${c.numero_fraccion}/${c.total_fracciones}</span>` : c.numero_cuota}</td>
                  <td>${UI.date(c.fecha_vencimiento)}</td>
                  <td class="fsb-right">${UI.fmt(c.valor_cuota)}</td>
                  <td>${UI.badge(c.estado)}</td>
                  ${puedeEscribir ? `<td class="fsb-right">
                    <button class="btn btn-ghost btn-sm btn-generar-factura">Generar</button>
                  </td>` : ""}
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`
    : "";

  const emitidas  = data.filter(f => f.estado === "emitida").length;
  const parciales = data.filter(f => f.estado === "parcialmente_pagada").length;
  const porCobrar = data.filter(f => f.estado !== "anulada").reduce((s, f) => s + Number(f.valor_a_pagar || 0), 0);

  vc.innerHTML = `
    ${window.SGIUI.statCards([
      { label: "Facturas",         value: data.length,       sub: "Activas" },
      { label: "Emitidas",         value: emitidas,          sub: "Pendientes de pago" },
      { label: "Parcial. pagadas", value: parciales,         sub: "Con abonos" },
      { label: "Por cobrar",       value: window.SGIUI.fmtCompactMoney(porCobrar), title: UI.fmt(porCobrar), sub: "Saldo facturado" },
    ])}
    <div class="table-wrap">
      <div class="table-header">
        <div class="table-header-titles">
          <h3>Facturas por Venta</h3>
          <span class="count-chip" id="ff-count">${grupos.length} venta${grupos.length === 1 ? "" : "s"}</span>
        </div>
        ${puedeEscribir ? `<button class="btn btn-primary btn-sm" onclick="facturaForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Factura</button>` : ""}
      </div>

      ${solicitudesHtml}
      ${bannerHtml}

      ${window.SGIUI.filterBar({
        fields: [
          { type: "select", id: "ff-proyecto", label: "Proyecto", onchange: "window._ffFiltrar()",
            options: [{ value: "", label: "Todos los proyectos" }, ...proyectos.map(p => ({ value: p, label: p }))] },
          { type: "select", id: "ff-estado", label: "Estado", onchange: "window._ffFiltrar()", options: [
            { value: "", label: "Todos los estados" },
            { value: "emitida", label: "Emitida" },
            { value: "parcialmente_pagada", label: "Parcial. pagada" },
            { value: "pagada", label: "Pagada" },
            { value: "anulada", label: "Anulada" },
          ] },
          { type: "search", id: "ff-comprador", label: "Buscar", placeholder: "Comprador, lote, proyecto o N° de factura…", grow: true, oninput: "window._ffFiltrar()" },
        ],
        actions: `<button class="btn btn-ghost btn-sm" onclick="window._ffLimpiar()">Limpiar</button>`,
      })}

      <div class="sticky-table-scroll">
        <table>
          <thead><tr>
            <th>Venta</th><th>Comprador</th><th>Proyecto / Lote</th>
            <th style="text-align:center">Facturas</th><th>Estados</th>
            <th style="text-align:right">Total facturado</th><th></th>
          </tr></thead>
          <tbody id="facturas-grupos-tbody">${grupos.map(filaVenta).join("")}</tbody>
        </table>
        <p id="facturas-grupos-empty" style="display:none;text-align:center;color:var(--text-muted);padding:1.5rem">
          No hay ventas con facturas que coincidan con los filtros.
        </p>
      </div>
    </div>`;

  const tbody = document.getElementById("facturas-grupos-tbody");

  window._ffFiltrar = function() {
    const fProyecto = document.getElementById("ff-proyecto")?.value || "";
    const fEstado   = document.getElementById("ff-estado")?.value || "";
    const fBuscar   = document.getElementById("ff-comprador")?.value || "";
    const visibles  = grupos.filter(g => {
      if (fProyecto && g.proyecto !== fProyecto) return false;
      if (fEstado && !g.facturas.some(f => f.estado === fEstado)) return false;
      const nums = g.facturas.map(f => f.numero_factura || "").join(" ");
      if (!SGISearch.matches(fBuscar, g.comprador, g.codigo_lote, g.proyecto, nums)) return false;
      return true;
    });
    tbody.innerHTML = visibles.map(filaVenta).join("");
    const empty = document.getElementById("facturas-grupos-empty");
    if (empty) empty.style.display = visibles.length ? "none" : "block";
    const cnt = document.getElementById("ff-count");
    if (cnt) cnt.textContent = `${visibles.length} venta${visibles.length === 1 ? "" : "s"}`;
  };
  window._ffLimpiar = function() {
    ["ff-proyecto", "ff-estado", "ff-comprador"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    window._ffFiltrar();
  };

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-ver-facturas");
    if (!btn) return;
    const row = btn.closest("tr[data-grupo-key]");
    if (!row) return;
    const key = row.dataset.grupoKey;
    const g = grupos.find(g => String(g.id_venta ?? "none") === key);
    if (g) facturasDeVentaView(g);
  });

  const solBanner = document.getElementById("solicitudes-banner");
  if (solBanner) {
    solBanner.addEventListener("click", async e => {
      const emitir    = e.target.closest(".btn-emitir-solicitud");
      const descartar = e.target.closest(".btn-descartar-solicitud");
      if (!emitir && !descartar) return;
      const row = e.target.closest("tr[data-solicitud]");
      const id  = row?.dataset.solicitud;
      if (!id) return;
      const accion = emitir ? "atender" : "descartar";
      const btn = e.target.closest("button");
      btn.disabled = true; btn.textContent = emitir ? "Emitiendo..." : "Descartando...";
      try {
        await API.patch(`/facturas/solicitudes/${id}`, { accion });
        UI.toast(emitir ? "Factura emitida para la solicitud" : "Solicitud descartada", "ok");
        facturasView();
      } catch (err) {
        UI.toast(err.message, "error");
        btn.disabled = false; btn.textContent = emitir ? "Emitir" : "Descartar";
      }
    });
  }

  window._facturasSinFactura = sinFactura;

  const banner = document.getElementById("sin-factura-banner");
  if (banner) {
    banner.addEventListener("click", async e => {
      if (e.target.closest(".btn-generar-todas")) {
        abrirPreviewGenerar(window._facturasSinFactura || []);
        return;
      }
      const btn = e.target.closest(".btn-generar-factura");
      if (!btn) return;
      const row = btn.closest("tr[data-cuota]");
      if (!row) return;
      facturaForm(JSON.parse(decodeURIComponent(row.dataset.cuota)));
    });
  }
};

// ── Generación automática con revisión previa (Tarea 6) ──────────────────────
// §4.3 (regla absoluta): "El valor de la factura debe ser EXACTAMENTE el saldo pendiente
// de la cuota/fracción en el momento de emisión". Por eso el valor NO es editable aquí:
// cambiarlo descuadraría el plan (Σcuotas = valor financiado). El aux puede revisar y
// editar la FECHA DE EMISIÓN y las OBSERVACIONES; si el monto no es correcto, debe ajustar
// el PLAN DE CUOTAS (editor con cuadre), no la factura. El número de factura lo asigna el
// sistema al emitir. La emisión usa POST /facturas, que factura el saldo exacto (RN-03/RN-10).
window.abrirPreviewGenerar = function(items) {
  if (!items || !items.length) {
    UI.toast("No hay cuotas vencidas sin factura.", "error");
    return;
  }

  const rows = items.map((c, i) => ({
    idx:         i,
    id_cuota:    c.id_cuota,
    id_fraccion: c.id_fraccion || null,
    comprador:   c.comprador,
    proyecto:    c.proyecto,
    codigo_lote: c.codigo_lote,
    codigo_venta: c.codigo_venta || null,
    id_venta:    c.id_venta,
    numero_cuota: c.numero_cuota,
    numero_fraccion: c.numero_fraccion || null,
    total_fracciones: c.total_fracciones || null,
    fecha_vencimiento: c.fecha_vencimiento,
    saldo:       Number(c.valor_cuota) || 0,   // saldo pendiente de la cuota/fracción (§4.3)
    fecha:       new Date().toISOString().split("T")[0],
    obs:         "",
  }));

  const filaHTML = (r) => {
    const cuotaLabel = r.id_fraccion
      ? `#${r.numero_cuota} · Frac ${r.numero_fraccion}/${r.total_fracciones}`
      : `#${r.numero_cuota}`;
    return `<tr data-idx="${r.idx}">
      <td style="font-size:.82rem">${r.comprador}<br><span style="color:var(--text-muted);font-size:.76rem">Venta ${SGIUI.ventaCode(r)} · ${r.proyecto} · ${r.codigo_lote}</span></td>
      <td style="text-align:center;white-space:nowrap">${cuotaLabel}</td>
      <td style="white-space:nowrap;color:var(--text-muted);font-size:.8rem">${UI.date(r.fecha_vencimiento)}</td>
      <td style="text-align:center;color:var(--text-muted);font-size:.78rem;font-style:italic">Automático</td>
      <td><input type="date" class="gp-fecha" data-idx="${r.idx}" value="${r.fecha}" style="width:9.25rem"></td>
      <td style="text-align:right;white-space:nowrap"><strong>${UI.fmt(r.saldo)}</strong><br>
        <button type="button" class="btn btn-ghost btn-sm gp-plan" data-idx="${r.idx}" style="font-size:.72rem;padding:.1rem .4rem;color:var(--text-muted)" title="Para cambiar el monto, ajusta el plan de cuotas (debe cuadrar)">Ajustar plan</button></td>
      <td><input type="text" class="gp-obs" data-idx="${r.idx}" placeholder="Opcional" value="" style="min-width:9rem"></td>
    </tr>`;
  };

  UI.openModal(`Generar facturas — revisar antes de emitir`, `
    <div style="margin-bottom:.75rem;padding:.625rem .875rem;background:var(--surface-2,#f0f4f8);border-radius:.5rem;font-size:.84rem;line-height:1.6">
      Vas a emitir <b>${rows.length} factura${rows.length !== 1 ? "s" : ""}</b>. Puedes editar la <b>fecha de emisión</b>
      y las <b>observaciones</b>. El <b>valor es el saldo exacto</b> de la cuota (regla §4.3) y no se edita aquí:
      si el monto no es correcto, usa <b>Ajustar plan</b> para reajustar el plan de cuotas (debe cuadrar con el valor financiado).
      El <b>número de factura</b> lo asigna el sistema al emitir.
    </div>
    <div style="max-height:50vh;overflow:auto;border:1px solid var(--border);border-radius:.5rem">
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead>
          <tr style="font-size:.72rem;color:var(--text-muted);position:sticky;top:0;background:var(--surface)">
            <th style="padding:.5rem;text-align:left">Comprador / Venta</th>
            <th style="padding:.5rem;text-align:center">Cuota</th>
            <th style="padding:.5rem;text-align:left">Vence</th>
            <th style="padding:.5rem;text-align:center">N° factura</th>
            <th style="padding:.5rem;text-align:left">Fecha emisión</th>
            <th style="padding:.5rem;text-align:right">Valor (saldo)</th>
            <th style="padding:.5rem;text-align:left">Observaciones</th>
          </tr>
        </thead>
        <tbody id="gp-rows">${rows.map(filaHTML).join("")}</tbody>
      </table>
    </div>
    <div id="gp-msg" style="font-size:.8rem;color:var(--text-muted);margin:.6rem 0"></div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="gp-emitir">Emitir ${rows.length} factura${rows.length !== 1 ? "s" : ""}</button>
    </div>`);

  document.querySelectorAll("#gp-rows .gp-fecha").forEach(inp => {
    const i = Number(inp.dataset.idx);
    inp.addEventListener("input", () => { rows[i].fecha = inp.value; });
  });
  document.querySelectorAll("#gp-rows .gp-obs").forEach(inp => {
    const i = Number(inp.dataset.idx);
    inp.addEventListener("input", () => { rows[i].obs = inp.value; });
  });

  // "Ajustar plan": changing the amount means changing the cuota, which must keep
  // Σcuotas = valor financiado. Send the aux to the balanced plan editor of that venta.
  document.querySelectorAll("#gp-rows .gp-plan").forEach(btn => {
    btn.addEventListener("click", () => {
      const r = rows[Number(btn.dataset.idx)];
      if (!r?.id_venta) return UI.toast("No se pudo identificar la venta.", "error");
      if (typeof window._editarPlanCuotas !== "function") {
        return UI.toast("Abre la venta en el módulo Ventas para ajustar su plan de cuotas.", "error");
      }
      UI.closeModal();
      window._editarPlanCuotas(r.id_venta, null, { returnTo: "facturas" });
    });
  });

  document.getElementById("gp-emitir")?.addEventListener("click", async () => {
    for (const r of rows) {
      if (!r.fecha) return UI.toast(`Falta la fecha de emisión en la cuota #${r.numero_cuota}`, "error");
    }

    const btn = document.getElementById("gp-emitir");
    btn.disabled = true;
    const msg = document.getElementById("gp-msg");

    // §4.3: do NOT send valor_facturado — the backend bills the exact pending saldo.
    let ok = 0, fail = 0;
    for (const r of rows) {
      btn.textContent = `Emitiendo ${ok + fail + 1}/${rows.length}...`;
      try {
        await API.post("/facturas", {
          id_cuota:      r.id_cuota,
          id_fraccion:   r.id_fraccion,
          fecha_emision: r.fecha,
          observaciones: r.obs?.trim() || null,
        });
        ok++;
      } catch (e) {
        fail++;
        if (msg) msg.innerHTML = `<span style="color:var(--danger)">Cuota #${r.numero_cuota}: ${e.message}</span>`;
      }
    }

    UI.closeModal();
    UI.toast(`${ok} factura${ok !== 1 ? "s" : ""} emitida${ok !== 1 ? "s" : ""}${fail ? ` · ${fail} con error` : ""}`, fail ? "error" : "ok");
    facturasView();
  });
};

// ── Vista detalle: facturas de una venta ─────────────────────────────────────
window.facturasDeVentaView = function(grupo) {
  const vc = document.getElementById("viewContainer");
  const esAuxiliar = AppState.can('facturas', 'crear');

  function filaFactura(f) {
    return `<tr>
      <td style="font-family:monospace;font-size:.85rem;white-space:nowrap">${_fmtNumFactura(f.numero_factura)}</td>
      <td>${UI.date(f.fecha_emision)}</td>
      <td>${f.numero_cuota != null
        ? `#${f.numero_cuota}${f.fecha_vencimiento ? ` <span style="color:var(--text-muted);font-size:.8rem">· ${UI.date(f.fecha_vencimiento)}</span>` : ""}`
        : "—"}</td>
      <td>${UI.fmt(f.valor_facturado)}</td>
      <td>${UI.badge(f.estado)}</td>
      <td style="max-width:140px;font-size:.82rem">${f.observaciones || "—"}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="verFacturaPDF(${f.id_factura})" style="margin-right:4px">Ver PDF</button>
        ${esAuxiliar && f.estado === "emitida"
          ? `<button class="btn btn-danger btn-sm" onclick="anularFacturaDetalle(${f.id_factura})">Anular</button>`
          : ""}
      </td>
    </tr>`;
  }

  window._facturaDetalleGrupo = grupo;

  const totalEmitido = grupo.facturas.filter(f => f.estado === "emitida").reduce((s, f) => s + Number(f.valor_facturado || 0), 0);

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-ghost btn-sm" onclick="facturasView()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Volver</button>
          <h3>Facturas &mdash; Venta ${grupo.id_venta ? SGIUI.ventaCode(grupo) : "sin venta"}</h3>
        </div>
        ${esAuxiliar ? `<button class="btn btn-primary btn-sm" onclick="facturaForm(null,${grupo.id_venta})"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Factura</button>` : ""}
      </div>

      <div style="background:var(--surface-2,#f0f4f8);border-radius:8px;padding:12px 16px;margin-bottom:1rem;font-size:.88rem;display:flex;gap:24px;flex-wrap:wrap">
        <span><span style="color:var(--text-muted)">Cliente:</span> <strong>${grupo.comprador}</strong></span>
        <span><span style="color:var(--text-muted)">Proyecto:</span> <strong>${grupo.proyecto}</strong></span>
        <span><span style="color:var(--text-muted)">Lote:</span> <strong>${grupo.codigo_lote}</strong></span>
        <span><span style="color:var(--text-muted)">Total facturado:</span> <strong>${UI.fmt(totalEmitido)}</strong></span>
      </div>

      <div style="overflow-x:auto">
        <table>
          <thead><tr>
            <th>N° Factura</th><th>Fecha emisión</th><th>Cuota</th>
            <th>Valor</th><th>Estado</th><th>Observaciones</th><th></th>
          </tr></thead>
          <tbody>${grupo.facturas.map(filaFactura).join("")}</tbody>
        </table>
        ${!grupo.facturas.length
          ? `<p style="text-align:center;color:var(--text-muted);padding:1.5rem">Sin facturas registradas para esta venta</p>`
          : ""}
      </div>
    </div>`;
};

// RN-18/RN-20: annulment requires a documented motivo, recorded in the audit trail.
function _modalMotivoAnular(onConfirm) {
  UI.openModal("Anular factura", `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:.5rem;padding:.75rem 1rem;font-size:.84rem;line-height:1.5">
        La anulación es <b>excepcional</b>: solo para corregir errores de datos de una factura emitida sin pagos. Queda registrada en auditoría con tu usuario.
      </div>
      <div class="form-group">
        <label>Motivo de la anulación *</label>
        <textarea id="anular-motivo" rows="3" placeholder="Describe el error que obliga a anular (mín. 5 caracteres)"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-danger" id="anular-confirmar">Anular factura</button>
      </div>
    </div>`);
  document.getElementById("anular-confirmar")?.addEventListener("click", async () => {
    const motivo = document.getElementById("anular-motivo")?.value.trim() || "";
    if (motivo.length < 5) return UI.toast("Indica el motivo (mín. 5 caracteres)", "error");
    const btn = document.getElementById("anular-confirmar");
    btn.disabled = true; btn.textContent = "Anulando...";
    try {
      await onConfirm(motivo);
    } catch (e) {
      btn.disabled = false; btn.textContent = "Anular factura";
      UI.toast(e.message, "error");
    }
  });
}

// Anular desde la vista de detalle y volver al mismo detalle
window.anularFacturaDetalle = function(id) {
  _modalMotivoAnular(async (motivo) => {
    await API.patch(`/facturas/${id}/anular`, { motivo });
    UI.closeModal();
    UI.toast("Factura anulada", "ok");
    const updatedData = await API.get("/facturas").catch(() => []);
    window._facturasMap = {};
    updatedData.forEach(f => { window._facturasMap[f.id_factura] = f; });
    const grupo = window._facturaDetalleGrupo;
    if (grupo) {
      grupo.facturas = updatedData.filter(f => f.id_venta === grupo.id_venta);
      facturasDeVentaView(grupo);
    } else {
      facturasView();
    }
  });
};

// ── Formulario ────────────────────────────────────────────────────────────────
window.facturaForm = async function(cuotaPresel = null, idVentaCtx = null, resumePago = false) {
  facturaPagoCuota = resumePago ? cuotaPresel : null;
  const hoy = new Date().toISOString().split("T")[0];

  let cuotas = [];
  try {
    cuotas = await API.get("/cuotas/pendientes");
    if (idVentaCtx) cuotas = cuotas.filter(c => c.id_venta === idVentaCtx);
  } catch(e) {}
  window._facturaCuotas = cuotas;

  const ctxCode = idVentaCtx
    ? (cuotas.find(c => c.id_venta === idVentaCtx)?.codigo_venta || `#${idVentaCtx}`)
    : "";
  const ctxLabel = idVentaCtx
    ? ` <span style="color:var(--text-muted);font-weight:400;font-size:.79rem">— Venta ${ctxCode}</span>`
    : "";

  const cuotaSection = cuotaPresel
    ? `<div class="form-group" style="grid-column:1/-1">
         <label>Cuota</label>
         <div class="summary-card">
           <div class="summary-card-head">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
             ${cuotaPresel.comprador}
           </div>
           <div class="summary-card-grid">
             <div class="summary-item"><span class="summary-item-label">Proyecto</span><span class="summary-item-value">${cuotaPresel.proyecto}</span></div>
             <div class="summary-item"><span class="summary-item-label">Lote</span><span class="summary-item-value">${cuotaPresel.codigo_lote}</span></div>
             <div class="summary-item"><span class="summary-item-label">Cuota</span><span class="summary-item-value">#${cuotaPresel.numero_cuota}${cuotaPresel.tiene_fracciones ? ` &bull; Fracción ${cuotaPresel.numero_fraccion}/${cuotaPresel.total_fracciones}` : ""}</span></div>
             <div class="summary-item"><span class="summary-item-label">Vence</span><span class="summary-item-value">${UI.date(cuotaPresel.fecha_vencimiento)}</span></div>
             <div class="summary-item"><span class="summary-item-label">Valor</span><span class="summary-item-value">${UI.fmt(cuotaPresel.valor_cuota)}</span></div>
           </div>
         </div>
         <input type="hidden" id="f_id_cuota" value="${cuotaPresel.id_cuota}">
         <input type="hidden" id="f_id_fraccion" value="${cuotaPresel.id_fraccion || ''}">
         <input type="hidden" id="f_id_venta" value="${cuotaPresel.id_venta || ''}">
       </div>`
    : `<div class="form-group" style="grid-column:1/-1">
         <label>Cuota *${ctxLabel}</label>
         <input type="text" id="f_cuota_buscar" placeholder="Filtrar por comprador, lote o cédula..."
                oninput="_filtrarCuotasFactura()" autocomplete="off" style="margin-bottom:6px">
         <input type="hidden" id="f_id_cuota">
         <input type="hidden" id="f_id_fraccion">
         <input type="hidden" id="f_id_venta" value="${idVentaCtx || ''}">
         <div id="f_cuota_lista"
              style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px 12px">
           ${_cuotasAgrupadasHTML(cuotas, "")}
         </div>
       </div>`;

  UI.openModal("Nueva Factura", `
    <div class="form-grid">
      ${cuotaSection}
      <div class="form-group"><label>Fecha de Emisión *</label><input id="f_fe" type="date" value="${hoy}"/></div>
      <div class="form-group">
        <label>Valor (saldo de la cuota)</label>
        <input id="f_vf" type="text" readonly value="${cuotaPresel ? _fmtMiles(cuotaPresel.valor_cuota) : ""}" style="background:var(--surface-2,#f0f4f8);cursor:not-allowed">
        <small style="display:block;color:var(--text-muted);font-size:.76rem;margin-top:.25rem">
          Es el saldo pendiente y no se edita (regla §4.3). Para cambiar el monto,
          <button type="button" id="f_ajustar_plan" class="btn btn-ghost btn-sm" style="padding:0 .4rem;font-size:.76rem">ajusta el plan de cuotas</button>.
        </small>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label><textarea id="f_obs" rows="2"></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarFactura()">Guardar</button>
    </div>`);

  if (!cuotaPresel) {
    const lista = document.getElementById("f_cuota_lista");
    if (lista) {
      lista.addEventListener("change", e => {
        if (e.target.type !== "radio") return;
        document.getElementById("f_id_cuota").value      = e.target.value;
        document.getElementById("f_id_fraccion").value   = e.target.dataset.fraccion || "";
        document.getElementById("f_id_venta").value      = e.target.dataset.idVenta || "";
        document.getElementById("f_vf").value            = _fmtMiles(e.target.dataset.valor);
      });
    }
  }

  // §4.3: the factura value cannot be edited; changing the amount means reajustar the cuota
  // plan (Σcuotas = valor financiado). Route the aux to the balanced plan editor.
  document.getElementById("f_ajustar_plan")?.addEventListener("click", () => {
    const idVenta = Number(document.getElementById("f_id_venta")?.value || 0);
    if (!idVenta) return UI.toast("Selecciona primero una cuota para identificar su venta.", "error");
    if (typeof window._editarPlanCuotas !== "function") {
      return UI.toast("Abre la venta en el módulo Ventas para ajustar su plan de cuotas.", "error");
    }
    UI.closeModal();
    window._editarPlanCuotas(idVenta, null, { returnTo: "facturas" });
  });
};

// Reopen the generation preview for a venta after its plan was reajusted: the cuotas whose
// value changed had their factura auto-annulled, so they reappear here (with the new value
// and date) ready to be re-emitted/approved. §4.3.
window.regenerarFacturasVenta = async function(idVenta) {
  let sin = [];
  try { sin = await API.get("/facturas/cuotas-sin-factura"); } catch (_) {}
  const items = (sin || []).filter(c => c.id_venta === idVenta);
  // Ensure the underlying view is Facturas (this may be invoked from the Cuotas reajuste).
  if (typeof window.navigate === "function" && window.location.hash !== "#facturas") {
    navigate("facturas");
  } else if (typeof window.facturasView === "function") {
    facturasView();
  }
  if (!items.length) {
    UI.toast("Tras el reajuste no hay cuotas vencidas pendientes de factura para esta venta.", "info");
    return;
  }
  setTimeout(() => window.abrirPreviewGenerar(items), 120);
};

window.guardarFactura = async function() {
  const id_cuota_str    = document.getElementById("f_id_cuota")?.value;
  const id_fraccion_str = document.getElementById("f_id_fraccion")?.value;
  const fecha_emision   = document.getElementById("f_fe").value;
  const observaciones   = document.getElementById("f_obs").value;

  if (!id_cuota_str)  return UI.toast("Seleccione una cuota", "error");
  if (!fecha_emision) return UI.toast("Ingrese la fecha de emisión", "error");

  // §4.3: do NOT send valor_facturado — the backend bills the exact pending saldo of the
  // cuota/fracción. Changing the amount must go through the balanced plan editor.
  const body = {
    fecha_emision,
    observaciones,
    id_cuota:    +id_cuota_str,
    id_fraccion: id_fraccion_str ? +id_fraccion_str : null,
  };
  try {
    await API.post("/facturas", body);
    UI.closeModal();
    UI.toast("Factura creada", "ok");
    if (facturaPagoCuota && typeof window.pagoForm === "function") {
      const cuota = facturaPagoCuota;
      facturaPagoCuota = null;
      window.pagoForm(cuota.id_venta, cuota);
    } else {
      facturasView();
    }
  } catch(e) {
    UI.toast(e.message, "error");
  }
};

window.anularFactura = function(id) {
  _modalMotivoAnular(async (motivo) => {
    await API.patch(`/facturas/${id}/anular`, { motivo });
    UI.closeModal();
    UI.toast("Factura anulada", "ok");
    facturasView();
  });
};

})();