const supabase   = require('../config/supabase');
const admin      = require('../config/firebase');
const twoFactor   = require('../services/two-factor.service');
const auditoria   = require('../services/auditoria.service');
const loginAlert  = require('../services/login-alert.service');
const { sendPasswordResetEmail, sendLogin2FACodigo, sendNuevoLoginEmail } = require('../services/email.service');
const SCHEMA   = 'condor';

// SEG-05: best-effort "new login" notice. Never throws — a failed alert must never block a
// successful login. Silent on the very first login ever (nothing to compare the IP against).
async function avisarNuevoLoginSiAplica(id_usuario, email, req) {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
    const { esNuevaIp } = await loginAlert.registrarLogin(id_usuario, ip);
    if (esNuevaIp) {
      const fecha = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' });
      await sendNuevoLoginEmail(email, { ip, fecha, userAgent: req.headers['user-agent'] });
    }
  } catch (e) {
    console.error('[login] aviso nuevo login', e.message);
  }
}

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

const MAX_INTENTOS    = 5;
const BLOQUEO_MINUTOS = 30;

const MAX_FALLOS_2FA_CUENTA = 10; // wrong codes across ANY challenges before locking the account
const BLOQUEO_MINUTOS_2FA   = 30;

// Server-side password login. The password is verified against Firebase from the backend, so the
// failed-attempt count and the lockout are AUTHORITATIVE — the browser can no longer self-report
// (nor reset) attempts. This closes the previous design where login-failed/login-success were
// public: anyone could lock any account out (DoS) or reset a victim's counter, and the lockout
// itself was only advisory because the real auth happened client-side.
//
// On success we mint a Firebase custom token so the web client opens a normal Firebase session
// (token refresh keeps working via the client SDK). Google sign-in stays federated and untouched.
async function login(req, res) {
  const email    = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  }
  if (!process.env.FIREBASE_API_KEY) {
    console.error('[login] FIREBASE_API_KEY no configurada');
    return res.status(500).json({ error: 'Autenticación no disponible. Contacta a la oficina.' });
  }

  const { data: row } = await supabase.schema(SCHEMA).from('usuarios')
    .select('id_usuario, intentos_fallidos, bloqueado_hasta, dosfa_bloqueado_hasta, dosfa_configurado_en, roles:id_rol(requiere_2fa)')
    .ilike('email', email)
    .maybeSingle();

  // Enforced server-side at the authentication boundary: a locked account cannot obtain a new
  // session until the window passes. (Existing sessions are intentionally NOT killed, so a
  // lockout can't be weaponized to log an active user out.)
  if (row?.bloqueado_hasta && new Date(row.bloqueado_hasta) > new Date()) {
    return res.status(423).json({
      error:           'Demasiados intentos fallidos. Intenta de nuevo en 30 minutos.',
      code:            'CUENTA_BLOQUEADA',
      bloqueado_hasta: row.bloqueado_hasta,
    });
  }

  // Verify the password with Firebase Identity Toolkit from the server.
  let fbData = null;
  let fbErr  = null;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    fbData = await resp.json().catch(() => ({}));
    if (!resp.ok) fbErr = fbData?.error?.message || 'AUTH_FAILED';
  } catch (e) {
    fbErr = 'NETWORK';
  }

  if (fbErr) {
    if (String(fbErr).includes('USER_DISABLED')) {
      return res.status(403).json({ error: 'La cuenta está inactiva. Contacta la oficina.' });
    }
    const credencialInvalida = ['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND', 'INVALID_EMAIL', 'MISSING_PASSWORD']
      .some(c => String(fbErr).includes(c));

    // Only a real credential failure against a KNOWN account increments the counter, so an
    // unknown email can neither be enumerated nor used to amplify a lockout DoS.
    if (row && credencialInvalida) {
      const intentos = (row.intentos_fallidos || 0) + 1;
      const updates  = { intentos_fallidos: intentos };
      if (intentos >= MAX_INTENTOS) {
        updates.bloqueado_hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000).toISOString();
      }
      await supabase.schema(SCHEMA).from('usuarios')
        .update(updates).eq('id_usuario', row.id_usuario);

      if (updates.bloqueado_hasta) {
        return res.status(423).json({
          error:           'Demasiados intentos fallidos. Intenta de nuevo en 30 minutos.',
          code:            'CUENTA_BLOQUEADA',
          bloqueado_hasta: updates.bloqueado_hasta,
        });
      }
      return res.status(401).json({
        error:              'Correo o contraseña incorrectos.',
        intentos_restantes: MAX_INTENTOS - intentos,
      });
    }

    if (!credencialInvalida) {
      // Network / config / rate-limit error from Firebase — not the user's credentials.
      return res.status(502).json({ error: 'No se pudo validar el acceso. Intenta de nuevo.' });
    }
    // Unknown account: generic response, no counter side effects (anti-enumeration).
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  // Success (password proven): reset the counter authoritatively.
  if (row && (row.intentos_fallidos || row.bloqueado_hasta)) {
    await supabase.schema(SCHEMA).from('usuarios')
      .update({ intentos_fallidos: 0, bloqueado_hasta: null }).eq('id_usuario', row.id_usuario);
  }

  // SEG-04: sensitive roles (admin, auxiliar_contable, gerencia) need a second factor before
  // we hand out a custom token. The account-level 2FA lockout is enforced here, at the same
  // boundary as the password lockout above — a locked account can't even request a new code.
  if (row?.roles?.requiere_2fa) {
    if (row.dosfa_bloqueado_hasta && new Date(row.dosfa_bloqueado_hasta) > new Date()) {
      return res.status(423).json({
        error:           'Demasiados códigos incorrectos. Intenta de nuevo en 30 minutos.',
        code:            'CUENTA_BLOQUEADA_2FA',
        bloqueado_hasta: row.dosfa_bloqueado_hasta,
      });
    }

    const primera_config = !row.dosfa_configurado_en;
    let challenge;
    try {
      challenge = await twoFactor.crearChallenge(row.id_usuario);
    } catch (e) {
      console.error('[login] crearChallenge 2fa', e.message);
      return res.status(500).json({ error: 'No se pudo iniciar la verificación. Intenta de nuevo.' });
    }

    try {
      await sendLogin2FACodigo(email, { codigo: challenge.codigo, expiraMinutos: 5, esPrimeraConfiguracion: primera_config });
    } catch (e) {
      console.error('[login] sendLogin2FACodigo', e.message);
      return res.status(502).json({ error: 'No se pudo enviar el código de verificación. Intenta de nuevo.' });
    }

    return res.status(202).json({ requiere_2fa: true, challenge_id: challenge.id_challenge, primera_config });
  }

  try {
    const customToken = await admin.auth().createCustomToken(fbData.localId);
    // row can be null here: a brand-new self-registered account only gets its `usuarios` row
    // provisioned lazily on the first authenticated API call (auth.middleware.js), so it may
    // not exist yet the moment they log in for the very first time.
    if (row?.id_usuario) await avisarNuevoLoginSiAplica(row.id_usuario, email, req);
    return res.json({ customToken });
  } catch (e) {
    console.error('[login] createCustomToken', e.message);
    return res.status(500).json({ error: 'No se pudo iniciar sesión. Intenta de nuevo.' });
  }
}

