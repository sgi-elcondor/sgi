const supabase = require("../config/supabase");
const SCHEMA   = "condor";

// Active user ids holding a role name.
async function _idsDeRol(nombreRol) {
  const { data: rol } = await supabase.schema(SCHEMA)
    .from("roles").select("id_rol").eq("nombre", nombreRol).single();
  if (!rol) return [];
  const { data } = await supabase.schema(SCHEMA)
    .from("usuarios").select("id_usuario")
    .eq("id_rol", rol.id_rol).eq("activo", true);
  return (data || []).map(u => u.id_usuario);
}

// crear({ paraIds?, paraRoles?, excepto?, titulo, mensaje?, vista?, referencia? })
// Fans out one row per target user (deduped). `excepto` skips the actor so
// nobody gets notified about their own action. Best-effort: errors are logged,
// never thrown, so callers can fire-and-forget.
async function crear({ paraIds = [], paraRoles = [], excepto = null, titulo, mensaje = null, vista = null, referencia = null }) {
  try {
    if (!titulo) return 0;

    const ids = new Set((paraIds || []).map(Number).filter(Boolean));
    for (const rol of paraRoles || []) {
      (await _idsDeRol(rol)).forEach(id => ids.add(id));
    }
    if (excepto != null) ids.delete(Number(excepto));
    if (!ids.size) return 0;

    const rows = [...ids].map(id_usuario => ({ id_usuario, titulo, mensaje, vista, referencia }));
    const { error } = await supabase.schema(SCHEMA).from("notificacion").insert(rows);
    if (error) {
      console.error("[notificaciones] insert falló:", error.message);
      return 0;
    }
    return rows.length;
  } catch (err) {
    console.error("[notificaciones] crear falló:", err.message);
    return 0;
  }
}

async function listar(idUsuario, limit = 30) {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("notificacion")
    .select("id_notificacion, titulo, mensaje, vista, referencia, leida, created_at")
    .eq("id_usuario", idUsuario)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

async function contarNoLeidas(idUsuario) {
  const { count, error } = await supabase.schema(SCHEMA)
    .from("notificacion")
    .select("id_notificacion", { count: "exact", head: true })
    .eq("id_usuario", idUsuario)
    .eq("leida", false);
  if (error) throw new Error(error.message);
  return count || 0;
}

// Marks the given ids (or ALL when ids is null) as read — only the caller's own rows.
async function marcarLeidas(idUsuario, ids = null) {
  let q = supabase.schema(SCHEMA)
    .from("notificacion")
    .update({ leida: true })
    .eq("id_usuario", idUsuario)
    .eq("leida", false);
  if (Array.isArray(ids) && ids.length) q = q.in("id_notificacion", ids.map(Number).filter(Boolean));
  const { error } = await q;
  if (error) throw new Error(error.message);
  return true;
}

// Housekeeping: drops READ notifications older than `dias` so the table does
// not grow forever. Unread ones are kept regardless of age.
async function limpiarAntiguas(dias = 60) {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.schema(SCHEMA)
    .from("notificacion")
    .delete()
    .eq("leida", true)
    .lt("created_at", limite);
  if (error) throw new Error(error.message);
  return true;
}

module.exports = { crear, listar, contarNoLeidas, marcarLeidas, limpiarAntiguas };
