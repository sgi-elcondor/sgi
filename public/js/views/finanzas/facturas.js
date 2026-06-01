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
          Venta #${g.id_venta ?? "—"} &mdash; <span style="font-weight:500">${g.comprador}</span> &bull; ${g.proyecto} &bull; ${g.codigo_lote}
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
  const colorMap = { emitida: ["#1e40af","#dbeafe"], pagada: ["#166534","#dcfce7"], anulada: ["#991b1b","#fee2e2"] };
  const [txtColor, bgColor] = colorMap[f.estado] || ["#555","#f3f4f6"];
  const numDisplay = _fmtNumFactura(f.numero_factura);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${numDisplay} — El Cóndor S.A.S.</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:32px 16px;color:#111}
    .page{max-width:680px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 16px rgba(0,0,0,.13);padding:44px 52px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #ff6a00;padding-bottom:20px;margin-bottom:28px}
    .co-name{font-size:22px;font-weight:700;color:#ff6a00;margin-bottom:4px}
    .co-sub{font-size:12px;color:#888;line-height:1.6}
    .inv-head{text-align:right}
    .inv-title{font-size:30px;font-weight:800;color:#ff6a00;letter-spacing:.02em}
    .inv-num{font-size:15px;font-weight:700;margin-top:4px}
    .inv-date{font-size:12px;color:#888;margin-top:2px}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-top:8px}
    .section{margin-bottom:22px}
    .sec-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#aaa;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:10px}
    .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5;font-size:13px}
    .lbl{color:#777}
    .val{font-weight:600;text-align:right}
    .total-box{background:#fff8f3;border:2px solid #ff6a00;border-radius:8px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}
    .total-lbl{font-size:13px;color:#777}
    .total-amt{font-size:26px;font-weight:800;color:#ff6a00}
    .footer{margin-top:28px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#bbb;text-align:center;line-height:1.7}
    .actions{text-align:center;margin-top:28px}
    .btn-p{background:#ff6a00;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;margin-right:8px}
    .btn-c{background:#efefef;color:#333;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer}
    @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0;padding:20px 28px}.actions{display:none}}
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div>
        <div class="co-name">El C&oacute;ndor S.A.S.</div>
        <div class="co-sub">Inversiones &amp; Construcciones<br>NIT: 901.708.415-1</div>
      </div>
      <div class="inv-head">
        <div class="inv-title">FACTURA</div>
        <div class="inv-num">N&deg; ${numDisplay}</div>
        <div class="inv-date">Emisi&oacute;n: ${f.fecha_emision || "—"}</div>
        <div><span class="badge" style="background:${bgColor};color:${txtColor}">${(f.estado||"").toUpperCase()}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="sec-title">Facturado a</div>
      <div class="row"><span class="lbl">Cliente</span><span class="val">${f.comprador || "—"}</span></div>
    </div>

    <div class="section">
      <div class="sec-title">Detalle del cobro</div>
      ${f.id_venta != null ? `<div class="row"><span class="lbl">N&deg; Venta</span><span class="val">#${f.id_venta}</span></div>` : ""}
      <div class="row"><span class="lbl">Proyecto</span><span class="val">${f.proyecto || "—"}</span></div>
      <div class="row"><span class="lbl">Lote</span><span class="val">${f.codigo_lote || "—"}</span></div>
      <div class="row"><span class="lbl">Cuota N&deg;</span><span class="val">${f.numero_cuota != null ? f.numero_cuota : "—"}</span></div>
      ${f.fecha_vencimiento ? `<div class="row"><span class="lbl">Fecha vencimiento</span><span class="val">${f.fecha_vencimiento}</span></div>` : ""}
    </div>

    ${f.observaciones ? `<div class="section">
      <div class="sec-title">Observaciones</div>
      <p style="font-size:13px;color:#666;line-height:1.6">${f.observaciones}</p>
    </div>` : ""}

    <div class="total-box">
      <span class="total-lbl">Valor a pagar</span>
      <span class="total-amt">${_fmtCOP(f.valor_facturado)}</span>
    </div>

    <div class="footer">
      Documento generado por SGI El C&oacute;ndor &bull;
      ${new Date().toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" })}<br>
      Este documento representa la causaci&oacute;n del ingreso correspondiente a la cuota indicada.
    </div>
  </div>

  <div class="actions">
    <button class="btn-p" onclick="window.print()">Imprimir / Descargar PDF</button>
    <button class="btn-c" onclick="window.close()">Cerrar</button>
  </div>
</body>
</html>`;
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

  const [data, sinFactura] = await Promise.all([
    API.get("/facturas").catch(e => {
      vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
      return null;
    }),
    API.get("/facturas/cuotas-sin-factura").catch(() => []),
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
        id_venta:    f.id_venta,
        comprador:   f.comprador,
        proyecto:    f.proyecto,
        codigo_lote: f.codigo_lote,
        facturas:    [],
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
      <td>${g.id_venta ? `<strong>#${g.id_venta}</strong>` : "—"}</td>
      <td>${g.comprador}</td>
      <td>${g.proyecto !== "—" ? `${g.proyecto} · <strong>${g.codigo_lote}</strong>` : "—"}</td>
      <td style="text-align:center"><strong>${g.facturas.length}</strong></td>
      <td>${badges}</td>
      <td style="text-align:right">${UI.fmt(total)}</td>
      <td><button class="btn btn-ghost btn-sm btn-ver-facturas">Ver <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></td>
    </tr>`;
  }

  const bannerHtml = sinFactura.length
    ? `<div class="facturas-sin-banner">
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

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <div class="table-header-titles">
          <h3>Facturas por Venta</h3>
          <span class="count-chip">${data.length} factura${data.length === 1 ? "" : "s"}</span>
        </div>
        ${puedeEscribir ? `<button class="btn btn-primary btn-sm" onclick="facturaForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Factura</button>` : ""}
      </div>

      ${bannerHtml}

      <div class="table-filters">
        <select id="ff-proyecto" class="select-sm" style="flex:1;min-width:160px;">
          <option value="">Todos los proyectos</option>
          ${optsProyecto}
        </select>
        <input id="ff-comprador" type="text" class="filter-input" placeholder="Buscar comprador..."
          style="flex:2;min-width:11rem">
      </div>

      <div style="overflow-x:auto">
        <table>
          <thead><tr>
            <th>Venta #</th><th>Comprador</th><th>Proyecto / Lote</th>
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

  function aplicarFiltros() {
    const fProyecto  = document.getElementById("ff-proyecto").value;
    const fComprador = _fNorm(document.getElementById("ff-comprador").value);
    const visibles   = grupos.filter(g => {
      if (fProyecto  && g.proyecto  !== fProyecto)                return false;
      if (fComprador && !_fNorm(g.comprador).includes(fComprador)) return false;
      return true;
    });
    tbody.innerHTML = visibles.map(filaVenta).join("");
    document.getElementById("facturas-grupos-empty").style.display = visibles.length ? "none" : "block";
  }

  document.getElementById("ff-proyecto").addEventListener("change", aplicarFiltros);
  document.getElementById("ff-comprador").addEventListener("input", aplicarFiltros);

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-ver-facturas");
    if (!btn) return;
    const row = btn.closest("tr[data-grupo-key]");
    if (!row) return;
    const key = row.dataset.grupoKey;
    const g = grupos.find(g => String(g.id_venta ?? "none") === key);
    if (g) facturasDeVentaView(g);
  });

  const banner = vc.querySelector(".facturas-sin-banner");
  if (banner) {
    banner.addEventListener("click", async e => {
      if (e.target.closest(".btn-generar-todas")) {
        if (!confirm(`¿Generar factura para las ${sinFactura.length} cuotas vencidas?`)) return;
        const btn = e.target.closest(".btn-generar-todas");
        btn.disabled = true; btn.textContent = "Generando...";
        try {
          const r = await API.post("/facturas/generar-pendientes", {});
          UI.toast(`${r.generadas} factura${r.generadas!==1?"s":""} generada${r.generadas!==1?"s":""}`, "ok");
          facturasView();
        } catch(err) {
          UI.toast(err.message, "error");
          btn.disabled = false; btn.textContent = "Generar todas";
        }
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
          <h3>Facturas &mdash; Venta #${grupo.id_venta ?? "sin venta"}</h3>
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

// Anular desde la vista de detalle y volver al mismo detalle
window.anularFacturaDetalle = async function(id) {
  if (!confirm("¿Anular esta factura?")) return;
  try {
    await API.patch(`/facturas/${id}/anular`, {});
    UI.toast("Factura anulada", "ok");
    // Reload data and rebuild the detail group
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
  } catch(e) {
    UI.toast(e.message, "error");
  }
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

  const ctxLabel = idVentaCtx
    ? ` <span style="color:var(--text-muted);font-weight:400;font-size:.79rem">— Venta #${idVentaCtx}</span>`
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
       </div>`
    : `<div class="form-group" style="grid-column:1/-1">
         <label>Cuota *${ctxLabel}</label>
         <input type="text" id="f_cuota_buscar" placeholder="Filtrar por comprador, lote o cédula..."
                oninput="_filtrarCuotasFactura()" autocomplete="off" style="margin-bottom:6px">
         <input type="hidden" id="f_id_cuota">
         <input type="hidden" id="f_id_fraccion">
         <div id="f_cuota_lista"
              style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px 12px">
           ${_cuotasAgrupadasHTML(cuotas, "")}
         </div>
       </div>`;

  UI.openModal("Nueva Factura", `
    <div class="form-grid">
      ${cuotaSection}
      <div class="form-group"><label>Fecha de Emisión *</label><input id="f_fe" type="date" value="${hoy}"/></div>
      <div class="form-group"><label>Valor *</label><input id="f_vf" type="text" inputmode="numeric" value="${cuotaPresel ? _fmtMiles(cuotaPresel.valor_cuota) : ""}"/></div>
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
        document.getElementById("f_vf").value            = _fmtMiles(e.target.dataset.valor);
      });
    }
  }

  const vf = document.getElementById("f_vf");
  if (vf) MoneyInput.init(vf);
};

window.guardarFactura = async function() {
  const id_cuota_str    = document.getElementById("f_id_cuota")?.value;
  const id_fraccion_str = document.getElementById("f_id_fraccion")?.value;
  const fecha_emision   = document.getElementById("f_fe").value;
  const valor_facturado = Number((document.getElementById("f_vf").value || "").replace(/\./g, ""));
  const observaciones   = document.getElementById("f_obs").value;

  if (!id_cuota_str)                            return UI.toast("Seleccione una cuota", "error");
  if (!fecha_emision)                           return UI.toast("Ingrese la fecha de emisión", "error");
  if (!valor_facturado || valor_facturado <= 0) return UI.toast("El valor debe ser mayor a 0", "error");

  const body = {
    fecha_emision,
    valor_facturado,
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

window.anularFactura = async function(id) {
  if (!confirm("¿Anular esta factura?")) return;
  try {
    await API.patch(`/facturas/${id}/anular`, {});
    UI.toast("Factura anulada", "ok");
    facturasView();
  } catch(e) {
    UI.toast(e.message, "error");
  }
};

})();