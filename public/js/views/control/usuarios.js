(function () {

window.usuariosView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  await Promise.all([cargarRolesCache(), cargarUsuariosTabla()]);
};

let _rolesCache    = [];
let _todosUsuarios = [];

async function cargarRolesCache() {
  try {
    _rolesCache = await API.get('/usuarios/roles');
    const sel = document.getElementById('filtro-rol');
    if (sel) {
      sel.innerHTML = '<option value="">Todos los roles</option>' +
        _rolesCache.map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('');
    }
  } catch (e) {
    console.error('No se pudieron cargar roles:', e.message);
  }
}

async function cargarUsuariosTabla() {
  const vc        = document.getElementById("viewContainer");
  const canCreate = AppState.can("usuarios", "crear");
  try {
    _todosUsuarios = await API.get('/usuarios');

    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.75rem;">
          <div style="display:flex; gap:.75rem; align-items:center; flex-wrap:wrap;">
            <input id="filtro-email" type="text" placeholder="Buscar por nombre, documento o email..."
              style="padding:.4rem .8rem; border:1px solid var(--border); border-radius:8px;
                     font-size:.875rem; background:var(--surface); color:var(--text); width:200px;"
              oninput="filtrarUsuarios()" />
            <select id="filtro-rol" onchange="filtrarUsuarios()" class="select-sm" style="width:auto;">
              <option value="">Todos los roles</option>
              ${_rolesCache.map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('')}
            </select>
            <select id="filtro-estado" onchange="filtrarUsuarios()" class="select-sm" style="width:auto;">
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
          ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="abrirModalNuevoUsuario()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo usuario</button>` : ""}
        </div>

        <div id="alerta-pendientes" style="display:none;
          background:#fff8e1; border:1px solid #ffe082; border-radius:8px;
          padding:.65rem 1rem; margin:.75rem 0; font-size:.875rem; color:#7a5c00;">
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:2.5rem"></th>
              <th>Email</th>
              <th>Rol</th>
              <th>Vinculado a</th>
              <th>Estado</th>
              <th style="width:160px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="body-usuarios"></tbody>
        </table>
      </div>
    `;

    await cargarRolesCache();
    renderTablaUsuarios(_todosUsuarios);
    mostrarAlertaPendientes(_todosUsuarios);

  } catch (err) {
    vc.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function mostrarAlertaPendientes(usuarios) {
  const pendientes = usuarios.filter(u => u.roles?.nombre === 'comprador' && u.activo && !u.nombres);
  const alerta = document.getElementById('alerta-pendientes');
  if (!alerta) return;
  if (pendientes.length === 0) { alerta.style.display = 'none'; return; }
  alerta.style.display = 'block';
  alerta.innerHTML = `<strong>${pendientes.length} usuario${pendientes.length > 1 ? 's' : ''}</strong>
    con rol comprador sin perfil completo.
    <a href="#" style="color:#b8860b; font-weight:600; margin-left:.5rem;"
      onclick="document.getElementById('filtro-rol').value='comprador'; filtrarUsuarios(); return false;">
      Ver <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </a>`;
}

function renderTablaUsuarios(usuarios) {
  const tbody = document.getElementById('body-usuarios');
  if (!tbody) return;

  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Sin resultados</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map(u => {
    const vinculo = (u.nombres || u.apellidos)
      ? `${u.nombres || ""} ${u.apellidos || ""}`.trim()
      : '<span style="color:var(--text-muted)">-</span>';

    const initial = (u.email || "?")[0].toUpperCase();
    const avatarCell = u.photo_url
      ? `<img src="${u.photo_url}" class="user-avatar-sm" alt="foto" />`
      : `<div class="user-avatar-icon">${initial}</div>`;

    const opcionesRol = _rolesCache.map(r =>
      `<option value="${r.id_rol}" ${u.roles?.id_rol === r.id_rol ? 'selected' : ''}>${r.nombre}</option>`
    ).join('');

    return `<tr>
      <td>${avatarCell}</td>
      <td>${u.email}</td>
      <td>
        <select data-id="${u.id_usuario}" onchange="cambiarRolInline(this)" class="select-sm" style="width:auto;">
          ${opcionesRol}
        </select>
      </td>
      <td>${vinculo}</td>
      <td>${UI.badge(u.activo ? 'activo' : 'inactivo')}</td>
      <td style="display:flex; gap:.4rem;">
        <button class="btn btn-sm btn-secondary"
          onclick="abrirModalEditarUsuario(${u.id_usuario})">Editar</button>
        ${u.activo
          ? `<button class="btn btn-sm btn-danger"
               onclick="confirmarDesactivar(${u.id_usuario}, '${u.email}')">Desactivar</button>`
          : `<button class="btn btn-sm btn-secondary"
               onclick="reactivarUsuario(${u.id_usuario})">Reactivar</button>`
        }
      </td>
    </tr>`;
  }).join('');
}

async function cambiarRolInline(sel) {
  const idUsuario  = sel.dataset.id;
  const nuevoIdRol = parseInt(sel.value);
  const rolNombre  = sel.options[sel.selectedIndex].text;
  const u = _todosUsuarios.find(x => x.id_usuario == idUsuario);
  const yaVinculado = !!(u?.nombres && u?.apellidos && u?.documento);

  if (rolRequiereIdentidad(nuevoIdRol) && !yaVinculado) {
    // Revert dropdown visually and open full edit modal instead
    const rolActual = _rolesCache.find(r => r.nombre === u?.roles?.nombre);
    if (rolActual) sel.value = rolActual.id_rol;
    await abrirModalEditarUsuario(parseInt(idUsuario));
    return;
  }

  sel.disabled = true;
  try {
    await API.put(`/usuarios/${idUsuario}`, { id_rol: nuevoIdRol });
    UI.toast(`Rol cambiado a "${rolNombre}"`, 'ok');
    if (u) u.roles = { id_rol: nuevoIdRol, nombre: rolNombre };
    mostrarAlertaPendientes(_todosUsuarios);
  } catch (err) {
    UI.toast('No se pudo cambiar el rol: ' + err.message, 'error');
    await cargarUsuariosTabla();
  } finally {
    sel.disabled = false;
  }
}

function filtrarUsuarios() {
  const email  = (document.getElementById('filtro-email')?.value  ?? '').toLowerCase();
  const rol    = document.getElementById('filtro-rol')?.value    ?? '';
  const estado = document.getElementById('filtro-estado')?.value ?? '';

  const filtrados = _todosUsuarios.filter(u => {
    const okEmail  = SGISearch.matches(email, u.email, u.nombres, u.apellidos, u.documento);
    const okRol    = !rol    || u.roles?.nombre === rol;
    const okEstado = !estado
      || (estado === 'activo'   &&  u.activo)
      || (estado === 'inactivo' && !u.activo);
    return okEmail && okRol && okEstado;
  });
  renderTablaUsuarios(filtrados);
}

// --- New user modal ---

let _usuarioEditandoId = null;

const ROLES_CON_IDENTIDAD = ['comprador', 'comisionista'];

function rolRequiereIdentidad(idRol) {
  const rol = _rolesCache.find(r => r.id_rol == idRol);
  return rol ? ROLES_CON_IDENTIDAD.includes(rol.nombre) : false;
}

function renderCamposIdentidad(visible) {
  const bloque = document.getElementById('campos-identidad');
  if (!bloque) return;
  bloque.style.display = visible ? '' : 'none';
  bloque.querySelectorAll('input').forEach(inp => {
    if (inp.dataset.opcional) return;
    inp.required = visible;
  });
}

async function abrirModalNuevoUsuario() {
  _usuarioEditandoId = null;

  UI.openModal('Nuevo Usuario', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1">
        <label>Rol *</label>
        <select id="u-rol" onchange="onRolChange(this)">
          ${_rolesCache.map(r =>
            `<option value="${r.id_rol}">${r.nombre}${r.descripcion ? ' - ' + r.descripcion : ''}</option>`
          ).join('')}
        </select>
      </div>

      <div id="campos-identidad" style="display:none; grid-column:1/-1;">
        <div class="form-grid" style="margin-top:.5rem;">
          <div class="form-group">
            <label>Nombres *</label>
            <input id="u-nombres" type="text" placeholder="Nombres completos" />
          </div>
          <div class="form-group">
            <label>Apellidos *</label>
            <input id="u-apellidos" type="text" placeholder="Apellidos completos" />
          </div>
          <div class="form-group">
            <label>Documento de identidad *</label>
            <input id="u-documento" type="text" placeholder="Cedula de ciudadania" />
          </div>
          <div class="form-group">
            <label>Telefono <span style="color:var(--text-muted); font-weight:400;">(opcional)</span></label>
            <input id="u-telefono" type="tel" placeholder="Ej: 3001234567" data-opcional="1" />
          </div>
        </div>
      </div>

      <div class="form-group" style="grid-column:1/-1">
        <label>Correo electronico *</label>
        <input id="u-email" type="email" placeholder="usuario@ejemplo.com" />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarNuevoUsuario()">Guardar</button>
    </div>
  `);

  // Trigger initial state
  const rolSel = document.getElementById('u-rol');
  if (rolSel) renderCamposIdentidad(rolRequiereIdentidad(rolSel.value));
}

window.onRolChange = function(sel) {
  renderCamposIdentidad(rolRequiereIdentidad(sel.value));
};

async function abrirModalEditarUsuario(idUsuario) {
  _usuarioEditandoId = idUsuario;
  const u = _todosUsuarios.find(x => x.id_usuario === idUsuario);
  if (!u) return;

  const yaVinculado = !!(u.nombres && u.apellidos && u.documento);

  UI.openModal('Editar Usuario', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1">
        <label>Email</label>
        <input type="text" value="${u.email}" disabled
          style="background:var(--surface2); color:var(--text-muted);" />
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Rol *</label>
        <select id="u-rol" onchange="onRolChange(this)">
          ${_rolesCache.map(r =>
            `<option value="${r.id_rol}" ${u.roles?.id_rol === r.id_rol ? 'selected' : ''}>
              ${r.nombre}${r.descripcion ? ' - ' + r.descripcion : ''}
            </option>`
          ).join('')}
        </select>
      </div>

      <div id="campos-identidad" style="display:none; grid-column:1/-1;">
        <div class="form-grid" style="margin-top:.5rem;">
          <div class="form-group">
            <label>Nombres *</label>
            <input id="u-nombres" type="text" placeholder="Nombres completos" value="${u.nombres || ""}" />
          </div>
          <div class="form-group">
            <label>Apellidos *</label>
            <input id="u-apellidos" type="text" placeholder="Apellidos completos" value="${u.apellidos || ""}" />
          </div>
          <div class="form-group">
            <label>Documento de identidad *</label>
            <input id="u-documento" type="text" placeholder="Cedula de ciudadania" value="${u.documento || ""}" />
          </div>
          <div class="form-group">
            <label>Telefono <span style="color:var(--text-muted); font-weight:400;">(opcional)</span></label>
            <input id="u-telefono" type="tel" placeholder="Ej: 3001234567" data-opcional="1" value="${u.telefono || ""}" />
          </div>
        </div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarEdicionUsuario()">Guardar</button>
    </div>
  `);

  const rolSel = document.getElementById('u-rol');
  if (rolSel) renderCamposIdentidad(rolRequiereIdentidad(rolSel.value));
}

async function guardarNuevoUsuario() {
  const email   = document.getElementById('u-email')?.value.trim();
  const idRol   = parseInt(document.getElementById('u-rol')?.value);
  const nombres   = document.getElementById('u-nombres')?.value.trim();
  const apellidos = document.getElementById('u-apellidos')?.value.trim();
  const documento = document.getElementById('u-documento')?.value.trim();
  const telefono  = document.getElementById('u-telefono')?.value.trim();

  if (!email || !idRol) {
    UI.toast('Email y rol son obligatorios.', 'error');
    return;
  }

  if (rolRequiereIdentidad(idRol) && (!nombres || !apellidos || !documento)) {
    UI.toast('Para este rol: nombres, apellidos y documento son obligatorios.', 'error');
    return;
  }

  try {
    const payload = { email, id_rol: idRol };
    if (rolRequiereIdentidad(idRol)) {
      payload.nombres   = nombres;
      payload.apellidos = apellidos;
      payload.documento = documento;
      if (telefono) payload.telefono = telefono;
    }
    await API.post('/usuarios', payload);
    UI.closeModal();
    UI.toast('Usuario creado', 'ok');
    await cargarUsuariosTabla();
  } catch (err) {
    UI.toast('Error al crear usuario: ' + err.message, 'error');
  }
}

async function guardarEdicionUsuario() {
  const idRol     = parseInt(document.getElementById('u-rol')?.value);
  const nombres   = document.getElementById('u-nombres')?.value.trim();
  const apellidos = document.getElementById('u-apellidos')?.value.trim();
  const documento = document.getElementById('u-documento')?.value.trim();
  const telefono  = document.getElementById('u-telefono')?.value.trim();

  if (rolRequiereIdentidad(idRol) && (!nombres || !apellidos || !documento)) {
    UI.toast('Para este rol: nombres, apellidos y documento son obligatorios.', 'error');
    return;
  }

  try {
    const payload = { id_rol: idRol };
    if (rolRequiereIdentidad(idRol)) {
      payload.nombres   = nombres;
      payload.apellidos = apellidos;
      payload.documento = documento;
      payload.telefono  = telefono || null;
    }
    await API.put(`/usuarios/${_usuarioEditandoId}`, payload);
    UI.closeModal();
    UI.toast('Usuario actualizado', 'ok');
    await cargarUsuariosTabla();
  } catch (err) {
    UI.toast('Error al actualizar: ' + err.message, 'error');
  }
}

async function confirmarDesactivar(id, email) {
  if (!confirm(`Desactivar a ${email}?\nPodras reactivarlo despues.`)) return;
  try {
    await API.patch(`/usuarios/${id}/desactivar`);
    UI.toast('Usuario desactivado', 'ok');
    await cargarUsuariosTabla();
  } catch (err) {
    UI.toast('Error: ' + err.message, 'error');
  }
}

async function reactivarUsuario(id) {
  try {
    await API.put(`/usuarios/${id}`, { activo: true });
    UI.toast('Usuario reactivado', 'ok');
    await cargarUsuariosTabla();
  } catch (err) {
    UI.toast('Error al reactivar: ' + err.message, 'error');
  }
}

// Expose functions called from inline onclick handlers
window.filtrarUsuarios         = filtrarUsuarios;
window.abrirModalNuevoUsuario  = abrirModalNuevoUsuario;
window.abrirModalEditarUsuario = abrirModalEditarUsuario;
window.guardarNuevoUsuario     = guardarNuevoUsuario;
window.guardarEdicionUsuario   = guardarEdicionUsuario;
window.confirmarDesactivar     = confirmarDesactivar;
window.reactivarUsuario        = reactivarUsuario;
window.cambiarRolInline        = cambiarRolInline;

})();