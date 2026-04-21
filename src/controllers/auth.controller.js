const supabase = require('../config/supabase');

// Registro: vincula Firebase UID con un rol en Supabase
// Solo un admin debería poder crear usuarios con rol específico
async function registrarUsuario(req, res) {
  const { firebase_uid, email, id_rol, id_comprador, id_comisionista } = req.body;

  // Solo admins pueden registrar usuarios
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede registrar usuarios' });
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

// Perfil del usuario autenticado
async function miPerfil(req, res) {
  return res.json({
    email:           req.usuario.email,
    rol:             req.usuario.rol,
    id_comprador:    req.usuario.id_comprador,
    id_comisionista: req.usuario.id_comisionista,
    permisos:        [...req.usuario.permisos],
  });
}

module.exports = { registrarUsuario, miPerfil };
