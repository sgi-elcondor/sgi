window.misFacturasView = async function (container) {
  const vc = container || document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  let facturas, ventas;
  try {
    [facturas, ventas] = await Promise.all([
      API.get("/facturas/mis-facturas"),
      API.get("/ventas/mis-ventas").catch(() => []),
    ]);
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }

  const fmt = n => n != null
    ? Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    : "—";

  function diasRestantes(fechaStr) {
    if (!fechaStr) return null;
    const hoy   = new Date(); hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(fechaStr + "T12:00:00");
    return Math.floor((fecha - hoy) / 86_400_000);
  }

  function diasLabel(dias) {
    if (dias === null)  return { text: "—",                                                     cls: "muted" };
    if (dias < 0)       return { text: `Vencida hace ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""}`, cls: "danger" };
    if (dias === 0)     return { text: "Vence hoy",                                             cls: "warning" };
    if (dias <= 3)      return { text: `Vence en ${dias} dia${dias !== 1 ? "s" : ""}`,          cls: "warning" };
    return               { text: `${dias} dias restantes`,                                      cls: "success" };
  }

  function buildLoteSelector(idx) {
    if (!ventas.length || ventas.length <= 1) return "";
    return `<div class="lote-selector">${ventas.map((vt, i) => {
      const label = `${vt.lote?.proyecto?.nombre || "Proyecto"} · Lote ${vt.lote?.codigo_lote || "—"}`;
      return `<button class="lote-tab ${i === idx ? "active" : ""}" data-idx="${i}">${label}</button>`;
    }).join("")}</div>`;
  }

  let selectedIdx = 0;

  function render(idx) {
    const venta   = ventas[idx] || null;
    const idVenta = venta?.id_venta ?? null;

    const filtradas = idVenta !== null
      ? (facturas || []).filter(f => f.id_venta === idVenta)
      : (facturas || []);

    const urgentes = filtradas.filter(f => {
      const d = diasRestantes(f.fecha_vencimiento);
      return d !== null && d <= 3;
    });

    function facturaCard(f) {
      const dias       = diasRestantes(f.fecha_vencimiento);
      const dl         = diasLabel(dias);
      const enRevision = !!f.tiene_comprobante_pendiente;
      const btnPagar   = enRevision
        ? `<button class="btn btn-sm" disabled
             style="opacity:.6;cursor:not-allowed;background:var(--surface-2);color:var(--text-muted);border:1px solid var(--border)">
             ${window.SGIUI?.icon("clock") ?? ""} En revision
           </button>`
        : `<button class="btn btn-primary btn-sm btn-pagar-factura"
             data-venta="${f.id_venta}" data-cuota="${f.id_cuota}" data-factura="${f.id_factura}">
             ${window.SGIUI?.icon("wallet") ?? ""} Pagar
           </button>`;
      return `
        <div class="factura-card ${dias !== null && dias <= 3 ? "urgente" : ""}">
          <div class="factura-card-top">
            <span class="factura-card-num">${f.numero_factura || "—"}</span>
            <span class="factura-card-lote">${f.proyecto} · Lote ${f.codigo_lote}</span>
          </div>
          <div class="factura-card-mid">
            <span class="factura-card-cuota">Cuota #${f.numero_cuota}</span>
            <span class="factura-card-vence ${dl.cls}">${dl.text}</span>
          </div>
          <div class="factura-card-bottom">
            <span class="factura-card-valor">${fmt(f.valor_facturado)}</span>
            ${btnPagar}
          </div>
        </div>`;
    }

    const facturasHtml = filtradas.length
      ? filtradas.map(facturaCard).join("")
      : `<div class="factura-empty-state">
          <div style="opacity:.4;margin-bottom:0.75rem">${window.SGIUI?.icon("file-check") ?? ""}</div>
          <p style="font-size:.9375rem;font-weight:600;color:var(--text);margin-bottom:0.25rem">Sin facturas pendientes</p>
          <p style="font-size:.82rem">Las facturas se emiten automaticamente antes de cada vencimiento.<br>Si necesitas una urgente, comunicate con la oficina.</p>
        </div>`;

    vc.innerHTML = `
      <section class="page-shell">
        ${window.SGIUI?.pageHeader({
          kicker:   "Mis Facturas",
          title:    venta ? `${venta.lote?.proyecto?.nombre || "Mi inmueble"}` : "Mis Facturas",
          subtitle: venta
            ? `Lote ${venta.lote?.codigo_lote || "—"}${venta.lote?.manzana ? " · Manzana " + venta.lote.manzana : ""}`
            : "Facturas emitidas pendientes de pago.",
          meta: filtradas.length
            ? `<span class="results-chip">${window.SGIUI?.icon("file-text") ?? ""} ${filtradas.length} pendiente(s)</span>`
            : "",
        }) ?? ""}

        ${buildLoteSelector(idx)}

        <div class="flow-context-hint">
          ${window.SGIUI?.icon("info") ?? ""}
          <span>Las facturas se generan automaticamente antes del vencimiento de cada cuota. Cuando este lista, aparece el boton <strong>Pagar</strong>.</span>
        </div>

        ${urgentes.length ? `
          <div class="cuota-alert alert-warning">
            <div class="cuota-alert-icon">${window.SGIUI?.icon("clock") ?? ""}</div>
            <div class="cuota-alert-body">
              <div class="cuota-alert-title">Tienes ${urgentes.length} factura(s) por vencer pronto</div>
              <div class="cuota-alert-text">Realiza el pago antes de la fecha limite para evitar mora en tu cuenta.</div>
            </div>
          </div>` : ""}

        <section class="table-wrap">
          <div class="table-header">
            <h3>${window.SGIUI?.icon("file-text") ?? ""} Pendientes de pago (${filtradas.length})</h3>
          </div>
          <div class="facturas-grid">${facturasHtml}</div>
        </section>

        <div style="padding:1rem 0.25rem;text-align:center;display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="navigate('mis-cuotas')">${window.SGIUI?.icon("calendar") ?? ""} Ver plan de cuotas</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('mis-recibos')">${window.SGIUI?.icon("receipt") ?? ""} Ver mis pagos</button>
        </div>
      </section>`;

    window.SGIUI?.hydrate();

    vc.querySelectorAll("[data-idx]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedIdx = Number(btn.dataset.idx);
        render(selectedIdx);
      });
    });

    vc.querySelectorAll(".btn-pagar-factura").forEach(btn => {
      btn.addEventListener("click", () => {
        if (typeof window._abrirModalPago !== "function") return;
        window._abrirModalPago({
          idVenta:   Number(btn.dataset.venta),
          idCuota:   Number(btn.dataset.cuota),
          idFactura: Number(btn.dataset.factura),
          onSuccess: () => {
            btn.disabled = true;
            btn.textContent = "En revision";
            btn.style.cssText = "opacity:.6;cursor:not-allowed;background:var(--surface-2);color:var(--text-muted);border:1px solid var(--border)";
          },
        });
      });
    });
  }

  render(selectedIdx);
};
