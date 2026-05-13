const supabase = require("../config/supabase");
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


exports.getMisRecibos = async (req, res) => {
  const id_comprador = req.usuario.id_comprador;
  if (!id_comprador) return res.status(400).json({ error: "Sin comprador vinculado" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("recibo_pago")
    .select(`
      recibo:id_recibo (
        id_recibo, numero_recibo, fecha_emision, observaciones
      ),
      pago:id_pago (
        id_pago, fecha_pago, valor_pago, metodo_pago, estado,
        url_baucher, tipo_pago
      )
    `)
    .eq("pago.id_comprador", id_comprador)
    .order("recibo(fecha_emision)", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).filter(r => r.pago && r.recibo).map(r => ({
    id_recibo:     r.recibo.id_recibo,
    numero_recibo: r.recibo.numero_recibo,
    fecha_emision: r.recibo.fecha_emision,
    observaciones: r.recibo.observaciones,
    pago: {
      id_pago:    r.pago.id_pago,
      fecha_pago: r.pago.fecha_pago,
      valor_pago: r.pago.valor_pago,
      metodo_pago:r.pago.metodo_pago,
      estado:     r.pago.estado,
      url_baucher:r.pago.url_baucher,
      tipo_pago:  r.pago.tipo_pago,
    },
  })));
};
