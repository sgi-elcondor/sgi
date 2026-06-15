(function () {

const EXPORT_ROLES = ["admin", "gerencia", "auxiliar_contable"];

window.ventasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const modoSolicitud = AppState.can('ventas', 'solicitar') && !AppState.can('ventas', 'actualizar');
  const canCreate     = AppState.can('ventas', 'crear') || AppState.can('ventas', 'solicitar');
  const isJuridico    = (window.currentUser?.rol || "") === "juridico";
  const botonNueva    = !canCreate ? "" : modoSolicitud
    ? `<button class="btn btn-primary btn-sm" onclick="ventaFormSolicitud()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Solicitar Venta</button>`
    : `<button class="btn btn-primary btn-sm" onclick="ventaForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Venta</button>`;

  const ESTADOS_JURIDICO = ["pre_mora", "en_mora"];

  function _renderVentasSummary(rows) {
    const el = document.getElementById("fv-summary");
    if (!el) return;
    const total   = rows.length;
    const activas = rows.filter(v => v.estado === "activa").length;
    const enMora  = rows.filter(v => v.estado === "pre_mora" || v.estado === "en_mora").length;
    const valor   = rows.reduce((s, v) => s + Number(v.valor_total || 0), 0);
    el.innerHTML = window.SGIUI.statCards([
      { label: "Ventas",     value: total,           sub: "Resultado actual" },
      { label: "Activas",    value: activas,         sub: "Al día" },
      { label: "En mora",    value: enMora,          sub: "Pre-mora + mora", tone: enMora ? "danger" : "" },
      { label: "Valor total", value: window.SGIUI.fmtCompactMoney(valor), title: UI.fmt(valor), sub: "Suma del resultado" },
    ]);
  }

  // Build query from filter state
  async function _cargarVentas() {
    const estado  = document.getElementById("fv_estado")?.value  || "";
    const mes     = document.getElementById("fv_mes")?.value     || "";
    const cliente = document.getElementById("fv_cliente")?.value.trim() || "";
    const proyecto= document.getElementById("fv_proyecto")?.value|| "";

    const params = new URLSearchParams();
    if (estado)  params.set("estado",  estado);
    if (mes && /^\d{4}-\d{2}$/.test(mes)) params.set("mes", mes);
    if (cliente) params.set("cliente", cliente);
    if (proyecto)params.set("proyecto",proyecto);

    const qs = params.toString();
    const tbody = document.getElementById("fv_tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:16px">${UI.loader()}</td></tr>`;

    let rows = await API.get(`/ventas${qs ? "?" + qs : ""}`).catch(e => {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="color:var(--danger);padding:12px">${e.message}</td></tr>`;
      return null;
    });
    if (!rows) return;

    if (isJuridico) {
      rows = rows.filter(v => ESTADOS_JURIDICO.includes(v.estado));
    }

    _renderVentasSummary(rows);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:16px;color:var(--text-muted)">Sin resultados</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(v => {
      const compradores = (v.venta_comprador || [])
        .map(vc => `${vc.usuario?.nombres || ""} ${vc.usuario?.apellidos || ""}`.trim() + (vc.usuario?.documento ? ` (${vc.usuario.documento})` : ""))
        .join(", ") || "—";
      const vc0 = Array.isArray(v.venta_comisionista) ? v.venta_comisionista[0] : v.venta_comisionista;
      const comisionista = vc0
        ? `${vc0.usuario?.nombres || ""} ${vc0.usuario?.apellidos || ""}`.trim()
        : "—";
      const lote = v.lote ? `${v.lote.codigo_lote} M${v.lote.manzana}-${v.lote.numero_lote}` : "—";
      return `<tr>
        <td>${v.id_venta}</td>
        <td>${v.lote?.proyecto?.nombre || "—"}</td>
        <td>${lote}</td>
        <td style="max-width:180px;font-size:.82rem">${compradores}</td>
        <td>${UI.date(v.fecha_venta)}</td>
        <td>${UI.fmt(v.valor_total)}</td>
        <td>${UI.fmt(v.cuota_inicial)}</td>
        <td style="font-size:.82rem">${comisionista}</td>
        <td>${UI.badge(v.estado)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="verVenta(${v.id_venta})">Ver</button></td>
      </tr>`;
    }).join("");
  }

  const ESTADOS = isJuridico
    ? ["pre_mora", "en_mora"]
    : ["activa","pre_mora","en_mora","cancelada","liquidada","pendiente_autorizacion"];

  vc.innerHTML = `
    <div id="fv-summary"></div>
    <div class="table-wrap">
      <div class="table-header">
        <h3>Ventas${isJuridico ? " en mora" : ""}</h3>
        ${botonNueva}
      </div>
      ${isJuridico ? `<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;">
        Solo se muestran ventas en estado <b>pre-mora</b> o <b>mora</b>.
      </p>` : ""}
      ${modoSolicitud ? `<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;">
        Puedes crear solicitudes de venta. Quedan en estado <b>pendiente de autorización</b> hasta que sean aprobadas.
      </p>` : ""}
      ${window.SGIUI.filterBar({
        fields: [
          { type: "search", id: "fv_proyecto", label: "Proyecto", placeholder: "Filtrar por proyecto…", oninput: "_cargarVentasFiltro()" },
          { type: "search", id: "fv_cliente", label: "Cliente (cédula o nombre)", placeholder: "Buscar cliente, lote…", oninput: "_cargarVentasFiltro()", grow: true },
          { type: "select", id: "fv_estado", label: "Estado", onchange: "_cargarVentasFiltro()",
            options: [{ value: "", label: "Todos los estados" }, ...ESTADOS.map(e => ({ value: e, label: e.replace(/_/g, " ") }))] },
          { type: "month", id: "fv_mes", label: "Mes", onchange: "_cargarVentasFiltro()" },
        ],
        actions: `<button class="btn btn-ghost btn-sm" onclick="_limpiarFiltrosVentas()">Limpiar</button>`,
      })}
      <div class="sticky-table-scroll">
        <table>
          <thead><tr>
            <th>#</th><th>Proyecto</th><th>Lote</th><th>Comprador(es)</th>
            <th>Fecha</th><th>Valor Total</th><th>Cuota Inicial</th>
            <th>Comisionista</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody id="fv_tbody"><tr><td colspan="10" style="text-align:center;padding:16px">${UI.loader()}</td></tr></tbody>
        </table>
      </div>
    </div>`;

  window._cargarVentasFiltro = _cargarVentas;
  window._limpiarFiltrosVentas = function() {
    ["fv_proyecto","fv_cliente","fv_estado","fv_mes"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    _cargarVentas();
  };

  _cargarVentas();
};
window.verVenta = async function(id) {
  let v;

  try {
    v = await API.get(`/ventas/${id}`);
  } catch(e) {
    UI.toast(e.message, "error");
    return;
  }

  // ── Helpers visuales del detalle ──
  const S = (titulo, contenido, icono = "") => `
    <section class="venta-detail-section">
      <div class="venta-detail-section-head">
        <span>${icono}${titulo}</span>
      </div>
      <div class="venta-detail-section-body">
        ${contenido}
      </div>
    </section>`;

  const R = (label, value) => `
    <div class="venta-detail-row">
      <span class="venta-detail-label">${label}</span>
      <span class="venta-detail-value">${value}</span>
    </div>`;

  const bar = (pct, color = "var(--primary,#ff6a00)") => `
    <div class="venta-progress">
      <div style="width:${Math.min(100, Math.max(0, pct)).toFixed(1)}%;background:${color}"></div>
    </div>`;

  const statCard = (label, value, detail = "") => `
    <div class="venta-detail-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      ${detail ? `<small>${detail}</small>` : ""}
    </div>`;

  // ── Cuotas ──
  const cuotas = (v.cuota || []).sort((a, b) => a.numero_cuota - b.numero_cuota);

  const cuotasIni = cuotas.filter(c => c.tipo === "inicial");
  const cuotasReg = cuotas.filter(c => c.tipo === "regular");

  // RN-16: paid state derived from receipts by the backend (getById), not the stored estado.
  const pagada = c => c.pagada === true;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const vencida = c => {
    const f = c.fecha_vencimiento
      ? new Date(c.fecha_vencimiento + "T12:00:00")
      : null;

    return f && f < hoy && !pagada(c);
  };

  const pagIni = cuotasIni.filter(pagada);
  const pagReg = cuotasReg.filter(pagada);

  const sumVal = arr => arr.reduce((s, c) => s + Number(c.valor_cuota || 0), 0);

  // RN-10: count receipt-backed amounts (includes partial payments), the single criterion.
  const totalPagadoIni = cuotasIni.reduce((s, c) => s + Number(c.valor_pagado || 0), 0);
  const totalPagadoReg = cuotasReg.reduce((s, c) => s + Number(c.valor_pagado || 0), 0);

  // ── Financiero ──
  const vt = Number(v.valor_total) || 0;
  const ci = Number(v.cuota_inicial) || 0;
  const tp = Number(v.total_permutas) || 0;
  const totalPagado = totalPagadoIni + totalPagadoReg + tp;
  const saldo = Math.max(0, vt - ci - tp);

  const cuotasPendientes = cuotas.filter(c => !pagada(c)).length;
  const cuotasVencidas = cuotas.filter(vencida).length;

  const proximaCuota = cuotas
    .filter(c => !pagada(c))
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0];
  const pct = vt > 0 ? totalPagado / vt * 100 : 0;

  const cumple = pct >= 30;
  const escrit = v.escriturado === true || v.fecha_escritura != null;

  // ── Comisionista ──
  const vc0 = Array.isArray(v.venta_comisionista)
    ? v.venta_comisionista[0]
    : v.venta_comisionista;

  // ── Permutas detalle ──
  let permsDetalle = "";

  if (tp > 0 && v.detalle_permutas) {
    try {
      permsDetalle = " — " + JSON.parse(v.detalle_permutas)
        .map(p => `${p.descripcion} (${UI.fmt(p.valor)})`)
        .join(", ");
    } catch {}
  }

  // ── Tabla de cuotas ──
  const cuotaRow = c => {
    const ok = pagada(c);
    const ven = vencida(c);

    const badgeClass = ok
      ? "is-paid"
      : ven
        ? "is-overdue"
        : "is-pending";

    const label = ok
      ? "Pagada"
      : ven
        ? "Vencida"
        : "Pendiente";

    return `
      <tr class="${ven ? "is-overdue" : ""}">
        <td>${c.numero_cuota}</td>
        <td>${UI.date(c.fecha_vencimiento)}</td>
        <td class="venta-quota-value">${UI.fmt(c.valor_cuota)}</td>
        <td>${c.fecha_pago ? UI.date(c.fecha_pago) : "—"}</td>
        <td>
          <span class="venta-quota-badge ${badgeClass}">
            ${label}
          </span>
        </td>
      </tr>`;
  };

  const theadCuotas = `
    <thead>
      <tr>
        <th>#</th>
        <th>Vencimiento</th>
        <th style="text-align:right">Valor</th>
        <th>Fecha pago</th>
        <th>Estado</th>
      </tr>
    </thead>`;

  const canExport     = EXPORT_ROLES.includes(window.currentUser?.rol);
  const puedeEliminar = ["auxiliar_contable", "admin"].includes(window.currentUser?.rol);

  const lote = v.lote || {};

  const html = `
    <div class="venta-detail-modal">

      <div class="venta-detail-hero">
        <div>
          <span class="venta-detail-kicker">Detalle de venta</span>
          <h3>Venta #${v.id_venta}</h3>
          <p>Registrada el ${UI.date(v.fecha_venta)}</p>
        </div>

        <div class="venta-detail-status">
          ${UI.badge(v.estado)}
        </div>
      </div>

      <div class="venta-detail-stats">
        ${statCard("Valor total", UI.fmt(vt), "Valor comercial registrado")}
        ${statCard("Saldo financiado", UI.fmt(saldo), `${cuotasReg.length} cuota(s) regular(es)`)}
        ${statCard("Total pagado", UI.fmt(totalPagado), `${pct.toFixed(1)}% del valor total`)}
        ${statCard(
          "Próximo vencimiento",
          proximaCuota ? UI.date(proximaCuota.fecha_vencimiento) : "—",
          cuotasVencidas > 0
            ? `${cuotasVencidas} cuota(s) vencida(s)`
            : `${cuotasPendientes} cuota(s) pendiente(s)`
        )}
      </div>

      ${S("Lote / Proyecto", `
        ${R("Proyecto", `<b>${lote.proyecto?.nombre || "—"}</b>`)}
        ${R("Código", lote.codigo_lote || "—")}
        ${R("Ubicación", `Mz ${lote.manzana || "—"} · Lote ${lote.numero_lote || "—"}`)}
        ${lote.area_m2 ? R("Área", `${lote.area_m2} m²`) : ""}
        ${R("Precio lista", UI.fmt(lote.precio_lista))}
        ${lote.estado ? R("Estado del lote", UI.badge(lote.estado)) : ""}
      `)}

      ${(() => {
        const puedeEditar = AppState.can('ventas', 'editar_financiero');

        const vfBody = `
          ${R("Valor total", `<b style="font-size:.95rem">${UI.fmt(vt)}</b>`)}
          ${ci > 0 ? R("Cuota inicial", UI.fmt(ci)) : ""}
          ${tp > 0 ? R("Permutas", `${UI.fmt(tp)}${permsDetalle}`) : ""}
          ${R("Saldo financiado", `<b style="color:var(--primary,#ff6a00)">${UI.fmt(saldo)}</b>`)}
          ${v.observaciones ? R("Observaciones", `<em style="color:var(--text-muted)">${v.observaciones}</em>`) : ""}
        `;

        return `
          <section class="venta-detail-section">
            <div class="venta-detail-section-head">
              <span>Valores financieros</span>
              ${puedeEditar ? `
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  style="font-size:.72rem;padding:2px 8px;text-transform:none;font-weight:700;letter-spacing:0"
                  onclick="_editarPlanCuotas(${v.id_venta})">
                  Editar venta
                </button>` : ""}
            </div>
            <div id="sgi_vf_body" class="venta-detail-section-body">
              ${vfBody}
            </div>
          </section>`;
      })()}

      ${S("Compradores", `
        <div class="venta-quota-table-wrap">
          <table class="venta-quota-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              ${(v.venta_comprador || []).map(vc => `
                <tr>
                  <td><b>${vc.usuario?.nombres || ""} ${vc.usuario?.apellidos || ""}</b></td>
                  <td>${vc.usuario?.documento || "—"}</td>
                  <td>${vc.usuario?.telefono || "—"}</td>
                  <td>${vc.usuario?.email || "—"}</td>
                  <td>${vc.porcentaje || 100}%</td>
                </tr>
              `).join("") || `
                <tr>
                  <td colspan="5" style="color:var(--text-muted)">Sin compradores</td>
                </tr>`}
            </tbody>
          </table>
        </div>
      `)}

      ${vc0 ? S("Comisionista", `
        ${R("Nombre", `<b>${vc0.usuario?.nombres || ""} ${vc0.usuario?.apellidos || ""}</b>`)}
        ${vc0.usuario?.documento ? R("Documento", vc0.usuario.documento) : ""}
        ${vc0.usuario?.telefono ? R("Teléfono", vc0.usuario.telefono) : ""}
        ${vc0.usuario?.email ? R("Correo", vc0.usuario.email) : ""}
        ${R("Valor comisión", `<b style="color:var(--primary,#ff6a00)">${UI.fmt(vc0.valor_comision)}</b>`)}
      `) : ""}

      ${cuotasIni.length ? S("Cuotas de cuota inicial", `
        <div class="venta-quota-summary">
          <span>Pagadas: <b>${pagIni.length}/${cuotasIni.length}</b></span>
          <span>Recaudado: <b style="color:var(--success,#22c55e)">${UI.fmt(totalPagadoIni)}</b></span>
          <span>Pendiente: <b>${UI.fmt(sumVal(cuotasIni) - totalPagadoIni)}</b></span>
        </div>

        ${bar(
          cuotasIni.length ? pagIni.length / cuotasIni.length * 100 : 0,
          "var(--success,#22c55e)"
        )}

        <div class="venta-quota-table-wrap">
          <table class="venta-quota-table">
            ${theadCuotas}
            <tbody>${cuotasIni.map(cuotaRow).join("")}</tbody>
          </table>
        </div>
      `) : ""}

      ${cuotasReg.length ? S("Cuotas regulares", `
        <div class="venta-quota-summary">
          <span>Pagadas: <b>${pagReg.length}/${cuotasReg.length}</b></span>
          <span>Recaudado: <b style="color:var(--success,#22c55e)">${UI.fmt(totalPagadoReg)}</b></span>
          <span>Pendiente: <b style="color:var(--danger,#ef4444)">${UI.fmt(sumVal(cuotasReg) - totalPagadoReg)}</b></span>
          <span>Cuota: <b>${UI.fmt(Math.round(sumVal(cuotasReg) / cuotasReg.length))}/mes</b></span>
        </div>

        ${bar(cuotasReg.length ? pagReg.length / cuotasReg.length * 100 : 0)}

        <div class="venta-quota-table-wrap">
          <table class="venta-quota-table">
            ${theadCuotas}
            <tbody>${cuotasReg.map(cuotaRow).join("")}</tbody>
          </table>
        </div>
      `) : cuotas.length === 0 ? `
        <div style="font-size:.82rem;color:var(--text-muted);padding:8px 0">
          Sin plan de pago registrado
        </div>` : ""}

      ${S("Estado global de pagos y escritura", `
        ${R("Total pagado", `<b>${UI.fmt(totalPagado)}</b> de ${UI.fmt(vt)}`)}
        ${R(
          "Porcentaje pagado",
          `<b style="color:${pct >= 30 ? "var(--success,#22c55e)" : "var(--primary,#ff6a00)"}">${pct.toFixed(1)}%</b>`
        )}

        <div style="margin:4px 0 10px">
          ${bar(
            pct,
            pct >= 30 ? "var(--success,#22c55e)" : "var(--primary,#ff6a00)"
          )}
        </div>

        ${R("Por pagar", `<b style="color:var(--danger,#ef4444)">${UI.fmt(Math.max(0, vt - totalPagado))}</b>`)}

        <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">

        ${R(
          "Requisito escritura (30%)",
          cumple
            ? `<span style="color:var(--success,#22c55e);font-weight:700">✓ Cumple — ${pct.toFixed(1)}% pagado</span>`
            : `<span style="color:var(--text-muted)">No cumple — faltan ${(30 - pct).toFixed(1)}% (${UI.fmt(Math.max(0, vt * 0.3 - totalPagado))})</span>`
        )}

        ${R(
          "Escriturado",
          escrit
            ? `<span style="color:var(--success,#22c55e);font-weight:700">✓ Sí${v.fecha_escritura ? " · " + UI.date(v.fecha_escritura) : ""}</span>`
            : cumple
              ? `<span style="color:var(--warning,#e8570c);font-weight:700">Pendiente — cumple el requisito, en espera del auxiliar contable</span>`
              : `<span style="color:var(--text-muted)">No — aún no alcanza el 30%</span>`
        )}
      `)}

      ${canExport ? `
      <div class="form-actions" style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" id="btnVentaExcel">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Exportar Excel
        </button>
        <button class="btn btn-primary btn-sm" id="btnVentaPDF">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Exportar PDF
        </button>
      </div>` : ""}

      ${puedeEliminar ? `
      <div class="form-actions" style="margin-top:.75rem;padding-top:1rem;border-top:1px solid var(--border);justify-content:flex-end;gap:.5rem">
        <button class="btn btn-ghost btn-sm" id="btnVentaCancelar" style="color:var(--warning,#e8570c)">Cancelar venta</button>
        <button class="btn btn-danger btn-sm" id="btnVentaEliminar">Eliminar venta</button>
      </div>` : ""}
    </div>`;

  UI.openModal(`Detalle · Venta #${v.id_venta}`, html);

  if (canExport) {
    const fin = { vt, ci, tp, totalPagado, saldo, pct, cumple, escrit, cuotasIni, cuotasReg, pagIni, pagReg, sumVal };
    document.getElementById("btnVentaPDF")?.addEventListener("click",   () => _exportVentaPDF(v, cuotas, fin));
    document.getElementById("btnVentaExcel")?.addEventListener("click", () => _exportVentaExcel(v, cuotas, fin));
  }
  if (puedeEliminar) {
    document.getElementById("btnVentaEliminar")?.addEventListener("click", () => _eliminarVenta(v.id_venta));
    document.getElementById("btnVentaCancelar")?.addEventListener("click", () => _cancelarVenta(v.id_venta));
  }
};

