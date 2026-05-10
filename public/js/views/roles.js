(() => {
  const VISTA_GROUPS = [
    { label: 'General', vistas: [{ key: 'dashboard', label: 'Panel de control' }]},
    { label: 'Operacion', vistas: [
      { key: 'proyectos-read', label: 'Proyectos (solo lectura)' },
      { key: 'proyectos-edit', label: 'Proyectos (gestion)' },
      { key: 'lotes-read',     label: 'Lotes (solo lectura)' },
      { key: 'lotes-edit',     label: 'Lotes (gestion)' },
      { key: 'compradores',    label: 'Compradores' },
      { key: 'ventas',         label: 'Ventas' },
    ]},
    { label: 'Finanzas', vistas: [
      { key: 'cuotas',        label: 'Cuotas' },
      { key: 'pagos-read',    label: 'Pagos (solo lectura)' },
      { key: 'pagos-upload',  label: 'Pagos (subir comprobante)' },
      { key: 'pagos-edit',    label: 'Pagos (gestion completa)' },
      { key: 'comisionistas', label: 'Comisionistas' },
      { key: 'facturas',      label: 'Facturas' },
      { key: 'recibos',       label: 'Recibos' },
    ]},
    { label: 'Control', vistas: [
      { key: 'reportes',  label: 'Reportes' },
      { key: 'alertas',   label: 'Alertas juridicas' },
      { key: 'auditoria', label: 'Auditoria' },
      { key: 'usuarios',  label: 'Gestion de usuarios' },
      { key: 'roles',     label: 'Roles y permisos' },
    ]},
  ];

  function humanizeRoleName(nombre) {
    return (nombre || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function renderCheckboxGroups(assignedVistas) {
    const assigned = new Set(assignedVistas);
    return VISTA_GROUPS.map(group => {
      const items = group.vistas.map(v => {
        const chk = assigned.has(v.key) ? ' checked' : '';
        return '<label class="roles-perm-item"><input type="checkbox" class="roles-perm-check" data-vista="' + v.key + '"' + chk + ' /><span>' + v.label + '</span></label>';
      }).join('');
      return '<div class="roles-perm-group"><div class="roles-perm-group-title">' + group.label + '</div>' + items + '</div>';
    }).join('');
  }

  function getCheckedVistas() {
    return [...document.querySelectorAll('.roles-perm-check:checked')].map(el => el.dataset.vista);
  }

  async function loadRolPermisos(rolId, rolNombre) {
    const panel = document.getElementById('roles-detail-panel');
    if (!panel) return;
    const title = humanizeRoleName(rolNombre);
    panel.innerHTML = '<div class="roles-detail-header"><h3 class="roles-detail-title">' + title + '</h3><p class="roles-detail-sub">Activa o desactiva las vistas de este rol.</p></div><div class="roles-perm-loading">Cargando permisos...</div>';
    try {
      const resp = await API.get('/roles/' + rolId + '/permisos');
      const vistas = resp.vistas || [];
      panel.innerHTML =
        '<div class="roles-detail-header"><h3 class="roles-detail-title">' + title + '</h3><p class="roles-detail-sub">Activa o desactiva las vistas de este rol.</p></div>' +
        '<div class="roles-perm-body">' + renderCheckboxGroups(vistas) + '</div>' +
        '<div class="roles-detail-actions"><div id="roles-save-feedback" style="display:none;font-size:.85rem"></div><button class="btn btn-primary" id="btn-guardar-permisos">Guardar cambios</button></div>';
      document.getElementById('btn-guardar-permisos')?.addEventListener('click', async () => {
        const nuevasVistas = getCheckedVistas();
        const btn      = document.getElementById('btn-guardar-permisos');
        const feedback = document.getElementById('roles-save-feedback');
        btn.disabled = true; btn.textContent = 'Guardando...';
        feedback.style.display = 'none';
        try {
          await API.put('/roles/' + rolId + '/permisos', { vistas: nuevasVistas });
          feedback.textContent = 'Permisos actualizados correctamente.';
          feedback.style.color = 'var(--success)';
          feedback.style.display = 'block';
          window.SGIUI?.toast('Permisos actualizados para ' + title, 'success', 'Exito');
        } catch (err) {
          feedback.textContent = err.message || 'Error al guardar.';
          feedback.style.color = 'var(--danger)';
          feedback.style.display = 'block';
        } finally {
          btn.disabled = false; btn.textContent = 'Guardar cambios';
        }
      });
    } catch (err) {
      panel.innerHTML = '<div class="roles-detail-header"><h3 class="roles-detail-title">' + title + '</h3></div><div style="color:var(--danger);padding:16px">' + (err.message || 'Error al cargar permisos.') + '</div>';
    }
  }

  window.rolesView = async function (container) {
    const vc = container || document.getElementById('viewContainer');
    vc.innerHTML = window.UI?.loader ? UI.loader() : '';
    try {
      const roles = await API.get('/roles');
      const header = window.SGIUI?.pageHeader({ kicker: 'Configuracion', title: 'Roles y Permisos', subtitle: 'Administra que vistas puede realizar cada rol del sistema.' }) ?? '';
      const listItems = roles.map(r => {
        const desc = r.descripcion ? '<span class="roles-list-desc">' + r.descripcion + '</span>' : '';
        return '<button type="button" class="roles-list-item" data-rol-id="' + r.id_rol + '" data-rol-nombre="' + r.nombre + '"><span class="roles-list-name">' + humanizeRoleName(r.nombre) + '</span>' + desc + '</button>';
      }).join('');
      vc.innerHTML = '<section class="page-shell">' + header +
        '<section class="roles-layout">' +
        '<aside class="roles-sidebar"><div class="roles-sidebar-title">Roles del sistema</div><div class="roles-list" id="roles-list">' + listItems + '</div></aside>' +
        '<div class="roles-detail" id="roles-detail-panel">' +
        '<div class="roles-detail-empty"><div style="font-size:2rem;margin-bottom:8px">&#128274;</div><div style="font-weight:500;margin-bottom:4px">Selecciona un rol</div><div style="font-size:.85rem;color:var(--text-muted)">Elige un rol de la lista para ver y editar sus permisos.</div></div>' +
        '</div></section></section>';
      window.SGIUI?.hydrate();
      document.getElementById('roles-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.roles-list-item');
        if (!btn) return;
        document.querySelectorAll('.roles-list-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadRolPermisos(btn.dataset.rolId, btn.dataset.rolNombre);
      });
    } catch (err) {
      vc.innerHTML = '<p style="color:var(--danger);padding:20px">' + err.message + '</p>';
    }
  };

  const style = document.createElement('style');
  style.textContent = '.roles-layout{display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:start}' +
    '.roles-sidebar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,8px);overflow:hidden}' +
    '.roles-sidebar-title{padding:12px 16px;font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)}' +
    '.roles-list{display:flex;flex-direction:column}' +
    '.roles-list-item{display:flex;flex-direction:column;align-items:flex-start;padding:10px 16px;background:none;border:none;border-bottom:1px solid var(--border);cursor:pointer;text-align:left;transition:background .15s}' +
    '.roles-list-item:last-child{border-bottom:none}.roles-list-item:hover{background:var(--surface2)}' +
    '.roles-list-item.active{outline:2px solid var(--accent);outline-offset:-2px}' +
    '.roles-list-name{font-size:.875rem;font-weight:500;color:var(--text)}' +
    '.roles-list-desc{font-size:.75rem;color:var(--text-muted);margin-top:2px}' +
    '.roles-detail{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,8px);min-height:400px}' +
    '.roles-detail-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;color:var(--text-muted);text-align:center}' +
    '.roles-detail-header{padding:20px 24px 16px;border-bottom:1px solid var(--border)}' +
    '.roles-detail-title{font-size:1.1rem;font-weight:600;margin:0 0 4px}' +
    '.roles-detail-sub{font-size:.85rem;color:var(--text-muted);margin:0}' +
    '.roles-perm-loading{padding:32px 24px;color:var(--text-muted)}' +
    '.roles-perm-body{padding:16px 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px 24px}' +
    '.roles-perm-group{margin-bottom:16px}' +
    '.roles-perm-group-title{font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px}' +
    '.roles-perm-item{display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:.875rem}' +
    '.roles-perm-item input[type=checkbox]{width:15px;height:15px;cursor:pointer;accent-color:var(--accent)}' +
    '.roles-detail-actions{padding:16px 24px;border-top:1px solid var(--border);display:flex;align-items:center;gap:16px}' +
    '@media(max-width:680px){.roles-layout{grid-template-columns:1fr}}';
  document.head.appendChild(style);
})();