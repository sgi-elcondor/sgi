const supabase  = require('../config/supabase');
const auditoria = require('../services/auditoria.service');

// Resource namespaces managed by this controller (via VISTA_API_MAP).
// Permissions in OTHER namespaces (e.g. dashboard:ver_*) are left untouched.
const MANAGED_RESOURCES = new Set();

const VISTA_API_MAP = {
  'dashboard':     ['mi_cuenta:leer'],
  'proyectos':     ['proyectos:leer', 'proyectos:crear', 'proyectos:actualizar'],
  'lotes':         ['lotes:leer', 'lotes:crear', 'lotes:actualizar'],
  'compradores':   ['compradores:leer', 'compradores:crear', 'compradores:actualizar'],
  'ventas':        ['ventas:leer', 'ventas:crear', 'ventas:actualizar', 'ventas:solicitar', 'ventas:editar_financiero'],
  'cuotas':        ['cuotas:leer', 'cuotas:crear', 'cuotas:actualizar', 'cuotas:editar_valores'],
  'pagos':         ['pagos:leer', 'pagos:crear', 'mis_pagos:leer', 'mis_pagos:crear', 'uploads:crear'],
  'comisionistas': ['comisionistas:leer', 'comisionistas:crear', 'comisionistas:actualizar'],
  'facturas':      ['facturas:leer', 'facturas:crear', 'facturas:actualizar'],
  'recibos':       ['recibos:leer', 'recibos:crear'],
  'reportes':      ['reportes:leer', 'reportes_dir:leer', 'alertas_jur:leer'],
  'alertas':       ['alertas_jur:leer'],
  'auditoria':     [],
  'usuarios':      ['usuarios:leer', 'usuarios:crear', 'usuarios:actualizar'],
  'roles':         ['roles:leer', 'roles:actualizar'],
  'juridico':      ['ventas:leer', 'compradores:leer', 'cuotas:leer', 'pagos:leer', 'alertas_jur:leer', 'observaciones_jur:leer', 'observaciones_jur:crear'],
  'personal':      ['usuarios:leer', 'compradores:leer', 'comisionistas:leer', 'reportes:leer'],
  'gastos':        ['gastos:leer', 'gastos:crear', 'gastos:actualizar', 'uploads:crear'],
  'bank-transactions':  ['bank_transactions:leer', 'bank_transactions:crear', 'bank_transactions:actualizar', 'bank_transactions:eliminar'],
  'payment-validation': ['validacion_pagos:leer', 'validacion_pagos:crear'],
  'mis-cuotas':    ['mis_cuotas:leer'],
  'mis-recibos':   ['mis_recibos:leer'],
};

// Build the set of managed resource namespaces from VISTA_API_MAP
MANAGED_RESOURCES.add('vista');
Object.values(VISTA_API_MAP).flat().forEach(p => MANAGED_RESOURCES.add(p.split(':')[0]));

async function getAll(req, res) {
  try {
    const { data, error } = await supabase
      .schema('condor')
      .from('roles')
      .select('id_rol, nombre, descripcion')
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

    return res.json({ ok: true, rol: rolData.nombre, vistas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getAll, getPermisos, updatePermisos };
