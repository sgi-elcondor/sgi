(function () {

function _rNorm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-͟]/g, "");
}

function _rFmtFactNum(v) {
  if (!v) return "—";
  const s = String(v);
  if (/^\d{7,9}$/.test(s)) {
    const p = s.padStart(9, "0");
    return `20${p.slice(0, 2)}-${p.slice(2, 6)}-${p.slice(6)}`;
  }
  return s;
}

function _rFmtCOP(n) {
  return "$ " + Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
}

function _buildReciboHTML(r) {
  const metodoLabel = {
    transferencia: "Transferencia bancaria",
    efectivo:      "Efectivo",
    cheque:        "Cheque",
    permuta:       "Permuta",
  }[r.metodo_pago] || (r.metodo_pago || "—");

  const valor      = Number(r.valor_pago || 0);
  const valorTxt   = _rFmtCOP(valor);
  const valorWords = (window.SGIExport && window.SGIExport.numToWordsES)
    ? window.SGIExport.numToWordsES(valor)
    : "";

  const waNumber = (window.SGIExport && window.SGIExport.CONTACT && window.SGIExport.CONTACT.whatsapp) || "573001234567";
  const waMsg    = `Hola, quiero obtener mas informacion acerca del recibo: ${r.numero_recibo || ""} por un valor de: ${_rFmtCOP(valor)} realizado en la fecha: ${r.fecha_emision || ""} a nombre de: ${r.comprador || ""}.`.trim();
  const waUrl    = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(waUrl)}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo ${r.numero_recibo} — El Cóndor S.A.S.</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --accent:        #ff4e00;
      --accent-dark:   #c53c00;
      --accent-soft:   #ffe9de;
      --accent-line:   #ffcbb3;
      --text:          #0f172a;
      --text-soft:     #475569;
      --muted:         #94a3b8;
      --line:          #e2e8f0;
      --line-soft:     #f1f5f9;
      --bg:            #f1f4f8;
      --surface:       #ffffff;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:var(--bg)}
    body{
      font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
      color:var(--text);
      padding:48px 16px 32px;
      -webkit-font-smoothing:antialiased;
    }
    .page{
      max-width:780px;margin:0 auto;background:var(--surface);
      border-radius:16px;
      box-shadow:0 1px 2px rgba(15,23,42,.04),0 12px 36px rgba(15,23,42,.08);
      overflow:hidden;position:relative;
    }
    .page-inner{padding:48px 56px;position:relative;z-index:1}

    /* ── Watermark ──────────────────────────────────────────────────────── */
    .watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
    .watermark span{
      font-family:'DM Serif Display',Georgia,serif;
      font-size:148px;color:var(--accent);opacity:.045;
      transform:rotate(-22deg);white-space:nowrap;letter-spacing:-.02em;
    }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:24px;border-bottom:1px solid var(--line)}
    .co{display:flex;flex-direction:column;gap:6px}
    .co-name{font-size:18px;font-weight:700;color:var(--text);letter-spacing:-.01em}
    .co-sub{font-size:11.5px;color:var(--muted);line-height:1.6}
    .rec{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
    .rec-title{
      font-family:'DM Serif Display','Playfair Display',Georgia,serif;
      font-size:34px;font-weight:400;color:var(--text);line-height:1;
    }
    .rec-sub{font-size:10.5px;text-transform:uppercase;letter-spacing:.18em;color:var(--muted);font-weight:600}

    /* ── Hero amount ───────────────────────────────────────────────────── */
    .hero{text-align:center;padding:42px 0 32px}
    .hero-label{font-size:10px;text-transform:uppercase;letter-spacing:.24em;color:var(--muted);font-weight:700;margin-bottom:14px}
    .hero-amount{
      font-family:'DM Serif Display',Georgia,serif;
      font-size:64px;font-weight:400;color:var(--accent-dark);
      letter-spacing:-.025em;line-height:1;font-variant-numeric:tabular-nums;
    }
    .hero-words{
      margin:18px auto 0;max-width:540px;
      font-size:11px;text-transform:uppercase;letter-spacing:.18em;
      color:var(--text-soft);font-weight:600;line-height:1.55;
    }
    .hero-meta{
      margin-top:24px;font-size:12px;color:var(--text-soft);
      display:flex;align-items:center;justify-content:center;gap:14px;
    }
    .hero-meta .dot{width:3px;height:3px;background:var(--muted);border-radius:50%}
    .hero-meta strong{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}

    /* ── Two-column body ───────────────────────────────────────────────── */
    .body-grid{
      display:grid;grid-template-columns:1fr 1fr;gap:48px;
      padding-top:28px;border-top:1px solid var(--line);
    }
    .col-block + .col-block{margin-top:26px}
    .sec-title{
      font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
      color:var(--muted);margin-bottom:12px;
    }
    .row{
      display:flex;justify-content:space-between;gap:12px;
      padding:7px 0;font-size:13px;border-top:1px dashed var(--line-soft);
    }
    .col-block .row:first-of-type{border-top:0}
    .lbl{color:var(--text-soft)}
    .val{font-weight:600;color:var(--text);text-align:right;font-variant-numeric:tabular-nums}

    /* ── Observations ──────────────────────────────────────────────────── */
    .obs{
      margin-top:26px;padding:14px 16px;background:var(--line-soft);
      border-left:3px solid var(--accent);border-radius:6px;
      font-size:12.5px;color:var(--text-soft);line-height:1.6;
    }
    .obs strong{color:var(--text);font-weight:600;display:block;margin-bottom:3px}

    /* ── Signatures ────────────────────────────────────────────────────── */
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:52px}
    .sig{text-align:center}
    .sig-line{border-bottom:1px solid var(--text-soft);margin:32px 16px 10px}
    .sig-role{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:var(--muted);font-weight:700;margin-bottom:4px}
    .sig-name{font-size:13px;color:var(--text);font-weight:600}
    .sig-extra{font-size:11px;color:var(--text-soft);margin-top:2px}

    /* ── Footer with QR ────────────────────────────────────────────────── */
    .foot{
      display:grid;grid-template-columns:auto 1fr;gap:20px;
      margin-top:36px;padding-top:18px;border-top:1px solid var(--line);
      align-items:center;
    }
    .qr-box{
      width:84px;height:84px;padding:5px;background:#fff;
      border:1px solid var(--line);border-radius:8px;flex-shrink:0;
    }
    .qr-box img{width:100%;height:100%;display:block}
    .foot-text{font-size:10.5px;color:var(--muted);line-height:1.7}
    .foot-text strong{color:var(--text-soft);font-weight:600}
    .foot-text .url{
      font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      color:var(--accent-dark);font-size:10px;
    }

    /* ── Actions (outside card) ─────────────────────────────────────────── */
    .actions{display:flex;justify-content:center;gap:10px;margin-top:24px}
    .btn{
      font-family:inherit;cursor:pointer;border:none;border-radius:8px;
      padding:11px 22px;font-size:13.5px;font-weight:600;letter-spacing:.01em;
      transition:transform .12s ease,box-shadow .12s ease,background .15s;
    }
    .btn-p{background:var(--accent);color:#fff;box-shadow:0 1px 0 rgba(197,60,0,.3),0 6px 14px rgba(197,60,0,.18)}
    .btn-p:hover{background:var(--accent-dark);transform:translateY(-1px);box-shadow:0 2px 0 rgba(197,60,0,.3),0 10px 20px rgba(197,60,0,.22)}
    .btn-c{background:#fff;color:var(--text-soft);border:1px solid var(--line)}
    .btn-c:hover{background:var(--line-soft);color:var(--text)}

    @media print{
      html,body{background:#fff}
      body{padding:0}
      .page{box-shadow:none;border-radius:0;max-width:none}
      .page-inner{padding:24px 28px}
      .actions{display:none}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="watermark"><span>El Cóndor</span></div>
    <div class="page-inner">

      <div class="top">
        <div class="co">
          <div class="co-name">El C&oacute;ndor S.A.S.</div>
          <div class="co-sub">Inversiones &amp; Construcciones &middot; NIT 901.708.415-1</div>
        </div>
        <div class="rec">
          <div class="rec-title">Recibo</div>
          <div class="rec-sub">Comprobante de Pago</div>
        </div>
      </div>

      <div class="hero">
        <div class="hero-label">Valor pagado</div>
        <div class="hero-amount">${valorTxt}</div>
        ${valorWords ? `<div class="hero-words">${valorWords}</div>` : ""}
        <div class="hero-meta">
          <span>N&deg; <strong>${r.numero_recibo || "—"}</strong></span>
          <span class="dot"></span>
          <span>Emisi&oacute;n <strong>${r.fecha_emision || "—"}</strong></span>
        </div>
      </div>

      <div class="body-grid">
        <div>
          <div class="col-block">
            <div class="sec-title">Recibido de</div>
            <div class="row"><span class="lbl">Cliente</span><span class="val">${r.comprador || "—"}</span></div>
            ${r.documento ? `<div class="row"><span class="lbl">Documento</span><span class="val">${r.documento}</span></div>` : ""}
          </div>
          <div class="col-block">
            <div class="sec-title">Detalle del pago</div>
            ${r.fecha_pago  ? `<div class="row"><span class="lbl">Fecha de pago</span><span class="val">${r.fecha_pago}</span></div>` : ""}
            ${r.metodo_pago ? `<div class="row"><span class="lbl">Medio de pago</span><span class="val">${metodoLabel}</span></div>` : ""}
            ${r.referencia  ? `<div class="row"><span class="lbl">Referencia</span><span class="val">${r.referencia}</span></div>` : ""}
          </div>
        </div>
        <div>
          <div class="col-block">
            <div class="sec-title">Concepto del pago</div>
            ${r.id_venta != null    ? `<div class="row"><span class="lbl">N&deg; Venta</span><span class="val">#${r.id_venta}</span></div>` : ""}
            <div class="row"><span class="lbl">Proyecto</span><span class="val">${r.proyecto || "—"}</span></div>
            <div class="row"><span class="lbl">Lote</span><span class="val">${r.codigo_lote || "—"}</span></div>
            ${r.numero_cuota != null ? `<div class="row"><span class="lbl">Cuota N&deg;</span><span class="val">${r.numero_cuota}</span></div>` : ""}
            ${r.numero_factura       ? `<div class="row"><span class="lbl">Factura</span><span class="val">${_rFmtFactNum(r.numero_factura)}</span></div>` : ""}
          </div>
        </div>
      </div>

      ${r.observaciones ? `<div class="obs"><strong>Observaciones</strong>${r.observaciones}</div>` : ""}

      <div class="signatures">
        <div class="sig">
          <div class="sig-line"></div>
          <div class="sig-role">Recibi&oacute;</div>
          <div class="sig-name">${r.comprador || "—"}</div>
          <div class="sig-extra">Comprador</div>
        </div>
        <div class="sig">
          <div class="sig-line"></div>
          <div class="sig-role">Emiti&oacute;</div>
          <div class="sig-name">${r.emitido_por || "Sistema SGI"}</div>
          <div class="sig-extra">El C&oacute;ndor S.A.S.</div>
        </div>
      </div>

      <div class="foot">
        <div class="qr-box">
          <img src="${qrUrl}" alt="C&oacute;digo de verificaci&oacute;n" loading="lazy">
        </div>
        <div class="foot-text">
          <strong>Documento generado por SGI El C&oacute;ndor</strong> &middot; ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}<br>
          V&aacute;lido como comprobante de pago.<br>
          Escanee el c&oacute;digo QR para escribirnos por WhatsApp por si tienes dudas con tu recibo.
        </div>
      </div>

    </div>
  </div>

  <div class="actions">
    <button class="btn btn-p" onclick="window.print()">Imprimir o Descargar PDF</button>
    <button class="btn btn-c" onclick="window.close()">Cerrar</button>
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
      <td><button class="btn btn-ghost btn-sm btn-ver-recibos">Ver <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></td>
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
      <div class="table-filters">
        <select id="rv-proyecto" class="select-sm" style="flex:1;min-width:160px;">
          <option value="">Todos los proyectos</option>
          ${optsProyecto}
        </select>
        <input id="rv-comprador" type="text" placeholder="Buscar comprador, lote, proyecto..."
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
    const fBuscar   = document.getElementById("rv-comprador").value;
    const visibles  = grupos.filter(g => {
      if (fProyecto && g.proyecto !== fProyecto) return false;
      if (!SGISearch.matches(fBuscar, g.comprador, g.codigo_lote, g.proyecto)) return false;
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
          <button class="btn btn-ghost btn-sm" onclick="recibosView()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Volver</button>
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

})();