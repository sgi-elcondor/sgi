const supabase  = require('../config/supabase');
const auditoria = require('../services/auditoria.service');
const authCache = require('../services/auth-cache.service');

// Resource namespaces managed by this controller (via VISTA_API_MAP).
// Permissions in OTHER namespaces (e.g. dashboard:ver_*) are left untouched.
const MANAGED_RESOURCES = new Set();

const VISTA_API_MAP = {
  'dashboard':     ['mi_cuenta:leer', 'dashboard:ver_operacion', 'dashboard:ver_cartera', 'dashboard:ver_comisiones', 'dashboard:ver_juridico'],
  'proyectos':     ['proyectos:leer', 'proyectos:crear', 'proyectos:actualizar'],
  'lotes':         ['lotes:leer', 'lotes:crear', 'lotes:actualizar'],
  'compradores':   ['compradores:leer', 'compradores:crear', 'compradores:actualizar'],
  'ventas':        ['ventas:leer', 'ventas:crear', 'ventas:actualizar', 'ventas:solicitar', 'ventas:editar_financiero'],
  'cuotas':        ['cuotas:leer', 'cuotas:crear', 'cuotas:actualizar', 'cuotas:editar_valores', 'cuotas:eliminar'],
  'pagos':         ['pagos:leer', 'pagos:crear', 'mis_pagos:leer', 'mis_pagos:crear', 'uploads:crear'],
  'comisionistas': ['comisionistas:leer', 'comisionistas:crear', 'comisionistas:actualizar'],
  'facturas':      ['facturas:leer', 'facturas:crear', 'facturas:actualizar'],
  'recibos':       ['recibos:leer', 'recibos:crear'],
  'reportes':      ['reportes:leer', 'reportes_dir:leer', 'alertas_jur:leer'],
  'alertas':       ['alertas_jur:leer'],
  'auditoria':     [],
  'respaldos':     ['respaldos:leer', 'respaldos:restaurar'],
  'usuarios':      ['usuarios:leer', 'usuarios:crear', 'usuarios:actualizar'],
  'roles':         ['roles:leer', 'roles:actualizar'],
  'juridico':      ['ventas:leer', 'compradores:leer', 'cuotas:leer', 'pagos:leer', 'alertas_jur:leer', 'observaciones_jur:leer', 'observaciones_jur:crear'],
  'personal':      ['usuarios:leer', 'compradores:leer', 'comisionistas:leer', 'reportes:leer'],
  'gastos':        ['gastos:leer', 'gastos:crear', 'gastos:actualizar', 'uploads:crear'],
  'recepciones':   ['recepciones:leer', 'recepciones:crear', 'requerimientos:leer', 'uploads:crear'],
  'requerimientos': ['requerimientos:leer', 'requerimientos:crear', 'proyectos:leer'],
  'aprobaciones':   ['requerimientos:leer', 'requerimientos:aprobar_jefe', 'requerimientos:aprobar_final', 'requerimientos:aprobar_dueno', 'requerimientos:aprobar_gerencia'],
  'desembolsos':    ['requerimientos:leer', 'requerimientos:desembolsar', 'uploads:crear'],
  'bank-transactions':  ['bank_transactions:leer', 'bank_transactions:crear', 'bank_transactions:actualizar', 'bank_transactions:eliminar'],
  'payment-validation': ['validacion_pagos:leer', 'validacion_pagos:crear'],
  'mis-cuotas':    ['mis_cuotas:leer'],
  'mis-facturas':  ['mis_facturas:leer'],
  'mis-recibos':   ['mis_recibos:leer'],
  'el-proyecto':   ['proyectos:leer', 'lotes:leer', 'mis_ventas:leer'],
  'mapa-editor':   ['proyectos:leer', 'proyectos:editar_ubicacion', 'lotes:leer', 'lotes:editar_geometria'],
};

// Build the set of managed resource namespaces from VISTA_API_MAP
MANAGED_RESOURCES.add('vista');
Object.values(VISTA_API_MAP).flat().forEach(p => MANAGED_RESOURCES.add(p.split(':')[0]));

