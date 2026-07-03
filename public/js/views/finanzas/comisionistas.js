(function () {

let _currentComisiones = [];

const EXPORT_ROLES = ["admin", "gerencia", "auxiliar_contable"];

function _parseMoney(value) {
  return MoneyInput.parse(value);
}

// ─── Main view ────────────────────────────────────────────────────────────────

window.comisionistasView = async function() {
  const vc       = document.getElementById("viewContainer");
  const canCreate = AppState.can("comisionistas", "crear");
  vc.innerHTML   = UI.loader();

  const [lista, causadas] = await Promise.all([
    API.get("/comisionistas").catch(() => []),
    API.get("/comisionistas/comisiones").catch(() => []),
  ]);
  const activos     = (lista || []).filter(c => c.activo).length;
  const numCausadas = Array.isArray(causadas) ? causadas.length : 0;

  vc.innerHTML = `
    ${SGIUI.pageHeader({
      kicker:  "Finanzas",
      title:   "Comisionistas",
      actions: canCreate ? `<button class="btn btn-primary btn-sm" onclick="comisionistaForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>` : "",
    })}

    ${window.SGIUI.statCards([
      { label: "Comisionistas",       value: (lista || []).length, sub: "Registrados" },
      { label: "Activos",             value: activos,              sub: "Habilitados" },
      { label: "Comisiones causadas", value: numCausadas,          sub: "Al 30% del valor de venta" },
    ])}

    <div class="table-wrap" style="margin-bottom:1.25rem">
      <div class="form-group" style="max-width:26rem;margin:0">
        <label>Seleccionar comisionista</label>
        <select id="sel_comisionista" onchange="cargarComisionesDetalle()">
          <option value="">— Seleccione un comisionista —</option>
          ${lista.map(c => `
            <option value="${c.id_usuario}">
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

  const canExport = EXPORT_ROLES.includes(window.currentUser?.rol);
  const nombre    = sel?.selectedOptions?.[0]?.textContent?.replace(/\s+/g, " ").trim() || "Comisionista";

  const totalValor   = comisiones.reduce((s, c) => s + Number(c.valor_comision), 0);
  const totalMicros  = comisiones.reduce((s, c) =>
    s + (c.micropagos || []).reduce((ms, m) => ms + Number(m.valor), 0), 0);
  const countGanadas = comisiones.filter(c => c.ganada).length;
  const countPagadas = comisiones.filter(c => c.pagada).length;

  container.innerHTML = `
    ${canExport ? `<div style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">
      <button class="btn btn-ghost btn-sm" id="comis-export-excel">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        Exportar Excel
      </button>
      <button class="btn btn-ghost btn-sm" id="comis-export-pdf">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9" x2="10" y2="9"/></svg>
        Exportar PDF
      </button>
    </div>` : ""}
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

  if (canExport) {
    document.getElementById("comis-export-excel")?.addEventListener("click", () => exportComisionesExcel(nombre, _currentComisiones));
    document.getElementById("comis-export-pdf")?.addEventListener("click", () => exportComisionesPDF(nombre, _currentComisiones));
  }
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
            Venta ${SGIUI.ventaCode(v)} &middot; ${UI.date(v.fecha_venta)}
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
            (${Math.min(100, vc.porcentaje_pagado||0).toFixed(1)}% de ${UI.fmt(v.valor_total)}).
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
            <span>${Math.min(100, vc.porcentaje_pagado||0).toFixed(1)}% pagado</span>
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
                  placeholder="0" style="font-size:.85rem"/>
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
  const inp = document.getElementById(`mp_valor_${ventaId}`);
  if (inp) {
    const vc = _currentComisiones.find(c => c.id_venta === ventaId);
    MoneyInput.init(inp, {
      dependsOn: vc ? () => Number(vc.valor_comision) : null,
    });
  }
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
    codigo_venta:   v.codigo_venta,
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

  const valor       = Number(d.valor || 0);
  const valorTxt    = fmt(valor);
  const valorWords  = (window.SGIExport && window.SGIExport.numToWordsES)
    ? window.SGIExport.numToWordsES(valor)
    : "";

  const totalPagado = (d.micropagos || []).reduce((s, m) => s + Number(m.valor), 0);
  const pendiente   = Math.max(0, Number(d.valor_comision) - totalPagado);
  const porcentaje  = d.valor_comision > 0
    ? Math.round((totalPagado / d.valor_comision) * 100)
    : 0;

  const fmtD = (window.SGIExport && window.SGIExport.fmtDate) ? window.SGIExport.fmtDate : (x => x || "");
  const fechaPago = fmtD(d.fecha_pago);

  const waNumber = (window.SGIExport && window.SGIExport.CONTACT && window.SGIExport.CONTACT.whatsapp) || "573001234567";
  const waMsg    = `Hola, quiero obtener mas informacion acerca de la comision ${d.numero_recibo || ""} por un valor ${fmt(valor)} en la fecha ${fechaPago} a nombre de ${d.comisionista || ""}.`.trim();
  const waUrl    = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
  const qrUrl    = (window.SGIExport && window.SGIExport.qrDataUri) ? window.SGIExport.qrDataUri(waUrl) : `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(waUrl)}`;

  const rowsMicros = (d.micropagos || []).map(m => {
    const isCurrent = m.id_pago_comision === d.currentPago?.id_pago_comision;
    return `
      <tr class="${isCurrent ? "cur" : ""}">
        <td>${fmtD(m.fecha)}</td>
        <td>${m.nota || "—"}</td>
        <td class="r">${fmt(m.valor)}</td>
      </tr>`;
  }).join("");

  if (window.SGIExport && window.SGIExport.comprobanteHTML) {
    const afterTotalHTML = `
      <div class="cmp-extra">
        <div class="cmp-extra-title">Estado de la comisión</div>
        <div class="cmp-stat-row"><span>Valor total de la comisión</span><strong>${fmt(d.valor_comision)}</strong></div>
        <div class="cmp-stat-row"><span>Pagado en micropagos</span><strong>${fmt(totalPagado)}</strong></div>
        <div class="cmp-stat-row"><span>Saldo pendiente</span><strong>${fmt(pendiente)}</strong></div>
        <div class="cmp-stat-row"><span>Progreso del pago</span><strong>${porcentaje}%</strong></div>
        <div class="cmp-prog"><div class="cmp-prog-fill" style="width:${Math.min(100, porcentaje)}%"></div></div>
      </div>
      ${rowsMicros ? `
      <div class="cmp-extra">
        <div class="cmp-extra-title">Historial de micropagos</div>
        <table class="cmp-mini">
          <thead><tr><th>Fecha</th><th>Nota</th><th class="r">Valor</th></tr></thead>
          <tbody>${rowsMicros}</tbody>
        </table>
      </div>` : ""}`;

    return window.SGIExport.comprobanteHTML({
      docTitle: `Recibo Comisión ${d.numero_recibo || ""} — El Cóndor S.A.S.`,
      badge:    "Pago de Comisión",
      fields: [
        { icon: "receipt",  label: "N° de recibo",  value: d.numero_recibo },
        { icon: "user",     label: "Comisionista",  value: d.comisionista },
        { icon: "briefcase",label: "N° de venta",   value: d.id_venta != null ? SGIUI.ventaCode(d) : "" },
        { icon: "pin",      label: "Proyecto",      value: d.proyecto },
        { icon: "map",      label: "Lote",          value: d.lote },
        { icon: "user",     label: "Comprador",     value: d.comprador },
        { icon: "calendar", label: "Fecha de pago", value: fechaPago },
        { icon: "note",     label: "Nota",          value: d.nota },
        { icon: "hash",     label: "N° de micropago", value: d.numero_pago },
      ],
      totalLabel: "Valor pagado en este recibo",
      totalValue: valorTxt,
      totalWords: valorWords,
      afterTotalHTML,
      qrUrl,
      qrCaption: "<strong>¿Dudas con este pago?</strong><br>Escanea el código QR para escribirnos por WhatsApp.",
    });
  }

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

// ─── Exportación ────────────────────────────────────────────────────────────────

function _comisionRow(c) {
  const v           = c.venta || {};
  const proyecto    = v.lote?.proyecto?.nombre || "—";
  const lote        = v.lote ? `${v.lote.codigo_lote} M${v.lote.manzana}-${v.lote.numero_lote}` : "—";
  const compradores = (v.compradores || [])
    .map(x => `${x.nombres} ${x.apellidos || ""}`.trim()).join(", ") || "—";
  const micros      = (c.micropagos || []).reduce((s, m) => s + Number(m.valor || 0), 0);
  const pendiente   = Math.max(0, Number(c.valor_comision || 0) - micros);
  return { v, proyecto, lote, compradores, micros, pendiente };
}

async function exportComisionesExcel(nombre, rows) {
  if (window.SGILibs) await window.SGILibs.ensureExport();
  const SX = window.SGIExport.xlsx;
  const wb = SX.setup();

  const ganadas        = rows.filter(c => c.ganada).length;
  const pagadas        = rows.filter(c => c.pagada).length;
  const totalValor     = rows.reduce((s, c) => s + Number(c.valor_comision || 0), 0);
  const totalMicros    = rows.reduce((s, c) => s + (c.micropagos || []).reduce((m, x) => m + Number(x.valor || 0), 0), 0);
  const pendienteTotal = Math.max(0, totalValor - totalMicros);

  const ws = wb.addWorksheet("Comisiones", { tabColor: { argb: SX.C.primary } });
  ws.columns = [
    { width: 16 }, { width: 14 }, { width: 24 }, { width: 18 }, { width: 30 }, { width: 18 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 18 },
  ];

  SX.masthead(ws, { title: "Comisiones del Comisionista", subtitle: nombre, mergeCols: 11 });

  SX.kpiRow(ws, [
    { label: "Comisiones",  value: rows.length },
    { label: "Ganadas",     value: ganadas },
    { label: "Pagadas",     value: pagadas },
    { label: "Valor total", value: totalValor,     money: true },
    { label: "Pendiente",   value: pendienteTotal, money: true },
  ]);

  ws.addRow([]).height = 4;
  const hRow = ws.addRow([
    "Venta", "Fecha venta", "Proyecto", "Lote", "Comprador(es)",
    "Valor comisión", "% pagado", "Ganada", "Pagada", "Micropagos", "Pendiente",
  ]);
  SX.styleHeader(hRow);
  const headerRowNum = hRow.number;

  rows.forEach((c, i) => {
    const x = _comisionRow(c);
    const r = ws.addRow([
      SGIUI.ventaCode(x.v),
      x.v.fecha_venta ? UI.date(x.v.fecha_venta) : "—",
      x.proyecto,
      x.lote,
      x.compradores,
      Number(c.valor_comision || 0),
      Math.min(100, Number(c.porcentaje_pagado || 0)) / 100,
      c.ganada ? "Sí" : "No",
      c.pagada ? "Sí" : "No",
      x.micros,
      x.pendiente,
    ]);
    SX.styleBody(r, i % 2 !== 0);
    r.getCell(6).numFmt  = SX.NF.money;
    r.getCell(7).numFmt  = SX.NF.percent;
    r.getCell(10).numFmt = SX.NF.money;
    r.getCell(11).numFmt = SX.NF.money;
    [6, 10, 11].forEach(col => { r.getCell(col).alignment = { vertical: "middle", horizontal: "right", indent: 1 }; });
    r.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
  });

  ws.views = [{ state: "frozen", ySplit: headerRowNum }];
  ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: 11 } };

  await SX.download(wb, `comisiones_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function exportComisionesPDF(nombre, rows) {
  if (window.SGILibs) await window.SGILibs.ensureExport();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const SX  = window.SGIExport.pdf;

  const ganadas        = rows.filter(c => c.ganada).length;
  const pagadas        = rows.filter(c => c.pagada).length;
  const totalValor     = rows.reduce((s, c) => s + Number(c.valor_comision || 0), 0);
  const totalMicros    = rows.reduce((s, c) => s + (c.micropagos || []).reduce((m, x) => m + Number(x.valor || 0), 0), 0);
  const pendienteTotal = Math.max(0, totalValor - totalMicros);

  let y = SX.brand(doc);
  y = SX.title(doc, y + 2, { title: "Comisiones del Comisionista", subtitle: nombre });
  y = SX.kpiCards(doc, y + 2, [
    { label: "Comisiones",  value: String(rows.length),  desc: "En la vista" },
    { label: "Ganadas",     value: String(ganadas),      desc: "Al 30% del valor" },
    { label: "Pagadas",     value: String(pagadas),      desc: "Liquidadas" },
    { label: "Valor total", value: UI.fmt(totalValor),   desc: "Suma de comisiones" },
    { label: "Pendiente",   value: UI.fmt(pendienteTotal), desc: "Por pagar" },
  ], { perRow: 5 });
  y = SX.section(doc, y + 6, { kicker: "Detalle", title: "Comisiones por venta" });

  doc.autoTable({
    startY: y,
    head: [["Venta", "Fecha", "Proyecto / Lote", "Comprador(es)", "Valor", "% pag.", "Estado", "Pagada", "Pendiente"]],
    body: rows.map(c => {
      const x = _comisionRow(c);
      return [
        SGIUI.ventaCode(x.v),
        x.v.fecha_venta ? UI.date(x.v.fecha_venta) : "—",
        `${x.proyecto}${x.lote !== "—" ? " · " + x.lote : ""}`,
        x.compradores,
        UI.fmt(c.valor_comision),
        `${Math.min(100, Number(c.porcentaje_pagado || 0)).toFixed(0)}%`,
        c.ganada ? "Ganada" : "No ganada",
        c.pagada ? "Sí" : "No",
        UI.fmt(x.pendiente),
      ];
    }),
    foot: [[
      `Total · ${rows.length} comisión${rows.length === 1 ? "" : "es"}`,
      "", "", "",
      UI.fmt(totalValor),
      "", "", "",
      UI.fmt(pendienteTotal),
    ]],
    showFoot: "lastPage",
    ...SX.tableTheme(),
    footStyles: SX.footStyles(),
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 50 },
      3: { cellWidth: 50 },
      4: { cellWidth: 28, halign: "right"  },
      5: { cellWidth: 18, halign: "center" },
      6: { cellWidth: 24, halign: "center" },
      7: { cellWidth: 18, halign: "center" },
      8: { cellWidth: 28, halign: "right"  },
    },
    ...SX.statusColumn(6, e => String(e).toLowerCase().includes("no") ? "muted" : "success"),
  });

  SX.footer(doc);
  doc.save(`comisiones_sgi_${new Date().toISOString().slice(0, 10)}.pdf`);
}

})();