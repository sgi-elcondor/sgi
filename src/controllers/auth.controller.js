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

// Hybrid identity link: an authenticated person whose login email does NOT match the email the
// team pre-registered claims their account by documento. The match is by the legally-unique
// (tipo_documento, documento), so the email used to sign in is irrelevant. The claim is an
// atomic guarded UPDATE (firebase_uid IS NULL) so it can only ever succeed once.
async function vincularCuenta(req, res) {
  const { uid, email } = req.firebaseUser || {};
  if (!uid) return res.status(401).json({ error: 'No autenticado' });

  const { documento, tipo_documento } = req.body;
  if (!documento) return res.status(400).json({ error: 'El documento es obligatorio' });

  // Already linked to this login? Idempotent success.
  const { data: yaLink } = await supabase.schema(SCHEMA).from('usuarios')
    .select('id_usuario').eq('firebase_uid', uid).maybeSingle();
  if (yaLink) return res.json({ ok: true, already: true });

  let q = supabase.schema(SCHEMA).from('usuarios')
    .select('id_usuario, firebase_uid, activo').eq('documento', documento);
  if (tipo_documento) q = q.eq('tipo_documento', tipo_documento);
  const { data: matches } = await q;
  const row = (matches || [])[0];

  if (!row)              return res.status(404).json({ error: 'No encontramos ninguna cuenta con ese documento. Contacta la oficina.', code: 'DOC_NO_ENCONTRADO' });
  if (row.firebase_uid)  return res.status(409).json({ error: 'Esa cuenta ya fue vinculada a otro acceso. Contacta la oficina.', code: 'DOC_YA_VINCULADO' });
  if (!row.activo)       return res.status(403).json({ error: 'La cuenta está inactiva. Contacta la oficina.' });

  // Per decision: adopt the login email — but only if no other row already uses it, to respect
  // the email uniqueness invariant; otherwise keep the registered email and link the uid only.
  let emailTaken = null;
  if (email) {
    const { data } = await supabase.schema(SCHEMA).from('usuarios')
      .select('id_usuario').ilike('email', email).neq('id_usuario', row.id_usuario).maybeSingle();
    emailTaken = data;
  }
  const payload = (email && !emailTaken) ? { firebase_uid: uid, email } : { firebase_uid: uid };

  const { data: updated, error } = await supabase.schema(SCHEMA).from('usuarios')
    .update(payload)
    .eq('id_usuario', row.id_usuario)
    .is('firebase_uid', null)
    .select('id_usuario')
    .single();
  if (error || !updated) {
    return res.status(409).json({ error: 'No se pudo vincular (intento simultáneo). Reintenta.', code: 'CLAIM_RACE' });
  }

  await supabase.schema(SCHEMA).from('auditoria').insert([{
    tabla_afectada: 'usuarios',
    id_registro:    row.id_usuario,
    campo:          'firebase_uid',
    valor_anterior: null,
    valor_nuevo:    uid,
    usuario_db:     email || uid,
    fecha_cambio:   new Date().toISOString(),
    motivo:         'vinculacion_cuenta_por_documento',
  }]);

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

// Returns the manual of the authenticated user's role: descripcion, obligaciones and the list
// of permissions actually granted to that role (with their human description). Admin role gets
// a synthetic 'acceso total' response because it bypasses rol_permiso.
async function miRol(req, res) {
  const { rol, id_usuario } = req.usuario;

  const { data: usuario } = await supabase.schema(SCHEMA)
    .from('usuarios').select('id_rol').eq('id_usuario', id_usuario).single();
  const id_rol = usuario?.id_rol;
  if (!id_rol) return res.status(404).json({ error: 'Tu cuenta no tiene un rol asignado.' });

  const { data: rolRow, error: eRol } = await supabase.schema(SCHEMA)
    .from('roles').select('id_rol, nombre, descripcion, obligaciones').eq('id_rol', id_rol).single();
  if (eRol || !rolRow) return res.status(404).json({ error: 'Rol no encontrado.' });

  if (rolRow.nombre === 'admin') {
    return res.json({
      nombre:       rolRow.nombre,
      descripcion:  rolRow.descripcion,
      obligaciones: rolRow.obligaciones,
      acceso_total: true,
      acciones:     [],
    });
  }

  const { data: links } = await supabase.schema(SCHEMA)
    .from('rol_permiso')
    .select('permisos:id_permiso(recurso, accion, descripcion)')
    .eq('id_rol', id_rol);

  const acciones = (links || [])
    .map(l => l.permisos)
    .filter(Boolean)
    .filter(p => p.recurso !== 'vista')
    .map(p => ({
      recurso:     p.recurso,
      accion:      p.accion,
      descripcion: p.descripcion || `${p.recurso}:${p.accion}`,
    }))
    .sort((a, b) => (a.recurso === b.recurso
      ? a.accion.localeCompare(b.accion)
      : a.recurso.localeCompare(b.recurso)));

  res.json({
    nombre:       rolRow.nombre,
    descripcion:  rolRow.descripcion,
    obligaciones: rolRow.obligaciones,
    acceso_total: false,
    acciones,
  });
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

module.exports = { registrarUsuario, miPerfil, miRol, completarPerfil, actualizarMiPerfil, actualizarAvatar, enviarEmailReset, vincularCuenta };
