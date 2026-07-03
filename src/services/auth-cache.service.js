// In-memory TTL cache for the identity payload (id_usuario + email + rol + permisos) that
// auth.middleware resolves from Supabase on every request. The Firebase ID token is STILL
// verified on every request — this only avoids re-querying Supabase for the same uid within the
// TTL window. Role/permission and user changes call clear() so a stale payload never outlives them.
const TTL_MS = 60_000;

const _cache = new Map(); // uid -> { data, exp }

function get(uid) {
  const hit = _cache.get(uid);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    _cache.delete(uid);
    return null;
  }
  return hit.data;
}

function set(uid, data, ttl = TTL_MS) {
  _cache.set(uid, { data, exp: Date.now() + ttl });
}

function invalidate(uid) {
  _cache.delete(uid);
}

// Role/permission and user updates are infrequent; clearing everything keeps correctness simple
// (no need to map a role change to each affected uid).
function clear() {
  _cache.clear();
}

module.exports = { get, set, invalidate, clear, TTL_MS };
