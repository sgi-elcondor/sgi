const supabase = require('../config/supabase');

// Listar todos los usuarios con su rol
async function listarUsuarios(req, res) {
  const { data, error } = await supabase
    .schema('condor')
    .from('usuarios')
    .select(`
      id_usuario, firebase_uid, email, activo, fecha_creacion,
      roles:id_rol ( id_rol, nombre ),
      comprador:id_comprador ( id_comprador, nombres, apellidos ),
      comisionista:id_comisionista ( id_comisionista, nombres, apellidos )
    `)
    .order('fecha_creacion', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}

// Listar roles disponibles
async function listarRoles(req, res) {
  const { data, error } = await supabase
    .schema('condor')
    .from('roles')
    .select('id_rol, nombre, descripcion')
    .order('id_rol');

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}

// Crear usuario (el admin ya creó la cuenta en Firebase, aquí la vincula)
async function crearUsuario(req, res) {
  const { firebase_uid, email, id_rol, id_comprador, id_comisionista } = req.body;

  if (!firebase_uid || !email || !id_rol) {
    return res.status(400).json({ error: 'firebase_uid, email e id_rol son obligatorios' });
  }

  const { data, error } = await supabase
    .schema('condor')
    .from('usuarios')
    .insert([{ firebase_uid, email, id_rol, id_comprador, id_comisionista }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
}

// Actualizar rol o estado de un usuario
async function actualizarUsuario(req, res) {
  const { id } = req.params;
  const { id_rol, activo, id_comprador, id_comisionista } = req.body;

  const updates = {};
  if (id_rol        !== undefined) updates.id_rol        = id_rol;
  if (activo        !== undefined) updates.activo        = activo;
  if (id_comprador  !== undefined) updates.id_comprador  = id_comprador;
  if (id_comisionista !== undefined) updates.id_comisionista = id_comisionista;

  const { data, error } = await supabase
    .schema('condor')
    .from('usuarios')
    .update(updates)
    .eq('id_usuario', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
}

// Desactivar usuario (nunca se borra)
async function desactivarUsuario(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .schema('condor')
    .from('usuarios')
    .update({ activo: false })
    .eq('id_usuario', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
}

module.exports = {
  listarUsuarios,
  listarRoles,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
};
