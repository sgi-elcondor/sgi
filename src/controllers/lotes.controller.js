const { supabase } = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("lote")
    .select("*, proyecto(nombre)").order("codigo_lote");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getDisponibles = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_disponibilidad_comercial").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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
