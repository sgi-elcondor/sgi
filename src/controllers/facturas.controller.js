const supabase = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("factura").select("*").order("fecha_emision", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { numero_factura, fecha_emision, valor_facturado, estado, observaciones, id_cuota } = req.body;
  const { data: factura, error: ef } = await supabase.schema(SCHEMA).from("factura")
    .insert([{ numero_factura, fecha_emision, valor_facturado, estado: estado || "emitida", observaciones }]).select().single();
  if (ef) return res.status(400).json({ error: ef.message });
  if (id_cuota) {
    await supabase.schema(SCHEMA).from("cuota_factura").insert([{ id_cuota, id_factura: factura.id_factura }]);
  }
  res.status(201).json(factura);
};

exports.anular = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("factura").update({ estado: "anulada" }).eq("id_factura", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
