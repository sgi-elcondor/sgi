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

module.exports = { getStock };
