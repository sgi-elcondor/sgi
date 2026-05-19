const supabase = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("lote")
    .select("*, proyecto(nombre)").order("codigo_lote");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getDisponibles = async (req, res) => {
  // Trae todas las ventas sin filtrar por enum para evitar validaciones del tipo
  const { data: todasVentas, error: ev } = await supabase.schema(SCHEMA)
    .from("venta").select("id_lote, estado");
  if (ev) return res.status(500).json({ error: ev.message });

  // Filter in JS: a lot is occupied if it has a non-cancelled/voided sale
  // Only "cancelada" returns the lot to the available inventory
  const estadosLibres = new Set(["cancelada"]);
  const idsOcupados = new Set(
    (todasVentas || []).filter(v => !estadosLibres.has(v.estado)).map(v => v.id_lote)
  );

  let q = supabase.schema(SCHEMA).from("lote")
    .select("*, proyecto(id_proyecto, nombre)")
    .order("manzana").order("numero_lote");

  if (idsOcupados.size > 0) {
    q = q.not("id_lote", "in", `(${[...idsOcupados].join(",")})`);
  }

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(l => ({
    id_lote:      l.id_lote,
    id_proyecto:  l.proyecto?.id_proyecto || l.id_proyecto,
    proyecto:     l.proyecto?.nombre || null,
    manzana:      l.manzana,
    numero_lote:  l.numero_lote,
    codigo_lote:  l.codigo_lote,
    area_m2:      l.area_m2,
    precio_lista: l.precio_base,
  })));
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("lote").select("*, proyecto(nombre)").eq("id_lote", req.params.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { id_proyecto, codigo_lote, area_m2, precio_base, descripcion, manzana, numero_lote, dimensiones } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("lote").insert([{ id_proyecto, codigo_lote, area_m2, precio_base, descripcion, manzana, numero_lote, dimensiones }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.update = async (req, res) => {
  const campos = (({ codigo_lote, area_m2, precio_base, descripcion, manzana, numero_lote, dimensiones }) =>
    ({ codigo_lote, area_m2, precio_base, descripcion, manzana, numero_lote, dimensiones }))(req.body);
  const { data, error } = await supabase.schema(SCHEMA).from("lote").update(campos).eq("id_lote", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