// Point 6: delete a clean venta, or fall back to cancel when it has receipts.
// Pre-checks the venta's pagos/facturas/recibos: if any accepted payment or receipt exists
// (RN-05, immutable receipts), deletion is blocked and the blocking documents are shown so
// the aux understands why, offering "Cancelar venta" instead.
window._eliminarVenta = async function(id) {
  UI.openModal("Eliminar venta", UI.loader());

  let pagos = [], facturas = [], recibos = [];
  try {
    [pagos, facturas, recibos] = await Promise.all([
      API.get("/pagos").catch(() => []),
      API.get("/facturas").catch(() => []),
      API.get("/recibos").catch(() => []),
    ]);
  } catch (_) {}
  pagos    = (pagos    || []).filter(p => p.id_venta === id);
  facturas = (facturas || []).filter(f => f.id_venta === id);
  recibos  = (recibos  || []).filter(r => r.id_venta === id);

  const bloqueada = recibos.length > 0 || pagos.some(p => p.estado === "aceptado");
  const body = document.getElementById("modalBody");
  if (!body) return;

  if (bloqueada) {
    const pill = (txt, extra = "") =>
      `<div style="font-size:.82rem;padding:5px 9px;background:var(--surface-2,#f0f4f8);border-radius:6px;display:flex;justify-content:space-between;align-items:center;gap:8px">${txt}${extra}</div>`;
    const docSection = (titulo, items) => items.length ? `
      <div>
        <div style="font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:700;margin-bottom:5px">${titulo} (${items.length})</div>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:8rem;overflow-y:auto">${items.join("")}</div>
      </div>` : "";

    const pagosHTML = pagos.map(p =>
      pill(`<span style="font-family:monospace">${p.numero_pago || "#" + p.id_pago}</span> · ${UI.fmt(p.valor_pago)}`, UI.badge(p.estado))
    );
    const facturasHTML = facturas.map(f =>
      pill(`<span style="font-family:monospace">${f.numero_factura ?? "—"}</span>`, UI.badge(f.estado))
    );
    const recibosHTML = recibos.map(r =>
      pill(`<span style="font-family:monospace">${r.numero_recibo}</span> · ${UI.fmt(r.valor_pago)}`)
    );

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:.5rem;padding:.75rem 1rem;font-size:.86rem;line-height:1.5">
          La venta #${id} <b>no se puede eliminar</b>: ya tiene documentos contables (pagos aceptados o recibos) que son inmutables (RN-05). Puedes <b>cancelar</b> la venta — se conserva todo y queda en auditoría.
        </div>
        ${docSection("Pagos", pagosHTML)}
        ${docSection("Facturas", facturasHTML)}
        ${docSection("Recibos", recibosHTML)}
        <div class="form-actions">
          <button class="btn btn-ghost" onclick="UI.closeModal()">Cerrar</button>
          <button class="btn btn-primary" id="del-venta-cancelar">Cancelar venta</button>
        </div>
      </div>`;
    document.getElementById("del-venta-cancelar")?.addEventListener("click", () => _cancelarVenta(id));
    return;
  }

  const facturasInfo = facturas.length
    ? `<div style="font-size:.82rem;color:var(--text-muted)">Se eliminarán también ${facturas.length} factura(s) sin cobro y el plan de cuotas.</div>`
    : "";
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:.5rem;padding:.75rem 1rem;font-size:.86rem;line-height:1.5">
        Esto <b>elimina</b> la venta #${id} y su plan de cuotas. La venta no tiene pagos aceptados ni recibos. La acción queda en auditoría.
      </div>
      ${facturasInfo}
      <div class="form-group">
        <label>Motivo (opcional)</label>
        <input id="del-venta-motivo" type="text" placeholder="Ej: venta duplicada / registrada por error" />
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-danger" id="del-venta-confirm">Eliminar venta</button>
      </div>
    </div>`;
  document.getElementById("del-venta-confirm")?.addEventListener("click", async () => {
    const motivo = document.getElementById("del-venta-motivo")?.value.trim() || undefined;
    const btn = document.getElementById("del-venta-confirm");
    btn.disabled = true; btn.textContent = "Eliminando...";
    try {
      await API.delete(`/ventas/${id}`, motivo ? { motivo } : undefined);
      UI.closeModal();
      UI.toast("Venta eliminada", "ok");
      if (typeof window.ventasView === "function") window.ventasView();
    } catch (e) {
      btn.disabled = false; btn.textContent = "Eliminar venta";
      UI.toast(e.message || "No se pudo eliminar la venta", "error");
    }
  });
};

window._cancelarVenta = function(id) {
  UI.openModal("Cancelar venta", `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:.5rem;padding:.75rem 1rem;font-size:.86rem;line-height:1.5">
        La venta #${id} se marcará como <b>cancelada</b>. No se elimina nada: se conservan
        cuotas, facturas y recibos. Queda registrado en auditoría.
      </div>
      <div class="form-group">
        <label>Motivo de la cancelación *</label>
        <textarea id="cancel-venta-motivo" rows="2" placeholder="Describe el motivo (mín. 5 caracteres)"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Volver</button>
        <button class="btn btn-primary" id="cancel-venta-confirm">Cancelar venta</button>
      </div>
    </div>`);
  document.getElementById("cancel-venta-confirm")?.addEventListener("click", async () => {
    const motivo = document.getElementById("cancel-venta-motivo")?.value.trim() || "";
    if (motivo.length < 5) return UI.toast("Indica el motivo (mín. 5 caracteres)", "error");
    const btn = document.getElementById("cancel-venta-confirm");
    btn.disabled = true; btn.textContent = "Cancelando...";
    try {
      await API.patch(`/ventas/${id}/cancelar`, { motivo });
      UI.closeModal();
      UI.toast("Venta cancelada", "ok");
      if (typeof window.ventasView === "function") window.ventasView();
    } catch (e) {
      btn.disabled = false; btn.textContent = "Cancelar venta";
      UI.toast(e.message || "No se pudo cancelar la venta", "error");
    }
  });
};

// ── Editor de venta (valor total + cuota inicial + plan de cuotas) ───────────
// Cambiar el valor total o la cuota inicial obliga a recuadrar el plan: valores y cuotas se
// guardan de forma atómica vía PUT /cuotas/venta/:id/plan, que valida dos cuadres (Σ iniciales ==
// cuota inicial; Σ regulares == valor total − inicial − permutas), exige motivo auditado (RN-20)
// y respeta las cuotas pagadas / con factura activa / subdivididas (RN-03/RN-04/§3.3).
function _planTargetTipo(tipo) {
  const { vt, ci, permutas } = window._planCtx || {};
  return tipo === "inicial"
    ? Number(ci || 0)
    : Math.max(0, Number(vt || 0) - Number(ci || 0) - Number(permutas || 0));
}
function _planSumTipo(tipo) {
  return (window._planRows || []).reduce((s, r) => r.tipo === tipo ? s + (Number(r.valor) || 0) : s, 0);
}
function _planCountTipo(tipo) {
  return (window._planRows || []).filter(r => r.tipo === tipo).length;
}
function _planBalancedTipo(tipo) {
  return Math.abs(_planTargetTipo(tipo) - _planSumTipo(tipo)) <= Math.max(1, _planCountTipo(tipo) || 1);
}
function _planBalanced() {
  return _planBalancedTipo("inicial") && _planBalancedTipo("regular");
}
function _planSummaryTipoHTML(tipo) {
  const target = _planTargetTipo(tipo);
  const sum    = _planSumTipo(tipo);
  const diff   = target - sum;
  const ok     = _planBalancedTipo(tipo);
  const color  = ok ? "var(--success,#22c55e)" : "var(--danger,#ef4444)";
  const ref    = tipo === "inicial" ? "cuota inicial" : "valor financiado";
  const msg    = ok ? "✓ cuadra" : diff > 0 ? `faltan ${UI.fmt(diff)}` : `sobran ${UI.fmt(-diff)}`;
  return `Σ <b>${UI.fmt(sum)}</b> / <b>${UI.fmt(target)}</b> (${ref}) — <span style="color:${color};font-weight:600">${msg}</span>`;
}
function _planRowHTML(r, i) {
  const fechaCell = r.pagada
    ? `<td style="padding:.35rem">${r.fecha ? UI.date(r.fecha) : "—"}</td>`
    : `<td style="padding:.35rem"><input type="date" class="pl-fecha" data-idx="${i}" value="${r.fecha || ""}" style="width:148px"></td>`;
  const valorCell = r.valorLocked
    ? `<td style="padding:.35rem;text-align:right;font-weight:600">${UI.fmt(r.valor)}</td>`
    : `<td style="padding:.35rem"><input type="text" inputmode="numeric" class="pl-valor" data-idx="${i}" value="${MoneyInput.format(r.valor)}" style="width:130px;text-align:right"></td>`;
  const quitar = r.deletable
    ? `<button class="btn btn-ghost btn-sm" title="Quitar cuota" style="padding:0 7px;color:var(--danger)" onclick="_planRemoveRow(${i})">✕</button>`
    : "";
  return `<tr${r.pagada ? ' style="opacity:.55"' : ""}>
    <td style="padding:.35rem;text-align:center;white-space:nowrap">${r.nueva ? '<span style="color:var(--text-muted)">nueva</span>' : r.numero}</td>
    ${fechaCell}
    ${valorCell}
    <td style="padding:.35rem;text-align:center;font-size:.72rem;color:var(--text-muted)">${r.hint || "—"}</td>
    <td style="padding:.35rem;text-align:center;width:30px">${quitar}</td>
  </tr>`;
}
function _planSectionBodyHTML(tipo) {
  const items = (window._planRows || []).map((r, i) => ({ r, i })).filter(x => x.r.tipo === tipo);
  if (!items.length) return `<tr><td colspan="5" style="padding:.5rem;text-align:center;color:var(--text-muted);font-size:.8rem">Sin cuotas ${tipo === "inicial" ? "iniciales" : "regulares"}</td></tr>`;
  return items.map(({ r, i }) => _planRowHTML(r, i)).join("");
}
function _planSectionHTML(tipo) {
  const titulo = tipo === "inicial" ? "Cuotas de cuota inicial" : "Cuotas regulares";
  return `
    <div style="margin-top:.6rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <strong style="font-size:.78rem">${titulo}</strong>
        <button type="button" class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:2px 8px" onclick="_planAddRow('${tipo}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar</button>
      </div>
      <div style="border:1px solid var(--border);border-radius:.5rem;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <tbody id="pl-rows-${tipo}">${_planSectionBodyHTML(tipo)}</tbody>
        </table>
      </div>
      <div id="pl-sum-${tipo}" style="font-size:.78rem;margin-top:4px">${_planSummaryTipoHTML(tipo)}</div>
    </div>`;
}
function _planRefresh() {
  ["inicial", "regular"].forEach(tipo => {
    const el = document.getElementById(`pl-sum-${tipo}`);
    if (el) el.innerHTML = _planSummaryTipoHTML(tipo);
  });
  const motivo = (document.getElementById("pl-motivo")?.value || "").trim();
  const mc = document.getElementById("pl-motivo-counter");
  if (mc) {
    mc.textContent = `${motivo.length} / 20 caracteres mínimo`;
    mc.style.color = motivo.length >= 20 ? "var(--success,#22c55e)" : "var(--text-muted)";
  }
  const btn = document.getElementById("pl-guardar");
  if (btn) btn.disabled = !_planBalanced() || motivo.length < 20;
}
function _planBindRowInputs() {
  document.querySelectorAll(".pl-valor").forEach(inp => {
    const i = Number(inp.dataset.idx);
    MoneyInput.init(inp, {
      dependsOn: () => Number(window._planCtx?.vt || 0),
      onChange: () => { window._planRows[i].valor = MoneyInput.parse(inp.value); _planRefresh(); },
    });
  });
  document.querySelectorAll(".pl-fecha").forEach(inp => {
    const i = Number(inp.dataset.idx);
    inp.addEventListener("input", () => { window._planRows[i].fecha = inp.value; });
  });
}
function _planRerenderSections() {
  ["inicial", "regular"].forEach(tipo => {
    const tb = document.getElementById(`pl-rows-${tipo}`);
    if (tb) tb.innerHTML = _planSectionBodyHTML(tipo);
  });
  _planBindRowInputs();
  _planRefresh();
}
window._planAddRow = function(tipo) {
  (window._planRows = window._planRows || []).push({
    id_cuota: null, numero: null, tipo: tipo === "inicial" ? "inicial" : "regular",
    pagada: false, valorLocked: false, deletable: true, hint: "", valor: 0, fecha: "", nueva: true,
  });
  _planRerenderSections();
};
window._planRemoveRow = function(i) {
  if (!window._planRows) return;
  window._planRows.splice(i, 1);
  _planRerenderSections();
};
function _renderPlanEditor() {
  const { idVenta, vt, ci, permutas } = window._planCtx;
  document.getElementById("modalBody").innerHTML = `
    <div style="margin-bottom:.6rem;padding:.5rem .8rem;background:var(--surface-2,#f0f4f8);border-radius:.5rem;font-size:.82rem;line-height:1.5">
      Cambiar el valor total o la cuota inicial obliga a recuadrar el plan. La Σ de las cuotas
      iniciales debe igualar la <b>cuota inicial</b>, y la de las regulares el <b>valor financiado</b>
      (valor total − cuota inicial − permutas). No podrás guardar hasta que ambas cuadren.
    </div>
    <div class="form-grid" style="gap:10px;margin-bottom:.25rem">
      <div class="form-group">
        <label style="font-size:.8rem">Valor total *</label>
        <input id="pl-vt" type="text" inputmode="numeric" value="${MoneyInput.format(vt)}" style="padding:5px 8px">
      </div>
      <div class="form-group">
        <label style="font-size:.8rem">Cuota inicial</label>
        <input id="pl-ci" type="text" inputmode="numeric" value="${MoneyInput.format(ci)}" style="padding:5px 8px">
      </div>
      ${permutas > 0 ? `<div class="form-group">
        <label style="font-size:.8rem">Permutas</label>
        <input type="text" value="${MoneyInput.format(permutas)}" disabled style="padding:5px 8px;opacity:.7">
      </div>` : ""}
    </div>
    <div style="max-height:40vh;overflow-y:auto">
      ${_planSectionHTML("inicial")}
      ${_planSectionHTML("regular")}
    </div>
    <div class="form-group" style="margin-top:.6rem">
      <label style="font-weight:600;font-size:.82rem">Motivo del cambio *</label>
      <textarea id="pl-motivo" rows="2" placeholder="Describe por qué se ajusta la venta (mín. 20 caracteres)" style="resize:vertical"></textarea>
      <small id="pl-motivo-counter" style="color:var(--text-muted);font-size:.78rem">0 / 20 caracteres mínimo</small>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:.4rem;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="verVenta(${idVenta})">Cancelar</button>
      <button class="btn btn-primary" id="pl-guardar" disabled onclick="_guardarPlanCuotas()">Guardar venta</button>
    </div>`;
  const vtInp = document.getElementById("pl-vt");
  const ciInp = document.getElementById("pl-ci");
  if (vtInp) MoneyInput.init(vtInp, { onChange: () => { window._planCtx.vt = MoneyInput.parse(vtInp.value); _planRefresh(); } });
  if (ciInp) MoneyInput.init(ciInp, { dependsOn: () => Number(window._planCtx?.vt || 0), onChange: () => { window._planCtx.ci = MoneyInput.parse(ciInp.value); _planRefresh(); } });
  _planBindRowInputs();
  document.getElementById("pl-motivo")?.addEventListener("input", _planRefresh);
  _planRefresh();
}
window._editarPlanCuotas = async function(idVenta, seedVt) {
  UI.openModal(`Editar venta · #${idVenta}`, UI.loader());
  let v;
  try { v = await API.get(`/ventas/${idVenta}`); }
  catch (e) {
    const body = document.getElementById("modalBody");
    if (body) body.innerHTML = `<p style="color:var(--danger);padding:1rem">${e.message}</p>`;
    return;
  }
  const cuotas = (v.cuota || []).slice().sort((a, b) => a.numero_cuota - b.numero_cuota);
  window._planRows = cuotas.map(c => {
    const pagada      = c.pagada === true || c.estado === "pagada";
    const valorLocked = pagada || c.tiene_fracciones === true || c.factura_activa === true;
    const deletable   = !pagada && c.tiene_fracciones !== true && c.factura_activa !== true && Number(c.valor_pagado || 0) === 0;
    const hint        = pagada               ? "Pagada"
                      : c.tiene_fracciones    ? "Subdividida"
                      : c.factura_activa      ? "Con factura activa"
                      : Number(c.valor_pagado || 0) > 0 ? `mín ${UI.fmt(c.valor_pagado)}` : "";
    return {
      id_cuota: c.id_cuota, numero: c.numero_cuota, tipo: c.tipo === "inicial" ? "inicial" : "regular",
      pagada, valorLocked, deletable, hint,
      valor: Number(c.valor_cuota), fecha: c.fecha_vencimiento, nueva: false,
    };
  });
  window._planCtx = {
    idVenta,
    vt: Number(v.valor_total || 0),
    ci: Number(v.cuota_inicial || 0),
    permutas: Number(v.total_permutas || 0),
  };
  // When opened to apply a new lote value, seed the "Valor total" so the plan starts
  // descuadrado and the aux is forced to rebalance the cuotas before saving (RN-17/§8.4).
  if (seedVt != null && Number(seedVt) > 0) window._planCtx.vt = Number(seedVt);
  _renderPlanEditor();
};
window._guardarPlanCuotas = async function() {
  const rows = window._planRows || [];
  const ctx  = window._planCtx || {};
  const motivo = (document.getElementById("pl-motivo")?.value || "").trim();
  if (!rows.length) return UI.toast("Debe haber al menos una cuota", "error");
  for (const r of rows) {
    if (!(Number(r.valor) > 0)) return UI.toast("Todas las cuotas deben tener un valor mayor a 0", "error");
    if (!r.fecha)               return UI.toast("Todas las cuotas deben tener fecha de vencimiento", "error");
  }
  if (!(Number(ctx.vt) > 0))            return UI.toast("El valor total debe ser mayor a 0", "error");
  if (Number(ctx.ci) > Number(ctx.vt)) return UI.toast("La cuota inicial no puede superar el valor total", "error");
  if (!_planBalanced())                return UI.toast("El plan no cuadra (revisa iniciales y regulares)", "error");
  if (motivo.length < 20)              return UI.toast("El motivo es obligatorio (mín. 20 caracteres)", "error");

  const cuotas = rows.map(r => {
    const o = { valor_cuota: Number(r.valor), fecha_vencimiento: r.fecha, tipo: r.tipo };
    if (r.id_cuota != null) o.id_cuota = r.id_cuota;
    return o;
  });

  const btn = document.getElementById("pl-guardar");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
  try {
    await API.put(`/cuotas/venta/${ctx.idVenta}/plan`, {
      valor_total: Number(ctx.vt), cuota_inicial: Number(ctx.ci), cuotas, motivo,
    });
    UI.toast("Venta actualizada", "ok");
    verVenta(ctx.idVenta);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "Guardar venta"; }
    UI.toast(e.message || "No se pudo actualizar la venta", "error");
  }
};

