const { supabase } = require("../config/supabase");
const SCHEMA   = "condor";

exports.getByVenta = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("cuota")
    .select("*").eq("id_venta", req.params.idVenta).order("numero_cuota");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { id_venta, numero_cuota, fecha_vencimiento, valor_cuota, es_extraordinaria } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("cuota")
    .insert([{ id_venta, numero_cuota, fecha_vencimiento, valor_cuota, es_extraordinaria: es_extraordinaria || false }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.updateEstado = async (req, res) => {
  const { estado } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("cuota")
    .update({ estado }).eq("id_cuota", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

exports.getVencidas = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("v_detalle_cuotas_vencidas").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};
