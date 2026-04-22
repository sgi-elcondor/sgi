window.proyectosView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/proyectos").catch(e => { vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;

  const esAsesor = window.currentUser?.rol === "asesor_comercial";

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.75rem;">
        <h3>Proyectos</h3>
        <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
          <input id="filtro-proyecto-nombre" type="text" placeholder="Buscar por nombre o ubicación…"
            style="padding:.4rem .8rem;border:1px solid var(--border);border-radius:8px;
                   font-size:.875rem;background:var(--surface);color:var(--text);width:220px;"
            oninput="filtrarProyectos()" />
          <select id="filtro-proyecto-estado" onchange="filtrarProyectos()"
            style="padding:.4rem .8rem;border:1px solid var(--border);border-radius:8px;
                   font-size:.875rem;background:var(--surface);color:var(--text);">
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="finalizado">Finalizado</option>
          </select>
          ${esAsesor ? "" : `<button class="btn btn-primary btn-sm" onclick="proyectoForm()">+ Nuevo</button>`}
        </div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Nombre</th><th>Ubicación</th><th>Estado</th><th>Creado</th></tr></thead>
        <tbody id="body-proyectos"></tbody>
      </table>
    </div>`;

  window._proyectosData = data;
  filtrarProyectos();
};

window.filtrarProyectos = function() {
  const texto  = document.getElementById("filtro-proyecto-nombre")?.value.toLowerCase() ?? "";
  const estado = document.getElementById("filtro-proyecto-estado")?.value ?? "";
  const tbody  = document.getElementById("body-proyectos");
  if (!tbody) return;

  const filtrados = (window._proyectosData || []).filter(p => {
    const coincideTexto  = !texto  || p.nombre?.toLowerCase().includes(texto) || p.ubicacion?.toLowerCase().includes(texto);
    const coincideEstado = !estado || p.estado === estado;
    return coincideTexto && coincideEstado;
  });

  tbody.innerHTML = filtrados.length
    ? filtrados.map(p => `<tr>
        <td>${p.id_proyecto}</td><td>${p.nombre}</td><td>${p.ubicacion||"—"}</td>
        <td>${UI.badge(p.estado)}</td><td>${UI.date(p.fecha_creacion)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem;">Sin resultados</td></tr>`;
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