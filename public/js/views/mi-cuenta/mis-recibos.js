(function () {

  function fmt(n) {
    return n != null
      ? Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
      : "—";
  }
  function fmtDateShort(d) {
    if (!d) return "—";
    return new Date(d + "T12:00:00").toLocaleDateString("es-CO");
  }

  // ── Comprador recibos view ─────────────────────────────────────────────────
  window.compradorRecibosView = async function (container) {
    const vc = container || document.getElementById("viewContainer");
    vc.innerHTML = UI.loader();

    let ventas, allPagos, misRecibos;
    try {
      [ventas, allPagos, misRecibos] = await Promise.all([
        API.get("/ventas/mis-ventas"),
        API.get("/pagos/mis-pagos"),
        API.get("/recibos/mis-recibos").catch(() => []),
      ]);
    } catch (e) {
      vc.innerHTML = `<p style="color:var(--danger);padding:20px">${e.message}</p>`;
      return;
    }

    window._recibosMap = {};
    (misRecibos || []).forEach(r => { window._recibosMap[r.id_recibo] = r; });

    const pendientes = (allPagos || []).filter(p => p.estado === "pendiente_revision");
    const rechazados = (allPagos || []).filter(p => p.estado === "rechazado");

    const METODO_LABEL = { transferencia: "Transferencia electronica", efectivo: "Efectivo", cheque: "Cheque", permuta: "Permuta" };
    const METODO_BADGE = { transferencia: "info", efectivo: "success", cheque: "muted", permuta: "warning" };

    function buildLoteSelector(idx) {
      if (!ventas.length || ventas.length <= 1) return "";
      return `<div class="lote-selector">
        ${ventas.map((vt, i) => {
          const label = `${vt.lote?.proyecto?.nombre || "Proyecto"} · Lote ${vt.lote?.codigo_lote || "—"}`;
          return `<button class="lote-tab ${i === idx ? "active" : ""}" data-idx="${i}">${label}</button>`;
        }).join("")}
      </div>`;
    }

    function reciboCard(r) {
      const loteInfo = r.proyecto !== "—" ? `${r.proyecto} · Lote ${r.codigo_lote}` : "—";
      return `
        <div class="recibo-list-item">
          <div class="recibo-list-icon">${window.SGIUI?.icon("receipt") ?? ""}</div>
          <div class="recibo-list-body">
            <div class="recibo-list-num">${r.numero_recibo}</div>
            <div class="recibo-list-meta">${loteInfo}</div>
            ${r.numero_cuota ? `<div class="recibo-list-meta">Cuota #${r.numero_cuota} &bull; ${METODO_LABEL[r.metodo_pago] || r.metodo_pago}</div>` : `<div class="recibo-list-meta">${METODO_LABEL[r.metodo_pago] || r.metodo_pago}</div>`}
          </div>
          <div class="recibo-list-right">
            <div class="recibo-list-fecha">${fmtDateShort(r.fecha_emision)}</div>
            <div class="recibo-list-valor">${fmt(r.valor_pago)}</div>
            <button class="btn btn-ghost btn-sm" onclick="verReciboPDF(${r.id_recibo})">${window.SGIUI?.icon("file-text") ?? ""} Ver recibo</button>
          </div>
        </div>`;
    }

    function pagoCard(p) {
      return `
        <div class="pago-card">
          <div class="pago-card-left">
            <div><span class="badge badge-${METODO_BADGE[p.metodo_pago] || "muted"}">${METODO_LABEL[p.metodo_pago] || p.metodo_pago}</span></div>
            <div class="pago-card-meta">Fecha: ${fmtDateShort(p.fecha_pago?.split("T")[0])}</div>
            ${p.url_baucher ? `<a href="${p.url_baucher}" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:4px">${window.SGIUI?.icon("image") ?? ""} Ver baucher</a>` : ""}
          </div>
          <div class="pago-card-right">
            <div class="pago-card-valor">${fmt(p.valor_pago)}</div>
            ${UI.badge(p.estado)}
          </div>
        </div>`;
    }

    let selectedIdx = 0;

    function render(idx) {
      const venta = ventas[idx] || null;

      const recibosHtml = (misRecibos || []).length
        ? (misRecibos || []).map(reciboCard).join("")
        : `<div style="padding:3rem 1.5rem;text-align:center;color:var(--text-muted)">
            <div style="margin-bottom:0.75rem;opacity:.4">${window.SGIUI?.icon("receipt") ?? ""}</div>
            <p style="font-size:.95rem;font-weight:600;color:var(--text);margin-bottom:0.25rem">Sin recibos aun</p>
            <p style="font-size:.82rem">Los recibos aparecen aqui cuando el equipo contable aprueba tus pagos.</p>
          </div>`;

      vc.innerHTML = `
        <section class="page-shell">
          ${window.SGIUI?.pageHeader({
            kicker: "Mi cuenta",
            title: venta ? `${venta.lote?.proyecto?.nombre || "Mi inmueble"}` : "Mis Recibos",
            subtitle: venta
              ? `Lote ${venta.lote?.codigo_lote || "—"}${venta.lote?.manzana ? " · Manzana " + venta.lote.manzana : ""}`
              : "Recibos de pago emitidos a tu nombre.",
            actions: venta ? `<button class="btn btn-primary" id="btn-nuevo-pago-recibos">${window.SGIUI?.icon("plus") ?? ""} Nuevo pago</button>` : "",
            meta: (misRecibos || []).length
              ? `<span class="results-chip">${window.SGIUI?.icon("receipt") ?? ""} ${misRecibos.length} recibo(s)</span>`
              : "",
          }) ?? ""}
          ${buildLoteSelector(idx)}
          <section class="table-wrap">
            <div style="display:flex;flex-direction:column;gap:0">${recibosHtml}</div>
          </section>

          ${pendientes.length ? `
            <section class="table-wrap" style="margin-top:1rem">
              <div class="table-header"><h3>${window.SGIUI?.icon("clock") ?? ""} En revision (${pendientes.length})</h3></div>
              <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem">${pendientes.map(pagoCard).join("")}</div>
            </section>` : ""}

          ${rechazados.length ? `
            <section class="table-wrap" style="margin-top:1rem">
              <div class="table-header"><h3 style="color:var(--danger)">${window.SGIUI?.icon("x-circle") ?? ""} Rechazados (${rechazados.length})</h3></div>
              <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem">${rechazados.map(pagoCard).join("")}</div>
            </section>` : ""}
        </section>`;

      window.SGIUI?.hydrate();

      vc.querySelectorAll(".lote-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedIdx = Number(btn.dataset.idx);
          render(selectedIdx);
        });
      });

      document.getElementById("btn-nuevo-pago-recibos")?.addEventListener("click", () => {
        if (!venta) return;
        const ca = venta.cuota_actual;
        window._abrirModalPago({ idVenta: venta.id_venta, idCuota: ca?.id_cuota, valorCuota: ca?.valor_cuota, numeroCuota: ca?.numero_cuota });
      });
    }

    render(selectedIdx);
  };

})();