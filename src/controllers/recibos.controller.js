const supabase = require("../config/supabase");
const SCHEMA   = "condor";

function _periodo() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

exports.getAll = async (req, res) => {
  // Query from accepted payments so the view always shows real data,
  // even when no formal recibo record has been created yet.
  const { data, error } = await supabase.schema(SCHEMA)
    .from("pago")
    .select(`
      id_pago, fecha_pago, valor_pago, metodo_pago, referencia, estado,
      recibo_pago(
        recibo:id_recibo(id_recibo, numero_recibo, fecha_emision, emitido_por, observaciones)
      ),
      cuota_pago(
        valor_aplicado,
        cuota:id_cuota(
          id_cuota, numero_cuota,
          cuota_factura(factura:id_factura(id_factura, numero_factura, estado)),
          venta:id_venta(
            id_venta,
            lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)),
            venta_comprador(usuario:id_usuario(nombres, apellidos, documento))
          )
        )
      )
    `)
    .eq("estado", "aceptado")
    .order("fecha_pago", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(p => {
    const recibo  = p.recibo_pago?.[0]?.recibo;
    const cp      = p.cuota_pago?.[0];
    const cuota   = cp?.cuota;
    const venta   = cuota?.venta;
    const lote    = venta?.lote;
    const comp    = venta?.venta_comprador?.[0]?.usuario;
    const factura = cuota?.cuota_factura?.[0]?.factura;
    // Use negative id_pago as synthetic key when no formal recibo exists yet
    return {
      id_recibo:      recibo?.id_recibo      ?? -(p.id_pago),
      numero_recibo:  recibo?.numero_recibo  ?? `REC-${String(p.id_pago).padStart(6, "0")}`,
      fecha_emision:  recibo?.fecha_emision  ?? p.fecha_pago?.split("T")[0] ?? null,
      emitido_por:    recibo?.emitido_por    ?? "Sistema SGI",
      observaciones:  recibo?.observaciones  ?? null,
      id_pago:        p.id_pago,
      fecha_pago:     p.fecha_pago,
      valor_pago:     p.valor_pago,
      metodo_pago:    p.metodo_pago,
      referencia:     p.referencia,
      estado_pago:    p.estado,
      id_venta:       venta?.id_venta         ?? null,
      numero_cuota:   cuota?.numero_cuota     ?? null,
      id_factura:     factura?.id_factura     ?? null,
      numero_factura: factura?.numero_factura ?? null,
      proyecto:       lote?.proyecto?.nombre  ?? "—",
      codigo_lote:    lote?.codigo_lote       ?? "—",
      comprador:      comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
      documento:      comp?.documento         ?? null,
    };
  }));
};

exports.generarRecibos = async (req, res) => {
  const fecha_emision = new Date().toISOString().split("T")[0];
  const emitido_por   = req.usuario?.email || "sistema";

  const { data: pagos, error: ep } = await supabase.schema(SCHEMA)
    .from("pago")
    .select("id_pago, numero_pago, recibo_pago(id_recibo)")
    .eq("estado", "aceptado");

  if (ep) return res.status(500).json({ error: ep.message });

  const pendientes = (pagos || []).filter(p => !p.recibo_pago?.length);
  if (!pendientes.length) return res.json({ generados: 0, pendientes: 0, primer_error: null });

  let generados   = 0;
  let primerError = null;

  for (const p of pendientes) {
    let numero_recibo;

    if (p.numero_pago?.startsWith("PAG-")) {
      numero_recibo = p.numero_pago.replace(/^PAG-/, "RC-");
    } else {
      const periodo = _periodo();
      const { data: rx, error: erx } = await supabase.rpc("next_consecutivo_condor", {
        p_prefijo: "PAG",
        p_periodo: periodo,
      });
      if (erx) { if (!primerError) primerError = `consecutivo (pago ${p.id_pago}): ${erx.message}`; continue; }
      const n = String(rx).padStart(5, "0");
      const numero_pago_nuevo = `PAG-${periodo}-${n}`;
      numero_recibo           = `RC-${periodo}-${n}`;
      await supabase.schema(SCHEMA).from("pago")
        .update({ numero_pago: numero_pago_nuevo }).eq("id_pago", p.id_pago);
    }

    let idRecibo = null;
    const { data: orphan } = await supabase.schema(SCHEMA)
      .from("recibo").select("id_recibo").eq("numero_recibo", numero_recibo).maybeSingle();

    if (orphan) {
      idRecibo = orphan.id_recibo;
    } else {
      const { data: nuevo, error: er } = await supabase.schema(SCHEMA)
        .from("recibo")
        .insert([{ numero_recibo, fecha_emision, emitido_por }])
        .select("id_recibo").single();
      if (!er && nuevo) idRecibo = nuevo.id_recibo;
      else if (!primerError) primerError = `recibo insert (pago ${p.id_pago}): ${er?.message}`;
    }

    if (idRecibo) {
      const { error: erp } = await supabase.schema(SCHEMA)
        .from("recibo_pago")
        .insert([{ id_recibo: idRecibo, id_pago: p.id_pago }]);
      if (!erp) generados++;
      else if (!primerError) primerError = `recibo_pago insert (pago ${p.id_pago}): ${erp.message}`;
    }
  }

  res.json({ generados, pendientes: pendientes.length, primer_error: primerError });
};

