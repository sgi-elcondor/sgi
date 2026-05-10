window.comisionistasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const [lista, comisiones] = await Promise.all([
    API.get("/comisionistas"),
    API.get("/comisionistas/comisiones").catch(() => [])
  ]);
  vc.innerHTML = `
    <div class="table-wrap" style="margin-bottom:20px">
      <div class="table-header">
        <h3>Comisionistas</h3>
        <button class="btn btn-primary btn-sm" onclick="comisionistaForm()">+ Nuevo</button>
      </div>
      <table>
        <thead><tr><th>Documento</th><th>Nombre</th><th>Teléfono</th><th>Correo</th></tr></thead>
        <tbody>${lista.map(c => `<tr>
          <td>${c.documento}</td>
          <td>${c.nombres} ${c.apellidos || ""}</td>
          <td>${c.telefono || "—"}</td>
          <td>${c.mail || "—"}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="table-wrap">
      <div class="table-header"><h3>Comisiones</h3></div>
      <table>
        <thead><tr><th>Venta</th><th>Comisionista</th><th>Comisión</th><th>Estado Reg.</th></tr></thead>
        <tbody>${(comisiones || []).map(c => `<tr>
          <td>#${c.id_venta}</td>
          <td>${c.comisionista || "—"}</td>
          <td>${UI.fmt(c.valor_comision ?? c.porcentaje_comision)}</td>
          <td>${UI.badge(c.estado_comision_registrado)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};

window.comisionistaForm = function() {
  UI.openModal("Nuevo Comisionista", `
    <div class="form-grid">
      <div class="form-group"><label>Documento *</label><input id="f_doc" type="text"/></div>
      <div class="form-group"><label>Teléfono *</label><input id="f_tel" type="tel"/></div>
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
  if (!doc || !nom)  return UI.toast("Documento y nombres son obligatorios", "error");
  if (!tel)          return UI.toast("El teléfono es obligatorio", "error");
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