// Second step of the sensitive-role login: verifies the 6-digit code and, only then, mints the
// Firebase custom token. The account-level 2FA lockout counter is authoritative here, mirroring
// how the password lockout works in login() above, but tracked separately (dosfa_*) so exhausting
// OTP attempts never confuses or resets the password lockout state.
async function verificar2FA(req, res) {
  const { challenge_id, codigo } = req.body;
  if (!challenge_id || !codigo) {
    return res.status(400).json({ error: 'Falta el código o el identificador de verificación.' });
  }

  const resultado = await twoFactor.verificarCodigo(challenge_id, codigo);

  if (!resultado.ok) {
    if (resultado.error === 'CODIGO_INCORRECTO' && resultado.id_usuario) {
      const { data: u } = await supabase.schema(SCHEMA).from('usuarios')
        .select('dosfa_intentos_fallidos').eq('id_usuario', resultado.id_usuario).single();

      const intentos = (u?.dosfa_intentos_fallidos || 0) + 1;
      const updates  = { dosfa_intentos_fallidos: intentos };
      if (intentos >= MAX_FALLOS_2FA_CUENTA) {
        updates.dosfa_bloqueado_hasta = new Date(Date.now() + BLOQUEO_MINUTOS_2FA * 60_000).toISOString();
      }
      await supabase.schema(SCHEMA).from('usuarios').update(updates).eq('id_usuario', resultado.id_usuario);

      if (updates.dosfa_bloqueado_hasta) {
        await auditoria.log({
          tabla: 'usuarios', id: resultado.id_usuario, campo: 'dosfa_bloqueado_hasta',
          nuevo: updates.dosfa_bloqueado_hasta, usuario: String(resultado.id_usuario),
          motivo: 'Cuenta bloqueada por exceso de códigos 2FA incorrectos',
        });
        return res.status(423).json({
          error:           'Demasiados códigos incorrectos. Intenta de nuevo en 30 minutos.',
          code:            'CUENTA_BLOQUEADA_2FA',
          bloqueado_hasta: updates.dosfa_bloqueado_hasta,
        });
      }
      return res.status(401).json({ error: 'Código incorrecto.', code: 'CODIGO_INCORRECTO' });
    }

    const MENSAJES = {
      MAX_INTENTOS:      'Superaste el número de intentos para este código. Vuelve a iniciar sesión.',
      CODIGO_EXPIRADO:   'El código expiró. Vuelve a iniciar sesión.',
      CHALLENGE_INVALIDO: 'La verificación ya no es válida. Vuelve a iniciar sesión.',
    };
    return res.status(401).json({ error: MENSAJES[resultado.error] || MENSAJES.CHALLENGE_INVALIDO, code: resultado.error });
  }

  const { data: usuario } = await supabase.schema(SCHEMA).from('usuarios')
    .select('email, firebase_uid, dosfa_configurado_en, dosfa_intentos_fallidos, dosfa_bloqueado_hasta')
    .eq('id_usuario', resultado.id_usuario)
    .single();

  if (!usuario?.firebase_uid) {
    return res.status(500).json({ error: 'No se pudo completar el inicio de sesión. Contacta a la oficina.' });
  }

  const updates = {};
  if (usuario.dosfa_intentos_fallidos || usuario.dosfa_bloqueado_hasta) {
    updates.dosfa_intentos_fallidos = 0;
    updates.dosfa_bloqueado_hasta   = null;
  }
  const primeraConfiguracion = !usuario.dosfa_configurado_en;
  if (primeraConfiguracion) updates.dosfa_configurado_en = new Date().toISOString();

  if (Object.keys(updates).length) {
    await supabase.schema(SCHEMA).from('usuarios').update(updates).eq('id_usuario', resultado.id_usuario);
  }
  if (primeraConfiguracion) {
    await auditoria.log({
      tabla: 'usuarios', id: resultado.id_usuario, campo: 'dosfa_configurado_en',
      nuevo: updates.dosfa_configurado_en, usuario: String(resultado.id_usuario),
      motivo: 'Verificación en dos pasos activada (primer login como rol sensible)',
    });
  }

  try {
    const customToken = await admin.auth().createCustomToken(usuario.firebase_uid);
    // Skip the "new login" notice on the very first 2FA setup — they already got the
    // "activa tu verificación" email seconds ago, a second alert right after would be noise.
    if (!primeraConfiguracion) await avisarNuevoLoginSiAplica(resultado.id_usuario, usuario.email, req);
    return res.json({ customToken });
  } catch (e) {
    console.error('[login/2fa] createCustomToken', e.message);
    return res.status(500).json({ error: 'No se pudo iniciar sesión. Intenta de nuevo.' });
  }
}

