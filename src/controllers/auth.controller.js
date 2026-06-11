const supabase = require('../config/supabase');
const admin    = require('../config/firebase');
const { sendPasswordResetEmail } = require('../services/email.service');
const SCHEMA   = 'condor';

async function registrarUsuario(req, res) {
  const { email, id_rol } = req.body;

  const ROLES_CON_ACCESO = ['admin', 'auxiliar_contable'];
  if (!ROLES_CON_ACCESO.includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Solo un administrador puede registrar usuarios' });
  }

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('usuarios')
    .insert([{ email, id_rol }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
}

async function miPerfil(req, res) {
  const { email, rol, id_usuario, permisos } = req.usuario;

  const vistas = [];
  const can    = [];
  for (const p of permisos) {
    if (p.startsWith('vista:')) vistas.push(p.slice(6));
    else can.push(p);
  }

  const { data: uData } = await supabase.schema(SCHEMA).from('usuarios')
    .select('photo_url, nombres, apellidos, telefono, documento, tipo_documento, tipo_persona')
    .eq('id_usuario', id_usuario)
    .single();

  return res.json({
    email,
    rol,
    id_usuario,
    vistas,
    can,
    photo_url:      uData?.photo_url      ?? null,
    nombres:        uData?.nombres        ?? null,
    apellidos:      uData?.apellidos      ?? null,
    telefono:       uData?.telefono       ?? null,
    documento:      uData?.documento      ?? null,
    tipo_documento: uData?.tipo_documento ?? null,
    tipo_persona:   uData?.tipo_persona   ?? null,
  });
}

async function completarPerfil(req, res) {
  const { id_usuario } = req.usuario;
  const { documento, nombres, apellidos, telefono, tipo_documento, tipo_persona } = req.body;

  if (!documento || !nombres || !apellidos) {
    return res.status(400).json({ error: 'Documento, nombres y apellidos son obligatorios' });
  }

  const { data: existente } = await supabase.schema(SCHEMA).from('usuarios')
    .select('id_usuario')
    .eq('documento', documento)
    .neq('id_usuario', id_usuario)
    .maybeSingle();

  if (existente) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese documento de identidad' });
  }

  const { error } = await supabase.schema(SCHEMA).from('usuarios')
    .update({
      documento,
      nombres,
      apellidos,
      telefono:       telefono       || null,
      tipo_documento: tipo_documento || null,
      tipo_persona:   tipo_persona   || 'natural',
    })
    .eq('id_usuario', id_usuario);

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ ok: true });
}

async function actualizarMiPerfil(req, res) {
  const { id_usuario } = req.usuario;
  const { nombres, apellidos, telefono, photo_url } = req.body;

  if (!nombres || !apellidos) {
    return res.status(400).json({ error: 'Nombres y apellidos son obligatorios' });
  }

  const updates = { nombres, apellidos, telefono: telefono || null };
  if (photo_url !== undefined) updates.photo_url = photo_url || null;

  try {
    const { error } = await supabase.schema(SCHEMA).from('usuarios')
      .update(updates)
      .eq('id_usuario', id_usuario);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function actualizarAvatar(req, res) {
  const { id_usuario } = req.usuario;
  const { photo_url }  = req.body;

  try {
    const { error } = await supabase.schema(SCHEMA).from('usuarios')
      .update({ photo_url: photo_url || null })
      .eq('id_usuario', id_usuario);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function enviarEmailReset(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'El correo es requerido.' });

  try {
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    await sendPasswordResetEmail(email, resetLink);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'auth/user-not-found') return res.json({ ok: true });
    console.error('[reset-password-email]', err.code, err.message);
    res.status(500).json({ error: 'No se pudo enviar el correo. Intenta de nuevo.' });
  }
}

module.exports = { registrarUsuario, miPerfil, completarPerfil, actualizarMiPerfil, actualizarAvatar, enviarEmailReset };
