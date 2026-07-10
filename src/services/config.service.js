// System-wide key-value config (condor.config_sistema). Read-heavy from the
// requerimientos flow, so we keep a small TTL cache to avoid a DB hit on every
// approval. Writes invalidate the affected key immediately.
const supabase = require("../config/supabase");
const SCHEMA   = "condor";

const TTL_MS = 60_000;
const _cache = new Map(); // clave -> { value, tipo, expiresAt }

// Fallback values used when the DB row is missing (fresh install) or the DB
// call fails. Keep in sync with the initial values inserted by the POL-02
// migration.
const DEFAULTS = {
  umbral_compra_grande: { valor: 5_000_000, tipo: "number" },
  modo_mantenimiento:   { valor: false, tipo: "json" },
};

function _cast(valor, tipo) {
  if (tipo === "number") {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }
  if (tipo === "json") {
    try { return JSON.parse(valor); } catch (_) { return null; }
  }
  return String(valor ?? "");
}

// Returns the typed value for `clave`. Falls back to DEFAULTS on missing row or
// on DB error (so the app keeps working even before the migration is run).
async function get(clave) {
  const now = Date.now();
  const cached = _cache.get(clave);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const { data, error } = await supabase.schema(SCHEMA)
      .from("config_sistema")
      .select("valor, tipo")
      .eq("clave", clave)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      const fallback = DEFAULTS[clave];
      if (fallback) return fallback.valor;
      return null;
    }

    const value = _cast(data.valor, data.tipo);
    _cache.set(clave, { value, tipo: data.tipo, expiresAt: now + TTL_MS });
    return value;
  } catch (err) {
    console.error(`[config] get(${clave}) fallo:`, err.message);
    const fallback = DEFAULTS[clave];
    return fallback ? fallback.valor : null;
  }
}

// Returns the raw rows for the admin UI (all keys, unfiltered).
async function listar() {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("config_sistema")
    .select("clave, valor, tipo, descripcion, actualizado_por, updated_at")
    .order("clave");
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ ...r, valor_typed: _cast(r.valor, r.tipo) }));
}

// Upserts the value and invalidates the cache for that key. `idUsuario` is
// stored in `actualizado_por` for the audit trail. Returns the fresh row.
async function set(clave, valor, idUsuario) {
  const existing = await supabase.schema(SCHEMA)
    .from("config_sistema").select("clave, tipo").eq("clave", clave).maybeSingle();

  const tipo = existing.data?.tipo || DEFAULTS[clave]?.tipo || "text";
  const stored = tipo === "json" ? JSON.stringify(valor) : String(valor);

  const payload = {
    clave, valor: stored, tipo,
    actualizado_por: idUsuario || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing.data
    ? await supabase.schema(SCHEMA).from("config_sistema")
        .update(payload).eq("clave", clave).select().single()
    : await supabase.schema(SCHEMA).from("config_sistema")
        .insert([payload]).select().single();

  if (error) throw new Error(error.message);

  _cache.delete(clave);
  return { ...data, valor_typed: _cast(data.valor, data.tipo) };
}

// Testing hook — never call from production code.
function _resetCache() { _cache.clear(); }

module.exports = { get, listar, set, _resetCache, DEFAULTS };
