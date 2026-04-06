window.proyectosView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/proyectos").catch(e => { vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <h3>Proyectos</h3>
        <button class="btn btn-primary btn-sm" onclick="proyectoForm()">+ Nuevo</button>
      </div>
      <table>
        <thead><tr><th>#</th><th>Nombre</th><th>Ubicación</th><th>Estado</th><th>Creado</th></tr></thead>
        <tbody>${data.map(p=>`<tr>
          <td>${p.id_proyecto}</td><td>${p.nombre}</td><td>${p.ubicacion||"—"}</td>
          <td>${UI.badge(p.estado)}</td><td>${UI.date(p.fecha_creacion)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
window.proyectoForm = function(p={}) {
  UI.openModal(p.id_proyecto?"Editar Proyecto":"Nuevo Proyecto",`
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1"><label>Nombre *</label><input id="f_nombre" value="${p.nombre||""}"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Ubicación</label><input id="f_ubi" value="${p.ubicacion||""}"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Descripción</label><textarea id="f_desc" rows="3">${p.descripcion||""}</textarea></div>
      ${p.id_proyecto?`<div class="form-group"><label>Estado</label><select id="f_est"><option value="activo" ${p.estado==="activo"?"selected":""}>Activo</option><option value="finalizado" ${p.estado==="finalizado"?"selected":""}>Finalizado</option></select></div>`:""}
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarProyecto(${p.id_proyecto||"null"})">Guardar</button>
    </div>`);
};
window.guardarProyecto = async function(id) {
  const body = { nombre: document.getElementById("f_nombre").value, ubicacion: document.getElementById("f_ubi").value, descripcion: document.getElementById("f_desc").value };
  if (id) body.estado = document.getElementById("f_est").value;
  try {
    id ? await API.put(`/proyectos/${id}`, body) : await API.post("/proyectos", body);
    UI.closeModal(); UI.toast("Proyecto guardado", "ok"); proyectosView();
  } catch(e) { UI.toast(e.message, "error"); }
};
