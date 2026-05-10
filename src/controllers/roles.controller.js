const supabase          = require('../config/supabase');
const { invalidateCache } = require('../middlewares/auth.middleware');

const VISTA_API_MAP = {
  'dashboard':       ['mi_cuenta:leer'],
  'proyectos-read':  ['proyectos:leer'],
  'proyectos-edit':  ['proyectos:leer', 'proyectos:crear', 'proyectos:actualizar'],
  'lotes-read':      ['lotes:leer'],
  'lotes-edit':      ['lotes:leer', 'lotes:crear', 'lotes:actualizar'],
  'compradores':     ['compradores:leer', 'compradores:crear', 'compradores:actualizar'],
  'ventas':          ['ventas:leer', 'ventas:crear', 'ventas:actualizar', 'ventas:solicitar'],
  'cuotas':          ['cuotas:leer', 'cuotas:crear', 'cuotas:actualizar'],
  'pagos-read':      ['pagos:leer'],
  'pagos-upload':    ['pagos:crear'],
  'pagos-edit':      ['pagos:leer', 'pagos:crear'],
  'comisionistas':   ['comisionistas:leer', 'comisionistas:crear', 'comisionistas:actualizar'],
  'facturas':        ['facturas:leer', 'facturas:crear', 'facturas:actualizar'],
  'recibos':         ['recibos:leer', 'recibos:crear'],
  'reportes':        ['reportes:leer', 'reportes_dir:leer', 'alertas_jur:leer'],
  'alertas':         ['alertas_jur:leer'],
  'auditoria':       [],
  'usuarios':        ['usuarios:leer', 'usuarios:crear', 'usuarios:actualizar'],
  'roles':           ['roles:leer', 'roles:actualizar'],
};

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

    const vistas = (data ?? [])
      .filter(rp => rp.permisos.recurso === 'vista')
      .map(rp => rp.permisos.accion);

    return res.json({ vistas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updatePermisos(req, res) {
  const id     = Number(req.params.id);
  const vistas = Array.isArray(req.body.vistas) ? req.body.vistas : [];

  if (!id) return res.status(400).json({ error: 'ID de rol invalido' });

  try {
    const { data: rolData } = await supabase
      .schema('condor')
      .from('roles')
      .select('nombre')
      .eq('id_rol', id)
      .single();

    if (!rolData) return res.status(404).json({ error: 'Rol no encontrado' });

    const { data: currentData } = await supabase
      .schema('condor')
      .from('rol_permiso')
      .select('permisos:id_permiso(recurso, accion)')
      .eq('id_rol', id);

    const oldVistas = (currentData ?? [])
      .filter(rp => rp.permisos.recurso === 'vista')
      .map(rp => rp.permisos.accion);

    const requiredPermisosSet = new Set();
    vistas.forEach(vista => {
      requiredPermisosSet.add('vista:' + vista);
      (VISTA_API_MAP[vista] ?? []).forEach(p => requiredPermisosSet.add(p));
    });

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
      .map(req => permisoRows.find(p => p.recurso === req.recurso && p.accion === req.accion))
      .filter(Boolean)
      .map(p => p.id_permiso);

    await supabase.schema('condor').from('rol_permiso').delete().eq('id_rol', id);

    if (permisoIds.length) {
      const rows = permisoIds.map(id_permiso => ({ id_rol: id, id_permiso }));
      const { error: insertErr } = await supabase.schema('condor').from('rol_permiso').insert(rows);
      if (insertErr) return res.status(400).json({ error: insertErr.message });
    }

    await supabase.schema('condor').from('auditoria').insert([{
      tabla_afectada: 'rol_permiso',
      operacion:      'UPDATE',
      id_registro:    id,
      campo:          'vistas',
      valor_anterior: JSON.stringify(oldVistas.sort()),
      valor_nuevo:    JSON.stringify([...vistas].sort()),
      usuario:        req.usuario.email,
      fecha_cambio:   new Date().toISOString(),
    }]);

    invalidateCache();

    return res.json({ ok: true, rol: rolData.nombre, vistas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getAll, getPermisos, updatePermisos };
