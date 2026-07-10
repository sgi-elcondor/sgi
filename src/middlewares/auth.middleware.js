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
      // The email-verification gate below also applies to cached identities.
      if (cached.rol === 'usuario' && decoded.email_verified !== true) {
        return res.status(403).json({
          error: 'Debes verificar tu correo electrónico para acceder.',
          code:  'EMAIL_NOT_VERIFIED',
        });
      }
      req.usuario = {
        uid:        decoded.uid,
        id_usuario: cached.id_usuario,
        email:      cached.email,
        rol:        cached.rol,
        permisos:   new Set(cached.permisos),
      };
      return next();
    }

    // SEG-04 (session lifetime): only checked on a cache miss (at most once per uid per
    // authCache TTL) so the forced-relogin cycle doesn't add a Firebase Admin round trip to
    // every single request. `auth_time` is the standard ID token claim for "when this user
    // last authenticated"; session-revocation.service.js advances tokensValidAfterTime by
    // calling revokeRefreshTokens roughly every 30 days.
    const userRecord = await admin.auth().getUser(decoded.uid);
    const validSince  = userRecord.tokensValidAfterTime
      ? new Date(userRecord.tokensValidAfterTime).getTime() / 1000
      : 0;
    if (decoded.auth_time < validSince) {
      return res.status(401).json({
        error: 'Tu sesión expiró por seguridad. Vuelve a iniciar sesión.',
        code:  'SESION_REVOCADA',
      });
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

    // First-time self-signup: provision a usuarios row with the default 'usuario' role
    // (catalog-only, no portal yet). A real venta later promotes them to 'comprador' (RN-23).
    // Concurrent inserts can race, so on insert failure we re-fetch by firebase_uid and use
    // whichever row won.
    if (!usuario) {
      const { data: rolDefault } = await supabase
        .schema('condor')
        .from('roles')
        .select('id_rol')
        .eq('nombre', 'usuario')
        .single();

      if (!rolDefault) {
        return res.status(403).json({
          error: 'Rol por defecto "usuario" no configurado. Contacta al administrador.',
          code:  'ROL_DEFAULT_NO_CONFIGURADO',
        });
      }

      const displayName = (decoded.name || '').trim();
      const firstSpace  = displayName.indexOf(' ');
      const nombres     = firstSpace > 0 ? displayName.slice(0, firstSpace) : (displayName || null);
      const apellidos   = firstSpace > 0 ? displayName.slice(firstSpace + 1) : null;

      const { data: created, error: eCreate } = await supabase
        .schema('condor')
        .from('usuarios')
        .insert([{
          firebase_uid: decoded.uid,
          email:        decoded.email,
          id_rol:       rolDefault.id_rol,
          activo:       true,
          tipo_persona: 'natural',
          nombres,
          apellidos,
          photo_url:    decoded.picture || null,
        }])
        .select('id_usuario, email, activo, id_rol')
        .single();

      if (eCreate) {
        const { data: refetched } = await supabase
          .schema('condor')
          .from('usuarios')
          .select('id_usuario, email, activo, id_rol')
          .eq('firebase_uid', decoded.uid)
          .single();
        if (!refetched) {
          return res.status(403).json({
            error: 'No se pudo crear tu cuenta. Contacta a la oficina.',
            code:  'AUTOCREACION_FALLA',
          });
        }
        usuario = refetched;
      } else {
        usuario = created;
      }
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