exports.create = async (req, res) => {
  const { numero_recibo, emitido_por, observaciones, id_pago } = req.body;
  const { data: recibo, error: er } = await supabase.schema(SCHEMA).from("recibo")
    .insert([{ numero_recibo, emitido_por, observaciones }]).select().single();
  if (er) return res.status(400).json({ error: er.message });
  if (id_pago) await supabase.schema(SCHEMA).from("recibo_pago").insert([{ id_recibo: recibo.id_recibo, id_pago }]);
  res.status(201).json(recibo);
};


exports.getMisRecibos = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  if (!id_usuario) return res.status(400).json({ error: "Sin usuario vinculado" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("pago")
    .select(`
      id_pago, fecha_pago, valor_pago, metodo_pago, referencia, estado, id_venta,
      recibo_pago(
        recibo:id_recibo(id_recibo, numero_recibo, fecha_emision, emitido_por, observaciones)
      ),
      cuota_pago(
        cuota:id_cuota(
          id_cuota, numero_cuota,
          cuota_factura(factura:id_factura(id_factura, numero_factura, estado)),
          venta:id_venta(
            id_venta,
            lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)),
            venta_comprador(usuario:id_usuario(nombres, apellidos, documento))
          )
        )
      )
    `)
    .eq("id_usuario", id_usuario)
    .eq("estado", "aceptado")
    .order("fecha_pago", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || [])
    .filter(p => p.recibo_pago && p.recibo_pago.length > 0)
    .map(p => {
      const recibo  = p.recibo_pago[0].recibo;
      const cp      = p.cuota_pago?.[0];
      const cuota   = cp?.cuota;
      const venta   = cuota?.venta;
      const lote    = venta?.lote;
      const comp    = venta?.venta_comprador?.[0]?.usuario;
      const factura = cuota?.cuota_factura?.[0]?.factura;
      return {
        id_recibo:      recibo?.id_recibo,
        numero_recibo:  recibo?.numero_recibo,
        fecha_emision:  recibo?.fecha_emision  ?? p.fecha_pago?.split("T")[0] ?? null,
        emitido_por:    recibo?.emitido_por    ?? "Sistema SGI",
        observaciones:  recibo?.observaciones  ?? null,
        id_pago:        p.id_pago,
        fecha_pago:     p.fecha_pago,
        valor_pago:     p.valor_pago,
        metodo_pago:    p.metodo_pago,
        referencia:     p.referencia,
        estado_pago:    p.estado,
        id_venta:       venta?.id_venta         ?? p.id_venta ?? null,
        numero_cuota:   cuota?.numero_cuota     ?? null,
        id_factura:     factura?.id_factura     ?? null,
        numero_factura: factura?.numero_factura ?? null,
        proyecto:       lote?.proyecto?.nombre  ?? "—",
        codigo_lote:    lote?.codigo_lote       ?? "—",
        comprador:      comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
        documento:      comp?.documento         ?? null,
      };
    })
  );
};
