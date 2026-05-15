function _rNorm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-͟]/g, "");
}

function _rFmtFactNum(n) {
  if (!n) return "—";
  const s = String(n).padStart(9, "0");
  return /^\d{9}$/.test(s) ? `20${s.slice(0, 2)}-${s.slice(2, 6)}-${s.slice(6)}` : String(n);
}

function _rFmtCOP(n) {
  return "$ " + Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
}

function _buildReciboHTML(r) {
  const metodoLabel = {
    transferencia: "Transferencia Bancaria",
    efectivo:      "Efectivo",
    cheque:        "Cheque",
    permuta:       "Permuta",
  }[r.metodo_pago] || (r.metodo_pago || "—");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo ${r.numero_recibo} — El Cóndor S.A.S.</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:32px 16px;color:#111}
    .page{max-width:680px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 16px rgba(0,0,0,.13);padding:44px 52px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #16a34a;padding-bottom:20px;margin-bottom:28px}
    .co-name{font-size:22px;font-weight:700;color:#16a34a;margin-bottom:4px}
    .co-sub{font-size:12px;color:#888;line-height:1.6}
    .rec-head{text-align:right}
    .rec-title{font-size:28px;font-weight:800;color:#16a34a;letter-spacing:.02em}
    .rec-sub{font-size:11px;font-weight:700;color:#16a34a;letter-spacing:.08em;text-transform:uppercase;margin-top:2px}
    .rec-num{font-size:15px;font-weight:700;margin-top:6px}
    .rec-date{font-size:12px;color:#888;margin-top:2px}
    .section{margin-bottom:22px}
    .sec-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#aaa;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:10px}
    .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5;font-size:13px}
    .lbl{color:#777}
    .val{font-weight:600;text-align:right}
    .total-box{background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}
    .total-lbl{font-size:13px;color:#777}
    .total-amt{font-size:26px;font-weight:800;color:#16a34a}
    .stamp-wrap{display:flex;justify-content:flex-end;margin-bottom:20px}
    .stamp{display:inline-block;border:3px solid #16a34a;color:#16a34a;font-size:18px;font-weight:800;padding:6px 20px;border-radius:6px;letter-spacing:.12em;transform:rotate(-8deg);opacity:.85}
    .footer{margin-top:28px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#bbb;text-align:center;line-height:1.7}
    .actions{text-align:center;margin-top:28px}
    .btn-p{background:#16a34a;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;margin-right:8px}
    .btn-c{background:#efefef;color:#333;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer}
    @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0;padding:20px 28px}.actions{display:none}}
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div>
        <div class="co-name">El C&oacute;ndor S.A.S.</div>
        <div class="co-sub">Inmobiliaria &amp; Urbanizadora<br>NIT: 900.000.000-0</div>
      </div>
      <div class="rec-head">
        <div class="rec-title">RECIBO</div>
        <div class="rec-sub">Comprobante de Pago</div>
        <div class="rec-num">N&deg; ${r.numero_recibo || "—"}</div>
        <div class="rec-date">Emisi&oacute;n: ${r.fecha_emision || "—"}</div>
      </div>
    </div>

    <div class="stamp-wrap"><div class="stamp">PAGADO</div></div>

    <div class="section">
      <div class="sec-title">Recibido de</div>
      <div class="row"><span class="lbl">Cliente</span><span class="val">${r.comprador || "—"}</span></div>
      ${r.documento ? `<div class="row"><span class="lbl">Documento</span><span class="val">${r.documento}</span></div>` : ""}
    </div>

    <div class="section">
      <div class="sec-title">Concepto del pago</div>
      ${r.id_venta != null ? `<div class="row"><span class="lbl">N&deg; Venta</span><span class="val">#${r.id_venta}</span></div>` : ""}
      <div class="row"><span class="lbl">Proyecto</span><span class="val">${r.proyecto || "—"}</span></div>
      <div class="row"><span class="lbl">Lote</span><span class="val">${r.codigo_lote || "—"}</span></div>
      ${r.numero_cuota != null ? `<div class="row"><span class="lbl">Cuota N&deg;</span><span class="val">${r.numero_cuota}</span></div>` : ""}
      ${r.numero_factura ? `<div class="row"><span class="lbl">Factura</span><span class="val">${_rFmtFactNum(r.numero_factura)}</span></div>` : ""}
    </div>

    <div class="section">
      <div class="sec-title">Detalle del pago</div>
      ${r.fecha_pago ? `<div class="row"><span class="lbl">Fecha de pago</span><span class="val">${r.fecha_pago}</span></div>` : ""}
      ${r.metodo_pago ? `<div class="row"><span class="lbl">Medio de pago</span><span class="val">${metodoLabel}</span></div>` : ""}
      ${r.referencia ? `<div class="row"><span class="lbl">Referencia</span><span class="val">${r.referencia}</span></div>` : ""}
    </div>

    <div class="total-box">
      <span class="total-lbl">Valor recibido</span>
      <span class="total-amt">${_rFmtCOP(r.valor_pago)}</span>
    </div>

    ${r.observaciones ? `<div style="margin-top:16px;padding:10px 14px;background:#f9fafb;border-radius:6px;font-size:12px;color:#666">
      <strong>Observaciones:</strong> ${r.observaciones}
    </div>` : ""}

    <div class="footer">
      Emitido por: ${r.emitido_por || "Sistema SGI"} &bull;
      ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}<br>
      Documento generado por SGI El C&oacute;ndor &bull; Este recibo es v&aacute;lido como comprobante de pago.
    </div>
  </div>

  <div class="actions">
    <button class="btn-p" onclick="window.print()">Imprimir / Descargar PDF</button>
    <button class="btn-c" onclick="window.close()">Cerrar</button>
  </div>
</body>
</html>`;
}

window.verReciboPDF = function(id) {
  const r = (window._recibosMap || {})[id];
  if (!r) return UI.toast("Recibo no encontrado", "error");
  const win = window.open("", "_blank", "width=780,height=720,scrollbars=yes");
  if (!win) return UI.toast("El navegador bloqueó la ventana emergente. Permita ventanas emergentes para este sitio.", "error");
  win.document.write(_buildReciboHTML(r));
  win.document.close();
};

// ── Main view: grouped by venta ──────────────────────────────────────────────
window.recibosView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const data = await API.get("/recibos").catch(e => {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    return null;
  });
  if (!data) return;

  window._recibosMap = {};
  data.forEach(r => { window._recibosMap[r.id_recibo] = r; });

  const ventasMap = new Map();
  data.forEach(r => {
    const key = r.id_venta ?? "none";
    if (!ventasMap.has(key)) {
      ventasMap.set(key, {
        id_venta:    r.id_venta,
        comprador:   r.comprador,
        proyecto:    r.proyecto,
        codigo_lote: r.codigo_lote,
        recibos:     [],
      });
    }
    ventasMap.get(key).recibos.push(r);
  });
  const grupos = [...ventasMap.values()].sort((a, b) => (b.id_venta || 0) - (a.id_venta || 0));
  window._recibosGrupos = grupos;

  const proyectos    = [...new Set(grupos.map(g => g.proyecto))].filter(p => p !== "—").sort();
  const optsProyecto = proyectos.map(p => `<option value="${p}">${p}</option>`).join("");

  function filaVenta(g) {
    const total = g.recibos.reduce((s, r) => s + Number(r.valor_pago || 0), 0);
    return `<tr data-grupo-key="${g.id_venta ?? "none"}" style="cursor:pointer">
      <td>${g.id_venta ? `<strong>#${g.id_venta}</strong>` : "—"}</td>
      <td>${g.comprador}</td>
      <td>${g.proyecto !== "—" ? `${g.proyecto} · <strong>${g.codigo_lote}</strong>` : "—"}</td>
      <td style="text-align:center"><strong>${g.recibos.length}</strong></td>
      <td style="text-align:right">${UI.fmt(total)}</td>
      <td><button class="btn btn-ghost btn-sm btn-ver-recibos">Ver →</button></td>
    </tr>`;
  }

  const emptyState = !grupos.length ? `
    <div style="padding:48px 24px;text-align:center;color:var(--text-muted)">
      <div style="font-size:2.5rem;margin-bottom:12px">🧾</div>
      <p style="font-size:1rem;font-weight:600;margin-bottom:6px">No hay recibos registrados</p>
      <p style="font-size:.85rem;line-height:1.6;max-width:360px;margin:0 auto 20px">
        Los recibos se generan al aceptar pagos de compradores.<br>
        Si ya hay pagos aceptados, usa el boton para generarlos.
      </p>
      <button class="btn btn-primary" id="btn-generar-recibos-empty">Generar recibos de pagos aceptados</button>
    </div>` : "";

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <h3>Recibos de Caja</h3>
        <button class="btn btn-ghost btn-sm" id="btn-generar-recibos">Generar recibos pendientes</button>
      </div>

      ${grupos.length ? `
      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:0 0 1rem">
        <select id="rv-proyecto" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:.83rem">
          <option value="">Todos los proyectos</option>
          ${optsProyecto}
        </select>
        <input id="rv-comprador" type="text" placeholder="Buscar comprador..."
          style="flex:2;min-width:180px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:.83rem">
      </div>

      <div style="overflow-x:auto">
        <table>
          <thead><tr>
            <th>Venta #</th><th>Comprador</th><th>Proyecto / Lote</th>
            <th style="text-align:center">Recibos</th>
            <th style="text-align:right">Total pagado</th><th></th>
          </tr></thead>
          <tbody id="recibos-grupos-tbody">${grupos.map(filaVenta).join("")}</tbody>
        </table>
        <p id="recibos-grupos-empty" style="display:none;text-align:center;color:var(--text-muted);padding:1.5rem">
          No hay recibos que coincidan con los filtros.
        </p>
      </div>` : emptyState}
    </div>`;

  async function generarPendientes(btnEl) {
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = "Generando..."; }
    try {
      const r = await API.post("/recibos/generar-pendientes", {});
      if (r.generados > 0) {
        window.SGIUI?.toast(`${r.generados} recibo(s) generados correctamente`, "success", "Recibos");
        recibosView();
      } else {
        window.SGIUI?.toast("No hay pagos aceptados sin recibo", "info", "Sin pendientes");
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = "Generar recibos pendientes"; }
      }
    } catch(e) {
      window.SGIUI?.toast(e.message, "error", "Error");
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = "Generar recibos pendientes"; }
    }
  }

  document.getElementById("btn-generar-recibos")?.addEventListener("click", e => generarPendientes(e.currentTarget));
  document.getElementById("btn-generar-recibos-empty")?.addEventListener("click", e => generarPendientes(e.currentTarget));

  if (!grupos.length) return;

  const tbody = document.getElementById("recibos-grupos-tbody");

  function aplicarFiltros() {
    const fProyecto = document.getElementById("rv-proyecto").value;
    const fComp     = _rNorm(document.getElementById("rv-comprador").value);
    const visibles  = grupos.filter(g => {
      if (fProyecto && g.proyecto !== fProyecto)              return false;
      if (fComp     && !_rNorm(g.comprador).includes(fComp)) return false;
      return true;
    });
    tbody.innerHTML = visibles.map(filaVenta).join("");
    document.getElementById("recibos-grupos-empty").style.display = visibles.length ? "none" : "block";
  }

  document.getElementById("rv-proyecto").addEventListener("change", aplicarFiltros);
  document.getElementById("rv-comprador").addEventListener("input", aplicarFiltros);

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-ver-recibos");
    if (!btn) return;
    const row = btn.closest("tr[data-grupo-key]");
    if (!row) return;
    const key = row.dataset.grupoKey;
    const g = grupos.find(g => String(g.id_venta ?? "none") === key);
    if (g) recibosDeVentaView(g);
  });
};

// ── Detail view: recibos of a venta ─────────────────────────────────────────
window.recibosDeVentaView = function(grupo) {
  const vc = document.getElementById("viewContainer");
  window._recibosDetalleGrupo = grupo;

  function filaRecibo(r) {
    return `<tr>
      <td style="font-family:monospace;font-weight:600;font-size:.85rem;white-space:nowrap">${r.numero_recibo || "—"}</td>
      <td>${UI.date(r.fecha_emision)}</td>
      <td>${r.numero_cuota != null ? `#${r.numero_cuota}` : "—"}</td>
      <td style="font-family:monospace;font-size:.82rem;white-space:nowrap">${_rFmtFactNum(r.numero_factura)}</td>
      <td style="text-align:right;font-weight:600">${UI.fmt(r.valor_pago)}</td>
      <td>${r.metodo_pago || "—"}</td>
      <td style="max-width:120px;font-size:.82rem">${r.referencia || "—"}</td>
      <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${r.emitido_por || "—"}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="verReciboPDF(${r.id_recibo})">Ver PDF</button></td>
    </tr>`;
  }

  const totalPagado = grupo.recibos.reduce((s, r) => s + Number(r.valor_pago || 0), 0);

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-ghost btn-sm" onclick="recibosView()">← Volver</button>
          <h3>Recibos &mdash; Venta #${grupo.id_venta ?? "sin venta"}</h3>
        </div>
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
            <th>N° Recibo</th><th>Fecha emisión</th><th>Cuota</th><th>Factura</th>
            <th style="text-align:right">Valor</th><th>Método</th><th>Referencia</th><th>Emitido por</th><th></th>
          </tr></thead>
          <tbody>${grupo.recibos.map(filaRecibo).join("")}</tbody>
        </table>
        ${!grupo.recibos.length
          ? `<p style="text-align:center;color:var(--text-muted);padding:1.5rem">Sin recibos para esta venta</p>`
          : ""}
      </div>
    </div>`;
};