async function reenviar2FA(req, res) {
  const { challenge_id } = req.body;
  if (!challenge_id) return res.status(400).json({ error: 'Falta el identificador de verificación.' });

  const resultado = await twoFactor.reenviarCodigo(challenge_id);
  if (resultado.error === 'CHALLENGE_INVALIDO') {
    return res.status(401).json({ error: 'La verificación ya no es válida. Vuelve a iniciar sesión.', code: 'CHALLENGE_INVALIDO' });
  }
  if (resultado.error === 'MAX_REENVIOS') {
    return res.status(429).json({ error: 'Ya reenviamos el código varias veces. Espera un momento o vuelve a iniciar sesión.', code: 'MAX_REENVIOS' });
  }

  const { data: usuario } = await supabase.schema(SCHEMA).from('usuarios')
    .select('email, dosfa_configurado_en').eq('id_usuario', resultado.id_usuario).single();

  try {
    await sendLogin2FACodigo(usuario.email, { codigo: resultado.codigo, expiraMinutos: 5, esPrimeraConfiguracion: !usuario.dosfa_configurado_en });
  } catch (e) {
    console.error('[login/2fa/reenviar] sendLogin2FACodigo', e.message);
    return res.status(502).json({ error: 'No se pudo reenviar el código. Intenta de nuevo.' });
  }

  return res.json({ ok: true });
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

module.exports = { registrarUsuario, miPerfil, miRol, completarPerfil, actualizarMiPerfil, actualizarAvatar, enviarEmailReset, vincularCuenta, login, verificar2FA, reenviar2FA };
