window.ventasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const esAsesor = window.currentUser?.rol === "asesor_comercial";
  const botonNueva = esAsesor
    ? `<button class="btn btn-primary btn-sm" onclick="ventaFormSolicitud()">+ Solicitar Venta</button>`
    : `<button class="btn btn-primary btn-sm" onclick="ventaForm()">+ Nueva Venta</button>`;

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

    const rows = await API.get(`/ventas${qs ? "?" + qs : ""}`).catch(e => {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="color:var(--danger);padding:12px">${e.message}</td></tr>`;
      return null;
    });
    if (!rows) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:16px;color:var(--text-muted)">Sin resultados</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(v => {
      const compradores = (v.venta_comprador || [])
        .map(vc => `${vc.comprador?.nombres || ""} ${vc.comprador?.apellidos || ""}`.trim() + (vc.comprador?.documento ? ` (${vc.comprador.documento})` : ""))
        .join(", ") || "—";
      const vc0 = Array.isArray(v.venta_comisionista) ? v.venta_comisionista[0] : v.venta_comisionista;
      const comisionista = vc0
        ? `${vc0.comisionista?.nombres || ""} ${vc0.comisionista?.apellidos || ""}`.trim()
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

  const ESTADOS = ["activa","pre_mora","en_mora","cancelada","liquidada","pendiente_autorizacion"];

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <h3>Ventas</h3>
        ${botonNueva}
      </div>
      ${esAsesor ? `<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;">
        Como asesor comercial puedes crear solicitudes de venta. Quedan en estado <b>pendiente de autorización</b> hasta que gerencia o un administrador las apruebe.
      </p>` : ""}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:flex-end">
        <div class="form-group" style="margin:0;flex:1;min-width:130px">
          <label style="font-size:.78rem;margin-bottom:2px">Proyecto</label>
          <input id="fv_proyecto" type="text" placeholder="Filtrar por proyecto…" oninput="_cargarVentasFiltro()" style="padding:5px 8px;font-size:.83rem"/>
        </div>
        <div class="form-group" style="margin:0;flex:1;min-width:150px">
          <label style="font-size:.78rem;margin-bottom:2px">Cliente (cédula o nombre)</label>
          <input id="fv_cliente" type="text" placeholder="Buscar cliente…" oninput="_cargarVentasFiltro()" style="padding:5px 8px;font-size:.83rem"/>
        </div>
        <div class="form-group" style="margin:0;min-width:160px">
          <label style="font-size:.78rem;margin-bottom:2px">Estado</label>
          <select id="fv_estado" onchange="_cargarVentasFiltro()" style="padding:5px 8px;font-size:.83rem">
            <option value="">Todos los estados</option>
            ${ESTADOS.map(e => `<option value="${e}">${e.replace(/_/g," ")}</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="margin:0;min-width:140px">
          <label style="font-size:.78rem;margin-bottom:2px">Mes</label>
          <input id="fv_mes" type="month" onchange="_cargarVentasFiltro()" style="padding:5px 8px;font-size:.83rem"/>
        </div>
        <button class="btn btn-ghost btn-sm" style="align-self:flex-end;padding:5px 12px" onclick="_limpiarFiltrosVentas()">Limpiar</button>
      </div>
      <div style="overflow-x:auto">
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
  try { v = await API.get(`/ventas/${id}`); }
  catch(e) { UI.toast(e.message, "error"); return; }

  // ── helpers locales ──
  const S  = (t,c,ic="") => `<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden"><div style="padding:7px 14px;background:var(--surface-2,#f0f4f8);font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)">${ic}${t}</div><div style="padding:12px 14px">${c}</div></div>`;
  const R  = (l,v2) => `<div style="display:flex;gap:6px;margin-bottom:5px"><span style="min-width:140px;font-size:.79rem;color:var(--text-muted);flex-shrink:0">${l}</span><span style="font-size:.85rem">${v2}</span></div>`;
  const bar= (pct,col="var(--primary,#ff6a00)") => `<div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin:5px 0"><div style="height:100%;width:${Math.min(100,pct).toFixed(1)}%;background:${col};border-radius:4px"></div></div>`;

  // ── cuotas ──
  const cuotas   = (v.cuota || []).sort((a,b) => a.numero_cuota - b.numero_cuota);
  const cuotasIni= cuotas.filter(c => c.tipo === "inicial");
  const cuotasReg= cuotas.filter(c => c.tipo === "regular");
  const pagada   = c => c.pagado === true || c.fecha_pago != null || c.estado === "pagado" || c.estado === "pagada";
  const hoy      = new Date(); hoy.setHours(0,0,0,0);
  const vencida  = c => { const f = c.fecha_vencimiento ? new Date(c.fecha_vencimiento+"T12:00:00") : null; return f && f < hoy && !pagada(c); };

  const pagIni = cuotasIni.filter(pagada);
  const pagReg = cuotasReg.filter(pagada);
  const sumVal = arr => arr.reduce((s,c) => s + Number(c.valor_cuota||0), 0);
  const totalPagadoIni = sumVal(pagIni);
  const totalPagadoReg = sumVal(pagReg);
  const totalPagado    = totalPagadoIni + totalPagadoReg;

  // ── financiero ──
  const vt    = Number(v.valor_total)    || 0;
  const ci    = Number(v.cuota_inicial)  || 0;
  const tp    = Number(v.total_permutas) || 0;
  const saldo = Math.max(0, vt - ci - tp);
  const pct   = vt > 0 ? totalPagado / vt * 100 : 0;
  const cumple = pct >= 30;
  const escrit = v.escriturado === true || v.fecha_escritura != null;

  // ── comisionista ──
  const vc0 = Array.isArray(v.venta_comisionista) ? v.venta_comisionista[0] : v.venta_comisionista;

  // ── permutas detalle ──
  let permsDetalle = "";
  if (tp > 0 && v.detalle_permutas) {
    try {
      permsDetalle = " — " + JSON.parse(v.detalle_permutas).map(p=>`${p.descripcion} (${UI.fmt(p.valor)})`).join(", ");
    } catch {}
  }

  // ── fila de cuota ──
  const cuotaRow = c => {
    const ok  = pagada(c);
    const ven = vencida(c);
    const est = ok  ? `<span style="color:var(--success,#22c55e);font-size:.75rem;font-weight:600">✓ Pagada</span>`
              : ven ? `<span style="color:var(--danger,#ef4444);font-size:.75rem;font-weight:600">Vencida</span>`
              :       `<span style="color:var(--text-muted);font-size:.75rem">Pendiente</span>`;
    return `<tr style="border-bottom:1px solid var(--border)${ven?" background:rgba(239,68,68,.04)":""}">
      <td style="padding:5px 8px;color:var(--text-muted);font-size:.75rem">${c.numero_cuota}</td>
      <td style="padding:5px 8px;font-size:.82rem">${UI.date(c.fecha_vencimiento)}</td>
      <td style="padding:5px 8px;font-size:.82rem;text-align:right"><b>${UI.fmt(c.valor_cuota)}</b></td>
      <td style="padding:5px 8px;font-size:.75rem;color:var(--text-muted)">${c.fecha_pago ? UI.date(c.fecha_pago) : "—"}</td>
      <td style="padding:5px 8px">${est}</td>
    </tr>`;
  };
  const thead = `<thead><tr style="border-bottom:2px solid var(--border)">
    <th style="padding:4px 8px;text-align:left;font-size:.72rem;color:var(--text-muted)">#</th>
    <th style="padding:4px 8px;text-align:left;font-size:.72rem;color:var(--text-muted)">Vencimiento</th>
    <th style="padding:4px 8px;text-align:right;font-size:.72rem;color:var(--text-muted)">Valor</th>
    <th style="padding:4px 8px;text-align:left;font-size:.72rem;color:var(--text-muted)">Fecha pago</th>
    <th style="padding:4px 8px;text-align:left;font-size:.72rem;color:var(--text-muted)">Estado</th>
  </tr></thead>`;

  const lote = v.lote || {};

  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div><span style="font-size:.85rem;color:var(--text-muted)">Registrada el ${UI.date(v.fecha_venta)}</span></div>
      <div>${UI.badge(v.estado)}</div>
    </div>

    ${S("Lote / Proyecto", `
      ${R("Proyecto", `<b>${lote.proyecto?.nombre||"—"}</b>`)}
      ${R("Código", lote.codigo_lote||"—")}
      ${R("Ubicación", `Mz ${lote.manzana||"—"} · Lote ${lote.numero_lote||"—"}`)}
      ${lote.area_m2 ? R("Área",`${lote.area_m2} m²`) : ""}
      ${R("Precio lista", UI.fmt(lote.precio_lista))}
      ${lote.estado ? R("Estado del lote", UI.badge(lote.estado)) : ""}
    `)}

    ${S("Valores financieros", `
      ${R("Valor total",`<b style="font-size:.95rem">${UI.fmt(vt)}</b>`)}
      ${ci>0 ? R("Cuota inicial",UI.fmt(ci)) : ""}
      ${tp>0 ? R("Permutas",`${UI.fmt(tp)}${permsDetalle}`) : ""}
      ${R("Saldo financiado",`<b style="color:var(--primary,#ff6a00)">${UI.fmt(saldo)}</b>`)}
      ${v.observaciones ? R("Observaciones",`<em style="color:var(--text-muted)">${v.observaciones}</em>`) : ""}
    `)}
    ${(() => {
      const puedeEditar = window.currentUser?.rol === "auxiliar_contable";
      const vfBody = `
        ${R("Valor total",`<b style="font-size:.95rem">${UI.fmt(vt)}</b>`)}
        ${ci>0 ? R("Cuota inicial",UI.fmt(ci)) : ""}
        ${tp>0 ? R("Permutas",`${UI.fmt(tp)}${permsDetalle}`) : ""}
        ${R("Saldo financiado",`<b style="color:var(--primary,#ff6a00)">${UI.fmt(saldo)}</b>`)}
        ${v.observaciones ? R("Observaciones",`<em style="color:var(--text-muted)">${v.observaciones}</em>`) : ""}
      `;
      return `<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:7px 14px;background:var(--surface-2,#f0f4f8);display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)">Valores financieros</span>
          ${puedeEditar ? `<button type="button" class="btn btn-ghost btn-sm"
            style="font-size:.72rem;padding:2px 8px;text-transform:none;font-weight:600;letter-spacing:0"
            onclick="_editarFinanciero(${v.id_venta},${vt},${ci})">Editar valores</button>` : ""}
        </div>
        <div id="sgi_vf_body" style="padding:12px 14px">${vfBody}</div>
      </div>`;
    })()}

    ${S("Compradores", `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border)">
        ${["Nombre","Documento","Teléfono","Correo","%"].map(h=>`<th style="padding:4px 8px;text-align:left;font-size:.72rem;color:var(--text-muted)">${h}</th>`).join("")}
      </tr></thead>
      <tbody>${(v.venta_comprador||[]).map(vc=>`<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 8px;font-size:.85rem"><b>${vc.comprador?.nombres||""} ${vc.comprador?.apellidos||""}</b></td>
        <td style="padding:6px 8px;font-size:.82rem">${vc.comprador?.documento||"—"}</td>
        <td style="padding:6px 8px;font-size:.82rem">${vc.comprador?.telefono||"—"}</td>
        <td style="padding:6px 8px;font-size:.82rem">${vc.comprador?.mail||"—"}</td>
        <td style="padding:6px 8px;font-size:.82rem">${vc.porcentaje||100}%</td>
      </tr>`).join("") || `<tr><td colspan="5" style="padding:8px;color:var(--text-muted);font-size:.85rem">Sin compradores</td></tr>`}
      </tbody></table></div>`)}

    ${vc0 ? S("Comisionista", `
      ${R("Nombre",`<b>${vc0.comisionista?.nombres||""} ${vc0.comisionista?.apellidos||""}</b>`)}
      ${vc0.comisionista?.documento ? R("Documento", vc0.comisionista.documento) : ""}
      ${vc0.comisionista?.telefono  ? R("Teléfono",  vc0.comisionista.telefono)  : ""}
      ${vc0.comisionista?.mail      ? R("Correo",    vc0.comisionista.mail)       : ""}
      ${R("Valor comisión",`<b style="color:var(--primary,#ff6a00)">${UI.fmt(vc0.valor_comision)}</b>`)}
    `) : ""}

    ${cuotasIni.length ? S("Cuotas de cuota inicial", `
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.82rem;margin-bottom:6px">
        <span>Pagadas: <b>${pagIni.length}/${cuotasIni.length}</b></span>
        <span>Recaudado: <b style="color:var(--success,#22c55e)">${UI.fmt(totalPagadoIni)}</b></span>
        <span>Pendiente: <b style="color:var(--text-muted)">${UI.fmt(sumVal(cuotasIni)-totalPagadoIni)}</b></span>
      </div>
      ${bar(cuotasIni.length ? pagIni.length/cuotasIni.length*100 : 0, "var(--success,#22c55e)")}
      <div style="overflow-x:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse">${thead}<tbody>${cuotasIni.map(cuotaRow).join("")}</tbody></table></div>
    `) : ""}

    ${cuotasReg.length ? S("Cuotas regulares", `
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.82rem;margin-bottom:6px">
        <span>Pagadas: <b>${pagReg.length}/${cuotasReg.length}</b></span>
        <span>Recaudado: <b style="color:var(--success,#22c55e)">${UI.fmt(totalPagadoReg)}</b></span>
        <span>Pendiente: <b style="color:var(--danger,#ef4444)">${UI.fmt(sumVal(cuotasReg)-totalPagadoReg)}</b></span>
        <span style="color:var(--text-muted)">Cuota: ≈ ${UI.fmt(Math.round(sumVal(cuotasReg)/cuotasReg.length))}/mes</span>
      </div>
      ${bar(cuotasReg.length ? pagReg.length/cuotasReg.length*100 : 0)}
      <div style="overflow-x:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse">${thead}<tbody>${cuotasReg.map(cuotaRow).join("")}</tbody></table></div>
    `) : cuotas.length===0 ? `<div style="font-size:.82rem;color:var(--text-muted);padding:8px 0">Sin plan de pago registrado</div>` : ""}

    ${S("Estado global de pagos y escritura", `
      ${R("Total pagado", `<b>${UI.fmt(totalPagado)}</b> de ${UI.fmt(vt)}`)}
      ${R("Porcentaje pagado", `<b style="color:${pct>=30?"var(--success,#22c55e)":"var(--primary,#ff6a00)"}">${pct.toFixed(1)}%</b>`)}
      <div style="margin:4px 0 10px">${bar(pct, pct>=30?"var(--success,#22c55e)":"var(--primary,#ff6a00)")}</div>
      ${R("Por pagar", `<b style="color:var(--danger,#ef4444)">${UI.fmt(Math.max(0,vt-totalPagado))}</b>`)}
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0">
      ${R("Requisito escritura (30%)", cumple
        ? `<span style="color:var(--success,#22c55e);font-weight:600">✓ Cumple — ${pct.toFixed(1)}% pagado</span>`
        : `<span style="color:var(--text-muted)">No cumple — faltan ${(30-pct).toFixed(1)}% (${UI.fmt(Math.max(0,vt*0.3-totalPagado))})</span>`
      )}
      ${R("Escriturado", escrit
        ? `<span style="color:var(--success,#22c55e);font-weight:600">✓ Sí${v.fecha_escritura?" · "+UI.date(v.fecha_escritura):""}</span>`
        : cumple
          ? `<span style="color:var(--warning,#f59e0b);font-weight:600">Pendiente — cumple el requisito, en espera del auxiliar contable</span>`
          : `<span style="color:var(--text-muted)">No — aún no alcanza el 30%</span>`
      )}
    `)}`;

  UI.openModal(`Detalle · Venta #${v.id_venta}`, html);
};

window._editarFinanciero = function(id, vtActual, ciActual) {
  const body = document.getElementById("sgi_vf_body");
  if (!body) return;
  body.innerHTML = `
    <div class="form-grid" style="gap:10px">
      <div class="form-group">
        <label style="font-size:.8rem">Valor total *</label>
        <input id="ef_vt" type="text" inputmode="numeric" value="${_fmtMiles(vtActual)}"
               oninput="_onMoneyInput(this)" style="padding:5px 8px"/>
      </div>
      <div class="form-group">
        <label style="font-size:.8rem">Cuota inicial</label>
        <input id="ef_ci" type="text" inputmode="numeric" value="${_fmtMiles(ciActual)}"
               oninput="_onMoneyInput(this)" style="padding:5px 8px"/>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label style="font-size:.8rem">Motivo del cambio *
          <span style="color:var(--text-muted);font-weight:400">(se registra en auditoría)</span>
        </label>
        <textarea id="ef_obs" rows="2" style="font-size:.85rem"
                  placeholder="Ej: corrección de precio por addendum al contrato"></textarea>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn btn-primary btn-sm" onclick="_guardarFinanciero(${id})">Guardar</button>
      <button class="btn btn-ghost btn-sm"   onclick="verVenta(${id})">Cancelar</button>
    </div>`;
};

window._guardarFinanciero = async function(id) {
  const vt  = _parseMiles(document.getElementById("ef_vt")?.value  || "0");
  const ci  = _parseMiles(document.getElementById("ef_ci")?.value  || "0");
  const obs = (document.getElementById("ef_obs")?.value || "").trim();
  if (!vt || vt <= 0) return UI.toast("El valor total debe ser mayor a cero", "error");
  if (ci > vt)        return UI.toast("La cuota inicial no puede superar el valor total", "error");
  if (!obs)           return UI.toast("El motivo del cambio es requerido para la auditoría", "error");
  try {
    await API.patch(`/ventas/${id}/financiero`, { valor_total: vt, cuota_inicial: ci, observaciones: obs });
    UI.toast("Valores actualizados", "ok");
    verVenta(id);
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Formato de miles (separador punto) ───
function _fmtMiles(val) {
  const d = String(val).replace(/[^\d]/g, "");
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
}
function _parseMiles(str) {
  return Number(String(str).replace(/\./g, "")) || 0;
}
window._onMoneyInput = function(el) {
  el.value = _fmtMiles(el.value);
};
function _validarEmail(mail) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
}
function _normalizar(str) {
  return String(str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ─── Proyectos únicos desde lista de lotes ───
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

      <div class="form-group" style="grid-column:1/-1"><label>Lote disponible *</label>
        <input type="text" id="f_lote_buscar" placeholder="Buscar por código de lote…"
               oninput="_buscarLote(this.value)" autocomplete="off" style="margin-bottom:4px" disabled/>
        <select id="f_lote" onchange="_mostrarInfoLote()">
          <option value="">— Primero seleccione un proyecto —</option>
        </select>
      </div>
      <div id="f_lote_info" style="grid-column:1/-1"></div>

      <div class="form-group">
        <label>Valor Total *</label>
        <input id="f_vt" type="text" inputmode="numeric" placeholder="0"
               oninput="_onMoneyInput(this);_actualizarCalculos()"/>
      </div>
      <div class="form-group">
        <label>Cuota Inicial</label>
        <input id="f_ci" type="text" inputmode="numeric" placeholder="0" value="0"
               oninput="_onMoneyInput(this);_actualizarCalculos()"/>
      </div>

      <!-- Permutas -->
      <div class="form-group" style="grid-column:1/-1">
        <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span>Permutas / Abonos en especie</span>
          <button type="button" class="btn btn-ghost btn-sm" style="font-size:.78rem;padding:2px 8px"
                  onclick="_agregarPermuta()">+ Agregar permuta</button>
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
                  style="display:none;font-size:.78rem;padding:2px 8px" onclick="_editarComprador()">✎ Editar</button>
          <button type="button" class="btn btn-ghost btn-sm"
                  style="font-size:.78rem;padding:2px 8px" onclick="_toggleNuevoComprador()">+ Nuevo</button>
        </div>
      </label>
      <input type="hidden" id="f_comp"/>

      <div id="f_comp_card" style="display:none;background:var(--surface-2,#f0f4f8);border-radius:6px;padding:8px 12px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div id="f_comp_card_info" style="font-size:.85rem;line-height:1.6"></div>
          <button type="button" class="btn btn-ghost btn-sm"
                  style="padding:2px 8px;font-size:.78rem;flex-shrink:0;margin-left:8px" onclick="_limpiarComprador()">✕</button>
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
                  style="display:none;font-size:.78rem;padding:2px 8px" onclick="_editarComisionista()">✎ Editar</button>
          <button type="button" class="btn btn-ghost btn-sm"
                  style="font-size:.78rem;padding:2px 8px" onclick="_toggleNuevoComisionista()">+ Nuevo</button>
        </div>
      </label>
      <input type="hidden" id="f_comi"/>

      <div id="f_comi_card" style="display:none;background:var(--surface-2,#f0f4f8);border-radius:6px;padding:8px 12px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div id="f_comi_card_info" style="font-size:.85rem;line-height:1.6"></div>
          <button type="button" class="btn btn-ghost btn-sm"
                  style="padding:2px 8px;font-size:.78rem;flex-shrink:0;margin-left:8px" onclick="_limpiarComisionista()">✕</button>
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
      <input id="f_pcom" type="text" inputmode="numeric" placeholder="0" value="0" oninput="_onMoneyInput(this)"/>
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
    const maxDia = new Date(yr, mo, 0).getDate(); // último día del mes
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
  return {
    id_lote:                     +document.getElementById("f_lote").value,
    valor_total:                 _parseMiles(document.getElementById("f_vt").value),
    cuota_inicial:               _parseMiles(document.getElementById("f_ci").value),
    numero_cuotas_inicial:       n,
    fecha_primera_cuota_inicial: microcuotas[0]?.fecha || "",
    numero_cuotas:               +document.getElementById("f_nc")?.value || 0,
    fecha_primera_cuota:         fechaPrimeraCuota,
    observaciones:               document.getElementById("f_obs").value,
    compradores: [{ id_comprador: +document.getElementById("f_comp").value, porcentaje: 100 }],
    id_comisionista:             idComi ? +idComi : null,
    valor_comision:              _parseMiles(document.getElementById("f_pcom").value),
    permutas:                    window._ventaPermutas || [],
    microcuotas,
  };
}

// ─── Selección de lote ───
window._filtrarLotesPorProyecto = function() {
  const nombreProy = document.getElementById("f_proy").value;
  const lotes = window._ventaLotes || [];
  const filtrados = nombreProy ? lotes.filter(l => l.proyecto === nombreProy) : [];

  window._lotesProyecto = filtrados;

  const buscar = document.getElementById("f_lote_buscar");
  buscar.value = "";
  buscar.disabled = filtrados.length === 0;
  buscar.placeholder = filtrados.length
    ? "Buscar por código de lote…"
    : "— No hay lotes disponibles en este proyecto —";

  _poblarSelectLotes(filtrados);
  document.getElementById("f_lote_info").innerHTML = "";
};

function _poblarSelectLotes(lista) {
  const sel = document.getElementById("f_lote");
  sel.innerHTML = lista.length
    ? lista.map(l =>
        `<option value="${l.id_lote}" data-lote='${JSON.stringify(l).replace(/'/g, "&#39;")}'>` +
        `${l.codigo_lote || ("Mz" + l.manzana + " Lt" + l.numero_lote)} — ${UI.fmt(l.precio_lista)}` +
        `</option>`).join("")
    : `<option value="">— Sin resultados —</option>`;
  if (lista.length === 1) _mostrarInfoLote();
}

window._buscarLote = function(texto) {
  const lotes = window._lotesProyecto || [];
  const q = texto.toLowerCase().trim();
  const filtrados = q
    ? lotes.filter(l => (l.codigo_lote || `Mz${l.manzana}Lt${l.numero_lote}`).toLowerCase().includes(q))
    : lotes;
  _poblarSelectLotes(filtrados);
  document.getElementById("f_lote_info").innerHTML = "";
};

window._mostrarInfoLote = function() {
  const sel = document.getElementById("f_lote");
  const opt = sel.options[sel.selectedIndex];
  const info = document.getElementById("f_lote_info");
  if (!opt || !opt.dataset.lote) { info.innerHTML = ""; return; }
  const l = JSON.parse(opt.dataset.lote);
  info.innerHTML = `
    <div style="background:var(--surface-2,#f0f4f8);border-radius:6px;padding:8px 14px;font-size:.85rem;display:flex;gap:20px;flex-wrap:wrap;margin-bottom:4px">
      <span><b>Manzana:</b> ${l.manzana || "—"}</span>
      <span><b>N° Lote:</b> ${l.numero_lote || "—"}</span>
      <span><b>Área:</b> ${l.area_m2 ? l.area_m2 + " m²" : "—"}</span>
      <span><b>Precio lista:</b> ${UI.fmt(l.precio_lista)}</span>
    </div>`;
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
             oninput="_onMoneyInput(this);window._ventaPermutas[${i}].valor=_parseMiles(this.value);_actualizarCalculos()"
             style="flex:1;min-width:0"/>
      <button type="button" class="btn btn-ghost btn-sm" style="padding:2px 8px;flex-shrink:0"
              onclick="_eliminarPermuta(${i})">✕</button>
    </div>`).join("");
  _actualizarPermutasResumen();
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

// ─── Cálculo financiero reactivo ───
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
  if (isNaN(parsed) || parsed < 1) return; // campo vacío o en proceso de escritura
  const n = Math.min(24, parsed);
  const inp = document.getElementById("f_nci");
  if (inp && +inp.value !== n) inp.value = n; // solo corrige si excedió el máximo

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
             value="${prev[i]?.val || ""}" style="flex:1;min-width:110px"
             oninput="_onMoneyInput(this);_actualizarResumenInicial()"/>
      <input type="date" id="f_mc_fecha_${i}"
             value="${prev[i]?.fecha || ""}" style="flex:1;min-width:140px"/>
    </div>`).join("");

  _actualizarResumenInicial();
};

function _actualizarResumenInicial() {
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
  const color = diff === 0 ? "var(--success,#22c55e)" : diff > 0 ? "var(--warning,#f59e0b)" : "var(--danger,#ef4444)";
  const msg   = diff === 0 ? "✓ Cuadra perfectamente"
              : diff > 0   ? `Faltan ${UI.fmt(diff)}`
              :               `Excede en ${UI.fmt(-diff)}`;
  div.innerHTML = `
    <div style="font-size:.82rem;margin-top:4px;padding:6px 10px;background:var(--surface-2,#f0f4f8);border-radius:4px">
      Total asignado: <b>${UI.fmt(total)}</b> de <b>${UI.fmt(ci)}</b>
      — <span style="color:${color};font-weight:600">${msg}</span>
    </div>`;
}

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

// ─── Búsqueda y selección de comprador ───
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
             onclick="_seleccionarComprador(${c.id_comprador})">
          <div style="font-weight:600">${c.nombres} ${c.apellidos || ""}</div>
          <div style="color:var(--text-muted);font-size:.78rem">Cédula: ${c.documento}${c.telefono ? " · Tel: " + c.telefono : ""}${c.mail ? " · " + c.mail : ""}</div>
        </div>`).join("");
};

window._seleccionarComprador = function(id) {
  const c = (window._ventaCompradores || []).find(x => x.id_comprador === id);
  if (!c) return;
  window._compradorSeleccionado = c;
  document.getElementById("f_comp").value = id;

  const linea2 = ["Cédula: " + c.documento];
  if (c.telefono) linea2.push("Tel: " + c.telefono);
  if (c.mail) linea2.push(c.mail);
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
  document.getElementById("fe_comp_mail").value = c.mail || "";
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
    const upd = await API.put(`/compradores/${c.id_comprador}`, {
      documento:    doc, nombres: nom,
      apellidos:    document.getElementById("fe_comp_ape").value.trim(),
      telefono:     tel, mail,
      tipo_persona: document.getElementById("fe_comp_tipo").value,
    });
    window._compradorSeleccionado = upd;
    const idx = (window._ventaCompradores || []).findIndex(x => x.id_comprador === upd.id_comprador);
    if (idx >= 0) window._ventaCompradores[idx] = upd;
    document.getElementById("f_comp_edit").style.display = "none";
    _seleccionarComprador(upd.id_comprador);
    UI.toast("Comprador actualizado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Búsqueda y selección de comisionista ───
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
             onclick="_seleccionarComisionista(${c.id_comisionista})">
          <div style="font-weight:600">${c.nombres} ${c.apellidos || ""}</div>
          <div style="color:var(--text-muted);font-size:.78rem">Cédula: ${c.documento}${c.telefono ? " · Tel: " + c.telefono : ""}</div>
        </div>`).join("");
};

window._seleccionarComisionista = function(id) {
  const c = (window._ventaComisionistas || []).find(x => x.id_comisionista === id);
  if (!c) return;
  window._comisionistaSeleccionado = c;
  document.getElementById("f_comi").value = id;

  const linea2 = ["Cédula: " + c.documento];
  if (c.telefono) linea2.push("Tel: " + c.telefono);
  if (c.mail) linea2.push(c.mail);

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
  document.getElementById("fe_comi_mail").value = c.mail || "";
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
    const upd = await API.put(`/comisionistas/${c.id_comisionista}`, {
      documento: doc, nombres: nom,
      apellidos: document.getElementById("fe_comi_ape").value.trim(),
      telefono: tel, mail,
    });
    window._comisionistaSeleccionado = upd;
    const idx = (window._ventaComisionistas || []).findIndex(x => x.id_comisionista === upd.id_comisionista);
    if (idx >= 0) window._ventaComisionistas[idx] = upd;
    document.getElementById("f_comi_edit").style.display = "none";
    _seleccionarComisionista(upd.id_comisionista);
    UI.toast("Comisionista actualizado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Creación rápida ───
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
    _seleccionarComprador(nuevo.id_comprador);
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
    _seleccionarComisionista(nuevo.id_comisionista);
    UI.toast("Comisionista creado y seleccionado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Resumen previo a la confirmación ───
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

window._mostrarResumenVenta = function(fnConfirmar) {
  const body = _bodyVenta();
  const err  = _validarBodyVenta(body);
  if (err) return UI.toast(err, "error");

  const selLote = document.getElementById("f_lote");
  const loteInfo = (() => { try { return JSON.parse(selLote?.options[selLote.selectedIndex]?.dataset.lote || "null"); } catch { return null; } })();
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
    ${_seccionResumen("Valores", `Valor total: <b>${UI.fmt(body.valor_total)}</b> · Cuota inicial: <b>${UI.fmt(body.cuota_inicial)}</b>${tp>0?` · Permutas: <b>${UI.fmt(tp)}</b> (${perms.map(p=>p.descripcion||"bien").join(", ")})`:""}  · Saldo: <b style="color:var(--primary,#ff6a00)">${UI.fmt(saldo)}</b>`)}
    ${body.cuota_inicial>0 ? _seccionResumen("Cuota inicial",`${body.numero_cuotas_inicial} micro-cuota${body.numero_cuotas_inicial>1?"s":""}<table style="margin-top:4px;border-collapse:collapse;font-size:.82rem">${mcRows}</table>`) : ""}
    ${_seccionResumen("Cuotas regulares", cuotaLine)}
    ${_seccionResumen("Comprador", comp ? `<b>${comp.nombres} ${comp.apellidos||""}</b> · CC ${comp.documento}${comp.telefono?" · "+comp.telefono:""}${comp.mail?" · "+comp.mail:""}` : "—")}
    ${_seccionResumen("Comisionista", comi ? `<b>${comi.nombres} ${comi.apellidos||""}</b> · CC ${comi.documento} · Comisión: ${UI.fmt(body.valor_comision)}` : "Sin comisionista")}
    ${body.observaciones ? _seccionResumen("Observaciones", body.observaciones) : ""}
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="_ocultarResumenVenta()">← Editar</button>
      <button class="btn btn-primary" onclick="${fnConfirmar}">✓ Confirmar y crear</button>
    </div>`;

  document.getElementById("venta_form_wrap").style.display = "none";
  const wrap = document.getElementById("venta_resumen_wrap");
  wrap.innerHTML = html;
  wrap.style.display = "block";
};

// ─── Inicialización de la sección dinámica del formulario ───
function _iniciarFormularioDinamico() {
  window._ventaPermutas = [];
  _renderMicroCuotas(1);
  _actualizarCalculos();
}

// ─── Formulario estándar (admin / auxiliar_contable) ───
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
        <button class="btn btn-primary" onclick="_mostrarResumenVenta('guardarVenta()')">Revisar →</button>
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
  if (!body.compradores[0]?.id_comprador)
    return "Seleccione un comprador";
  if (!body.numero_cuotas)
    return "Ingrese el número de cuotas regulares";
  if (!body.fecha_primera_cuota)
    return "Ingrese el mes de inicio y día de pago de las cuotas regulares";
  if (body.cuota_inicial > 0 && !body.fecha_primera_cuota_inicial)
    return "Ingrese la fecha de al menos la primera micro-cuota inicial";
  // Micro-cuotas: si el usuario llenó valores, deben cuadrar con la cuota inicial
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
  if (err) return UI.toast(err, "error");
  try {
    await API.post("/ventas", body);
    UI.closeModal();
    UI.toast("Venta creada", "ok");
    ventasView();
  } catch(e) { UI.toast(e.message, "error"); }
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
        <button class="btn btn-primary" onclick="_mostrarResumenVenta('guardarSolicitudVenta()')">Revisar →</button>
      </div>
    </div>
    <div id="venta_resumen_wrap" style="display:none"></div>`);
  setTimeout(_iniciarFormularioDinamico, 0);
};

window.guardarSolicitudVenta = async function() {
  const body = _bodyVenta();
  const err  = _validarBodyVenta(body);
  if (err) return UI.toast(err, "error");
  try {
    await API.post("/ventas/solicitud", body);
    UI.closeModal();
    UI.toast("Solicitud enviada — pendiente de autorización", "ok");
    ventasView();
  } catch(e) { UI.toast(e.message, "error"); }
};
