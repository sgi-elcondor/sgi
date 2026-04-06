window.compradoresView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/compradores").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header"><h3>Compradores</h3><button class="btn btn-primary btn-sm" onclick="compradorForm()">+ Nuevo</button></div>
      <table>
        <thead><tr><th>Documento</th><th>Tipo</th><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Estado</th></tr></thead>
        <tbody>${data.map(c=>`<tr>
          <td>${c.documento}</td><td>${c.tipo_persona}</td>
          <td>${c.nombres} ${c.apellidos||""}</td>
          <td>${c.telefono||"—"}</td><td>${c.mail||"—"}</td>
          <td>${UI.badge(c.estado)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
window.compradorForm = function() {
  UI.openModal("Nuevo Comprador",`
    <div class="form-grid">
      <div class="form-group"><label>Tipo Persona *</label><select id="f_tipo"><option value="natural">Natural</option><option value="juridica">Jurídica</option></select></div>
      <div class="form-group"><label>Documento *</label><input id="f_doc"/></div>
      <div class="form-group"><label>Nombres *</label><input id="f_nom"/></div>
      <div class="form-group"><label>Apellidos</label><input id="f_ape"/></div>
      <div class="form-group"><label>Teléfono</label><input id="f_tel"/></div>
      <div class="form-group"><label>Email</label><input id="f_mail" type="email"/></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarComprador()">Guardar</button>
    </div>`);
};
window.guardarComprador = async function() {
  const body = { tipo_persona: document.getElementById("f_tipo").value, documento: document.getElementById("f_doc").value,
    nombres: document.getElementById("f_nom").value, apellidos: document.getElementById("f_ape").value,
    telefono: document.getElementById("f_tel").value, mail: document.getElementById("f_mail").value };
  try { await API.post("/compradores", body); UI.closeModal(); UI.toast("Comprador creado","ok"); compradoresView(); }
  catch(e) { UI.toast(e.message,"error"); }
};
