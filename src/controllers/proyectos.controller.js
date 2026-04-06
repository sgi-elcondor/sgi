const { supabase } = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("proyecto").select("*").order("nombre");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("proyecto").select("*").eq("id_proyecto", req.params.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { nombre, ubicacion, descripcion } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("proyecto").insert([{ nombre, ubicacion, descripcion }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.update = async (req, res) => {
  const { nombre, ubicacion, descripcion, estado } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("proyecto").update({ nombre, ubicacion, descripcion, estado }).eq("id_proyecto", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
