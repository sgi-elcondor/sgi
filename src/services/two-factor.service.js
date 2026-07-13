const crypto   = require('crypto');
const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

// A 6-digit code only has 1,000,000 combinations, so hashing it is defense in depth
// (protects against a casual DB read/log leak), not real brute-force resistance. The
// actual protection is: short expiry, a hard cap on attempts per challenge, and the
// per-IP rate limit already applied on the routes that call into this service.
const CODIGO_TTL_MIN = 5;
const MAX_INTENTOS   = 5; // wrong codes allowed within a single challenge
const MAX_REENVIOS   = 3; // resends allowed within a single challenge's lifetime

function generarCodigo() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCodigo(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex');
}

function hashesIguales(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

async function crearChallenge(id_usuario) {
  const codigo      = generarCodigo();
  const codigo_hash = hashCodigo(codigo);
  const expira_en   = new Date(Date.now() + CODIGO_TTL_MIN * 60_000).toISOString();

  const { data, error } = await supabase.schema(SCHEMA).from('login_2fa')
    .insert([{ id_usuario, codigo_hash, expira_en }])
    .select('id_challenge')
    .single();
  if (error) throw new Error(error.message);

  return { id_challenge: data.id_challenge, codigo };
}

async function reenviarCodigo(id_challenge) {
  const { data: challenge } = await supabase.schema(SCHEMA).from('login_2fa')
    .select('id_challenge, id_usuario, reenvios, consumido_en')
    .eq('id_challenge', id_challenge)
    .maybeSingle();

  if (!challenge || challenge.consumido_en) return { error: 'CHALLENGE_INVALIDO' };
  if (challenge.reenvios >= MAX_REENVIOS)   return { error: 'MAX_REENVIOS' };

  const codigo      = generarCodigo();
  const codigo_hash = hashCodigo(codigo);
  const expira_en   = new Date(Date.now() + CODIGO_TTL_MIN * 60_000).toISOString();

  const { error } = await supabase.schema(SCHEMA).from('login_2fa')
    .update({ codigo_hash, expira_en, intentos: 0, reenvios: challenge.reenvios + 1 })
    .eq('id_challenge', id_challenge);
  if (error) throw new Error(error.message);

  return { id_usuario: challenge.id_usuario, codigo };
}

// Read-then-write, not a single atomic UPDATE — same pattern the password lockout in
// auth.controller.js already uses. A user racing against their own code entry is not a
// realistic threat here.
async function verificarCodigo(id_challenge, codigoIngresado) {
  const { data: challenge } = await supabase.schema(SCHEMA).from('login_2fa')
    .select('id_challenge, id_usuario, codigo_hash, intentos, expira_en, consumido_en')
    .eq('id_challenge', id_challenge)
    .maybeSingle();

  if (!challenge || challenge.consumido_en) return { ok: false, error: 'CHALLENGE_INVALIDO' };
  if (new Date(challenge.expira_en) < new Date()) return { ok: false, error: 'CODIGO_EXPIRADO' };
  if (challenge.intentos >= MAX_INTENTOS) return { ok: false, error: 'MAX_INTENTOS' };

  const codigoLimpio = String(codigoIngresado || '').trim();
  const coincide = codigoLimpio.length === 6 && hashesIguales(hashCodigo(codigoLimpio), challenge.codigo_hash);

  if (!coincide) {
    await supabase.schema(SCHEMA).from('login_2fa')
      .update({ intentos: challenge.intentos + 1 })
      .eq('id_challenge', id_challenge);
    return { ok: false, error: 'CODIGO_INCORRECTO', id_usuario: challenge.id_usuario };
  }

  await supabase.schema(SCHEMA).from('login_2fa')
    .update({ consumido_en: new Date().toISOString() })
    .eq('id_challenge', id_challenge);

  return { ok: true, id_usuario: challenge.id_usuario };
}

// Daily housekeeping (called from index.js, same pattern as notificaciones.limpiarAntiguas):
// drops challenges that are long expired/consumed so login_2fa doesn't grow unbounded.
async function limpiarExpirados(diasAntiguedad = 2) {
  const limite = new Date(Date.now() - diasAntiguedad * 24 * 60 * 60 * 1000).toISOString();
  await supabase.schema(SCHEMA).from('login_2fa')
    .delete()
    .lt('creado_en', limite);
}

module.exports = { crearChallenge, reenviarCodigo, verificarCodigo, limpiarExpirados };
