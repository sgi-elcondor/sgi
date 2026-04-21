window.usuariosView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  await Promise.all([cargarRolesCache(), cargarUsuariosTabla()]);
};

// ─── Cache global ───
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
  const vc = document.getElementById("viewContainer");
  try {
    _todosUsuarios = await API.get('/usuarios');

    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.75rem;">
          <div style="display:flex; gap:.75rem; align-items:center; flex-wrap:wrap;">
            <input id="filtro-email" type="text" placeholder="Buscar por email…"
              style="padding:.4rem .8rem; border:1px solid var(--border); border-radius:8px;
                     font-size:.875rem; background:var(--surface); color:var(--text); width:200px;"
              oninput="filtrarUsuarios()" />
            <select id="filtro-rol" onchange="filtrarUsuarios()"
              style="padding:.4rem .8rem; border:1px solid var(--border); border-radius:8px;
                     font-size:.875rem; background:var(--surface); color:var(--text);">
              <option value="">Todos los roles</option>
              ${_rolesCache.map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('')}
            </select>
            <select id="filtro-estado" onchange="filtrarUsuarios()"
              style="padding:.4rem .8rem; border:1px solid var(--border); border-radius:8px;
                     font-size:.875rem; background:var(--surface); color:var(--text);">
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="abrirModalNuevoUsuario()">+ Nuevo usuario</button>
        </div>

        <div id="alerta-pendientes" style="display:none;
          background:#fff8e1; border:1px solid #ffe082; border-radius:8px;
          padding:.65rem 1rem; margin:.75rem 0; font-size:.875rem; color:#7a5c00;">
        </div>

        <table>
          <thead>
            <tr>
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

    // Ahora que el DOM tiene los selects, llena roles en filtro
    await cargarRolesCache();
    renderTablaUsuarios(_todosUsuarios);
    mostrarAlertaPendientes(_todosUsuarios);

  } catch (err) {
    vc.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

// ─── Alerta de pendientes ───
function mostrarAlertaPendientes(usuarios) {
  const pendientes = usuarios.filter(u => u.roles?.nombre === 'comprador' && u.activo);
  const alerta = document.getElementById('alerta-pendientes');
  if (!alerta) return;
  if (pendientes.length === 0) { alerta.style.display = 'none'; return; }
  alerta.style.display = 'block';
  alerta.innerHTML = `⚠️ <strong>${pendientes.length} usuario${pendientes.length > 1 ? 's' : ''}</strong>
    con rol por defecto (<em>comprador</em>) pendiente${pendientes.length > 1 ? 's' : ''} de asignación.
    <a href="#" style="color:#b8860b; font-weight:600; margin-left:.5rem;"
      onclick="document.getElementById('filtro-rol').value='comprador'; filtrarUsuarios(); return false;">
      Ver →
    </a>`;
}

// ─── Render tabla ───
function renderTablaUsuarios(usuarios) {
  const tbody = document.getElementById('body-usuarios');
  if (!tbody) return;

  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Sin resultados</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map(u => {
    const vinculo = u.comprador
      ? `👤 ${u.comprador.nombres} ${u.comprador.apellidos}`
      : u.comisionista
      ? `🤝 ${u.comisionista.nombres} ${u.comisionista.apellidos}`
      : '<span style="color:var(--text-muted)">—</span>';

    const opcionesRol = _rolesCache.map(r =>
      `<option value="${r.id_rol}" ${u.roles?.id_rol === r.id_rol ? 'selected' : ''}>${r.nombre}</option>`
    ).join('');

    return `<tr>
      <td>${u.email}</td>
      <td>
        <select data-id="${u.id_usuario}" onchange="cambiarRolInline(this)"
          style="padding:.3rem .6rem; border:1px solid var(--border); border-radius:6px;
                 font-size:.85rem; background:var(--surface); color:var(--text); cursor:pointer;">
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

// ─── Cambio de rol inline ───
async function cambiarRolInline(sel) {
  const idUsuario  = sel.dataset.id;
  const nuevoIdRol = parseInt(sel.value);
  const rolNombre  = sel.options[sel.selectedIndex].text;

  sel.disabled = true;
  try {
    await API.put(`/usuarios/${idUsuario}`, { id_rol: nuevoIdRol });
    UI.toast(`Rol cambiado a "${rolNombre}"`, 'ok');
    // Actualiza cache local sin re-pedir toda la tabla
    const u = _todosUsuarios.find(x => x.id_usuario == idUsuario);
    if (u) u.roles = { id_rol: nuevoIdRol, nombre: rolNombre };
    mostrarAlertaPendientes(_todosUsuarios);
  } catch (err) {
    UI.toast('No se pudo cambiar el rol: ' + err.message, 'error');
    await cargarUsuariosTabla(); // revierte
  } finally {
    sel.disabled = false;
  }
}

// ─── Filtros ───
function filtrarUsuarios() {
  const email  = (document.getElementById('filtro-email')?.value  ?? '').toLowerCase();
  const rol    = document.getElementById('filtro-rol')?.value    ?? '';
  const estado = document.getElementById('filtro-estado')?.value ?? '';

  const filtrados = _todosUsuarios.filter(u => {
    const okEmail  = !email  || u.email.toLowerCase().includes(email);
    const okRol    = !rol    || u.roles?.nombre === rol;
    const okEstado = !estado
      || (estado === 'activo'   &&  u.activo)
      || (estado === 'inactivo' && !u.activo);
    return okEmail && okRol && okEstado;
  });
  renderTablaUsuarios(filtrados);
}

// ─── Modal nuevo usuario ───
let _usuarioEditandoId = null;

async function abrirModalNuevoUsuario() {
  _usuarioEditandoId = null;
  const [compradores, comisionistas] = await Promise.all([
    API.get('/compradores'),
    API.get('/comisionistas'),
  ]);
  const rolDefaultId = _rolesCache.find(r => r.nombre === 'comprador')?.id_rol ?? '';

  UI.openModal('Nuevo Usuario', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1">
        <label>Firebase UID *</label>
        <input id="u-uid" type="text" placeholder="Obtenlo desde Firebase Console" />
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Email *</label>
        <input id="u-email" type="email" placeholder="usuario@ejemplo.com" />
      </div>
      <div class="form-group">
        <label>Rol *</label>
        <select id="u-rol">
          ${_rolesCache.map(r =>
            `<option value="${r.id_rol}" ${r.id_rol == rolDefaultId ? 'selected' : ''}>
              ${r.nombre}${r.descripcion ? ' — ' + r.descripcion : ''}
            </option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Vincular a Comprador <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
        <select id="u-comprador">
          <option value="">— Ninguno —</option>
          ${compradores.map(c =>
            `<option value="${c.id_comprador}">${c.nombres} ${c.apellidos} (${c.documento})</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Vincular a Comisionista <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
        <select id="u-comisionista">
          <option value="">— Ninguno —</option>
          ${comisionistas.map(c =>
            `<option value="${c.id_comisionista}">${c.nombres} ${c.apellidos}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarNuevoUsuario()">Guardar</button>
    </div>
  `);
}

// ─── Modal editar usuario ───
async function abrirModalEditarUsuario(idUsuario) {
  _usuarioEditandoId = idUsuario;
  const u = _todosUsuarios.find(x => x.id_usuario === idUsuario);
  if (!u) return;

  const [compradores, comisionistas] = await Promise.all([
    API.get('/compradores'),
    API.get('/comisionistas'),
  ]);

  UI.openModal('Editar Usuario', `
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1">
        <label>Email</label>
        <input type="text" value="${u.email}" disabled
          style="background:var(--surface2); color:var(--text-muted);" />
      </div>
      <div class="form-group">
        <label>Rol *</label>
        <select id="u-rol">
          ${_rolesCache.map(r =>
            `<option value="${r.id_rol}" ${u.roles?.id_rol === r.id_rol ? 'selected' : ''}>
              ${r.nombre}${r.descripcion ? ' — ' + r.descripcion : ''}
            </option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Vincular a Comprador <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
        <select id="u-comprador">
          <option value="">— Ninguno —</option>
          ${compradores.map(c =>
            `<option value="${c.id_comprador}"
              ${u.id_comprador === c.id_comprador ? 'selected' : ''}>
              ${c.nombres} ${c.apellidos} (${c.documento})
            </option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Vincular a Comisionista <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
        <select id="u-comisionista">
          <option value="">— Ninguno —</option>
          ${comisionistas.map(c =>
            `<option value="${c.id_comisionista}"
              ${u.id_comisionista === c.id_comisionista ? 'selected' : ''}>
              ${c.nombres} ${c.apellidos}
            </option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarEdicionUsuario()">Guardar</button>
    </div>
  `);
}

// ─── Guardar nuevo ───
async function guardarNuevoUsuario() {
  const uid   = document.getElementById('u-uid')?.value.trim();
  const email = document.getElementById('u-email')?.value.trim();
  const idRol = parseInt(document.getElementById('u-rol')?.value);

  if (!uid || !email || !idRol) {
    UI.toast('UID, email y rol son obligatorios.', 'error');
    return;
  }
  try {
    await API.post('/usuarios', {
      firebase_uid:    uid,
      email,
      id_rol:          idRol,
      id_comprador:    document.getElementById('u-comprador')?.value    || null,
      id_comisionista: document.getElementById('u-comisionista')?.value || null,
    });
    UI.closeModal();
    UI.toast('Usuario creado', 'ok');
    await cargarUsuariosTabla();
  } catch (err) {
    UI.toast('Error al crear usuario: ' + err.message, 'error');
  }
}

// ─── Guardar edición ───
async function guardarEdicionUsuario() {
  try {
    await API.put(`/usuarios/${_usuarioEditandoId}`, {
      id_rol:          parseInt(document.getElementById('u-rol')?.value),
      id_comprador:    document.getElementById('u-comprador')?.value    || null,
      id_comisionista: document.getElementById('u-comisionista')?.value || null,
    });
    UI.closeModal();
    UI.toast('Usuario actualizado', 'ok');
    await cargarUsuariosTabla();
  } catch (err) {
    UI.toast('Error al actualizar: ' + err.message, 'error');
  }
}

// ─── Desactivar / reactivar ───
async function confirmarDesactivar(id, email) {
  if (!confirm(`¿Desactivar a ${email}?\nPodrás reactivarlo después.`)) return;
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