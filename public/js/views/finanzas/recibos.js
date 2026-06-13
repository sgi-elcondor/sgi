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

  const fmtD = (window.SGIExport && window.SGIExport.fmtDate) ? window.SGIExport.fmtDate : (x => x || "");
  const fechaPago = fmtD(r.fecha_pago || r.fecha_emision);

  const waNumber = (window.SGIExport && window.SGIExport.CONTACT && window.SGIExport.CONTACT.whatsapp) || "573001234567";
  const waMsg    = `Hola, quiero obtener mas informacion acerca del recibo: ${r.numero_recibo || ""} por un valor de: ${valorTxt} realizado en la fecha: ${fechaPago} a nombre de: ${r.comprador || ""}.`.trim();
  const waUrl    = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
  const qrUrl    = window.SGIExport.qrDataUri(waUrl);

  if (window.SGIExport && window.SGIExport.comprobanteHTML) {
    return window.SGIExport.comprobanteHTML({
      docTitle: `Recibo ${r.numero_recibo || ""} — El Cóndor S.A.S.`,
      badge:    "Comprobante de Pago",
      fields: [
        { icon: "check",    label: "Estado de la transacción", value: "Pagado", badge: "success" },
        { icon: "receipt",  label: "N° de recibo",             value: r.numero_recibo },
        { icon: "user",     label: "Cliente",                  value: r.comprador },
        { icon: "hash",     label: "Documento",                value: r.documento },
        { icon: "briefcase",label: "N° de venta",              value: r.id_venta != null ? `#${r.id_venta}` : "" },
        { icon: "pin",      label: "Proyecto / Lote",          value: [r.proyecto, r.codigo_lote].filter(x => x && x !== "—").join(" · ") },
        { icon: "calendar", label: "Fecha de pago",            value: fechaPago },
        { icon: "card",     label: "Medio de pago",            value: r.metodo_pago ? metodoLabel : "" },
        { icon: "tag",      label: "Referencia",               value: r.referencia },
      ],
      trace: [
        { label: "Cuota",   value: r.numero_cuota != null ? `#${r.numero_cuota}` : "" },
        { label: "Factura", value: r.numero_factura ? _rFmtFactNum(r.numero_factura) : "" },
        { label: "Pago",    value: r.numero_pago || "" },
        { label: "Recibo",  value: r.numero_recibo || "", current: true },
      ],
      totalLabel: "Total pagado",
      totalValue: valorTxt,
      totalWords: valorWords,
      qrUrl,
      qrCaption: "<strong>¿Dudas con tu recibo?</strong><br>Escanea el código QR para escribirnos por WhatsApp.",
    });
  }

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