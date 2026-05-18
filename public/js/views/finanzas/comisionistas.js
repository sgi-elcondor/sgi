(function () {

let _currentComisiones = [];

function _fmtMoneyInput(el) {
  const raw = el.value.replace(/\D/g, "");
  el.value  = raw ? Number(raw).toLocaleString("es-CO") : "";
}

function _parseMoney(value) {
  return Number(String(value).replace(/\./g, "")) || 0;
}

// ─── Main view ────────────────────────────────────────────────────────────────

window.comisionistasView = async function() {
  const vc       = document.getElementById("viewContainer");
  const canCreate = AppState.can("comisionistas", "crear");
  vc.innerHTML   = UI.loader();

  const lista = await API.get("/comisionistas").catch(() => []);

  vc.innerHTML = `
    ${SGIUI.pageHeader({
      kicker:  "Finanzas",
      title:   "Comisionistas",
      actions: canCreate ? `<button class="btn btn-primary btn-sm" onclick="comisionistaForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>` : "",
    })}

    <div class="table-wrap" style="margin-bottom:1.25rem">
      <div class="form-group" style="max-width:26rem;margin:0">
        <label>Seleccionar comisionista</label>
        <select id="sel_comisionista" onchange="cargarComisionesDetalle()">
          <option value="">— Seleccione un comisionista —</option>
          ${lista.map(c => `
            <option value="${c.id_comisionista}">
              ${c.nombres} ${c.apellidos || ""} &middot; ${c.documento}
            </option>`).join("")}
        </select>
      </div>
    </div>

    <div id="comisiones_container">
      <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.9rem">
        Seleccione un comisionista para ver sus comisiones
      </div>
    </div>
  `;

  SGIUI.hydrate();
};

// ─── Load commissions for selected comisionista ───────────────────────────────

window.cargarComisionesDetalle = async function() {
  const sel       = document.getElementById("sel_comisionista");
  const id        = sel?.value;
  const container = document.getElementById("comisiones_container");

  _currentComisiones = [];

  if (!id) {
    container.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.9rem">
      Seleccione un comisionista para ver sus comisiones
    </div>`;
    return;
  }

  container.innerHTML = UI.loader();

  const comisiones = await API.get(`/comisionistas/${id}/comisiones`).catch(e => {
    container.innerHTML = `<p style="color:var(--danger);padding:1rem">${e.message}</p>`;
    return null;
  });

  if (!comisiones) return;

  _currentComisiones = comisiones;

  if (!comisiones.length) {
    container.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.9rem">
      Este comisionista no tiene comisiones registradas
    </div>`;
    return;
  }

  const totalValor   = comisiones.reduce((s, c) => s + Number(c.valor_comision), 0);
  const totalMicros  = comisiones.reduce((s, c) =>
    s + (c.micropagos || []).reduce((ms, m) => ms + Number(m.valor), 0), 0);
  const countGanadas = comisiones.filter(c => c.ganada).length;
  const countPagadas = comisiones.filter(c => c.pagada).length;

  container.innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(11.25rem,1fr));margin-bottom:1.5rem">
      <div class="stat-card">
        <div class="stat-label">Comisiones</div>
        <div class="stat-value">${comisiones.length}</div>
        <div class="stat-sub">${countGanadas} ganadas &middot; ${countPagadas} pagadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Valor total</div>
        <div class="stat-value" style="font-size:1.3rem">${UI.fmt(totalValor)}</div>
        <div class="stat-sub">Pendiente: ${UI.fmt(Math.max(0, totalValor - totalMicros))}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Micropagos acumulados</div>
        <div class="stat-value" style="font-size:1.3rem">${UI.fmt(totalMicros)}</div>
        <div class="stat-sub">en ${comisiones.filter(c => c.micropagos?.length).length} comisiones</div>
      </div>
    </div>

    <div id="lista_comisiones">
      ${comisiones.map(c => _renderComisionCard(c)).join("")}
    </div>
  `;

  SGIUI.hydrate();
};

// ─── Accordion card ───────────────────────────────────────────────────────────

