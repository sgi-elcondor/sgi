window.ventasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/ventas").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;

  const esAsesor = window.currentUser?.rol === "asesor_comercial";
  const botonNueva = esAsesor
    ? `<button class="btn btn-primary btn-sm" onclick="ventaFormSolicitud()">+ Solicitar Venta</button>`
    : `<button class="btn btn-primary btn-sm" onclick="ventaForm()">+ Nueva Venta</button>`;

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <h3>Ventas</h3>
        ${botonNueva}
      </div>
      ${esAsesor ? `<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;">
        ℹ️ Como asesor comercial puedes crear solicitudes de venta. Quedan en estado <b>pendiente de autorización</b> hasta que un operador o administrador las apruebe.
      </p>` : ""}
      <table>
        <thead><tr><th>#</th><th>Lote</th><th>Proyecto</th><th>Fecha</th><th>Valor Total</th><th>Cuota Inicial</th><th>Estado</th><th></th></tr></thead>
        <tbody>${data.map(v=>`<tr>
          <td>${v.id_venta}</td>
          <td>${v.lote?.codigo_lote||"—"}</td>
          <td>${v.lote?.proyecto?.nombre||"—"}</td>
          <td>${UI.date(v.fecha_venta)}</td>
          <td>${UI.fmt(v.valor_total)}</td>
          <td>${UI.fmt(v.cuota_inicial)}</td>
          <td>${UI.badge(v.estado)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="verVenta(${v.id_venta})">Ver</button></td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
window.verVenta = async function(id) {
  const v = await API.get(`/ventas/${id}`);
  UI.openModal(`Venta #${v.id_venta}`,`
    <p><b>Lote:</b> ${v.lote?.codigo_lote} — ${v.lote?.proyecto?.nombre}</p>
    <p><b>Estado:</b> ${UI.badge(v.estado)}</p>
    <p><b>Valor total:</b> ${UI.fmt(v.valor_total)}</p>
    <p><b>Cuota inicial:</b> ${UI.fmt(v.cuota_inicial)}</p>
    <p><b>Fecha:</b> ${UI.date(v.fecha_venta)}</p>
    <hr style="border-color:var(--border);margin:16px 0">
    <p><b>Compradores:</b></p>
    ${(v.venta_comprador||[]).map(c=>`<p style="padding-left:12px">· ${c.comprador?.nombres} ${c.comprador?.apellidos||""} — ${c.porcentaje}%</p>`).join("")||"<p style='color:var(--text-muted)'>Sin compradores</p>"}
    <p style="margin-top:12px"><b>Comisionista:</b> ${v.venta_comisionista?`${v.venta_comisionista.comisionista?.nombres} (${v.venta_comisionista.porcentaje_comision}%)`:"—"}</p>`);
};

// ─── Formulario estándar (admin / operador) ───
window.ventaForm = async function() {
  const [lotes, compradores, comisionistas] = await Promise.all([
    API.get("/lotes/disponibles"), API.get("/compradores"), API.get("/comisionistas")
  ]);
  UI.openModal("Nueva Venta",`
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1"><label>Lote disponible *</label>
        <select id="f_lote">${lotes.map(l=>`<option value="${l.id_lote}">${l.proyecto} · Mz${l.manzana} Lt${l.numero_lote} (${UI.fmt(l.precio_lista)})</option>`).join("")}</select>
      </div>
      <div class="form-group"><label>Valor Total *</label><input id="f_vt" type="number"/></div>
      <div class="form-group"><label>Cuota Inicial</label><input id="f_ci" type="number" value="0"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Comprador *</label>
        <select id="f_comp">${compradores.map(c=>`<option value="${c.id_comprador}">${c.nombres} ${c.apellidos||""} (${c.documento})</option>`).join("")}</select>
      </div>
      <div class="form-group"><label>Comisionista</label>
        <select id="f_comi"><option value="">— Ninguno —</option>${comisionistas.map(c=>`<option value="${c.id_comisionista}">${c.nombres}</option>`).join("")}</select>
      </div>
      <div class="form-group"><label>% Comisión</label><input id="f_pcom" type="number" value="5"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label><textarea id="f_obs" rows="2"></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarVenta()">Crear Venta</button>
    </div>`);
};
window.guardarVenta = async function() {
  const idComi = document.getElementById("f_comi").value;
  const body = {
    id_lote: +document.getElementById("f_lote").value,
    valor_total: +document.getElementById("f_vt").value,
    cuota_inicial: +document.getElementById("f_ci").value,
    observaciones: document.getElementById("f_obs").value,
    compradores: [{ id_comprador: +document.getElementById("f_comp").value, porcentaje: 100 }],
    id_comisionista: idComi ? +idComi : null,
    porcentaje_comision: +document.getElementById("f_pcom").value
  };
  try { await API.post("/ventas", body); UI.closeModal(); UI.toast("Venta creada","ok"); ventasView(); }
  catch(e) { UI.toast(e.message,"error"); }
};

// ─── Formulario de solicitud (asesor_comercial) ───
window.ventaFormSolicitud = async function() {
  const [lotes, compradores, comisionistas] = await Promise.all([
    API.get("/lotes/disponibles"), API.get("/compradores"), API.get("/comisionistas")
  ]);
  UI.openModal("Solicitar Venta (pendiente de autorización)",`
    <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem;">
      Esta solicitud quedará en estado <b>pendiente_autorizacion</b> y deberá ser aprobada por un administrador u operador antes de activarse.
    </p>
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1"><label>Lote disponible *</label>
        <select id="f_lote">${lotes.map(l=>`<option value="${l.id_lote}">${l.proyecto} · Mz${l.manzana} Lt${l.numero_lote} (${UI.fmt(l.precio_lista)})</option>`).join("")}</select>
      </div>
      <div class="form-group"><label>Valor Total *</label><input id="f_vt" type="number"/></div>
      <div class="form-group"><label>Cuota Inicial</label><input id="f_ci" type="number" value="0"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Comprador *</label>
        <select id="f_comp">${compradores.map(c=>`<option value="${c.id_comprador}">${c.nombres} ${c.apellidos||""} (${c.documento})</option>`).join("")}</select>
      </div>
      <div class="form-group"><label>Comisionista</label>
        <select id="f_comi"><option value="">— Ninguno —</option>${comisionistas.map(c=>`<option value="${c.id_comisionista}">${c.nombres}</option>`).join("")}</select>
      </div>
      <div class="form-group"><label>% Comisión</label><input id="f_pcom" type="number" value="5"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label><textarea id="f_obs" rows="2" placeholder="Agrega detalles relevantes para quien autorice..."></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarSolicitudVenta()">Enviar Solicitud</button>
    </div>`);
};
window.guardarSolicitudVenta = async function() {
  const idComi = document.getElementById("f_comi").value;
  const body = {
    id_lote: +document.getElementById("f_lote").value,
    valor_total: +document.getElementById("f_vt").value,
    cuota_inicial: +document.getElementById("f_ci").value,
    observaciones: document.getElementById("f_obs").value,
    compradores: [{ id_comprador: +document.getElementById("f_comp").value, porcentaje: 100 }],
    id_comisionista: idComi ? +idComi : null,
    porcentaje_comision: +document.getElementById("f_pcom").value
  };
  try {
    await API.post("/ventas/solicitud", body);
    UI.closeModal();
    UI.toast("Solicitud enviada — pendiente de autorización","ok");
    ventasView();
  } catch(e) { UI.toast(e.message,"error"); }
};