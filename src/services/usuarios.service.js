const supabase = require("../config/supabase");
const SCHEMA   = "condor";

// Returns the inactive users (activo === false) among the given ids,
// shaped as [{ id_usuario, nombres, apellidos }].
async function inactivosPorIds(ids) {
  const unique = [...new Set((ids || []).map(Number).filter(Boolean))];
  if (!unique.length) return [];

  const { data } = await supabase.schema(SCHEMA)
    .from("usuarios")
    .select("id_usuario, nombres, apellidos, activo")
    .in("id_usuario", unique);

  return (data || []).filter(u => u.activo === false);
}

// Inactive compradores associated with a venta.
async function inactivosDeVenta(idVenta) {
  if (!idVenta) return [];
  const { data } = await supabase.schema(SCHEMA)
    .from("venta_comprador")
    .select("id_usuario")
    .eq("id_venta", idVenta);
  return inactivosPorIds((data || []).map(vc => vc.id_usuario));
}

// Inactive compradores associated with the venta that owns a cuota.
async function inactivosDeCuota(idCuota) {
  if (!idCuota) return [];
  const { data } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select("venta:id_venta(venta_comprador(id_usuario))")
    .eq("id_cuota", idCuota)
    .single();
  const ids = (data?.venta?.venta_comprador || []).map(vc => vc.id_usuario);
  return inactivosPorIds(ids);
}

// Human-readable list of inactive comprador names for error messages.
function nombresInactivos(list) {
  return (list || [])
    .map(u => `${u.nombres || ""} ${u.apellidos || ""}`.trim() || `usuario ${u.id_usuario}`)
    .join(", ");
}

module.exports = { inactivosPorIds, inactivosDeVenta, inactivosDeCuota, nombresInactivos };