function _renderComisionCard(vc) {
  const v           = vc.venta;
  const ventaId     = vc.id_venta;
  const proyecto    = v.lote?.proyecto?.nombre || "—";
  const lote        = v.lote ? `${v.lote.codigo_lote} M${v.lote.manzana}-${v.lote.numero_lote}` : "—";
  const compradores = (v.compradores || [])
    .map(c => `${c.nombres} ${c.apellidos || ""}`.trim()).join(", ") || "—";

  const micropagosTotal = (vc.micropagos || []).reduce((s, m) => s + Number(m.valor), 0);
  const pendiente       = Math.max(0, Number(vc.valor_comision) - micropagosTotal);
  const porc30          = Math.min(100, vc.porcentaje_pagado);
  const barColor        = vc.ganada ? "var(--success)" : porc30 >= 20 ? "var(--warning)" : "var(--danger)";
  const faltante        = Math.max(0, vc.umbral_30pct - vc.total_pagado_venta);

  return `
    <div class="stat-card" style="margin-bottom:.5rem;padding:0;overflow:hidden" id="vc_card_${ventaId}">

      <!-- ── Clickable header ── -->
      <div onclick="_toggleComisionCard(${ventaId})"
        style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:1rem 1.125rem;gap:1rem;flex-wrap:wrap;user-select:none">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            Venta #${v.id_venta} &middot; ${UI.date(v.fecha_venta)}
          </div>
          <div style="color:var(--text-muted);font-size:.78rem;margin-top:.15rem">
            ${proyecto} &middot; ${lote} &middot; ${compradores}
          </div>
        </div>
        <div style="display:flex;gap:.4rem;align-items:center;flex-shrink:0;flex-wrap:wrap">
          ${UI.badge(vc.ganada ? "ganada" : "no_ganada")}
          ${vc.pagada ? UI.badge("pagada") : ""}
          <span style="font-weight:700;font-size:.88rem;color:var(--accent)">${UI.fmt(vc.valor_comision)}</span>
          <span id="vc_chevron_${ventaId}"
            style="display:inline-flex;align-items:center;color:var(--text-muted);transition:transform .2s ease">
            <i data-lucide="chevron-down" class="sgi-icon"></i>
          </span>
        </div>
      </div>

      <!-- ── Collapsible body ── -->
      <div id="vc_body_${ventaId}" style="display:none;border-top:1px solid var(--border);padding:1rem 1.125rem">

        <!-- Earned reason + progress -->
        <div style="background:var(--surface-2);border-radius:.5rem;padding:.75rem 1rem;margin-bottom:.85rem;border-left:.2rem solid ${vc.ganada ? "var(--success)" : "var(--border)"}">
          <div style="font-weight:600;font-size:.82rem;margin-bottom:.3rem;color:${vc.ganada ? "var(--success)" : "var(--text-muted)"}">
            ${vc.ganada
              ? "Comisi&oacute;n ganada &mdash; el comprador super&oacute; el 30% del valor"
              : "A&uacute;n no ganada &mdash; el comprador no ha alcanzado el 30%"}
          </div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.6rem">
            Pagado por el comprador: <strong>${UI.fmt(vc.total_pagado_venta)}</strong>
            (${vc.porcentaje_pagado}% de ${UI.fmt(v.valor_total)}).
            ${vc.ganada
              ? `Umbral del 30% alcanzado (${UI.fmt(vc.umbral_30pct)}).`
                + (vc.fecha_ganada ? ` Ganada el ${UI.date(vc.fecha_ganada)}.` : "")
              : `Faltan <strong>${UI.fmt(faltante)}</strong> para el umbral de ${UI.fmt(vc.umbral_30pct)}.`}
          </div>
          <div style="background:var(--border);border-radius:.25rem;height:.4rem;overflow:hidden;position:relative">
            <div style="width:${porc30}%;background:${barColor};height:100%;border-radius:.25rem;transition:width .3s ease"></div>
            <div style="position:absolute;left:30%;top:0;width:1px;height:100%;background:var(--text-muted);opacity:.4"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-soft);margin-top:.25rem">
            <span>${vc.porcentaje_pagado}% pagado</span>
            <span>&#9650; 30%</span>
            <span>100%</span>
          </div>
        </div>

        <!-- Commission value + paid toggle -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 1rem;background:var(--surface-2);border-radius:.5rem;margin-bottom:.85rem;gap:1rem;flex-wrap:wrap">
          <div>
            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">
              Valor comisi&oacute;n
            </div>
            <div style="font-size:1.15rem;font-weight:700;color:var(--accent)">${UI.fmt(vc.valor_comision)}</div>
            ${micropagosTotal > 0 ? `
              <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem">
                Micropagos: ${UI.fmt(micropagosTotal)}
                &middot; Pendiente: <strong>${UI.fmt(pendiente)}</strong>
              </div>` : ""}
          </div>
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;user-select:none;font-size:.85rem">
            <input
              type="checkbox"
              id="chk_pagada_${ventaId}"
              ${vc.pagada ? "checked" : ""}
              onchange="togglePagarComision(${ventaId}, this.checked)"
              style="width:1.05rem;height:1.05rem;accent-color:var(--success);cursor:pointer"
            />
            <span style="color:var(--text-muted)">Pagada al comisionista</span>
            ${vc.fecha_pagado
              ? `<span style="font-size:.75rem;color:var(--text-soft)">(${UI.date(vc.fecha_pagado)})</span>`
              : ""}
          </label>
        </div>

        <!-- Micropagos -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
            <span style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em">
              Micropagos${micropagosTotal > 0 ? ` &mdash; ${UI.fmt(micropagosTotal)} / ${UI.fmt(vc.valor_comision)}` : ""}
            </span>
            <button class="btn btn-ghost btn-sm"
              style="font-size:.78rem;padding:.2rem .55rem"
              onclick="abrirFormMicropago(${ventaId})">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar
            </button>
          </div>

          ${(vc.micropagos || []).length === 0
            ? `<div style="font-size:.8rem;color:var(--text-soft);padding:.25rem 0 .5rem">Sin micropagos registrados</div>`
            : `<div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.5rem">
                ${(vc.micropagos || []).map(m => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .7rem;background:var(--surface-3);border-radius:.4rem;font-size:.82rem">
                    <div>
                      <span style="font-weight:600">${UI.fmt(m.valor)}</span>
                      ${m.nota ? `<span style="color:var(--text-muted);margin-left:.5rem">&middot; ${m.nota}</span>` : ""}
                      ${m.numero_pago ? `<span style="color:var(--text-soft);margin-left:.5rem;font-size:.72rem">${m.numero_pago}</span>` : ""}
                    </div>
                    <div style="text-align:right;display:flex;align-items:center;gap:.5rem">
                      <div>
                        <div style="color:var(--text-muted);font-size:.76rem">${UI.date(m.fecha)}</div>
                        ${m.recibo?.numero_recibo ? `<div style="color:var(--text-soft);font-size:.7rem">${m.recibo.numero_recibo}</div>` : ""}
                      </div>
                      ${m.recibo?.numero_recibo
                        ? `<button class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:.15rem .45rem"
                             onclick="_verReciboMicropago(${ventaId},${m.id_pago_comision})">PDF</button>`
                        : ""}
                    </div>
                  </div>`).join("")}
              </div>`}

          <!-- Inline form -->
          <div id="micropago_form_${ventaId}"
            style="display:none;margin-top:.5rem;padding:.85rem;background:var(--surface-2);border-radius:.5rem;border:1px solid var(--border)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.6rem">
              <div class="form-group" style="margin:0">
                <label style="font-size:.78rem">Valor *</label>
                <input type="text" id="mp_valor_${ventaId}" inputmode="numeric"
                  placeholder="0" oninput="_fmtMoneyInput(this)" style="font-size:.85rem"/>
              </div>
              <div class="form-group" style="margin:0">
                <label style="font-size:.78rem">Fecha *</label>
                <input type="date" id="mp_fecha_${ventaId}"
                  value="${new Date().toISOString().split("T")[0]}" style="font-size:.85rem"/>
              </div>
              <div class="form-group" style="margin:0;grid-column:1/-1">
                <label style="font-size:.78rem">Nota</label>
                <input type="text" id="mp_nota_${ventaId}"
                  placeholder="Opcional&hellip;" style="font-size:.85rem"/>
              </div>
            </div>
            <div style="display:flex;gap:.5rem;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" onclick="cerrarFormMicropago(${ventaId})">Cancelar</button>
              <button class="btn btn-primary btn-sm" id="mp_btn_${ventaId}"
                onclick="guardarMicropago(${ventaId})">Guardar</button>
            </div>
          </div>
        </div>

      </div><!-- /body -->
    </div>
  `;
}

// ─── Accordion toggle ─────────────────────────────────────────────────────────

function _toggleComisionCard(ventaId) {
  const body    = document.getElementById(`vc_body_${ventaId}`);
  const chevron = document.getElementById(`vc_chevron_${ventaId}`);
  if (!body) return;
  const isOpen = body.style.display !== "none";
  body.style.display    = isOpen ? "none" : "block";
  if (chevron) chevron.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
}

// ─── Micropago form helpers ───────────────────────────────────────────────────

window.abrirFormMicropago = function(ventaId) {
  const el = document.getElementById(`micropago_form_${ventaId}`);
  if (el) el.style.display = "block";
};

window.cerrarFormMicropago = function(ventaId) {
  const el = document.getElementById(`micropago_form_${ventaId}`);
  if (el) el.style.display = "none";
};

window.guardarMicropago = async function(ventaId) {
  const valor = document.getElementById(`mp_valor_${ventaId}`)?.value;
  const fecha = document.getElementById(`mp_fecha_${ventaId}`)?.value;
  const nota  = document.getElementById(`mp_nota_${ventaId}`)?.value?.trim() || "";

  const parsed = _parseMoney(valor);
  if (!parsed || parsed <= 0) return UI.toast("Ingrese un valor válido", "error");
  if (!fecha)                 return UI.toast("La fecha es obligatoria", "error");

  const btn = document.getElementById(`mp_btn_${ventaId}`);
  if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; }

  try {
    const result = await API.post(`/comisionistas/ventas/${ventaId}/micropago`, { valor: parsed, fecha, nota });

    UI.toast(result?.numero_recibo
      ? `Micropago registrado · Recibo ${result.numero_recibo}`
      : "Micropago registrado", "ok");

    // Open PDF immediately if recibo was generated
    if (result?.numero_recibo) {
      const vc = _currentComisiones.find(c => c.id_venta === ventaId);
      if (vc) _abrirReciboMicropago({ result, vc });
    }

    await cargarComisionesDetalle();

    // Re-open the card that was being edited
    const body = document.getElementById(`vc_body_${ventaId}`);
    if (body && body.style.display === "none") _toggleComisionCard(ventaId);

  } catch(e) {
    UI.toast(e?.message || "Error al guardar el micropago", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Guardar"; }
  }
};

// ─── Toggle paid status ───────────────────────────────────────────────────────

window.togglePagarComision = async function(ventaId, pagada) {
  try {
    await API.patch(`/comisionistas/ventas/${ventaId}/pagada`, { pagada });
    UI.toast(pagada ? "Comisión marcada como pagada" : "Comisión desmarcada", "ok");
    await cargarComisionesDetalle();
    const body = document.getElementById(`vc_body_${ventaId}`);
    if (body && body.style.display === "none") _toggleComisionCard(ventaId);
  } catch(e) {
    const chk = document.getElementById(`chk_pagada_${ventaId}`);
    if (chk) chk.checked = !pagada;
    UI.toast(e?.message || "Error", "error");
  }
};

// ─── PDF recibo de micropago ──────────────────────────────────────────────────

function _verReciboMicropago(ventaId, pagoCid) {
  const vc = _currentComisiones.find(c => c.id_venta === ventaId);
  if (!vc) return UI.toast("Datos no encontrados", "error");
  const m = (vc.micropagos || []).find(x => x.id_pago_comision === pagoCid);
  if (!m) return UI.toast("Micropago no encontrado", "error");
  _abrirReciboMicropago({ result: { ...m, numero_recibo: m.recibo?.numero_recibo }, vc });
}

function _abrirReciboMicropago({ result, vc }) {
  const sel  = document.getElementById("sel_comisionista");
  const opt  = sel?.options[sel.selectedIndex];
  const nombre = opt ? opt.text.split(" · ")[0].trim() : "Comisionista";

  const v        = vc.venta;
  const proyecto = v.lote?.proyecto?.nombre || "—";
  const lote     = v.lote ? `${v.lote.codigo_lote} M${v.lote.manzana}-${v.lote.numero_lote}` : "—";
  const comprador = (v.compradores || []).map(c => `${c.nombres} ${c.apellidos || ""}`.trim()).join(", ") || "—";

  const win = window.open("", "_blank", "width=780,height=820,scrollbars=yes");
  if (!win) return UI.toast("El navegador bloqueó la ventana emergente. Permita ventanas emergentes para este sitio.", "error");
  win.document.write(_buildReciboComisionHTML({
    numero_recibo:  result.numero_recibo,
    numero_pago:    result.numero_pago,
    fecha_emision:  new Date().toLocaleDateString("es-CO"),
    fecha_pago:     result.fecha,
    valor:          result.valor,
    nota:           result.nota,
    comisionista:   nombre,
    id_venta:       v.id_venta,
    proyecto,
    lote,
    comprador,
    valor_comision: vc.valor_comision,
    micropagos:     vc.micropagos || [],
    currentPago:    result
  }));
  win.document.close();
}

function _buildReciboComisionHTML(d) {
  const fmt = n => "$ " + Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });

  const totalPagado   = (d.micropagos || []).reduce((s, m) => s + Number(m.valor), 0);
  const pendiente     = Math.max(0, Number(d.valor_comision) - totalPagado);
  const porcentaje    = d.valor_comision > 0
    ? Math.round((totalPagado / d.valor_comision) * 100)
    : 0;

  const rowsMicros = (d.micropagos || []).map(m => `
    <tr style="border-bottom:1px solid #f0f0f0;${m.id_pago_comision === d.currentPago?.id_pago_comision ? "background:#f0fdf4;" : ""}">
      <td style="padding:5px 8px;font-size:12px;color:#555">${m.fecha || "—"}</td>
      <td style="padding:5px 8px;font-size:12px;color:#555">${m.nota || "—"}</td>
      <td style="padding:5px 8px;font-size:12px;font-weight:${m.id_pago_comision === d.currentPago?.id_pago_comision ? "700" : "400"};text-align:right;color:${m.id_pago_comision === d.currentPago?.id_pago_comision ? "#16a34a" : "#333"}">${fmt(m.valor)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo Comisi&oacute;n ${d.numero_recibo || "—"} &mdash; El C&oacute;ndor S.A.S.</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:32px 16px;color:#111}
    .page{max-width:680px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 16px rgba(0,0,0,.13);padding:44px 52px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f97316;padding-bottom:20px;margin-bottom:28px}
    .co-name{font-size:22px;font-weight:700;color:#f97316;margin-bottom:4px}
    .co-sub{font-size:12px;color:#888;line-height:1.6}
    .rec-head{text-align:right}
    .rec-title{font-size:26px;font-weight:800;color:#f97316;letter-spacing:.02em}
    .rec-sub{font-size:10px;font-weight:700;color:#f97316;letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
    .rec-num{font-size:15px;font-weight:700;margin-top:6px}
    .rec-date{font-size:12px;color:#888;margin-top:2px}
    .sec-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#aaa;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:10px;margin-top:20px}
    .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5;font-size:13px}
    .lbl{color:#777}
    .val{font-weight:600;text-align:right}
    .total-box{background:#fff7ed;border:2px solid #f97316;border-radius:8px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}
    .total-lbl{font-size:13px;color:#777}
    .total-amt{font-size:26px;font-weight:800;color:#f97316}
    .stamp-wrap{display:flex;justify-content:flex-end;margin-bottom:20px}
    .stamp{display:inline-block;border:3px solid #f97316;color:#f97316;font-size:16px;font-weight:800;padding:6px 18px;border-radius:6px;letter-spacing:.1em;transform:rotate(-8deg);opacity:.85}
    .progress-bar{background:#fee2c0;border-radius:4px;height:8px;overflow:hidden;margin-top:6px}
    .progress-fill{background:#f97316;height:100%;border-radius:4px}
    .footer{margin-top:28px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#bbb;text-align:center;line-height:1.7}
    .actions{text-align:center;margin-top:28px}
    .btn-p{background:#f97316;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;margin-right:8px}
    .btn-c{background:#efefef;color:#333;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer}
    table{width:100%;border-collapse:collapse}
    th{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#aaa;text-align:left;padding:5px 8px;border-bottom:2px solid #eee}
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
      <div class="rec-sub">Pago de Comisi&oacute;n</div>
      <div class="rec-num">N&deg; ${d.numero_recibo || "—"}</div>
      <div class="rec-date">Emisi&oacute;n: ${d.fecha_emision}</div>
    </div>
  </div>

  <div class="stamp-wrap"><div class="stamp">COMISI&Oacute;N</div></div>

  <div class="sec-title" style="margin-top:0">Comisionista</div>
  <div class="row"><span class="lbl">Nombre</span><span class="val">${d.comisionista}</span></div>

  <div class="sec-title">Venta relacionada</div>
  <div class="row"><span class="lbl">N&deg; Venta</span><span class="val">#${d.id_venta}</span></div>
  <div class="row"><span class="lbl">Proyecto</span><span class="val">${d.proyecto}</span></div>
  <div class="row"><span class="lbl">Lote</span><span class="val">${d.lote}</span></div>
  <div class="row"><span class="lbl">Comprador</span><span class="val">${d.comprador}</span></div>

  <div class="sec-title">Detalle del micropago</div>
  <div class="row"><span class="lbl">Fecha de pago</span><span class="val">${d.fecha_pago || "—"}</span></div>
  ${d.nota ? `<div class="row"><span class="lbl">Nota</span><span class="val">${d.nota}</span></div>` : ""}
  ${d.numero_pago ? `<div class="row"><span class="lbl">N&deg; Micropago</span><span class="val">${d.numero_pago}</span></div>` : ""}

  <div class="total-box">
    <span class="total-lbl">Valor pagado en este recibo</span>
    <span class="total-amt">${fmt(d.valor)}</span>
  </div>

  <div class="sec-title">Estado de la comisi&oacute;n</div>
  <div class="row"><span class="lbl">Valor total comisi&oacute;n</span><span class="val">${fmt(d.valor_comision)}</span></div>
  <div class="row"><span class="lbl">Total pagado en micropagos</span><span class="val">${fmt(totalPagado)}</span></div>
  <div class="row"><span class="lbl">Saldo pendiente</span><span class="val" style="color:${pendiente > 0 ? "#f97316" : "#16a34a"}">${fmt(pendiente)}</span></div>
  <div style="margin-top:6px">
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-bottom:3px">
      <span>Progreso del pago</span><span>${porcentaje}%</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, porcentaje)}%"></div></div>
  </div>

  ${rowsMicros ? `
  <div class="sec-title">Historial de micropagos</div>
  <table>
    <thead><tr><th>Fecha</th><th>Nota</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${rowsMicros}</tbody>
  </table>` : ""}

  <div class="footer">
    Emitido por SGI El C&oacute;ndor &bull;
    ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}<br>
    Este recibo es v&aacute;lido como comprobante de pago parcial de comisi&oacute;n.
  </div>
</div>

<div class="actions">
  <button class="btn-p" onclick="window.print()">Imprimir / Descargar PDF</button>
  <button class="btn-c" onclick="window.close()">Cerrar</button>
</div>
</body>
</html>`;
}

// ─── New comisionista form ────────────────────────────────────────────────────

window.comisionistaForm = function() {
  UI.openModal("Nuevo Comisionista", `
    <div class="form-grid">
      <div class="form-group"><label>Documento *</label><input id="f_doc" type="text"/></div>
      <div class="form-group"><label>Tel&eacute;fono *</label><input id="f_tel" type="tel"/></div>
      <div class="form-group"><label>Nombres *</label><input id="f_nom" type="text"/></div>
      <div class="form-group"><label>Apellidos</label><input id="f_ape" type="text"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Email</label><input id="f_mail" type="email" placeholder="correo@ejemplo.com"/></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarComisionista()">Guardar</button>
    </div>`);
};

window.guardarComisionista = async function() {
  const doc  = document.getElementById("f_doc").value.trim();
  const nom  = document.getElementById("f_nom").value.trim();
  const tel  = document.getElementById("f_tel").value.trim();
  const mail = document.getElementById("f_mail").value.trim();
  if (!doc || !nom) return UI.toast("Documento y nombres son obligatorios", "error");
  if (!tel)         return UI.toast("El teléfono es obligatorio", "error");
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return UI.toast("Ingrese un correo válido", "error");
  try {
    await API.post("/comisionistas", {
      documento: doc, nombres: nom,
      apellidos: document.getElementById("f_ape").value.trim(),
      telefono: tel, mail
    });
    UI.closeModal();
    UI.toast("Comisionista creado", "ok");
    comisionistasView();
  } catch(e) { UI.toast(e.message, "error"); }
};

window._toggleComisionCard  = _toggleComisionCard;
window._verReciboMicropago  = _verReciboMicropago;
window._fmtMoneyInput       = _fmtMoneyInput;

})();