async function getAll(req, res) {
  try {
    const { data, error } = await supabase
      .schema('condor')
      .from('roles')
      .select('id_rol, nombre, descripcion, obligaciones')
      .order('id_rol');

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getPermisos(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de rol invalido' });

  try {
    const { data, error } = await supabase
      .schema('condor')
      .from('rol_permiso')
      .select('permisos:id_permiso(recurso, accion)')
      .eq('id_rol', id);

    if (error) return res.status(400).json({ error: error.message });

    const vistas = [];
    const can    = [];
    for (const rp of data ?? []) {
      const { recurso, accion } = rp.permisos;
      if (recurso === 'vista') vistas.push(accion);
      else can.push(`${recurso}:${accion}`);
    }

    return res.json({ vistas, can });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updatePermisos(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de rol invalido' });

  // Supports two formats:
  // Granular (new): { vistas: ['pagos','ventas'], can: ['pagos:leer','ventas:leer','ventas:actualizar'] }
  // Legacy (old):   { vistas: ['pagos','ventas'] }  → derives can from VISTA_API_MAP
  const vistas  = Array.isArray(req.body.vistas) ? req.body.vistas : [];
  const canList = Array.isArray(req.body.can)    ? req.body.can    : null;

  try {
    const { data: rolData } = await supabase
      .schema('condor').from('roles').select('nombre').eq('id_rol', id).single();

    if (!rolData) return res.status(404).json({ error: 'Rol no encontrado' });

    const { data: currentData } = await supabase
      .schema('condor').from('rol_permiso')
      .select('id_permiso, permisos:id_permiso(recurso, accion)').eq('id_rol', id);

    const oldVistas = (currentData ?? [])
      .filter(rp => rp.permisos.recurso === 'vista').map(rp => rp.permisos.accion);

    const idsToDelete = (currentData ?? [])
      .filter(rp => MANAGED_RESOURCES.has(rp.permisos.recurso)).map(rp => rp.id_permiso);

    if (idsToDelete.length) {
      await supabase.schema('condor').from('rol_permiso')
        .delete().eq('id_rol', id).in('id_permiso', idsToDelete);
    }

    // Build the complete permission set to insert
    const requiredPermisosSet = new Set();

    // Always add vista:* for enabled modules
    vistas.forEach(v => requiredPermisosSet.add(`vista:${v}`));

    if (canList !== null) {
      // Granular format: use the exact can list provided by the UI
      canList.forEach(p => requiredPermisosSet.add(p));
    } else {
      // Legacy format: derive API permissions from VISTA_API_MAP
      vistas.forEach(v => (VISTA_API_MAP[v] ?? []).forEach(p => requiredPermisosSet.add(p)));
    }

    const requiredList = [...requiredPermisosSet].map(p => {
      const colonIdx = p.indexOf(':');
      return { recurso: p.slice(0, colonIdx), accion: p.slice(colonIdx + 1) };
    });

    const { data: permisoRows, error: permErr } = await supabase
      .schema('condor')
      .from('permisos')
      .select('id_permiso, recurso, accion');

    if (permErr) return res.status(400).json({ error: permErr.message });

    const permisoIds = requiredList
      .map(r => permisoRows.find(p => p.recurso === r.recurso && p.accion === r.accion))
      .filter(Boolean)
      .map(p => p.id_permiso);

    if (permisoIds.length) {
      const rows = permisoIds.map(id_permiso => ({ id_rol: id, id_permiso }));
      const { error: insertErr } = await supabase.schema('condor').from('rol_permiso').insert(rows);
      if (insertErr) return res.status(400).json({ error: insertErr.message });
    }

    await auditoria.log({
      tabla:    'rol_permiso',
      id:       id,
      campo:    'vistas',
      anterior: JSON.stringify(oldVistas.sort()),
      nuevo:    JSON.stringify([...vistas].sort()),
      usuario:  req.usuario.email,
      motivo:   'gestion_permisos',
    });

    // Permissions changed for this role — drop cached identity payloads so users on this role
    // pick up the new permissions on their next request instead of waiting for the TTL.
    authCache.clear();

    return res.json({ ok: true, rol: rolData.nombre, vistas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Admin-only: edit a rol's manual (descripcion + obligaciones). Audited.
// Returns 204 No Content on success. Cache cleared so users see the new text on next request.
async function updateManual(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de rol invalido' });

  const { descripcion, obligaciones } = req.body || {};
  if (descripcion === undefined && obligaciones === undefined) {
    return res.status(400).json({ error: 'Debes enviar descripcion u obligaciones' });
  }

  try {
    const { data: actual, error: eRead } = await supabase
      .schema('condor').from('roles')
      .select('nombre, descripcion, obligaciones').eq('id_rol', id).single();
    if (eRead || !actual) return res.status(404).json({ error: 'Rol no encontrado' });

    const updates = {};
    if (descripcion !== undefined)  updates.descripcion  = descripcion;
    if (obligaciones !== undefined) updates.obligaciones = obligaciones;

    const { error: eUpd } = await supabase
      .schema('condor').from('roles')
      .update(updates).eq('id_rol', id);
    if (eUpd) return res.status(400).json({ error: eUpd.message });

    const auditRows = [];
    if (descripcion !== undefined && descripcion !== actual.descripcion) {
      auditRows.push({
        tabla_afectada: 'roles',
        id_registro:    id,
        campo:          'descripcion',
        valor_anterior: actual.descripcion || null,
        valor_nuevo:    descripcion || null,
        usuario_db:     req.usuario.email,
        motivo:         'edicion_manual_rol',
      });
    }
    if (obligaciones !== undefined && obligaciones !== actual.obligaciones) {
      auditRows.push({
        tabla_afectada: 'roles',
        id_registro:    id,
        campo:          'obligaciones',
        valor_anterior: actual.obligaciones || null,
        valor_nuevo:    obligaciones || null,
        usuario_db:     req.usuario.email,
        motivo:         'edicion_manual_rol',
      });
    }
    if (auditRows.length) {
      await supabase.schema('condor').from('auditoria').insert(auditRows);
    }

    authCache.clear();
    return res.json({ ok: true, rol: actual.nombre });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getAll, getPermisos, updatePermisos, updateManual };
