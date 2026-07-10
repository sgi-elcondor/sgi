(() => {

  // ── Permission catalog ────────────────────────────────────────────────────────
  const PERMISSION_CATALOG = [
    { group: 'General', modules: [
      { key: 'dashboard',  label: 'Panel de control',   icon: 'layout-dashboard', actions: [] },
    ]},
    { group: 'Operacion', modules: [
      { key: 'proyectos', label: 'Proyectos', icon: 'building-2', actions: [
        { key: 'proyectos:leer',       label: 'Ver proyectos' },
        { key: 'proyectos:crear',      label: 'Crear proyecto' },
        { key: 'proyectos:actualizar', label: 'Editar proyecto' },
      ]},
      { key: 'lotes', label: 'Lotes', icon: 'map', actions: [
        { key: 'lotes:leer',       label: 'Ver lotes' },
        { key: 'lotes:crear',      label: 'Crear lote' },
        { key: 'lotes:actualizar', label: 'Editar lote' },
      ]},
      { key: 'compradores', label: 'Compradores', icon: 'users', actions: [
        { key: 'compradores:leer',       label: 'Ver compradores' },
        { key: 'compradores:crear',      label: 'Registrar comprador' },
        { key: 'compradores:actualizar', label: 'Editar comprador' },
      ]},
      { key: 'el-proyecto', label: 'El Proyecto', icon: 'map-pin', actions: [
        { key: 'proyectos:leer', label: 'Ver proyectos' },
        { key: 'lotes:leer',     label: 'Ver lotes' },
      ]},
      { key: 'ventas', label: 'Ventas', icon: 'briefcase', actions: [
        { key: 'ventas:leer',              label: 'Ver ventas' },
        { key: 'ventas:crear',             label: 'Crear venta directa' },
        { key: 'ventas:solicitar',         label: 'Solicitar venta (asesor)' },
        { key: 'ventas:actualizar',        label: 'Actualizar venta' },
        { key: 'ventas:editar_financiero', label: 'Editar datos financieros' },
      ]},
      { key: 'requerimientos', label: 'Requerimientos', icon: 'clipboard-list', actions: [
        { key: 'requerimientos:leer',   label: 'Ver mis requerimientos' },
        { key: 'requerimientos:crear',  label: 'Crear requerimientos' },
      ]},
      { key: 'aprobaciones', label: 'Aprobaciones', icon: 'clipboard-check', actions: [
        { key: 'requerimientos:leer',              label: 'Ver aprobaciones' },
        { key: 'requerimientos:aprobar_jefe',      label: 'Firmar como jefe de área' },
        { key: 'requerimientos:aprobar_final',     label: 'Aprobación final (compras chicas)' },
        { key: 'requerimientos:aprobar_dueno',     label: 'Firmar como dueño (compras grandes)' },
        { key: 'requerimientos:aprobar_gerencia',  label: 'Co-firmar como gerencia (compras grandes)' },
      ]},
      { key: 'desembolsos', label: 'Desembolsos', icon: 'landmark', actions: [
        { key: 'requerimientos:leer',        label: 'Ver desembolsos' },
        { key: 'requerimientos:desembolsar', label: 'Registrar desembolsos' },
        { key: 'uploads:crear',              label: 'Adjuntar comprobante' },
      ]},
      { key: 'recepciones', label: 'Recepciones', icon: 'package-check', actions: [
        { key: 'recepciones:leer',  label: 'Ver recepciones' },
        { key: 'recepciones:crear', label: 'Registrar recepciones' },
        { key: 'uploads:crear',     label: 'Adjuntar remisiones' },
      ]},
    ]},
    { group: 'Finanzas', modules: [
      { key: 'cuotas', label: 'Cuotas', icon: 'calendar', actions: [
        { key: 'cuotas:leer',           label: 'Ver cuotas' },
        { key: 'cuotas:crear',          label: 'Crear cuota' },
        { key: 'cuotas:actualizar',     label: 'Actualizar cuota' },
        { key: 'cuotas:editar_valores', label: 'Editar valores de cuota' },
      ]},
      { key: 'pagos', label: 'Pagos', icon: 'wallet', actions: [
        { key: 'pagos:leer',      label: 'Ver pagos registrados' },
        { key: 'pagos:crear',     label: 'Registrar y aplicar pagos' },
        { key: 'mis_pagos:leer',  label: 'Consultar mis pagos (comprador)' },
        { key: 'mis_pagos:crear', label: 'Subir comprobante (comprador)' },
        { key: 'uploads:crear',   label: 'Adjuntar archivos' },
      ]},
      { key: 'comisionistas', label: 'Comisionistas', icon: 'percent', actions: [
        { key: 'comisionistas:leer',       label: 'Ver comisionistas' },
        { key: 'comisionistas:crear',      label: 'Registrar comisionista' },
        { key: 'comisionistas:actualizar', label: 'Editar comisionista' },
      ]},
      { key: 'facturas', label: 'Facturas', icon: 'receipt', actions: [
        { key: 'facturas:leer',       label: 'Ver facturas' },
        { key: 'facturas:crear',      label: 'Emitir factura' },
        { key: 'facturas:actualizar', label: 'Actualizar factura' },
      ]},
      { key: 'recibos', label: 'Recibos', icon: 'file-text', actions: [
        { key: 'recibos:leer',  label: 'Ver recibos' },
        { key: 'recibos:crear', label: 'Generar recibo' },
      ]},
      { key: 'gastos', label: 'Gastos operativos', icon: 'trending-down', actions: [
        { key: 'gastos:leer',       label: 'Ver gastos' },
        { key: 'gastos:crear',      label: 'Registrar gasto' },
        { key: 'gastos:actualizar', label: 'Editar gasto' },
      ]},
      { key: 'bank-transactions', label: 'Transacciones bancarias', icon: 'landmark', actions: [
        { key: 'bank_transactions:leer',       label: 'Ver transacciones' },
        { key: 'bank_transactions:crear',      label: 'Importar transacciones' },
        { key: 'bank_transactions:actualizar', label: 'Editar transaccion' },
        { key: 'bank_transactions:eliminar',   label: 'Eliminar transaccion' },
      ]},
      { key: 'payment-validation', label: 'Validacion de pagos', icon: 'shield-check', actions: [
        { key: 'validacion_pagos:leer',  label: 'Ver pagos pendientes' },
        { key: 'validacion_pagos:crear', label: 'Aceptar pagos' },
      ]},
    ]},
    { group: 'Mi cuenta', modules: [
      { key: 'mis-cuotas',  label: 'Mis cuotas',  icon: 'calendar',  actions: [
        { key: 'mis_cuotas:leer', label: 'Ver mis cuotas' },
      ]},
      { key: 'mis-facturas', label: 'Mis facturas', icon: 'receipt', actions: [
        { key: 'mis_facturas:leer', label: 'Ver mis facturas' },
      ]},
      { key: 'mis-recibos', label: 'Mis recibos', icon: 'file-text', actions: [
        { key: 'mis_recibos:leer', label: 'Ver mis recibos' },
      ]},
    ]},
    { group: 'Control', modules: [
      { key: 'reportes', label: 'Reportes', icon: 'bar-chart-3', actions: [
        { key: 'reportes:leer',     label: 'Ver reportes operativos' },
        { key: 'reportes_dir:leer', label: 'Ver reportes directivos' },
      ]},
      { key: 'alertas',   label: 'Alertas juridicas',  icon: 'triangle-alert', actions: [
        { key: 'alertas_jur:leer', label: 'Ver alertas' },
      ]},
      { key: 'auditoria', label: 'Auditoria',           icon: 'shield',         actions: [] },
      { key: 'personal',  label: 'Personal registrado', icon: 'users-round',    actions: [
        { key: 'usuarios:leer',      label: 'Ver usuarios' },
        { key: 'compradores:leer',   label: 'Ver compradores' },
        { key: 'comisionistas:leer', label: 'Ver comisionistas' },
      ]},
      { key: 'usuarios', label: 'Usuarios', icon: 'settings', actions: [
        { key: 'usuarios:leer',       label: 'Ver usuarios' },
        { key: 'usuarios:crear',      label: 'Crear usuario' },
        { key: 'usuarios:actualizar', label: 'Editar usuario' },
      ]},
      { key: 'roles', label: 'Permisos', icon: 'shield-check', actions: [
        { key: 'roles:leer',       label: 'Ver roles' },
        { key: 'roles:actualizar', label: 'Editar permisos' },
        { key: 'config:leer',       label: 'Ver configuración del sistema' },
        { key: 'config:actualizar', label: 'Editar configuración del sistema' },
      ]},
    ]},
    { group: 'Juridico', modules: [
      { key: 'juridico', label: 'Seguimiento juridico', icon: 'scale', actions: [
        { key: 'ventas:leer',             label: 'Ver ventas' },
        { key: 'compradores:leer',        label: 'Ver compradores' },
        { key: 'cuotas:leer',             label: 'Ver cuotas' },
        { key: 'pagos:leer',              label: 'Ver pagos' },
        { key: 'alertas_jur:leer',        label: 'Ver alertas juridicas' },
        { key: 'observaciones_jur:leer',  label: 'Ver observaciones' },
        { key: 'observaciones_jur:crear', label: 'Crear observacion' },
      ]},
    ]},
  ];

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function humanize(nombre) {
    return (nombre || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function rolIcon(nombre) {
    const MAP = { admin:'crown', gerencia:'briefcase-business', juridico:'scale',
      comprador:'home', comisionista:'percent', asesor_comercial:'handshake', auxiliar_contable:'calculator' };
    return MAP[nombre] || 'user-cog';
  }

  // ── Two-level permission panel ────────────────────────────────────────────────

  function buildPermissionPanel(vistas, can) {
    const vistaSet = new Set(vistas);
    const canSet   = new Set(can);

    return PERMISSION_CATALOG.map(group => {
      const modulesHtml = group.modules.map(mod => {
        const enabled = vistaSet.has(mod.key);
        const actionsHtml = mod.actions.length
          ? mod.actions.map(a => {
              const checked  = canSet.has(a.key) ? ' checked' : '';
              const disabled = !enabled ? ' disabled' : '';
              return `<label class="perm-action-item${!enabled ? ' disabled' : ''}">
                <input type="checkbox" class="perm-action-check"
                  data-module="${mod.key}" data-action="${a.key}"${checked}${disabled}>
                <span>${a.label}</span>
              </label>`;
            }).join('')
          : `<p class="perm-action-empty">Acceso sin acciones adicionales</p>`;

        return `<div class="perm-module" data-module="${mod.key}">
          <div class="perm-module-header">
            <label class="perm-module-toggle">
              <span class="perm-module-icon"><i data-lucide="${mod.icon}"></i></span>
              <span class="perm-module-label">${mod.label}</span>
              <span class="perm-toggle-switch">
                <input type="checkbox" class="perm-toggle-input perm-module-check"
                  data-module="${mod.key}"${enabled ? ' checked' : ''}>
                <span class="perm-toggle-track"><span class="perm-toggle-thumb"></span></span>
              </span>
            </label>
          </div>
          <div class="perm-module-actions${enabled ? '' : ' perm-module-actions--hidden'}">
            ${actionsHtml}
          </div>
        </div>`;
      }).join('');

      return `<div class="perm-group">
        <div class="perm-group-title">${group.group}</div>
        <div class="perm-modules-list">${modulesHtml}</div>
      </div>`;
    }).join('');
  }

  // ── Auto-save ─────────────────────────────────────────────────────────────────

  function makeAutoSave(rolId) {
    let timer = null;

    function setStatus(state) {
      const el = document.getElementById('perm-save-status');
      if (!el) return;
      const MAP = {
        idle:    '',
        pending: '<span class="perm-status pending"><i data-lucide="clock"></i> Guardando...</span>',
        saved:   '<span class="perm-status saved"><i data-lucide="check-circle"></i> Guardado</span>',
        error:   '<span class="perm-status error"><i data-lucide="x-circle"></i> Error al guardar</span>',
      };
      el.innerHTML = MAP[state] || '';
      window.SGIUI?.hydrate();
    }

    async function doSave() {
      setStatus('pending');
      const panel = document.getElementById('perm-detail-panel');
      if (!panel) return;

      const vistas = [...panel.querySelectorAll('.perm-module-check:checked')]
        .map(el => el.dataset.module);
      const can = [...panel.querySelectorAll('.perm-action-check:checked')]
        .map(el => el.dataset.action);

      try {
        await API.put('/roles/' + rolId + '/permisos', { vistas, can });
        setStatus('saved');

        const sub = panel.querySelector('.perm-detail-sub');
        if (sub) sub.textContent = `${vistas.length} acceso${vistas.length !== 1 ? 's' : ''} configurado${vistas.length !== 1 ? 's' : ''}`;

        const fresh = await API.get('/roles/' + rolId + '/permisos');
        const canEl = document.getElementById('perm-api-chips');
        if (canEl) canEl.innerHTML = buildApiChips(fresh.can || []);

        setTimeout(() => setStatus('idle'), 2500);
      } catch (err) {
        setStatus('error');
        window.SGIUI?.toast(err.message || 'Error al guardar permisos', 'error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    }

    return function schedule() {
      setStatus('pending');
      clearTimeout(timer);
      timer = setTimeout(doSave, 600);
    };
  }

  // ── API chips ─────────────────────────────────────────────────────────────────

  function buildApiChips(canList) {
    if (!canList || !canList.length) return '<span style="color:var(--text-muted);font-size:.82rem">Sin permisos de API derivados.</span>';
    const grouped = {};
    canList.forEach(p => {
      const [r, a] = p.split(':');
      if (!grouped[r]) grouped[r] = [];
      grouped[r].push(a);
    });
    return Object.entries(grouped).map(([r, actions]) =>
      `<div class="perm-api-group"><span class="perm-api-resource">${r}</span>${actions.map(a => `<span class="perm-api-chip">${a}</span>`).join('')}</div>`
    ).join('');
  }

  // ── Manual del rol (descripcion + obligaciones, editable) ───────────────────

  function _escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function buildManualSection(rol) {
    return `
      <section class="perm-section" id="perm-manual-section">
        <div class="perm-section-header">
          <div class="perm-section-title"><i data-lucide="book-marked"></i> Manual del rol</div>
          <p class="perm-section-sub">Texto en espanol claro que vera el usuario en su menu "Mi rol". Se actualiza automaticamente al perder el foco.</p>
        </div>
        <div class="perm-manual-row">
          <label for="perm-manual-desc">Descripcion corta</label>
          <textarea id="perm-manual-desc" rows="2" placeholder="En una o dos lineas, que es este rol.">${_escapeHtml(rol.descripcion || '')}</textarea>
        </div>
        <div class="perm-manual-row">
          <label for="perm-manual-obl">Obligaciones</label>
          <textarea id="perm-manual-obl" rows="6" placeholder="Una obligacion por linea.&#10;Ej:&#10;Atender clientes&#10;Crear solicitudes de venta">${_escapeHtml(rol.obligaciones || '')}</textarea>
        </div>
        <div id="perm-manual-status" style="margin-top:.4rem;min-height:1.1rem"></div>
      </section>`;
  }

  function makeManualAutoSave(rolId) {
    let timer = null;
    let last  = null;

    function setStatus(state) {
      const el = document.getElementById('perm-manual-status');
      if (!el) return;
      const MAP = {
        idle:    '',
        pending: '<span class="perm-status pending"><i data-lucide="clock"></i> Guardando manual...</span>',
        saved:   '<span class="perm-status saved"><i data-lucide="check-circle"></i> Manual guardado</span>',
        error:   '<span class="perm-status error"><i data-lucide="x-circle"></i> Error al guardar manual</span>',
      };
      el.innerHTML = MAP[state] || '';
      window.SGIUI?.hydrate();
    }

    async function doSave() {
      const desc = document.getElementById('perm-manual-desc')?.value ?? '';
      const obl  = document.getElementById('perm-manual-obl')?.value  ?? '';
      const payload = { descripcion: desc, obligaciones: obl };
      const key = JSON.stringify(payload);
      if (key === last) { setStatus('idle'); return; }
      last = key;
      setStatus('pending');
      try {
        await API.patch('/roles/' + rolId + '/manual', payload);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2500);
      } catch (err) {
        setStatus('error');
        window.SGIUI?.toast(err.message || 'Error al guardar manual', 'error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    }

    return function schedule() {
      setStatus('pending');
      clearTimeout(timer);
      timer = setTimeout(doSave, 800);
    };
  }

  // ── Detail panel ──────────────────────────────────────────────────────────────

  let _rolesCache = [];

  async function loadRolPermisos(rolId, rolNombre) {
    const panel = document.getElementById('perm-detail-panel');
    if (!panel) return;

    panel.innerHTML = `<div class="perm-detail-loading"><i data-lucide="loader-2" style="animation:spin 1s linear infinite"></i>Cargando...</div>`;
    window.SGIUI?.hydrate();

    try {
      const resp   = await API.get('/roles/' + rolId + '/permisos');
      const vistas = resp.vistas || [];
      const can    = resp.can    || [];
      const schedule = makeAutoSave(rolId);
      const manualSchedule = makeManualAutoSave(rolId);
      const rolData = _rolesCache.find(r => String(r.id_rol) === String(rolId)) || { nombre: rolNombre };

      panel.innerHTML = `
        <div class="perm-detail-header">
          <div class="perm-detail-title-row">
            <div class="perm-detail-avatar"><i data-lucide="${rolIcon(rolNombre)}"></i></div>
            <div>
              <h3 class="perm-detail-title">${humanize(rolNombre)}</h3>
              <p class="perm-detail-sub">${vistas.length} acceso${vistas.length !== 1 ? 's' : ''} configurado${vistas.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div id="perm-save-status"></div>
        </div>
        <div class="perm-sections">
          ${buildManualSection(rolData)}
          <section class="perm-section">
            <div class="perm-section-header">
              <div class="perm-section-title"><i data-lucide="layout-grid"></i> Accesos y acciones</div>
              <p class="perm-section-sub">Activa el modulo para que aparezca en el sidebar. Luego define que acciones puede realizar el rol dentro de ese modulo.</p>
            </div>
            <div class="perm-groups-grid">${buildPermissionPanel(vistas, can)}</div>
          </section>
          <section class="perm-section">
            <div class="perm-section-header">
              <div class="perm-section-title"><i data-lucide="key"></i> Permisos de API activos</div>
              <p class="perm-section-sub">Se actualizan automaticamente al guardar.</p>
            </div>
            <div class="perm-api-list" id="perm-api-chips">${buildApiChips(can)}</div>
          </section>
        </div>`;

      window.SGIUI?.hydrate();

      document.getElementById('perm-manual-desc')?.addEventListener('input', manualSchedule);
      document.getElementById('perm-manual-obl')?.addEventListener('input', manualSchedule);

      // Wire module toggles
      panel.querySelectorAll('.perm-module-check').forEach(toggle => {
        toggle.addEventListener('change', () => {
          const key    = toggle.dataset.module;
          const on     = toggle.checked;
          const modEl  = panel.querySelector(`.perm-module[data-module="${key}"]`);
          if (!modEl) return;
          modEl.querySelector('.perm-module-actions')?.classList.toggle('perm-module-actions--hidden', !on);
          modEl.querySelectorAll('.perm-action-check').forEach(ac => {
            ac.disabled = !on;
            ac.closest('.perm-action-item')?.classList.toggle('disabled', !on);
            if (!on) ac.checked = false;
          });
          schedule();
        });
      });

      // Wire action checkboxes
      panel.querySelectorAll('.perm-action-check').forEach(ac => ac.addEventListener('change', schedule));

    } catch (err) {
      panel.innerHTML = `<div class="perm-detail-error"><i data-lucide="alert-triangle"></i><p>${err.message || 'Error al cargar permisos.'}</p></div>`;
      window.SGIUI?.hydrate();
    }
  }

  // ── Config card (umbral de compra grande + otras claves editables) ────────────

  function fmtCOP(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  async function renderUmbralCard(vc) {
    if (!AppState.can('config', 'leer')) return; // Hide the whole card
    const puedeEditar = AppState.can('config', 'actualizar');

    const mount = document.getElementById('perm-config-card');
    if (!mount) return;

    mount.innerHTML = `
      <div class="perm-cfg-card">
        <div class="perm-cfg-head">
          <span class="perm-cfg-icon"><i data-lucide="sliders-horizontal"></i></span>
          <div>
            <h3 class="perm-cfg-title">Configuración del sistema</h3>
            <p class="perm-cfg-sub">Umbral que decide cuándo una compra de requerimientos necesita doble firma (dueño + gerencia).</p>
          </div>
        </div>
        <div class="perm-cfg-body">
          <label class="perm-cfg-label" for="perm-cfg-umbral">Umbral de compra grande (COP)</label>
          <div class="perm-cfg-row">
            <input id="perm-cfg-umbral" type="text" inputmode="numeric"
                   ${puedeEditar ? '' : 'disabled'}
                   placeholder="5.000.000">
            <button id="perm-cfg-save" class="btn btn-primary btn-sm" ${puedeEditar ? '' : 'disabled'}>
              <i data-lucide="save"></i> Guardar
            </button>
          </div>
          <p id="perm-cfg-status" class="perm-cfg-status"></p>
          <p class="perm-cfg-hint">Compras iguales o mayores a este monto pasan a la firma del dueño y la co-firma de gerencia (POL-02). Las compras por debajo mantienen la firma única.</p>
        </div>
      </div>`;

    window.SGIUI?.hydrate();

    const input   = document.getElementById('perm-cfg-umbral');
    const btn     = document.getElementById('perm-cfg-save');
    const status  = document.getElementById('perm-cfg-status');

    // Cargar valor actual
    try {
      const { valor } = await API.get('/config/umbral_compra_grande');
      input.value = Number(valor).toLocaleString('es-CO');
      status.innerHTML = `<span class="perm-cfg-current">Valor actual: <strong>${fmtCOP(valor)}</strong></span>`;
    } catch (e) {
      status.innerHTML = `<span style="color:var(--danger)">No se pudo cargar: ${e.message}</span>`;
    }

    // Formato de miles al escribir
    if (window.SGIHelpers?.applyMoneyInput) {
      window.SGIHelpers.applyMoneyInput(input);
    } else {
      input.addEventListener('input', () => {
        const digits = (input.value || '').replace(/[^0-9]/g, '');
        input.value = digits ? Number(digits).toLocaleString('es-CO') : '';
      });
    }

    btn?.addEventListener('click', async () => {
      const digits = (input.value || '').replace(/[^0-9]/g, '');
      const valor  = Number(digits);
      if (!Number.isFinite(valor) || valor <= 0) {
        status.innerHTML = '<span style="color:var(--danger)">Ingresa un monto mayor a cero.</span>';
        return;
      }
      btn.disabled = true;
      const orig   = btn.innerHTML;
      btn.innerHTML = 'Guardando...';
      try {
        const resp = await API.patch('/config/umbral_compra_grande', { valor });
        status.innerHTML = `<span class="perm-cfg-current">Actualizado: <strong>${fmtCOP(resp.valor)}</strong></span>`;
        window.SGIUI?.toast(`Umbral actualizado a ${fmtCOP(resp.valor)}`, 'ok');
      } catch (e) {
        status.innerHTML = `<span style="color:var(--danger)">${e.message}</span>`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
        window.SGIUI?.hydrate();
      }
    });
  }

  // ── Main view ─────────────────────────────────────────────────────────────────

  window.rolesView = async function (container) {
    const vc = container || document.getElementById('viewContainer');
    vc.innerHTML = UI.loader();
    try {
      const roles = await API.getCached('/roles', { ttl: 300000 });
      _rolesCache = roles || [];
      vc.innerHTML = `
        <section class="page-shell">
          ${window.SGIUI?.pageHeader({ kicker:'Administracion', title:'Permisos del sistema', subtitle:'Configura que pantallas y acciones puede realizar cada rol.' }) ?? ''}
          <div id="perm-config-card"></div>
          <div class="perm-layout">
            <aside class="perm-sidebar">
              <div class="perm-sidebar-header"><i data-lucide="users-round"></i> Roles</div>
              <div class="perm-rol-list" id="perm-rol-list">
                ${roles.map(r => `
                  <button type="button" class="perm-rol-item" data-rol-id="${r.id_rol}" data-rol-nombre="${r.nombre}">
                    <span class="perm-rol-avatar"><i data-lucide="${rolIcon(r.nombre)}"></i></span>
                    <span class="perm-rol-name">${humanize(r.nombre)}</span>
                  </button>`).join('')}
              </div>
            </aside>
            <div class="perm-detail" id="perm-detail-panel">
              <div class="perm-detail-empty">
                <i data-lucide="shield" style="width:2.5rem;height:2.5rem;color:var(--text-muted)"></i>
                <p style="font-weight:500;margin:.75rem 0 .25rem">Selecciona un rol</p>
                <p style="font-size:.84rem;color:var(--text-muted)">Elige un rol para configurar sus permisos.</p>
              </div>
            </div>
          </div>
        </section>`;
      window.SGIUI?.hydrate();
      renderUmbralCard(vc); // Fire-and-forget; hidden if user lacks config:leer
      document.getElementById('perm-rol-list')?.addEventListener('click', e => {
        const btn = e.target.closest('.perm-rol-item');
        if (!btn) return;
        document.querySelectorAll('.perm-rol-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadRolPermisos(btn.dataset.rolId, btn.dataset.rolNombre);
      });
    } catch (err) {
      vc.innerHTML = `<p style="color:var(--danger);padding:20px">${err.message}</p>`;
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    .perm-layout{display:grid;grid-template-columns:13rem 1fr;gap:1rem;align-items:start}
    @media(max-width:700px){.perm-layout{grid-template-columns:1fr}}
    .perm-sidebar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,8px);overflow:hidden}
    .perm-sidebar-header{display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);border-bottom:1px solid var(--border)}
    .perm-sidebar-header i{width:.9rem;height:.9rem}
    .perm-rol-list{display:flex;flex-direction:column}
    .perm-rol-item{display:flex;align-items:center;gap:.6rem;padding:.6rem 1rem;background:none;border:none;border-bottom:1px solid var(--border);cursor:pointer;text-align:left;transition:background .12s}
    .perm-rol-item:last-child{border-bottom:none}
    .perm-rol-item:hover{background:var(--surface-2,var(--surface2))}
    .perm-rol-item.active{background:color-mix(in srgb,var(--accent) 8%,transparent);outline:2px solid var(--accent);outline-offset:-2px}
    .perm-rol-avatar{display:flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:50%;background:var(--surface-2,var(--surface2));color:var(--accent);flex-shrink:0}
    .perm-rol-avatar i{width:.9rem;height:.9rem}
    .perm-rol-name{font-size:.875rem;font-weight:500;color:var(--text)}
    .perm-detail{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,8px);min-height:28rem}
    .perm-detail-empty,.perm-detail-loading,.perm-detail-error{display:flex;align-items:center;justify-content:center;gap:.6rem;min-height:28rem;text-align:center;flex-direction:column;padding:2rem;color:var(--text-muted);font-size:.875rem}
    .perm-detail-error{color:var(--danger)}
    @keyframes spin{to{transform:rotate(360deg)}}
    .perm-detail-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.25rem 1.5rem 1rem;border-bottom:1px solid var(--border)}
    .perm-detail-title-row{display:flex;align-items:center;gap:.75rem}
    .perm-detail-avatar{display:flex;align-items:center;justify-content:center;width:2.5rem;height:2.5rem;border-radius:50%;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);flex-shrink:0}
    .perm-detail-avatar i{width:1.2rem;height:1.2rem}
    .perm-detail-title{font-size:1.05rem;font-weight:600;margin:0 0 .2rem}
    .perm-detail-sub{font-size:.8rem;color:var(--text-muted);margin:0}
    .perm-status{display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;font-weight:500;padding:.25rem .6rem;border-radius:999px}
    .perm-status i{width:.8rem;height:.8rem}
    .perm-status.pending{color:var(--text-muted);background:var(--surface-2,var(--surface2))}
    .perm-status.saved{color:var(--success,#22c55e);background:color-mix(in srgb,var(--success,#22c55e) 12%,transparent)}
    .perm-status.error{color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent)}
    .perm-sections{padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:2rem}
    .perm-section-header{margin-bottom:1rem}
    .perm-section-title{display:flex;align-items:center;gap:.4rem;font-size:.875rem;font-weight:600;margin-bottom:.25rem}
    .perm-section-title i{width:.95rem;height:.95rem}
    .perm-section-sub{font-size:.78rem;color:var(--text-muted);margin:0}
    .perm-groups-grid{display:flex;flex-direction:column;gap:1.5rem}
    .perm-group-title{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.6rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)}
    .perm-modules-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:.5rem}
    .perm-module{border:1px solid var(--border);border-radius:.5rem;overflow:hidden;transition:border-color .15s}
    .perm-module:has(.perm-module-check:checked){border-color:color-mix(in srgb,var(--accent) 40%,transparent)}
    .perm-module-header{padding:.5rem .75rem;background:var(--surface)}
    .perm-module-toggle{display:flex;align-items:center;gap:.5rem;cursor:pointer;width:100%}
    .perm-module-icon{width:1.1rem;height:1.1rem;color:var(--text-muted);flex-shrink:0;display:flex}
    .perm-module-icon i{width:.95rem;height:.95rem}
    .perm-module-label{flex:1;font-size:.82rem;font-weight:500;color:var(--text)}
    .perm-module-actions{padding:.5rem .75rem;background:var(--surface-2,#f8f9fb);border-top:1px solid var(--border);display:flex;flex-direction:column;gap:.2rem}
    .perm-module-actions--hidden{display:none}
    .perm-action-empty{font-size:.76rem;color:var(--text-muted);margin:0;font-style:italic}
    .perm-action-item{display:flex;align-items:center;gap:.5rem;font-size:.78rem;color:var(--text);padding:.15rem 0;cursor:pointer}
    .perm-action-item.disabled{color:var(--text-muted);cursor:not-allowed}
    .perm-action-item input[type=checkbox]{width:13px;height:13px;cursor:pointer;accent-color:var(--accent)}
    .perm-action-item.disabled input{cursor:not-allowed}
    .perm-toggle-input{position:absolute;opacity:0;width:0;height:0}
    .perm-toggle-switch{flex-shrink:0}
    .perm-toggle-track{display:block;width:2rem;height:1.1rem;border-radius:999px;background:var(--border);transition:background .2s;position:relative}
    .perm-toggle-thumb{position:absolute;top:.15rem;left:.15rem;width:.8rem;height:.8rem;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
    .perm-toggle-input:checked + .perm-toggle-track{background:var(--accent)}
    .perm-toggle-input:checked + .perm-toggle-track .perm-toggle-thumb{transform:translateX(.9rem)}
    .perm-api-list{display:flex;flex-direction:column;gap:.6rem}
    .perm-api-group{display:flex;align-items:center;flex-wrap:wrap;gap:.3rem}
    .perm-api-resource{font-size:.75rem;font-weight:600;color:var(--text-muted);min-width:7rem}
    .perm-api-chip{font-size:.72rem;font-weight:500;padding:.15rem .5rem;border-radius:999px;background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 25%,transparent)}
    .perm-manual-row{display:flex;flex-direction:column;gap:.35rem;margin-bottom:.75rem}
    .perm-manual-row label{font-size:.78rem;font-weight:500;color:var(--text)}
    .perm-manual-row textarea{width:100%;padding:.55rem .75rem;font-size:.85rem;line-height:1.5;border:1px solid var(--border);border-radius:.45rem;background:var(--surface);color:var(--text);font-family:inherit;resize:vertical;min-height:2.5rem}
    .perm-manual-row textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
    .perm-cfg-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,.5rem);padding:1rem 1.25rem;margin-bottom:1rem}
    .perm-cfg-head{display:flex;gap:.75rem;align-items:flex-start;margin-bottom:.75rem}
    .perm-cfg-icon{display:flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;border-radius:.5rem;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);flex-shrink:0}
    .perm-cfg-icon i{width:1.1rem;height:1.1rem}
    .perm-cfg-title{font-size:1rem;font-weight:600;margin:0 0 .1rem}
    .perm-cfg-sub{font-size:.8rem;color:var(--text-muted);margin:0}
    .perm-cfg-body{display:flex;flex-direction:column;gap:.4rem}
    .perm-cfg-label{font-size:.78rem;font-weight:500;color:var(--text)}
    .perm-cfg-row{display:flex;gap:.5rem;align-items:center}
    .perm-cfg-row input{flex:1;padding:.5rem .75rem;font-size:.9rem;border:1px solid var(--border);border-radius:.4rem;background:var(--surface);color:var(--text)}
    .perm-cfg-row input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
    .perm-cfg-row input:disabled{background:var(--surface-2,var(--surface2));color:var(--text-muted);cursor:not-allowed}
    .perm-cfg-status{font-size:.8rem;margin:.15rem 0 0;min-height:1.1rem}
    .perm-cfg-current{color:var(--success,#16a34a)}
    .perm-cfg-hint{font-size:.75rem;color:var(--text-muted);margin:.1rem 0 0;line-height:1.4}
  `;
  document.head.appendChild(style);

})();