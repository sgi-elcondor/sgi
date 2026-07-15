const supabase   = require("../config/supabase");
const inventario = require("../services/inventario.service");

const SCHEMA = "condor";

// GET /api/v1/inventario/stock
// Derived stock (Σ entradas − Σ salidas) grouped by material+unidad+proyecto,
// with categoría and last entrada/salida (INV-03). Project names are resolved
// here so roles without proyectos:leer (almacenista) get them too.
async function getStock(req, res) {
  try {
    const stock = await inventario.stockActual();

    const { data: proyectos } = await supabase.schema(SCHEMA)
      .from("proyecto")
      .select("id_proyecto, nombre, sigla");

    const porId = new Map((proyectos || []).map(p => [p.id_proyecto, p]));

    return res.json(stock.map(s => ({
      ...s,
      proyecto: porId.get(s.id_proyecto)?.nombre || null,
      sigla:    porId.get(s.id_proyecto)?.sigla || null,
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v1/inventario/movimientos?material=&unidad=&id_proyecto=
// Kardex: the full movement history of one stock line (oldest first so the
// client can compute the running balance).
async function getMovimientos(req, res) {
  try {
    const material = String(req.query.material || "").trim();
    if (!material) return res.status(400).json({ error: "Indica el material" });

    const unidad    = String(req.query.unidad || "").trim();
    const proyParam = req.query.id_proyecto;

    let q = supabase.schema(SCHEMA)
      .from("inventario_movimiento")
      .select(`
        id_movimiento, tipo, descripcion, categoria, unidad, cantidad, created_at,
        requerimiento:id_requerimiento (numero),
        usuario:creado_por (nombres, apellidos)
      `)
      .eq("material", material)
      .order("created_at", { ascending: true });

    if (unidad) q = q.eq("unidad", unidad);
    if (proyParam === "none") q = q.is("id_proyecto", null);
    else if (Number(proyParam)) q = q.eq("id_proyecto", Number(proyParam));

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map(m => ({
      id_movimiento: m.id_movimiento,
      tipo:          m.tipo,
      descripcion:   m.descripcion,
      unidad:        m.unidad,
      cantidad:      Number(m.cantidad),
      created_at:    m.created_at,
      requerimiento: m.requerimiento?.numero || null,
      registrado_por: m.usuario
        ? `${m.usuario.nombres || ""} ${m.usuario.apellidos || ""}`.trim()
        : "—",
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getStock, getMovimientos };
