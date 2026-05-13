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


exports.getMisPagos = async (req, res) => {
  const id_comprador = req.usuario.id_comprador;
  if (!id_comprador) return res.status(400).json({ error: "Sin comprador vinculado" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("pago")
    .select(`
      id_pago, fecha_pago, valor_pago, metodo_pago, referencia,
      estado, url_baucher, numero_cuenta_origen, tipo_pago,
      id_venta, id_cuota_propuesta,
      cuota_pago (
        valor_aplicado,
        cuota:id_cuota (numero_cuota, fecha_vencimiento)
      ),
      recibo_pago (
        recibo:id_recibo (numero_recibo, fecha_emision)
      )
    `)
    .eq("id_comprador", id_comprador)
    .order("fecha_pago", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
};

exports.createCompradorPago = async (req, res) => {
  const id_comprador = req.usuario.id_comprador;
  if (!id_comprador) return res.status(400).json({ error: "Sin comprador vinculado" });

  const {
    fecha_pago, valor_pago, metodo_pago,
    numero_cuenta_origen, url_baucher,
    id_venta, id_cuota_propuesta, tipo_pago,
    referencia,
  } = req.body;

  if (!fecha_pago)   return res.status(400).json({ error: "fecha_pago es obligatorio" });
  if (!valor_pago || Number(valor_pago) <= 0) return res.status(400).json({ error: "valor_pago debe ser mayor a 0" });
  if (!metodo_pago)  return res.status(400).json({ error: "metodo_pago es obligatorio" });

  const allowed = ["transferencia", "efectivo", "cheque", "permuta"];
  if (!allowed.includes(metodo_pago)) return res.status(400).json({ error: "metodo_pago invalido" });

  if (metodo_pago === "transferencia" && !url_baucher)
    return res.status(400).json({ error: "Debe adjuntar el baucher para pagos electronicos" });

  if (id_venta) {
    const { data: vc } = await supabase.schema(SCHEMA)
      .from("venta_comprador")
      .select("id_comprador")
      .eq("id_venta", id_venta)
      .eq("id_comprador", id_comprador)
      .single();
    if (!vc) return res.status(403).json({ error: "No tienes acceso a esta venta" });
  }

  const { data: pago, error: ep } = await supabase.schema(SCHEMA)
    .from("pago")
    .insert([{
      fecha_pago,
      valor_pago:           Number(valor_pago),
      metodo_pago,
      referencia:           referencia || null,
      estado:               "pendiente_revision",
      url_baucher:          url_baucher || null,
      numero_cuenta_origen: numero_cuenta_origen || null,
      tipo_pago:            tipo_pago || "cuota",
      id_comprador,
      id_venta:             id_venta || null,
      id_cuota_propuesta:   id_cuota_propuesta || null,
    }])
    .select()
    .single();

  if (ep) return res.status(400).json({ error: ep.message });

  await supabase.schema(SCHEMA).from("auditoria").insert([{
    tabla_afectada: "pago",
    id_registro:    pago.id_pago,
    campo:          "creacion_comprobante",
    valor_anterior: null,
    valor_nuevo:    JSON.stringify({ valor: pago.valor_pago, metodo: metodo_pago, tipo: tipo_pago }),
    usuario_db:     req.usuario.email,
    motivo:         "comprobante_comprador",
  }]);

  res.status(201).json(pago);
};
