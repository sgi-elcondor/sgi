const supabase = require('../config/supabase');
const admin    = require('../config/firebase');
const SCHEMA   = 'condor';

// SEG-04 (session lifetime): applies to every role. Sessions stay alive across browser
// restarts (Firebase's own silent refresh handles that), but the server forces a fresh login
// roughly every 30 days by revoking the refresh token — the ID token the client is holding
// keeps working for at most 1h more, then the next silent refresh fails and the user is sent
// back to /login. See auth.middleware.js for the enforcement side (tokensValidAfterTime check).
const CICLO_MS = 30 * 24 * 60 * 60 * 1000;

async function revocarSesionesVencidas() {
  const ahora   = Date.now();
  const limite  = new Date(ahora - CICLO_MS).toISOString();
  let nuevosConBaseline = 0;
  let revocados         = 0;

  // Users without a baseline yet (never swept before): give them a random point within the
  // last 30 days instead of "now" or "never revoked". That's what spreads everyone's future
  // forced logout across the month instead of piling every account onto the same day.
  const { data: sinBaseline } = await supabase.schema(SCHEMA).from('usuarios')
    .select('id_usuario')
    .is('sesion_revocada_en', null);

  for (const u of sinBaseline || []) {
    const jitterMs = Math.floor(Math.random() * CICLO_MS);
    await supabase.schema(SCHEMA).from('usuarios')
      .update({ sesion_revocada_en: new Date(ahora - jitterMs).toISOString() })
      .eq('id_usuario', u.id_usuario);
    nuevosConBaseline++;
  }

  const { data: vencidos } = await supabase.schema(SCHEMA).from('usuarios')
    .select('id_usuario, firebase_uid')
    .lt('sesion_revocada_en', limite)
    .not('firebase_uid', 'is', null);

  for (const u of vencidos || []) {
    try {
      await admin.auth().revokeRefreshTokens(u.firebase_uid);
    } catch (e) {
      console.error('[sesion] revokeRefreshTokens', u.id_usuario, e.message);
      continue; // do not advance the baseline if the revoke call itself failed
    }
    await supabase.schema(SCHEMA).from('usuarios')
      .update({ sesion_revocada_en: new Date().toISOString() })
      .eq('id_usuario', u.id_usuario);
    revocados++;
  }

  return { nuevosConBaseline, revocados };
}

module.exports = { revocarSesionesVencidas };