function _fmtMiles(val) { return MoneyInput.format(val); }
function _parseMiles(str) { return MoneyInput.parse(str); }
function _validarEmail(mail) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
}
function _normalizar(str) {
  return String(str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ─── Unique projects from lot list ───
function _proyectosDesdeIotes(lotes) {
  if (!Array.isArray(lotes) || lotes.length === 0) return [];
  const vistos = new Set();
  return lotes
    .filter(l => l.proyecto && !vistos.has(l.proyecto) && (vistos.add(l.proyecto), true))
    .map(l => ({ nombre: l.proyecto }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ─── HTML principal del formulario ───
function _htmlFormVenta(proyectos) {
  return `
    <div class="form-grid">

      <div class="form-group" style="grid-column:1/-1"><label>Proyecto *</label>
        <select id="f_proy" onchange="_filtrarLotesPorProyecto()">
          <option value="">— Seleccione proyecto —</option>
          ${proyectos.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join("")}
        </select>
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label>Lote disponible *</label>
        <input type="hidden" id="f_lote"/>
        <div id="f_lote_card" style="display:none;background:var(--surface-2,#f0f4f8);border-radius:6px;padding:8px 12px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div id="f_lote_card_info" style="font-size:.85rem;line-height:1.6"></div>
            <button type="button" class="btn btn-ghost btn-sm"
                    style="padding:2px 8px;flex-shrink:0;margin-left:8px" onclick="_limpiarLote()"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        </div>
        <div id="f_lote_search_wrap">
          <input type="text" id="f_lote_buscar" placeholder="— Primero seleccione un proyecto —"
                 oninput="_buscarLote(this.value)" onfocus="_buscarLote(this.value)"
                 autocomplete="off" disabled/>
          <div id="f_lote_results" style="display:none;border:1px solid var(--border);border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;background:var(--surface);position:relative;z-index:10"></div>
        </div>
      </div>

      <div class="form-group">
        <label>Valor Total *</label>
        <input id="f_vt" type="text" inputmode="numeric" placeholder="0"/>
      </div>
      <div class="form-group">
        <label>Cuota Inicial</label>
        <input id="f_ci" type="text" inputmode="numeric" placeholder="0" value="0"/>
      </div>

      <div class="form-group">
        <label>Fecha de venta *</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input id="f_fecha_venta" type="date" style="flex:1"/>
          <button type="button" class="btn btn-ghost btn-sm" style="white-space:nowrap"
                  onclick="document.getElementById('f_fecha_venta').value=new Date().toISOString().split('T')[0]">Hoy</button>
        </div>
      </div>

      <!-- Permutas -->
      <div class="form-group" style="grid-column:1/-1">
        <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span>Permutas / Abonos en especie</span>
          <button type="button" class="btn btn-ghost btn-sm" style="font-size:.78rem;padding:2px 8px"
                  onclick="_agregarPermuta()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar permuta</button>
        </label>
        <div id="f_permutas_lista"></div>
        <div id="f_permutas_resumen" style="display:none;font-size:.82rem;color:var(--text-muted);margin-top:4px"></div>
      </div>

      <!-- Resumen financiero (auto-actualizado) -->
      <div id="f_resumen_financiero" style="grid-column:1/-1;display:none"></div>

      <!-- Plan de cuota inicial con micro-cuotas -->
      <div class="form-group" style="grid-column:1/-1">
        <label style="display:block;margin-bottom:6px">Plan de cuota inicial</label>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-size:.9rem;color:var(--text-muted)">Dividida en</span>
          <input id="f_nci" type="number" min="1" max="24" value="1" style="width:70px"
                 oninput="_renderMicroCuotas(this.value)"/>
          <span style="font-size:.9rem;color:var(--text-muted)">micro-cuota(s)</span>
        </div>
        <div id="f_microcuotas_wrap"></div>
        <div id="f_microcuotas_resumen"></div>
      </div>

      <!-- Plan de cuotas regulares con día fijo -->
      <div class="form-group" style="grid-column:1/-1">
        <label style="display:block;margin-bottom:6px">Plan de cuotas regulares</label>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:110px">
            <label style="font-size:.8rem;display:block;margin-bottom:4px">N° Cuotas *</label>
            <input id="f_nc" type="number" min="1" oninput="_actualizarCalculos()"/>
          </div>
          <div style="flex:1;min-width:100px">
            <label style="font-size:.8rem;display:block;margin-bottom:4px">Día de pago</label>
            <input id="f_dia_pago" type="number" min="1" max="31" placeholder="ej. 15"
                   oninput="_actualizarCalculos()"/>
          </div>
          <div style="flex:1;min-width:160px">
            <label style="font-size:.8rem;display:block;margin-bottom:4px">Mes de inicio *</label>
            <input id="f_fc" type="month" oninput="_actualizarCalculos()"/>
          </div>
        </div>
        <div id="f_cuotas_preview"></div>
      </div>

      ${_htmlCompradorField()}
      ${_htmlComisionistaField()}

      <div class="form-group" style="grid-column:1/-1">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="f_escriturado" onchange="_toggleFechaEscritura()"/>
          <span>¿Ya está escriturado?</span>
        </label>
        <div id="f_fecha_escritura_wrap" style="display:none;margin-top:6px">
          <label style="font-size:.8rem;color:var(--text-muted)">Fecha de escritura</label>
          <input id="f_fecha_escritura" type="date" style="margin-top:4px;width:100%"/>
        </div>
      </div>

      <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label>
        <textarea id="f_obs" rows="2"></textarea>
      </div>
    </div>`;
}

function _htmlCompradorField() {
  return `
    <div class="form-group" style="grid-column:1/-1">
      <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span>Comprador *</span>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn btn-ghost btn-sm" id="btn_edit_comp"
                  style="display:none;padding:2px 8px" onclick="_editarComprador()"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
          <button type="button" class="btn btn-ghost btn-sm"
                  style="font-size:.78rem;padding:2px 8px" onclick="_toggleNuevoComprador()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
        </div>
      </label>
      <input type="hidden" id="f_comp"/>

      <div id="f_comp_card" style="display:none;background:var(--surface-2,#f0f4f8);border-radius:6px;padding:8px 12px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div id="f_comp_card_info" style="font-size:.85rem;line-height:1.6"></div>
          <button type="button" class="btn btn-ghost btn-sm"
                  style="padding:2px 8px;flex-shrink:0;margin-left:8px" onclick="_limpiarComprador()"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>

      <div id="f_comp_search_wrap">
        <input type="text" id="f_comp_search" placeholder="Buscar por cédula o nombre..."
               oninput="_buscarComprador(this.value)" onfocus="_buscarComprador(this.value)" autocomplete="off"/>
        <div id="f_comp_results" style="display:none;border:1px solid var(--border);border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;background:var(--surface);position:relative;z-index:10"></div>
      </div>

      <div id="f_comp_edit" style="display:none;margin-top:8px;background:var(--surface-2,#f5f7fa);border-radius:6px;padding:10px 12px">
        <p style="font-size:.82rem;font-weight:600;margin-bottom:6px">Editar comprador</p>
        <div class="form-grid" style="gap:8px">
          <div class="form-group"><label style="font-size:.8rem">Documento *</label><input id="fe_comp_doc" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Nombres *</label><input id="fe_comp_nom" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Apellidos</label><input id="fe_comp_ape" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Teléfono *</label><input id="fe_comp_tel" type="tel"/></div>
          <div class="form-group"><label style="font-size:.8rem">Email</label><input id="fe_comp_mail" type="email"/></div>
          <div class="form-group"><label style="font-size:.8rem">Tipo persona</label>
            <select id="fe_comp_tipo"><option value="natural">Natural</option><option value="juridica">Jurídica</option></select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button type="button" class="btn btn-primary btn-sm" onclick="_guardarEdicionComprador()">Guardar cambios</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="_cancelarEdicionComprador()">Cancelar</button>
        </div>
      </div>

      <div id="f_comp_nuevo" style="display:none;margin-top:8px;background:var(--surface-2,#f5f7fa);border-radius:6px;padding:10px 12px">
        <p style="font-size:.82rem;font-weight:600;margin-bottom:6px">Nuevo comprador</p>
        <div class="form-grid" style="gap:8px">
          <div class="form-group"><label style="font-size:.8rem">Documento *</label><input id="fn_comp_doc" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Nombres *</label><input id="fn_comp_nom" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Apellidos</label><input id="fn_comp_ape" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Teléfono *</label><input id="fn_comp_tel" type="tel"/></div>
          <div class="form-group"><label style="font-size:.8rem">Email</label><input id="fn_comp_mail" type="email"/></div>
          <div class="form-group"><label style="font-size:.8rem">Tipo persona</label>
            <select id="fn_comp_tipo"><option value="natural">Natural</option><option value="juridica">Jurídica</option></select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button type="button" class="btn btn-primary btn-sm" onclick="_crearCompradorRapido()">Guardar comprador</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="_toggleNuevoComprador()">Cancelar</button>
        </div>
      </div>
    </div>`;
}

function _htmlComisionistaField() {
  return `
    <div class="form-group" style="grid-column:1/-1">
      <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span>Comisionista</span>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn btn-ghost btn-sm" id="btn_edit_comi"
                  style="display:none;padding:2px 8px" onclick="_editarComisionista()"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
          <button type="button" class="btn btn-ghost btn-sm"
                  style="font-size:.78rem;padding:2px 8px" onclick="_toggleNuevoComisionista()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
        </div>
      </label>
      <input type="hidden" id="f_comi"/>

      <div id="f_comi_card" style="display:none;background:var(--surface-2,#f0f4f8);border-radius:6px;padding:8px 12px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div id="f_comi_card_info" style="font-size:.85rem;line-height:1.6"></div>
          <button type="button" class="btn btn-ghost btn-sm"
                  style="padding:2px 8px;flex-shrink:0;margin-left:8px" onclick="_limpiarComisionista()"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>

      <div id="f_comi_search_wrap">
        <input type="text" id="f_comi_search" placeholder="Buscar comisionista por nombre o cédula..."
               oninput="_buscarComisionista(this.value)" onfocus="_buscarComisionista(this.value)" autocomplete="off"/>
        <div id="f_comi_results" style="display:none;border:1px solid var(--border);border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;background:var(--surface);position:relative;z-index:10"></div>
      </div>

      <div id="f_comi_edit" style="display:none;margin-top:8px;background:var(--surface-2,#f5f7fa);border-radius:6px;padding:10px 12px">
        <p style="font-size:.82rem;font-weight:600;margin-bottom:6px">Editar comisionista</p>
        <div class="form-grid" style="gap:8px">
          <div class="form-group"><label style="font-size:.8rem">Documento *</label><input id="fe_comi_doc" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Nombres *</label><input id="fe_comi_nom" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Apellidos</label><input id="fe_comi_ape" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Teléfono *</label><input id="fe_comi_tel" type="tel"/></div>
          <div class="form-group"><label style="font-size:.8rem">Email</label><input id="fe_comi_mail" type="email"/></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button type="button" class="btn btn-primary btn-sm" onclick="_guardarEdicionComisionista()">Guardar cambios</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="_cancelarEdicionComisionista()">Cancelar</button>
        </div>
      </div>

      <div id="f_comi_nuevo" style="display:none;margin-top:8px;background:var(--surface-2,#f5f7fa);border-radius:6px;padding:10px 12px">
        <p style="font-size:.82rem;font-weight:600;margin-bottom:6px">Nuevo comisionista</p>
        <div class="form-grid" style="gap:8px">
          <div class="form-group"><label style="font-size:.8rem">Documento *</label><input id="fn_comi_doc" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Nombres *</label><input id="fn_comi_nom" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Apellidos</label><input id="fn_comi_ape" type="text"/></div>
          <div class="form-group"><label style="font-size:.8rem">Teléfono *</label><input id="fn_comi_tel" type="tel"/></div>
          <div class="form-group"><label style="font-size:.8rem">Email</label><input id="fn_comi_mail" type="email"/></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button type="button" class="btn btn-primary btn-sm" onclick="_crearComisionistaRapido()">Guardar comisionista</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="_toggleNuevoComisionista()">Cancelar</button>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Comisión ($)</label>
      <input id="f_pcom" type="text" inputmode="numeric" placeholder="0" value="0"/>
    </div>`;
}

// ─── Body para POST ───
function _bodyVenta() {
  const n   = Math.max(1, +document.getElementById("f_nci")?.value || 1);
  const dia = +document.getElementById("f_dia_pago")?.value || 0;
  const mesInicio = document.getElementById("f_fc")?.value || "";
  const fechaPrimeraCuota = (() => {
    if (!mesInicio || !dia) return "";
    const [yr, mo] = mesInicio.split("-").map(Number);
    const maxDia = new Date(yr, mo, 0).getDate(); // last day of the month
    return `${mesInicio}-${String(Math.min(dia, maxDia)).padStart(2, "0")}`;
  })();

  const microcuotas = [];
  for (let i = 0; i < n; i++) {
    microcuotas.push({
      valor: _parseMiles(document.getElementById(`f_mc_val_${i}`)?.value || "0"),
      fecha: document.getElementById(`f_mc_fecha_${i}`)?.value || "",
    });
  }

  const idComi = document.getElementById("f_comi").value;
  const escriturado = document.getElementById("f_escriturado")?.checked || false;
  return {
    id_lote:                     +document.getElementById("f_lote").value,
    valor_total:                 _parseMiles(document.getElementById("f_vt").value),
    cuota_inicial:               _parseMiles(document.getElementById("f_ci").value),
    numero_cuotas_inicial:       n,
    fecha_primera_cuota_inicial: microcuotas[0]?.fecha || "",
    numero_cuotas:               +document.getElementById("f_nc")?.value || 0,
    fecha_primera_cuota:         fechaPrimeraCuota,
    observaciones:               document.getElementById("f_obs").value,
    compradores: [{ id_usuario: +document.getElementById("f_comp").value, porcentaje: 100 }],
    id_comisionista:             idComi ? +idComi : null,
    valor_comision:              _parseMiles(document.getElementById("f_pcom").value),
    permutas:                    window._ventaPermutas || [],
    microcuotas,
    fecha_venta:                 document.getElementById("f_fecha_venta")?.value || null,
    escriturado,
    fecha_escritura:             escriturado ? (document.getElementById("f_fecha_escritura")?.value || null) : null,
  };
}

// ─── Lot selection ───
window._filtrarLotesPorProyecto = function() {
  const nombreProy = document.getElementById("f_proy").value;
  const lotes = window._ventaLotes || [];
  const filtrados = nombreProy ? lotes.filter(l => l.proyecto === nombreProy) : [];

  window._lotesProyecto = filtrados;
  _limpiarLote();

  const buscar = document.getElementById("f_lote_buscar");
  if (!buscar) return;
  buscar.value = "";
  buscar.disabled = filtrados.length === 0;
  buscar.placeholder = filtrados.length
    ? "Buscar por código de lote…"
    : "— No hay lotes disponibles en este proyecto —";
};

window._buscarLote = function(texto) {
  const lotes = window._lotesProyecto || [];
  const q = texto.toLowerCase().trim();
  const filtrados = q
    ? lotes.filter(l => (l.codigo_lote || `Mz${l.manzana}Lt${l.numero_lote}`).toLowerCase().includes(q))
    : lotes;

  const div = document.getElementById("f_lote_results");
  if (!div) return;

  if (!filtrados.length) {
    div.style.display = q ? "block" : "none";
    div.innerHTML = q
      ? `<div style="padding:10px 12px;color:var(--text-muted);font-size:.85rem">Sin resultados para "${texto.trim()}"</div>`
      : "";
    return;
  }

  div.style.display = "block";
  div.innerHTML = filtrados.map(l => `
    <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:.85rem"
         onmouseover="this.style.background='var(--surface-2,#f0f4f8)'"
         onmouseout="this.style.background=''"
         onclick="_seleccionarLote(${l.id_lote})">
      <div style="font-weight:600">${l.codigo_lote || ("Mz" + l.manzana + " Lt" + l.numero_lote)}</div>
      <div style="color:var(--text-muted);font-size:.78rem">
        Mz ${l.manzana || "—"} · Lote ${l.numero_lote || "—"}${l.area_m2 ? " · " + l.area_m2 + " m²" : ""} · Precio lista: ${UI.fmt(l.precio_lista)}
      </div>
    </div>`).join("");

  if (filtrados.length === 1) _seleccionarLote(filtrados[0].id_lote);
};

window._seleccionarLote = function(idLote) {
  const l = (window._lotesProyecto || []).find(x => x.id_lote === idLote);
  if (!l) return;

  window._loteSeleccionado = l;
  document.getElementById("f_lote").value = idLote;

  document.getElementById("f_lote_card_info").innerHTML =
    `<div style="font-weight:600">${l.codigo_lote || ("Mz" + l.manzana + " Lt" + l.numero_lote)}</div>` +
    `<div style="color:var(--text-muted)">Mz ${l.manzana || "—"} · Lote ${l.numero_lote || "—"}` +
    `${l.area_m2 ? " · " + l.area_m2 + " m²" : ""} · Precio lista: ${UI.fmt(l.precio_lista)}</div>`;

  document.getElementById("f_lote_card").style.display = "block";
  document.getElementById("f_lote_search_wrap").style.display = "none";
  document.getElementById("f_lote_results").style.display = "none";

  const vtInput = document.getElementById("f_vt");
  if (vtInput && l.precio_lista) {
    vtInput.value = _fmtMiles(l.precio_lista);
    _actualizarCalculos();
  }
};

window._limpiarLote = function() {
  window._loteSeleccionado = null;
  const hidden = document.getElementById("f_lote");
  if (hidden) hidden.value = "";
  const card = document.getElementById("f_lote_card");
  const searchWrap = document.getElementById("f_lote_search_wrap");
  const buscar = document.getElementById("f_lote_buscar");
  const results = document.getElementById("f_lote_results");
  if (card) card.style.display = "none";
  if (searchWrap) searchWrap.style.display = "";
  if (buscar) buscar.value = "";
  if (results) results.style.display = "none";
};

window._toggleFechaEscritura = function() {
  const checked = document.getElementById("f_escriturado")?.checked;
  const wrap = document.getElementById("f_fecha_escritura_wrap");
  if (wrap) wrap.style.display = checked ? "block" : "none";
};

// ─── Permutas ───
window._ventaPermutas = [];

window._agregarPermuta = function() {
  window._ventaPermutas.push({ descripcion: "", valor: 0 });
  _renderPermutasLista();
  _actualizarCalculos();
};

window._eliminarPermuta = function(idx) {
  window._ventaPermutas.splice(idx, 1);
  _renderPermutasLista();
  _actualizarCalculos();
};

function _renderPermutasLista() {
  const div = document.getElementById("f_permutas_lista");
  if (!div) return;
  const lista = window._ventaPermutas || [];
  div.innerHTML = lista.map((p, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <input type="text" placeholder="Descripción del bien o activo (ej. Terreno en Fusagasugá)"
             value="${(p.descripcion || "").replace(/"/g, "&quot;")}"
             oninput="window._ventaPermutas[${i}].descripcion=this.value"
             style="flex:2;min-width:0"/>
      <input type="text" inputmode="numeric" placeholder="0"
             value="${p.valor > 0 ? _fmtMiles(p.valor) : ""}"
             style="flex:1;min-width:0"/>
      <button type="button" class="btn btn-ghost btn-sm" style="padding:2px 8px;flex-shrink:0"
              onclick="_eliminarPermuta(${i})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`).join("");
  _actualizarPermutasResumen();

  div.querySelectorAll("input[inputmode='numeric']").forEach((inp, idx) => {
    MoneyInput.init(inp, {
      dependsOn: () => MoneyInput.parse(document.getElementById("f_vt")?.value || "0"),
      onChange: () => {
        window._ventaPermutas[idx].valor = MoneyInput.parse(inp.value);
        _actualizarCalculos();
      },
    });
  });
}

function _actualizarPermutasResumen() {
  const div = document.getElementById("f_permutas_resumen");
  if (!div) return;
  const total = _totalPermutas();
  div.style.display = total > 0 ? "block" : "none";
  div.innerHTML = `Total permutas: <b>${UI.fmt(total)}</b>`;
}

function _totalPermutas() {
  return (window._ventaPermutas || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
}

// ─── Reactive financial calculation ───
function _actualizarCalculos() {
  const vt    = _parseMiles(document.getElementById("f_vt")?.value || "0");
  const ci    = _parseMiles(document.getElementById("f_ci")?.value || "0");
  const tp    = _totalPermutas();
  const saldo = Math.max(0, vt - ci - tp);
  const nc    = +document.getElementById("f_nc")?.value || 0;

  _renderResumenFinanciero(vt, ci, tp, saldo, nc);
  _renderPreviewCuotas(saldo, nc);
  _actualizarResumenInicial();
  _actualizarPermutasResumen();
}

function _renderResumenFinanciero(vt, ci, tp, saldo, nc) {
  const div = document.getElementById("f_resumen_financiero");
  if (!div) return;
  if (vt === 0) { div.style.display = "none"; return; }
  div.style.display = "block";
  const cuotaAmt = nc > 0 && saldo > 0 ? Math.floor(saldo / nc) : 0;
  div.innerHTML = `
    <div style="background:var(--surface-2,#f0f4f8);border-radius:6px;padding:10px 14px;font-size:.85rem;margin-bottom:4px">
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
        <span>Valor total: <b>${UI.fmt(vt)}</b></span>
        ${ci > 0 ? `<span style="color:var(--text-muted)">− Cuota inicial: <b>${UI.fmt(ci)}</b></span>` : ""}
        ${tp > 0 ? `<span style="color:var(--text-muted)">− Permutas: <b>${UI.fmt(tp)}</b></span>` : ""}
        <span style="border-left:2px solid var(--border);padding-left:16px">
          Saldo a financiar: <b style="color:var(--primary,#ff6a00)">${UI.fmt(saldo)}</b>
        </span>
        ${cuotaAmt > 0 ? `<span style="color:var(--text-muted)">≈ ${UI.fmt(cuotaAmt)} × ${nc} cuotas</span>` : ""}
      </div>
    </div>`;
}

window._renderMicroCuotas = function(raw) {
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1) return; // empty field or mid-typing
  const n = Math.min(24, parsed);
  const inp = document.getElementById("f_nci");
  if (inp && +inp.value !== n) inp.value = n; // only corrects if the value exceeded the max

  const div = document.getElementById("f_microcuotas_wrap");
  if (!div) return;

  // Preserve existing values when re-rendering
  const prev = [];
  for (let i = 0; i < 24; i++) {
    const v = document.getElementById(`f_mc_val_${i}`);
    const f = document.getElementById(`f_mc_fecha_${i}`);
    if (!v) break;
    prev.push({ val: v.value, fecha: f?.value || "" });
  }

  div.innerHTML = Array.from({ length: n }, (_, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
      <span style="font-size:.8rem;color:var(--text-muted);width:90px;flex-shrink:0">Micro-cuota ${i + 1}</span>
      <input type="text" id="f_mc_val_${i}" inputmode="numeric" placeholder="0"
             value="${prev[i]?.val || ""}" style="flex:1;min-width:110px"/>
      <input type="date" id="f_mc_fecha_${i}"
             value="${prev[i]?.fecha || ""}" style="flex:1;min-width:140px"/>
    </div>`).join("");

  _actualizarResumenInicial();

  for (let j = 0; j < n; j++) {
    const inp = document.getElementById(`f_mc_val_${j}`);
    if (inp) MoneyInput.init(inp, {
      dependsOn: () => MoneyInput.parse(document.getElementById("f_ci")?.value || "0"),
      onChange: _actualizarResumenInicial,
    });
  }
};

window._actualizarResumenInicial = function() {
  const ci  = _parseMiles(document.getElementById("f_ci")?.value || "0");
  const n   = +document.getElementById("f_nci")?.value || 1;
  const div = document.getElementById("f_microcuotas_resumen");
  if (!div) return;
  if (ci === 0) { div.innerHTML = ""; return; }

  let total = 0;
  for (let i = 0; i < n; i++) {
    total += _parseMiles(document.getElementById(`f_mc_val_${i}`)?.value || "0");
  }
  const diff = ci - total;
  const color = diff === 0 ? "var(--success,#22c55e)" : diff > 0 ? "var(--warning,#e8570c)" : "var(--danger,#ef4444)";
  const msg   = diff === 0 ? "✓ Cuadra perfectamente"
              : diff > 0   ? `Faltan ${UI.fmt(diff)}`
              :               `Excede en ${UI.fmt(-diff)}`;
  div.innerHTML = `
    <div style="font-size:.82rem;margin-top:4px;padding:6px 10px;background:var(--surface-2,#f0f4f8);border-radius:4px">
      Total asignado: <b>${UI.fmt(total)}</b> de <b>${UI.fmt(ci)}</b>
      — <span style="color:${color};font-weight:600">${msg}</span>
    </div>`;
};

function _renderPreviewCuotas(saldo, nc) {
  const div = document.getElementById("f_cuotas_preview");
  if (!div) return;
  if (!nc || saldo <= 0) { div.innerHTML = ""; return; }

  const dia       = +document.getElementById("f_dia_pago")?.value || 0;
  const mesInicio = document.getElementById("f_fc")?.value || "";

  if (!dia || !mesInicio) {
    div.innerHTML = `<p style="font-size:.82rem;color:var(--text-muted);margin-top:6px">
      Ingrese el día de pago y mes de inicio para ver el calendario</p>`;
    return;
  }

  const [yr, mo] = mesInicio.split("-").map(Number);
  const cuotaBase = Math.floor(saldo / nc);
  const cuotaUlt  = saldo - cuotaBase * (nc - 1);

  const fechas = [];
  for (let i = 0; i < nc; i++) {
    let mes  = mo + i;
    let anio = yr + Math.floor((mes - 1) / 12);
    mes = ((mes - 1) % 12) + 1;
    const diaReal = Math.min(dia, new Date(anio, mes, 0).getDate());
    fechas.push(`${String(diaReal).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`);
  }

  const preview = fechas.length <= 4
    ? fechas.join(" · ")
    : `${fechas.slice(0, 3).join(" · ")} … ${fechas[nc - 1]}`;

  div.innerHTML = `
    <div style="font-size:.82rem;padding:8px 12px;background:var(--surface-2,#f0f4f8);border-radius:6px;margin-top:8px">
      <div style="margin-bottom:4px">
        Cuota mensual: <b style="color:var(--primary,#ff6a00)">${UI.fmt(cuotaBase)}</b>
        ${cuotaUlt !== cuotaBase ? ` · última: <b>${UI.fmt(cuotaUlt)}</b>` : ""}
        <span style="color:var(--text-muted)"> · ${nc} cuotas · día ${dia} de cada mes</span>
      </div>
      <div style="color:var(--text-muted)">${preview}</div>
    </div>`;
}

// ─── Buyer search and selection ───
window._buscarComprador = function(texto) {
  const qn = _normalizar(texto);
  const todos = window._ventaCompradores || [];
  const resultados = qn
    ? todos.filter(c =>
        _normalizar(c.documento).includes(qn) ||
        _normalizar(`${c.nombres} ${c.apellidos || ""}`).includes(qn))
    : todos.slice(0, 10);

  const div = document.getElementById("f_comp_results");
  if (!resultados.length && !qn) { div.style.display = "none"; return; }

  div.style.display = "block";
  div.innerHTML = resultados.length === 0
    ? `<div style="padding:10px 12px;color:var(--text-muted);font-size:.85rem">Sin resultados para "${texto.trim()}"</div>`
    : resultados.map(c => `
        <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:.85rem"
             onmouseover="this.style.background='var(--surface-2,#f0f4f8)'"
             onmouseout="this.style.background=''"
             onclick="_seleccionarComprador(${c.id_usuario})">
          <div style="font-weight:600">${c.nombres} ${c.apellidos || ""}</div>
          <div style="color:var(--text-muted);font-size:.78rem">Cédula: ${c.documento}${c.telefono ? " · Tel: " + c.telefono : ""}${c.email ? " · " + c.email : ""}</div>
        </div>`).join("");
};

window._seleccionarComprador = function(id) {
  const c = (window._ventaCompradores || []).find(x => x.id_usuario === id);
  if (!c) return;
  window._compradorSeleccionado = c;
  document.getElementById("f_comp").value = id;

  const linea2 = ["Cédula: " + c.documento];
  if (c.telefono) linea2.push("Tel: " + c.telefono);
  if (c.email) linea2.push(c.email);
  if (c.tipo_persona) linea2.push(c.tipo_persona === "juridica" ? "Persona Jurídica" : "Persona Natural");

  document.getElementById("f_comp_card_info").innerHTML =
    `<div style="font-weight:600">${c.nombres} ${c.apellidos || ""}</div>` +
    `<div style="color:var(--text-muted)">${linea2.join(" · ")}</div>`;
  document.getElementById("f_comp_card").style.display = "block";
  document.getElementById("f_comp_search_wrap").style.display = "none";
  document.getElementById("f_comp_results").style.display = "none";
  document.getElementById("f_comp_edit").style.display = "none";
  const btn = document.getElementById("btn_edit_comp");
  if (btn) btn.style.display = "";
};

window._limpiarComprador = function() {
  window._compradorSeleccionado = null;
  document.getElementById("f_comp").value = "";
  document.getElementById("f_comp_card").style.display = "none";
  document.getElementById("f_comp_search_wrap").style.display = "";
  document.getElementById("f_comp_search").value = "";
  document.getElementById("f_comp_results").style.display = "none";
  document.getElementById("f_comp_edit").style.display = "none";
  const btn = document.getElementById("btn_edit_comp");
  if (btn) btn.style.display = "none";
};

window._editarComprador = function() {
  const c = window._compradorSeleccionado;
  if (!c) return;
  document.getElementById("fe_comp_doc").value  = c.documento || "";
  document.getElementById("fe_comp_nom").value  = c.nombres || "";
  document.getElementById("fe_comp_ape").value  = c.apellidos || "";
  document.getElementById("fe_comp_tel").value  = c.telefono || "";
  document.getElementById("fe_comp_mail").value = c.email || "";
  document.getElementById("fe_comp_tipo").value = c.tipo_persona || "natural";
  document.getElementById("f_comp_edit").style.display = "block";
};

window._cancelarEdicionComprador = function() {
  document.getElementById("f_comp_edit").style.display = "none";
};

window._guardarEdicionComprador = async function() {
  const c = window._compradorSeleccionado;
  if (!c) return;
  const doc  = document.getElementById("fe_comp_doc").value.trim();
  const nom  = document.getElementById("fe_comp_nom").value.trim();
  const tel  = document.getElementById("fe_comp_tel").value.trim();
  const mail = document.getElementById("fe_comp_mail").value.trim();
  if (!doc || !nom)                 return UI.toast("Documento y nombres son obligatorios", "error");
  if (!tel)                         return UI.toast("El teléfono es obligatorio", "error");
  if (mail && !_validarEmail(mail)) return UI.toast("Ingrese un correo electrónico válido", "error");
  try {
    const upd = await API.put(`/compradores/${c.id_usuario}`, {
      documento:    doc, nombres: nom,
      apellidos:    document.getElementById("fe_comp_ape").value.trim(),
      telefono:     tel, mail,
      tipo_persona: document.getElementById("fe_comp_tipo").value,
    });
    window._compradorSeleccionado = upd;
    const idx = (window._ventaCompradores || []).findIndex(x => x.id_usuario === upd.id_usuario);
    if (idx >= 0) window._ventaCompradores[idx] = upd;
    document.getElementById("f_comp_edit").style.display = "none";
    _seleccionarComprador(upd.id_usuario);
    UI.toast("Comprador actualizado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Commission agent search and selection ───
window._buscarComisionista = function(texto) {
  const qn = _normalizar(texto);
  const todos = window._ventaComisionistas || [];
  const resultados = qn
    ? todos.filter(c =>
        _normalizar(c.documento).includes(qn) ||
        _normalizar(`${c.nombres} ${c.apellidos || ""}`).includes(qn))
    : todos.slice(0, 10);

  const div = document.getElementById("f_comi_results");
  if (!resultados.length && !qn) { div.style.display = "none"; return; }

  div.style.display = "block";
  div.innerHTML = resultados.length === 0
    ? `<div style="padding:10px 12px;color:var(--text-muted);font-size:.85rem">Sin resultados</div>`
    : resultados.map(c => `
        <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:.85rem"
             onmouseover="this.style.background='var(--surface-2,#f0f4f8)'"
             onmouseout="this.style.background=''"
             onclick="_seleccionarComisionista(${c.id_usuario})">
          <div style="font-weight:600">${c.nombres} ${c.apellidos || ""}</div>
          <div style="color:var(--text-muted);font-size:.78rem">Cédula: ${c.documento}${c.telefono ? " · Tel: " + c.telefono : ""}</div>
        </div>`).join("");
};

window._seleccionarComisionista = function(id) {
  const c = (window._ventaComisionistas || []).find(x => x.id_usuario === id);
  if (!c) return;
  window._comisionistaSeleccionado = c;
  document.getElementById("f_comi").value = id;

  const linea2 = ["Cédula: " + c.documento];
  if (c.telefono) linea2.push("Tel: " + c.telefono);
  if (c.email) linea2.push(c.email);

  document.getElementById("f_comi_card_info").innerHTML =
    `<div style="font-weight:600">${c.nombres} ${c.apellidos || ""}</div>` +
    `<div style="color:var(--text-muted)">${linea2.join(" · ")}</div>`;
  document.getElementById("f_comi_card").style.display = "block";
  document.getElementById("f_comi_search_wrap").style.display = "none";
  document.getElementById("f_comi_results").style.display = "none";
  document.getElementById("f_comi_edit").style.display = "none";
  const btn = document.getElementById("btn_edit_comi");
  if (btn) btn.style.display = "";
};

window._limpiarComisionista = function() {
  window._comisionistaSeleccionado = null;
  document.getElementById("f_comi").value = "";
  document.getElementById("f_comi_card").style.display = "none";
  document.getElementById("f_comi_search_wrap").style.display = "";
  document.getElementById("f_comi_search").value = "";
  document.getElementById("f_comi_results").style.display = "none";
  document.getElementById("f_comi_edit").style.display = "none";
  const btn = document.getElementById("btn_edit_comi");
  if (btn) btn.style.display = "none";
};

window._editarComisionista = function() {
  const c = window._comisionistaSeleccionado;
  if (!c) return;
  document.getElementById("fe_comi_doc").value  = c.documento || "";
  document.getElementById("fe_comi_nom").value  = c.nombres || "";
  document.getElementById("fe_comi_ape").value  = c.apellidos || "";
  document.getElementById("fe_comi_tel").value  = c.telefono || "";
  document.getElementById("fe_comi_mail").value = c.email || "";
  document.getElementById("f_comi_edit").style.display = "block";
};

window._cancelarEdicionComisionista = function() {
  document.getElementById("f_comi_edit").style.display = "none";
};

window._guardarEdicionComisionista = async function() {
  const c = window._comisionistaSeleccionado;
  if (!c) return;
  const doc  = document.getElementById("fe_comi_doc").value.trim();
  const nom  = document.getElementById("fe_comi_nom").value.trim();
  const tel  = document.getElementById("fe_comi_tel").value.trim();
  const mail = document.getElementById("fe_comi_mail").value.trim();
  if (!doc || !nom)                 return UI.toast("Documento y nombres son obligatorios", "error");
  if (!tel)                         return UI.toast("El teléfono es obligatorio", "error");
  if (mail && !_validarEmail(mail)) return UI.toast("Ingrese un correo electrónico válido", "error");
  try {
    const upd = await API.put(`/comisionistas/${c.id_usuario}`, {
      documento: doc, nombres: nom,
      apellidos: document.getElementById("fe_comi_ape").value.trim(),
      telefono: tel, mail,
    });
    window._comisionistaSeleccionado = upd;
    const idx = (window._ventaComisionistas || []).findIndex(x => x.id_usuario === upd.id_usuario);
    if (idx >= 0) window._ventaComisionistas[idx] = upd;
    document.getElementById("f_comi_edit").style.display = "none";
    _seleccionarComisionista(upd.id_usuario);
    UI.toast("Comisionista actualizado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Quick creation ───
window._toggleNuevoComprador = function() {
  const div = document.getElementById("f_comp_nuevo");
  div.style.display = div.style.display === "none" ? "block" : "none";
};

window._toggleNuevoComisionista = function() {
  const div = document.getElementById("f_comi_nuevo");
  div.style.display = div.style.display === "none" ? "block" : "none";
};

window._crearCompradorRapido = async function() {
  const doc  = document.getElementById("fn_comp_doc").value.trim();
  const nom  = document.getElementById("fn_comp_nom").value.trim();
  const tel  = document.getElementById("fn_comp_tel").value.trim();
  const mail = document.getElementById("fn_comp_mail").value.trim();
  if (!doc || !nom)                 return UI.toast("Documento y nombres son obligatorios", "error");
  if (!tel)                         return UI.toast("El teléfono es obligatorio", "error");
  if (mail && !_validarEmail(mail)) return UI.toast("Ingrese un correo electrónico válido", "error");
  try {
    const nuevo = await API.post("/compradores", {
      documento: doc, nombres: nom,
      apellidos: document.getElementById("fn_comp_ape").value.trim(),
      telefono: tel, mail,
      tipo_persona: document.getElementById("fn_comp_tipo").value,
    });
    (window._ventaCompradores = window._ventaCompradores || []).push(nuevo);
    _toggleNuevoComprador();
    _seleccionarComprador(nuevo.id_usuario);
    UI.toast("Comprador creado y seleccionado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

window._crearComisionistaRapido = async function() {
  const doc  = document.getElementById("fn_comi_doc").value.trim();
  const nom  = document.getElementById("fn_comi_nom").value.trim();
  const tel  = document.getElementById("fn_comi_tel").value.trim();
  const mail = document.getElementById("fn_comi_mail").value.trim();
  if (!doc || !nom)                 return UI.toast("Documento y nombres son obligatorios", "error");
  if (!tel)                         return UI.toast("El teléfono es obligatorio", "error");
  if (mail && !_validarEmail(mail)) return UI.toast("Ingrese un correo electrónico válido", "error");
  try {
    const nuevo = await API.post("/comisionistas", {
      documento: doc, nombres: nom,
      apellidos: document.getElementById("fn_comi_ape").value.trim(),
      telefono: tel, mail,
    });
    (window._ventaComisionistas = window._ventaComisionistas || []).push(nuevo);
    _toggleNuevoComisionista();
    _seleccionarComisionista(nuevo.id_usuario);
    UI.toast("Comisionista creado y seleccionado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Pre-confirmation summary ───
function _seccionResumen(titulo, contenido) {
  return `
    <div style="margin-bottom:8px;padding:8px 12px;background:var(--surface-2,#f0f4f8);border-radius:6px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <span style="font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">${titulo}</span>
          <div style="margin-top:2px;font-size:.85rem;line-height:1.6">${contenido}</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm"
                style="font-size:.75rem;padding:2px 6px;flex-shrink:0;color:var(--primary,#ff6a00)"
                onclick="_ocultarResumenVenta()">Editar</button>
      </div>
    </div>`;
}

window._ocultarResumenVenta = function() {
  document.getElementById("venta_form_wrap").style.display = "block";
  document.getElementById("venta_resumen_wrap").style.display = "none";
};
function _getVentaErrorWrap() {
  let errorWrap = document.getElementById("venta_error_wrap");

  if (errorWrap) return errorWrap;

  const formWrap = document.getElementById("venta_form_wrap");
  const resumenWrap = document.getElementById("venta_resumen_wrap");

  const target =
    resumenWrap && resumenWrap.style.display !== "none"
      ? resumenWrap
      : formWrap;

  if (!target) return null;

  errorWrap = document.createElement("div");
  errorWrap.id = "venta_error_wrap";
  errorWrap.className = "venta-modal-error";

  target.prepend(errorWrap);

  return errorWrap;
}

function _mostrarErrorVenta(mensaje) {
  const errorWrap = _getVentaErrorWrap();

  if (!errorWrap) {
    UI.toast(mensaje || "Ocurrió un error al procesar la venta", "error");
    return;
  }

  errorWrap.innerHTML = `
    <strong>No se pudo completar la operación</strong>
    <span>${mensaje || "Revise la información ingresada e intente nuevamente."}</span>
  `;

  errorWrap.style.display = "block";
  errorWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function _limpiarErrorVenta() {
  const errorWrap = document.getElementById("venta_error_wrap");

  if (!errorWrap) return;

  errorWrap.innerHTML = "";
  errorWrap.style.display = "none";
}

window._mostrarResumenVenta = function(fnConfirmar) {
  const body = _bodyVenta();
  const err  = _validarBodyVenta(body);

if (err) {
  _mostrarErrorVenta(err);
  UI.toast(err, "error");
  return;
}

_limpiarErrorVenta();

  const loteInfo = window._loteSeleccionado || null;
  const proy = document.getElementById("f_proy")?.value || "—";
  const tp   = _totalPermutas();
  const saldo = Math.max(0, body.valor_total - body.cuota_inicial - tp);

  // Micro-cuotas rows
  const mcRows = body.microcuotas.map((mc, i) =>
    `<tr><td style="padding:2px 10px 2px 0">Micro-cuota ${i+1}</td><td style="padding:2px 10px 2px 0"><b>${UI.fmt(mc.valor) || "—"}</b></td><td style="color:var(--text-muted)">${mc.fecha || "—"}</td></tr>`
  ).join("");

  // Cuotas preview
  const dia = +document.getElementById("f_dia_pago")?.value || 0;
  const mes = document.getElementById("f_fc")?.value || "";
  const nc  = body.numero_cuotas;
  let cuotaLine = "—";
  if (dia && mes && nc && saldo > 0) {
    const base = Math.floor(saldo / nc);
    const [yr, mo] = mes.split("-").map(Number);
    const fmtDate = (offset) => {
      let m = mo + offset, y = yr + Math.floor((m-1)/12);
      m = ((m-1)%12)+1;
      const d = Math.min(dia, new Date(y,m,0).getDate());
      return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
    };
    const preview = nc <= 4
      ? Array.from({length:nc},(_,i)=>fmtDate(i)).join(" · ")
      : `${fmtDate(0)} · ${fmtDate(1)} · ${fmtDate(2)} … ${fmtDate(nc-1)}`;
    cuotaLine = `<b>${nc}</b> cuotas de <b style="color:var(--primary,#ff6a00)">${UI.fmt(base)}</b>/mes · día ${dia} · ${preview}`;
  }

  const comp = window._compradorSeleccionado;
  const comi = window._comisionistaSeleccionado;
  const perms = (window._ventaPermutas||[]).filter(p=>p.valor>0);

  const html = `
    <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:10px">Revise antes de confirmar — cada sección tiene un botón <b>Editar</b> para volver al formulario.</p>
    ${_seccionResumen("Lote", `<b>${proy}</b> · ${loteInfo?.codigo_lote||"—"} · Mz ${loteInfo?.manzana||"—"} Lt ${loteInfo?.numero_lote||"—"} · ${loteInfo?.area_m2?loteInfo.area_m2+" m²":"—"} · Precio lista: ${UI.fmt(loteInfo?.precio_lista)}`)}
    ${_seccionResumen("Fecha de venta", body.fecha_venta ? UI.date(body.fecha_venta) : "—")}
    ${_seccionResumen("Valores", `Valor total: <b>${UI.fmt(body.valor_total)}</b> · Cuota inicial: <b>${UI.fmt(body.cuota_inicial)}</b>${tp>0?` · Permutas: <b>${UI.fmt(tp)}</b> (${perms.map(p=>p.descripcion||"bien").join(", ")})`:""}  · Saldo: <b style="color:var(--primary,#ff6a00)">${UI.fmt(saldo)}</b>`)}
    ${body.escriturado ? _seccionResumen("Escritura", `Escriturado${body.fecha_escritura ? " · " + UI.date(body.fecha_escritura) : ""}`) : ""}
    ${body.cuota_inicial>0 ? _seccionResumen("Cuota inicial",`${body.numero_cuotas_inicial} micro-cuota${body.numero_cuotas_inicial>1?"s":""}<table style="margin-top:4px;border-collapse:collapse;font-size:.82rem">${mcRows}</table>`) : ""}
    ${_seccionResumen("Cuotas regulares", cuotaLine)}
    ${_seccionResumen("Comprador", comp ? `<b>${comp.nombres} ${comp.apellidos||""}</b> · CC ${comp.documento}${comp.telefono?" · "+comp.telefono:""}${comp.email?" · "+comp.email:""}` : "—")}
    ${_seccionResumen("Comisionista", comi ? `<b>${comi.nombres} ${comi.apellidos||""}</b> · CC ${comi.documento} · Comisión: ${UI.fmt(body.valor_comision)}` : "Sin comisionista")}
    ${body.observaciones ? _seccionResumen("Observaciones", body.observaciones) : ""}
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="_ocultarResumenVenta()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Editar</button>
      <button class="btn btn-primary" onclick="${fnConfirmar}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Confirmar y crear</button>
    </div>`;

  document.getElementById("venta_form_wrap").style.display = "none";
  const wrap = document.getElementById("venta_resumen_wrap");
  wrap.innerHTML = html;
  wrap.style.display = "block";
};

// ─── Dynamic form section initialization ───
function _iniciarFormularioDinamico() {
  window._ventaPermutas = [];
  window._loteSeleccionado = null;
  _renderMicroCuotas(1);
  _actualizarCalculos();
  const fechaInput = document.getElementById("f_fecha_venta");
  if (fechaInput) fechaInput.value = new Date().toISOString().split("T")[0];

  const vtEl   = document.getElementById("f_vt");
  const ciEl   = document.getElementById("f_ci");
  const pcomEl = document.getElementById("f_pcom");
  if (vtEl) MoneyInput.init(vtEl, { onChange: _actualizarCalculos });
  if (ciEl) MoneyInput.init(ciEl, {
    dependsOn: () => MoneyInput.parse(document.getElementById("f_vt")?.value || "0"),
    onChange: _actualizarCalculos,
  });
  if (pcomEl) MoneyInput.init(pcomEl);
}

// ─── Standard form (admin / auxiliar_contable) ───
window.ventaForm = async function() {
  let lotes, compradores, comisionistas;
  try {
    [lotes, compradores, comisionistas] = await Promise.all([
      API.get("/lotes/disponibles"), API.get("/compradores"), API.get("/comisionistas")
    ]);
  } catch(e) {
    UI.toast("Error al cargar datos del formulario: " + e.message, "error");
    console.error("[ventaForm]", e);
    return;
  }

  window._ventaLotes           = lotes || [];
  window._ventaCompradores     = compradores || [];
  window._ventaComisionistas   = comisionistas || [];
  window._compradorSeleccionado    = null;
  window._comisionistaSeleccionado = null;

  const proyectos = _proyectosDesdeIotes(window._ventaLotes);
  if (proyectos.length === 0) console.warn("[ventaForm] lotes disponibles recibidos:", lotes);

  UI.openModal("Nueva Venta",
    `<div id="venta_form_wrap">` + _htmlFormVenta(proyectos) + `
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="_mostrarResumenVenta('guardarVenta()')">Revisar <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
      </div>
    </div>
    <div id="venta_resumen_wrap" style="display:none"></div>`);
  setTimeout(_iniciarFormularioDinamico, 0);
};

function _validarBodyVenta(body) {
  if (!body.id_lote)
    return "Seleccione un lote";
  if (!body.valor_total || body.valor_total <= 0)
    return "El valor total debe ser mayor a cero";
  if (body.cuota_inicial < 0)
    return "La cuota inicial no puede ser negativa";
  if (body.cuota_inicial > body.valor_total)
    return "La cuota inicial no puede superar el valor total";
  if (!body.compradores[0]?.id_usuario)
    return "Seleccione un comprador";
  if (!body.numero_cuotas)
    return "Ingrese el número de cuotas regulares";
  if (!body.fecha_primera_cuota)
    return "Ingrese el mes de inicio y día de pago de las cuotas regulares";
  if (body.cuota_inicial > 0 && !body.fecha_primera_cuota_inicial)
    return "Ingrese la fecha de al menos la primera micro-cuota inicial";
  // Micro-installments: if the user filled in values, they must match the initial installment total
  if (body.cuota_inicial > 0 && Array.isArray(body.microcuotas)) {
    const algunoLleno = body.microcuotas.some(mc => mc.valor > 0);
    if (algunoLleno) {
      const suma = body.microcuotas.reduce((s, mc) => s + (mc.valor || 0), 0);
      if (Math.abs(suma - body.cuota_inicial) > 1)
        return `Las micro-cuotas suman ${UI.fmt(suma)} pero la cuota inicial es ${UI.fmt(body.cuota_inicial)}. Ajuste los montos o déjelos en 0 para división automática.`;
    }
  }
  // Permutas
  const permas = body.permutas || [];
  if (permas.some(p => Number(p.valor) < 0))
    return "Los valores de permuta no pueden ser negativos";
  const totalPerm = permas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  if (totalPerm >= body.valor_total)
    return "El total de permutas no puede igualar o superar el valor total del lote";
  return null;
}

window.guardarVenta = async function() {
  const body = _bodyVenta();
  const err  = _validarBodyVenta(body);

  if (err) {
    _mostrarErrorVenta(err);
    UI.toast(err, "error");
    return;
  }

  _limpiarErrorVenta();

  try {
    const ventaCreada = await API.post("/ventas", body);

    UI.closeModal();

    const cuotas = ventaCreada?.cuotas_generadas || 0;

    UI.toast(
      cuotas > 0
        ? `Venta creada correctamente con ${cuotas} cuota(s) generada(s)`
        : "Venta creada correctamente",
      "ok"
    );

    ventasView();
  } catch(e) {
    const mensaje = e.message || "No se pudo crear la venta";

    _mostrarErrorVenta(mensaje);
    UI.toast(mensaje, "error");
  }
};

// ─── Formulario de solicitud (asesor_comercial) ───
window.ventaFormSolicitud = async function() {
  let lotes, compradores, comisionistas;
  try {
    [lotes, compradores, comisionistas] = await Promise.all([
      API.get("/lotes/disponibles"), API.get("/compradores"), API.get("/comisionistas")
    ]);
  } catch(e) {
    UI.toast("Error al cargar datos del formulario: " + e.message, "error");
    console.error("[ventaFormSolicitud]", e);
    return;
  }

  window._ventaLotes           = lotes || [];
  window._ventaCompradores     = compradores || [];
  window._ventaComisionistas   = comisionistas || [];
  window._compradorSeleccionado    = null;
  window._comisionistaSeleccionado = null;

  const proyectos = _proyectosDesdeIotes(window._ventaLotes);

  UI.openModal("Solicitar Venta (pendiente de autorización)",
    `<div id="venta_form_wrap">
      <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem;">
        Esta solicitud quedará en estado <b>pendiente</b> y deberá ser aprobada por un administrador o auxiliar contable antes de activarse.
      </p>
      ` + _htmlFormVenta(proyectos) + `
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="_mostrarResumenVenta('guardarSolicitudVenta()')">Revisar <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
      </div>
    </div>
    <div id="venta_resumen_wrap" style="display:none"></div>`);
  setTimeout(_iniciarFormularioDinamico, 0);
};

window.guardarSolicitudVenta = async function() {
  const body = _bodyVenta();
  const err  = _validarBodyVenta(body);

  if (err) {
    _mostrarErrorVenta(err);
    UI.toast(err, "error");
    return;
  }

  _limpiarErrorVenta();

  try {
    const ventaCreada = await API.post("/ventas/solicitud", body);

    UI.closeModal();

    const cuotas = ventaCreada?.cuotas_generadas || 0;

    UI.toast(
      cuotas > 0
        ? `Solicitud enviada con ${cuotas} cuota(s) generada(s)`
        : "Solicitud enviada — pendiente de autorización",
      "ok"
    );

    ventasView();
  } catch(e) {
    const mensaje = e.message || "No se pudo enviar la solicitud";

    _mostrarErrorVenta(mensaje);
    UI.toast(mensaje, "error");
  }
};

window._actualizarCalculos = _actualizarCalculos;

function _exportVentaPDF(v, cuotas, fin) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const SX  = window.SGIExport.pdf;

  const fmtCOP  = n => n != null
    ? Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    : "—";
  const fmtDate = d => d
    ? new Date(String(d).length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-CO")
    : "—";
  const pagada  = c => c.pagada === true;

  const lote = v.lote || {};
  const { vt, ci, tp, totalPagado, saldo, pct, cumple, escrit, cuotasIni, cuotasReg, pagIni, pagReg, sumVal } = fin;

  let y = SX.brand(doc);

  const subtitle = `${lote.proyecto?.nombre || "—"}${lote.codigo_lote ? `  ·  ${lote.codigo_lote}` : ""}  ·  Estado ${(v.estado || "—").replace(/_/g, " ").toUpperCase()}  ·  Fecha de venta ${fmtDate(v.fecha_venta)}`;
  y = SX.title(doc, y + 2, {
    title:    `Detalle de Venta #${v.id_venta}`,
    subtitle,
  });

  const allCuotas = [...cuotasIni, ...cuotasReg];
  const pagadasAll = allCuotas.filter(pagada);
  y = SX.kpiCards(doc, y + 2, [
    { label: "Valor total",    value: fmtCOP(vt) },
    { label: "Total pagado",   value: fmtCOP(totalPagado), desc: `${pct.toFixed(1)}% del valor total` },
    { label: "Por pagar",      value: fmtCOP(Math.max(0, vt - totalPagado)), desc: "Saldo pendiente sobre el lote" },
    { label: "Cuotas pagadas", value: `${pagadasAll.length}/${allCuotas.length}`, desc: cumple ? "Cumple requisito 30%" : `Falta ${(30 - pct).toFixed(1)}% para el 30%` },
  ], { perRow: 4 });

  y = SX.section(doc, y + 6, { kicker: "Inmueble", title: "Lote y Proyecto" });
  y = SX.detailTable(doc, y, [
    ["Proyecto",     lote.proyecto?.nombre || "—"],
    ["Código lote",  lote.codigo_lote || "—"],
    ["Ubicación",    `Mz ${lote.manzana || "—"} · Lote ${lote.numero_lote || "—"}`],
    ...(lote.area_m2 != null      ? [["Área",          `${lote.area_m2} m²`]] : []),
    ...(lote.precio_lista != null ? [["Precio lista",  fmtCOP(lote.precio_lista)]] : []),
  ]);

  const compradores = v.venta_comprador || [];
  y = SX.section(doc, y + 4, { kicker: "Personas", title: "Compradores" });
  doc.autoTable({
    startY: y,
    head: [["Nombre", "Documento", "Teléfono", "Correo", "Particip."]],
    body: compradores.length
      ? compradores.map(vc => [
          `${vc.usuario?.nombres || ""} ${vc.usuario?.apellidos || ""}`.trim() || "—",
          vc.usuario?.documento || "—",
          vc.usuario?.telefono  || "—",
          vc.usuario?.email     || "—",
          `${vc.porcentaje || 100}%`,
        ])
      : [["Sin compradores", "", "", "", ""]],
    ...SX.tableTheme(),
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 54 },
      4: { cellWidth: 20, halign: "center" },
    },
  });
  y = doc.lastAutoTable.finalY;

  y = SX.section(doc, y + 4, { kicker: "Financiero", title: "Valores Financieros" });
  y = SX.detailTable(doc, y, [
    ["Valor total",      fmtCOP(vt)],
    ...(ci > 0 ? [["Cuota inicial", fmtCOP(ci)]] : []),
    ...(tp > 0 ? [["Permutas",      fmtCOP(tp)]] : []),
    ["Saldo financiado", fmtCOP(saldo)],
    ["Total pagado",     `${fmtCOP(totalPagado)}  (${pct.toFixed(1)}%)`],
    ["Por pagar",        fmtCOP(Math.max(0, vt - totalPagado))],
    ["Requisito 30%",    cumple ? "Cumple" : `No cumple — faltan ${(30 - pct).toFixed(1)}% (${fmtCOP(Math.max(0, vt * 0.3 - totalPagado))})`],
    ["Escriturado",      escrit ? `Sí${v.fecha_escritura ? " · " + fmtDate(v.fecha_escritura) : ""}` : "No"],
  ]);

  const cuotaTableOpts = {
    head: [["#", "Tipo", "Vencimiento", "Valor", "Fecha pago", "Estado"]],
    ...SX.tableTheme(),
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: 28 },
      2: { halign: "center", cellWidth: 34 },
      3: { halign: "right",  cellWidth: 40 },
      4: { halign: "center", cellWidth: 34 },
      5: { halign: "center", cellWidth: 34 },
    },
  };

  if (cuotasIni.length > 0) {
    y = SX.section(doc, y + 4, {
      kicker: "Plan de pagos",
      title:  `Cuotas Iniciales · ${pagIni.length}/${cuotasIni.length} pagadas · Recaudado ${fmtCOP(sumVal(pagIni))}`,
    });
    doc.autoTable({
      startY: y,
      body: cuotasIni.map(c => [
        c.numero_cuota,
        "Inicial",
        fmtDate(c.fecha_vencimiento),
        fmtCOP(c.valor_cuota),
        c.fecha_pago ? fmtDate(c.fecha_pago) : "—",
        pagada(c) ? "Pagada" : "Pendiente",
      ]),
      ...cuotaTableOpts,
    });
    y = doc.lastAutoTable.finalY;
  }

  if (cuotasReg.length > 0) {
    y = SX.section(doc, y + 4, {
      kicker: "Plan de pagos",
      title:  `Cuotas Regulares · ${pagReg.length}/${cuotasReg.length} pagadas · Recaudado ${fmtCOP(sumVal(pagReg))}`,
    });
    doc.autoTable({
      startY: y,
      body: cuotasReg.map(c => [
        c.numero_cuota,
        "Regular",
        fmtDate(c.fecha_vencimiento),
        fmtCOP(c.valor_cuota),
        c.fecha_pago ? fmtDate(c.fecha_pago) : "—",
        pagada(c) ? "Pagada" : "Pendiente",
      ]),
      ...cuotaTableOpts,
    });
    y = doc.lastAutoTable.finalY;
  }

  const vc0 = Array.isArray(v.venta_comisionista) ? v.venta_comisionista[0] : v.venta_comisionista;
  if (vc0) {
    y = SX.section(doc, y + 4, { kicker: "Asignación", title: "Comisionista" });
    y = SX.detailTable(doc, y, [
      ["Nombre",         `${vc0.usuario?.nombres || ""} ${vc0.usuario?.apellidos || ""}`.trim() || "—"],
      ...(vc0.usuario?.documento ? [["Documento", vc0.usuario.documento]] : []),
      ...(vc0.usuario?.telefono  ? [["Teléfono",  vc0.usuario.telefono]]  : []),
      ...(vc0.usuario?.email     ? [["Correo",    vc0.usuario.email]]     : []),
      ["Valor comisión", fmtCOP(vc0.valor_comision)],
    ]);
  }

  SX.footer(doc);
  doc.save(`venta_${v.id_venta}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function _exportVentaExcel(v, cuotas, fin) {
  const SX = window.SGIExport.xlsx;
  const wb = SX.setup();

  const pagada  = c => c.pagada === true;
  const fmtDate = d => d
    ? new Date(String(d).length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-CO")
    : "—";

  const lote = v.lote || {};
  const { vt, ci, tp, totalPagado, saldo, pct, cumple, escrit, cuotasIni, cuotasReg, pagIni, pagReg, sumVal } = fin;

  // ── Hoja 1: Resumen ─────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Resumen", { tabColor: { argb: SX.C.primary } });
  ws1.columns = [
    { key: "col1", width: 22 },
    { key: "col2", width: 22 },
    { key: "col3", width: 22 },
    { key: "col4", width: 22 },
  ];

  SX.masthead(ws1, {
    title:    `Detalle de Venta #${v.id_venta}`,
    subtitle: `${lote.proyecto?.nombre || "—"} · ${lote.codigo_lote || "—"}  ·  Estado: ${(v.estado || "—").replace(/_/g, " ")}`,
    mergeCols: 4,
  });

  SX.kpiRow(ws1, [
    { label: "Valor total",  value: Number(vt),                       money:   true },
    { label: "Total pagado", value: Number(totalPagado),              money:   true },
    { label: "% pagado",     value: pct / 100,                        percent: true },
    { label: "Por pagar",    value: Math.max(0, vt - totalPagado),    money:   true },
  ]);

  SX.sectionHeader(ws1, "Información general", { mergeCols: 4 });
  SX.keyValue(ws1, "Número de venta", v.id_venta);
  SX.keyValue(ws1, "Estado",          (v.estado || "—").replace(/_/g, " "));
  SX.keyValue(ws1, "Fecha de venta",  fmtDate(v.fecha_venta));

  SX.sectionHeader(ws1, "Lote y Proyecto", { mergeCols: 4 });
  SX.keyValue(ws1, "Proyecto",    lote.proyecto?.nombre || "—");
  SX.keyValue(ws1, "Código lote", lote.codigo_lote || "—");
  SX.keyValue(ws1, "Manzana",     lote.manzana || "—");
  SX.keyValue(ws1, "Número lote", lote.numero_lote || "—");
  if (lote.area_m2 != null)      SX.keyValue(ws1, "Área (m²)",    Number(lote.area_m2));
  if (lote.precio_lista != null) SX.keyValue(ws1, "Precio lista", Number(lote.precio_lista), { money: true });

  SX.sectionHeader(ws1, "Valores Financieros", { mergeCols: 4 });
  SX.keyValue(ws1, "Valor total",      Number(vt),          { money: true });
  if (ci > 0) SX.keyValue(ws1, "Cuota inicial", Number(ci), { money: true });
  if (tp > 0) SX.keyValue(ws1, "Permutas",      Number(tp), { money: true });
  SX.keyValue(ws1, "Saldo financiado", Number(saldo),       { money: true });
  SX.keyValue(ws1, "Total pagado",     Number(totalPagado), { money: true });
  SX.keyValue(ws1, "% pagado",         pct / 100,           { percent: true });
  SX.keyValue(ws1, "Por pagar",        Number(Math.max(0, vt - totalPagado)), { money: true });
  SX.keyValue(ws1, "Requisito 30%",    cumple ? "Cumple" : `No cumple — faltan ${(30 - pct).toFixed(1)}%`,
    { valueColor: cumple ? SX.C.green : SX.C.red });
  SX.keyValue(ws1, "Escriturado",      escrit ? `Sí${v.fecha_escritura ? " · " + fmtDate(v.fecha_escritura) : ""}` : "No");

  const compradores = v.venta_comprador || [];
  if (compradores.length > 0) {
    SX.sectionHeader(ws1, "Compradores", { mergeCols: 4 });
    compradores.forEach((vc, i) => {
      const nombre = `${vc.usuario?.nombres || ""} ${vc.usuario?.apellidos || ""}`.trim() || "—";
      SX.keyValue(ws1, `Comprador ${i + 1}`, nombre);
      if (vc.usuario?.documento) SX.keyValue(ws1, "  Documento", vc.usuario.documento);
      if (vc.usuario?.telefono)  SX.keyValue(ws1, "  Teléfono",  vc.usuario.telefono);
      if (vc.usuario?.email)     SX.keyValue(ws1, "  Correo",    vc.usuario.email);
      SX.keyValue(ws1, "  Participación", `${vc.porcentaje || 100}%`);
    });
  }

  const vc0 = Array.isArray(v.venta_comisionista) ? v.venta_comisionista[0] : v.venta_comisionista;
  if (vc0) {
    SX.sectionHeader(ws1, "Comisionista", { mergeCols: 4 });
    SX.keyValue(ws1, "Nombre", `${vc0.usuario?.nombres || ""} ${vc0.usuario?.apellidos || ""}`.trim() || "—");
    if (vc0.usuario?.documento) SX.keyValue(ws1, "Documento", vc0.usuario.documento);
    if (vc0.usuario?.telefono)  SX.keyValue(ws1, "Teléfono",  vc0.usuario.telefono);
    if (vc0.usuario?.email)     SX.keyValue(ws1, "Correo",    vc0.usuario.email);
    SX.keyValue(ws1, "Valor comisión", Number(vc0.valor_comision), { money: true });
  }

  ws1.views = [{ state: "frozen", ySplit: 5 }];

  // ── Hoja 2: Plan de Pagos ───────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Plan de Pagos", { tabColor: { argb: SX.C.primary } });
  ws2.columns = [
    { key: "tipo",      width: 18 },
    { key: "numero",    width: 8  },
    { key: "vence",     width: 16 },
    { key: "valor",     width: 18 },
    { key: "fechaPago", width: 16 },
    { key: "estado",    width: 14 },
  ];

  SX.masthead(ws2, {
    title:    `Venta #${v.id_venta} — Plan de Pagos`,
    subtitle: `${lote.proyecto?.nombre || ""}${lote.codigo_lote ? ` · ${lote.codigo_lote}` : ""}`,
    mergeCols: 6,
  });

  ws2.addRow([]).height = 4;
  const hRow = ws2.addRow(["Tipo", "#", "Vencimiento", "Valor (COP)", "Fecha pago", "Estado"]);
  SX.styleHeader(hRow);
  const headerRowNum = hRow.number;

  const allCuotas = [...cuotasIni, ...cuotasReg].sort((a, b) => a.numero_cuota - b.numero_cuota);
  allCuotas.forEach((c, i) => {
    const ok = pagada(c);
    const r  = ws2.addRow({
      tipo:      c.tipo === "inicial" ? "Cuota inicial" : "Cuota regular",
      numero:    c.numero_cuota,
      vence:     fmtDate(c.fecha_vencimiento),
      valor:     Number(c.valor_cuota || 0),
      fechaPago: c.fecha_pago ? fmtDate(c.fecha_pago) : "—",
      estado:    ok ? "Pagada" : "Pendiente",
    });
    SX.styleBody(r, i % 2 !== 0);
    r.getCell("valor").numFmt = SX.NF.money;
    r.getCell("valor").alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    r.getCell("estado").font = {
      name: "Calibri", bold: true, size: 10,
      color: { argb: ok ? SX.C.green : SX.C.red },
    };
    r.getCell("estado").alignment = { vertical: "middle", horizontal: "center" };
  });

  ws2.addRow([]).height = 6;
  // RN-10: total collected = receipt-backed amounts (includes partial payments).
  const totPagado = allCuotas.reduce((s, c) => s + Number(c.valor_pagado || 0), 0);
  const totRow = ws2.addRow(["", "", "Total recaudado", totPagado, "", ""]);
  totRow.getCell(3).font = { name: "Calibri", bold: true, size: 11, color: { argb: SX.C.dark } };
  totRow.getCell(3).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  totRow.getCell(4).font = { name: "Calibri", bold: true, size: 12, color: { argb: SX.C.primary } };
  totRow.getCell(4).numFmt = SX.NF.money;
  totRow.getCell(4).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  totRow.height = 24;

  ws2.views = [{ state: "frozen", ySplit: headerRowNum }];
  ws2.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to:   { row: headerRowNum, column: 6 },
  };

  await SX.download(wb, `venta_${v.id_venta}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

})();
