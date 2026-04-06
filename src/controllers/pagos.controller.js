const { supabase } = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("pago").select("*").order("fecha_pago", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { fecha_pago, valor_pago, metodo_pago, referencia, cuotas } = req.body;
  
  const { data: pago, error: ep } = await supabase.schema(SCHEMA).from("pago")
    .insert([{ fecha_pago, valor_pago, metodo_pago, referencia }]).select().single();
  if (ep) return res.status(400).json({ error: ep.message });
  
  if (cuotas && cuotas.length > 0) {
    const rows = cuotas.map(c => ({ id_pago: pago.id_pago, id_cuota: c.id_cuota, valor_aplicado: c.valor_aplicado }));
    const { error: ec } = await supabase.schema(SCHEMA).from("cuota_pago").insert(rows);
    if (ec) return res.status(400).json({ error: ec.message });
  }
  res.status(201).json(pago);
};
