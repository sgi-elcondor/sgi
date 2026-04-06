const { supabase } = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("recibo").select("*").order("fecha_emision", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { numero_recibo, emitido_por, observaciones, id_pago, id_comprador } = req.body;
  const { data: recibo, error: er } = await supabase.schema(SCHEMA).from("recibo")
    .insert([{ numero_recibo, emitido_por, observaciones }]).select().single();
  if (er) return res.status(400).json({ error: er.message });
  if (id_pago) await supabase.schema(SCHEMA).from("recibo_pago").insert([{ id_recibo: recibo.id_recibo, id_pago }]);
  if (id_comprador) await supabase.schema(SCHEMA).from("comprador_recibo").insert([{ id_recibo: recibo.id_recibo, id_comprador }]);
  res.status(201).json(recibo);
};
