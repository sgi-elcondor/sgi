const supabase  = require('../config/supabase');
const authCache = require('../services/auth-cache.service');
const SCHEMA    = 'condor';

async function listarUsuarios(req, res) {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('usuarios')
    .select(`
      id_usuario, firebase_uid, email, activo, fecha_creacion, photo_url,
      nombres, apellidos, documento, tipo_persona, tipo_documento, telefono,
      intentos_fallidos, bloqueado_hasta,
      roles:id_rol ( id_rol, nombre )
    `)
    .order('fecha_creacion', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}

async function listarRoles(req, res) {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('roles')
    .select('id_rol, nombre, descripcion')
    .order('id_rol');

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}

async function crearUsuario(req, res) {
  const { email, id_rol, nombres, apellidos, documento, tipo_persona, tipo_documento, telefono } = req.body;

  if (!email || !id_rol) {
    return res.status(400).json({ error: 'email e id_rol son obligatorios' });
  }

  const { data: rolData, error: rolError } = await supabase
    .schema(SCHEMA)
    .from('roles')
    .select('nombre')
    .eq('id_rol', id_rol)
    .single();

  if (rolError || !rolData) {
    return res.status(400).json({ error: 'Rol no encontrado' });
  }

  const rolNombre = rolData.nombre;

  // Only an admin can create an admin account (prevents privilege escalation by a non-admin who
  // was granted the "usuarios" view).
  if (rolNombre === 'admin' && req.usuario?.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede asignar el rol admin' });
  }

  const esPersona = rolNombre === 'comprador' || rolNombre === 'comisionista';

  if (esPersona && (!nombres || !apellidos || !documento)) {
    return res.status(400).json({ error: 'Para compradores y comisionistas: nombres, apellidos y documento son obligatorios' });
  }

  if (documento) {
    const { data: dupDoc } = await supabase
      .schema(SCHEMA).from('usuarios').select('id_usuario').eq('documento', documento).limit(1);
    if (dupDoc?.length) return res.status(409).json({ error: 'Ya existe un usuario con ese documento' });
  }

  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('usuarios')
      .insert([{
        email,
        id_rol,
        nombres:        nombres        || null,
        apellidos:      apellidos      || null,
        documento:      documento      || null,
        tipo_persona:   tipo_persona   || 'natural',
        tipo_documento: tipo_documento || null,
        telefono:       telefono       || null,
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function actualizarUsuario(req, res) {
  const targetId = Number(req.params.id);
  const { id_rol, activo, nombres, apellidos, documento, tipo_persona, tipo_documento, telefono } = req.body;

  const { data: actual, error: eRead } = await supabase
    .schema(SCHEMA).from('usuarios')
    .select('id_usuario, id_rol, activo, roles:id_rol(nombre)')
    .eq('id_usuario', targetId)
    .single();
  if (eRead || !actual) return res.status(404).json({ error: 'Usuario no encontrado' });

  const cambiaRol = id_rol !== undefined && Number(id_rol) !== Number(actual.id_rol);

  if (cambiaRol) {
    const { data: nuevoRol } = await supabase
      .schema(SCHEMA).from('roles').select('nombre').eq('id_rol', id_rol).single();
    if (!nuevoRol) return res.status(400).json({ error: 'Rol no encontrado' });
    // Only an admin can grant the admin role.
    if (nuevoRol.nombre === 'admin' && req.usuario?.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo un administrador puede asignar el rol admin' });
    }
    // No self role change — blocks privilege self-escalation.
    if (targetId === req.usuario?.id_usuario) {
      return res.status(403).json({ error: 'No puedes cambiar tu propio rol' });
    }
  }

  // No self-deactivation (avoids locking yourself out / removing the last active admin by accident).
  if (activo === false && targetId === req.usuario?.id_usuario) {
    return res.status(403).json({ error: 'No puedes desactivar tu propia cuenta' });
  }

  const updates = {};
  if (id_rol         !== undefined) updates.id_rol         = id_rol;
  if (activo         !== undefined) updates.activo         = activo;
  if (nombres        !== undefined) updates.nombres        = nombres;
  if (apellidos      !== undefined) updates.apellidos      = apellidos;
  if (documento      !== undefined) updates.documento      = documento;
  if (tipo_persona   !== undefined) updates.tipo_persona   = tipo_persona;
  if (tipo_documento !== undefined) updates.tipo_documento = tipo_documento;
  if (telefono       !== undefined) updates.telefono       = telefono || null;

  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('usuarios')
      .update(updates)
      .eq('id_usuario', targetId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Audit the sensitive changes (role / active flag) — mandatory per project policy.
    const auditRows = [];
    const now = new Date().toISOString();
    if (cambiaRol) {
      auditRows.push({
        tabla_afectada: 'usuarios', id_registro: targetId, campo: 'id_rol',
        valor_anterior: actual.roles?.nombre ?? (actual.id_rol != null ? String(actual.id_rol) : null),
        valor_nuevo:    String(id_rol),
        usuario_db:     req.usuario?.email || 'sistema', fecha_cambio: now, motivo: 'cambio_rol_usuario',
      });
    }
    if (activo !== undefined && activo !== actual.activo) {
      auditRows.push({
        tabla_afectada: 'usuarios', id_registro: targetId, campo: 'activo',
        valor_anterior: String(actual.activo), valor_nuevo: String(activo),
        usuario_db:     req.usuario?.email || 'sistema', fecha_cambio: now,
        motivo:         activo ? 'reactivacion_usuario' : 'desactivacion_usuario',
      });
    }
    if (auditRows.length) await supabase.schema(SCHEMA).from('auditoria').insert(auditRows);

    // Role or active flag may have changed — drop cached identity payloads so the change takes
    // effect on the next request instead of waiting for the TTL.
    authCache.clear();

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function desactivarUsuario(req, res) {
  const targetId = Number(req.params.id);

  // No self-deactivation.
  if (targetId === req.usuario?.id_usuario) {
    return res.status(403).json({ error: 'No puedes desactivar tu propia cuenta' });
  }

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('usuarios')
    .update({ activo: false })
    .eq('id_usuario', targetId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Deactivated user must lose access immediately, not after the TTL.
  authCache.clear();

  await supabase.schema(SCHEMA).from('auditoria').insert([{
    tabla_afectada: 'usuarios', id_registro: targetId, campo: 'activo',
    valor_anterior: 'true', valor_nuevo: 'false',
    usuario_db:     req.usuario?.email || 'sistema',
    fecha_cambio:   new Date().toISOString(),
    motivo:         'desactivacion_usuario',
  }]);

  return res.json(data);
}

async function desbloquearUsuario(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('usuarios')
    .update({ intentos_fallidos: 0, bloqueado_hasta: null })
    .eq('id_usuario', id)
    .select('id_usuario, email')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  authCache.clear();

  await supabase.schema(SCHEMA).from('auditoria').insert([{
    tabla_afectada: 'usuarios',
    id_registro:    id,
    campo:          'bloqueado_hasta',
    valor_anterior: null,
    valor_nuevo:    null,
    usuario_db:     req.usuario?.email || 'admin',
    fecha_cambio:   new Date().toISOString(),
    motivo:         'desbloqueo_manual',
  }]);

  return res.json({ ok: true, email: data.email });
}

module.exports = { listarUsuarios, listarRoles, crearUsuario, actualizarUsuario, desactivarUsuario, desbloquearUsuario };
