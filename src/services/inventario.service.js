// Inventory ledger (INV-01). Stock is never stored as truth: it derives from
// the entrada/salida movements, same principle as saldos (RN-10).
// INV-02 will append 'salida' movements; INV-03 queries the derived stock.
const supabase = require("../config/supabase");
const SCHEMA   = "condor";

// Normalized lookup key so "Cemento Gris " and "cemento gris" land on the same
// stock line. A proper materials catalog is a future story; this mitigates
// free-text drift meanwhile.
function normalizarMaterial(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Appends 'entrada' movements for the items received in a recepcion.
// Best-effort by design: the recepcion itself is the source document, so a
// ledger failure is logged and never blocks the delivery being registered.
async function registrarEntradas({ requerimiento, id_recepcion, items, id_usuario }) {
  try {
    const rows = (items || [])
      .filter(it => Number(it.cantidad) > 0 && String(it.descripcion || "").trim())
      .map(it => ({
        tipo:             "entrada",
        material:         normalizarMaterial(it.descripcion),
        descripcion:      String(it.descripcion).trim(),
        categoria:        requerimiento?.categoria || null,
        unidad:           String(it.unidad || "und").trim(),
        cantidad:         Number(it.cantidad),
        id_proyecto:      requerimiento?.id_proyecto || null,
        id_requerimiento: requerimiento?.id_requerimiento || null,
        id_recepcion:     id_recepcion || null,
        creado_por:       id_usuario || null,
      }));

    if (!rows.length) return 0;

    const { error } = await supabase.schema(SCHEMA)
      .from("inventario_movimiento")
      .insert(rows);

    if (error) {
      console.error("[inventario] entrada falló:", error.message);
      return 0;
    }
    return rows.length;
  } catch (err) {
    console.error("[inventario] registrarEntradas falló:", err.message);
    return 0;
  }
}

// Derived stock: Σ entradas − Σ salidas, grouped by material + unidad
// (+ proyecto). Single source for INV-03's stock view.
async function stockActual({ idProyecto = null } = {}) {
  let q = supabase.schema(SCHEMA)
    .from("inventario_movimiento")
    .select("tipo, material, descripcion, categoria, unidad, cantidad, id_proyecto, created_at");
  if (idProyecto) q = q.eq("id_proyecto", idProyecto);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const grupos = new Map();
  for (const m of data || []) {
    const key = `${m.material}|${m.unidad || ""}|${m.id_proyecto || ""}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        material:    m.material,
        descripcion: m.descripcion,
        categoria:   m.categoria,
        unidad:      m.unidad,
        id_proyecto: m.id_proyecto,
        cantidad:    0,
        ultima_entrada: null,
        ultima_salida:  null,
      });
    }
    const g = grupos.get(key);
    const signo = m.tipo === "salida" ? -1 : 1;
    g.cantidad += signo * Number(m.cantidad || 0);

    if (m.tipo === "entrada" && (!g.ultima_entrada || m.created_at > g.ultima_entrada)) {
      g.ultima_entrada = m.created_at;
      g.descripcion = m.descripcion;
      if (m.categoria) g.categoria = m.categoria;
    }
    if (m.tipo === "salida" && (!g.ultima_salida || m.created_at > g.ultima_salida)) {
      g.ultima_salida = m.created_at;
    }
  }

  return [...grupos.values()].sort((a, b) => a.material.localeCompare(b.material));
}

module.exports = { normalizarMaterial, registrarEntradas, stockActual };
