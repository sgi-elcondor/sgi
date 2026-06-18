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
  const { id } = req.params;
  const { id_rol, activo, nombres, apellidos, documento, tipo_persona, tipo_documento, telefono } = req.body;

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
      .eq('id_usuario', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Role or active flag may have changed — drop cached identity payloads so the change takes
    // effect on the next request instead of waiting for the TTL.
    authCache.clear();

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function desactivarUsuario(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('usuarios')
    .update({ activo: false })
    .eq('id_usuario', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Deactivated user must lose access immediately, not after the TTL.
  authCache.clear();

  return res.json(data);
}

module.exports = { listarUsuarios, listarRoles, crearUsuario, actualizarUsuario, desactivarUsuario };
