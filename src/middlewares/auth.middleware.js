const admin     = require('../config/firebase');
const supabase  = require('../config/supabase');
const authCache = require('../services/auth-cache.service');

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    // The token is always verified above. Reuse the cached identity payload (resolved from
    // Supabase) for this uid within the TTL, rebuilding a fresh permisos Set each request.
    const cached = authCache.get(decoded.uid);
    if (cached) {
      req.usuario = {
        uid:        decoded.uid,
        id_usuario: cached.id_usuario,
        email:      cached.email,
        rol:        cached.rol,
        permisos:   new Set(cached.permisos),
      };
      return next();
    }

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

    // Identity is never auto-created: a fresh login with no matching usuarios row (by uid or
    // email) is NOT granted a role. The only ways in are an email match above, or claiming a
    // pre-registered account by documento via POST /api/v1/auth/vincular.
    if (!usuario) {
      return res.status(403).json({
        error: 'Tu cuenta aún no está vinculada. Vincúlala con tu documento o contacta la oficina.',
        code:  'CUENTA_NO_VINCULADA',
      });
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

    const permisosArray = (rolData.rol_permiso ?? []).map(rp =>
      `${rp.permisos.recurso}:${rp.permisos.accion}`
    );
    const permisos = new Set(permisosArray);

    authCache.set(decoded.uid, {
      id_usuario: usuario.id_usuario,
      email:      usuario.email,
      rol:        rolData.nombre,
      permisos:   permisosArray,
    });

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

// Lightweight verifier for routes reachable BEFORE an account is linked (e.g. claiming by
// documento): validates the Firebase token only and never requires a usuarios row.
async function verificarTokenFirebase(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    req.firebaseUser = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

module.exports = { verificarToken, verificarTokenFirebase };
