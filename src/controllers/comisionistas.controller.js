const { supabase } = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("comisionista").select("*").order("nombres");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { documento, nombres, apellidos, telefono } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("comisionista").insert([{ documento, nombres, apellidos, telefono }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.getComisiones = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_comisiones_causadas").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};
