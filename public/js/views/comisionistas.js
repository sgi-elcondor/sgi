window.comisionistasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const [lista, comisiones] = await Promise.all([API.get("/comisionistas"), API.get("/comisionistas/comisiones")]);
  vc.innerHTML = `
    <div class="table-wrap" style="margin-bottom:20px">
      <div class="table-header"><h3>Comisionistas</h3><button class="btn btn-primary btn-sm" onclick="comisionistaForm()">+ Nuevo</button></div>
      <table><thead><tr><th>Documento</th><th>Nombre</th><th>Teléfono</th></tr></thead>
        <tbody>${lista.map(c=>`<tr><td>${c.documento}</td><td>${c.nombres} ${c.apellidos||""}</td><td>${c.telefono||"—"}</td></tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="table-wrap">
      <div class="table-header"><h3>Comisiones</h3></div>
      <table><thead><tr><th>Venta</th><th>Comisionista</th><th>% Comisión</th><th>Total Pagado</th><th>% Pagado</th><th>Estado Calc.</th><th>Estado Reg.</th></tr></thead>
        <tbody>${comisiones.map(c=>`<tr>
          <td>#${c.id_venta}</td><td>${c.comisionista}</td><td>${c.porcentaje_comision}%</td>
          <td>${UI.fmt(c.total_pagado_venta)}</td><td>${c.porcentaje_pagado_venta}%</td>
          <td>${UI.badge(c.estado_comision_calculado)}</td><td>${UI.badge(c.estado_comision_registrado)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
window.comisionistaForm = function() {
  UI.openModal("Nuevo Comisionista",`
    <div class="form-grid">
      <div class="form-group"><label>Documento *</label><input id="f_doc" type="number"/></div>
      <div class="form-group"><label>Teléfono</label><input id="f_tel"/></div>
      <div class="form-group"><label>Nombres *</label><input id="f_nom"/></div>
      <div class="form-group"><label>Apellidos</label><input id="f_ape"/></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarComisionista()">Guardar</button>
    </div>`);
};
window.guardarComisionista = async function() {
  const body = { documento: +document.getElementById("f_doc").value, nombres: document.getElementById("f_nom").value,
    apellidos: document.getElementById("f_ape").value, telefono: document.getElementById("f_tel").value };
  try { await API.post("/comisionistas", body); UI.closeModal(); UI.toast("Comisionista creado","ok"); comisionistasView(); }
  catch(e) { UI.toast(e.message,"error"); }
};
