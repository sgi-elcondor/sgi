const admin    = require('../config/firebase');
const supabase = require('../config/supabase');

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    let { data: usuario, error } = await supabase
      .schema('condor')
      .from('usuarios')
      .select('id_usuario, email, activo, id_rol')
      .eq('firebase_uid', decoded.uid)
      .single();

    if (error?.code === 'PGRST116' || !usuario) {
      const { data: byEmail } = await supabase
        .schema('condor')
        .from('usuarios')
        .select('id_usuario, email, activo, id_rol')
        .eq('email', decoded.email)
        .single();

      if (byEmail) {
        await supabase
          .schema('condor')
          .from('usuarios')
          .update({ firebase_uid: decoded.uid })
          .eq('id_usuario', byEmail.id_usuario);
        usuario = byEmail;
      }
    }

    if (!usuario) {
      const { data: rolDefault, error: rolError } = await supabase
        .schema('condor')
        .from('roles')
        .select('id_rol')
        .eq('nombre', 'usuario')
        .single();

      if (rolError || !rolDefault) {
        return res.status(403).json({ error: 'No se pudo asignar rol por defecto' });
      }

      const { data: nuevo, error: errInsert } = await supabase
        .schema('condor')
        .from('usuarios')
        .insert([{
          firebase_uid: decoded.uid,
          email:        decoded.email,
          id_rol:       rolDefault.id_rol,
        }])
        .select('id_usuario, email, activo, id_rol')
        .single();

      if (errInsert || !nuevo) {
        return res.status(500).json({ error: 'Error al registrar usuario: ' + errInsert?.message });
      }

      usuario = nuevo;
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Usuario inactivo. Contacta al administrador.' });
    }

    if (!usuario.id_rol) {
      return res.status(403).json({ error: 'Usuario sin rol asignado. Contacta al administrador.' });
    }

    const { data: rolData, error: rolError } = await supabase
      .schema('condor')
      .from('roles')
      .select(`
        nombre,
        rol_permiso (
          permisos:id_permiso ( recurso, accion )
        )
      `)
      .eq('id_rol', usuario.id_rol)
      .single();

    if (rolError || !rolData) {
      return res.status(403).json({ error: 'No se pudo cargar el rol del usuario.' });
    }

    // Self-registered visitors must verify their email before accessing anything.
    // Staff roles are unaffected; only the 'usuario' role is gated.
    if (rolData.nombre === 'usuario' && decoded.email_verified !== true) {
      return res.status(403).json({
        error: 'Debes verificar tu correo electrónico para acceder.',
        code:  'EMAIL_NOT_VERIFIED',
      });
    }

    const permisos = new Set(
      (rolData.rol_permiso ?? []).map(rp =>
        `${rp.permisos.recurso}:${rp.permisos.accion}`
      )
    );

    req.usuario = {
      uid:        decoded.uid,
      id_usuario: usuario.id_usuario,
      email:      usuario.email,
      rol:        rolData.nombre,
      permisos,
    };

    next();

  } catch (err) {
    console.error('[middleware] Error verificando token:', err.message);
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

module.exports = { verificarToken };
