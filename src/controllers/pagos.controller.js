const supabase = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("pago").select("*").order("fecha_pago", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { fecha_pago, metodo_pago, referencia, cuotas } = req.body;

  if (!cuotas || cuotas.length === 0)
    return res.status(400).json({ error: "Debe seleccionar al menos una cuota" });

  const valor_pago = cuotas.reduce((s, c) => s + Number(c.valor_aplicado), 0);

  // 1. Crear registro de pago
  const { data: pago, error: ep } = await supabase.schema(SCHEMA).from("pago")
    .insert([{ fecha_pago, valor_pago, metodo_pago, referencia: referencia || null }]).select().single();
  if (ep) return res.status(400).json({ error: ep.message });

  // 2. Vincular cuotas al pago
  const cuotaRows = cuotas.map(c => ({
    id_pago:        pago.id_pago,
    id_cuota:       c.id_cuota,
    valor_aplicado: Number(c.valor_aplicado),
  }));
  const { error: ec } = await supabase.schema(SCHEMA).from("cuota_pago").insert(cuotaRows);
  if (ec) return res.status(400).json({ error: ec.message });

  // 3. Marcar como pagada cada cuota donde valor_aplicado >= valor_cuota
  const ids = cuotas.map(c => c.id_cuota);
  const { data: cuotasDB } = await supabase.schema(SCHEMA)
    .from("cuota").select("id_cuota, valor_cuota").in("id_cuota", ids);

  if (cuotasDB) {
    for (const db of cuotasDB) {
      const c = cuotas.find(x => Number(x.id_cuota) === db.id_cuota);
      if (c && Number(c.valor_aplicado) >= Number(db.valor_cuota)) {
        await supabase.schema(SCHEMA).from("cuota")
          .update({ estado: "pagada" }).eq("id_cuota", db.id_cuota);
      }
    }
  }

  // 4. Auto-generar recibo vinculado al pago
  const numero_recibo = `REC-${String(pago.id_pago).padStart(6, "0")}`;
  const { data: recibo } = await supabase.schema(SCHEMA).from("recibo")
    .insert([{ numero_recibo, emitido_por: req.usuario.email }]).select().single();
  if (recibo) {
    await supabase.schema(SCHEMA).from("recibo_pago")
      .insert([{ id_recibo: recibo.id_recibo, id_pago: pago.id_pago }]);
  }

  res.status(201).json({ ...pago, recibo: recibo || null });
};
