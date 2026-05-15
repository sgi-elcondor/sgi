const supabase = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("pago")
    .select(`
      id_pago, fecha_pago, valor_pago, metodo_pago, referencia, estado,
      cuota_pago(
        valor_aplicado,
        cuota:id_cuota(
          id_cuota, numero_cuota,
          cuota_factura(factura:id_factura(id_factura, numero_factura, estado)),
          venta:id_venta(
            id_venta,
            lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)),
            venta_comprador(comprador:id_comprador(nombres, apellidos))
          )
        )
      ),
      recibo_pago(recibo:id_recibo(numero_recibo))
    `)
    .order("fecha_pago", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(p => {
    const cp      = p.cuota_pago?.[0];
    const cuota   = cp?.cuota;
    const venta   = cuota?.venta;
    const lote    = venta?.lote;
    const comp    = venta?.venta_comprador?.[0]?.comprador;
    const factura = cuota?.cuota_factura?.[0]?.factura;
    return {
      id_pago:        p.id_pago,
      fecha_pago:     p.fecha_pago,
      valor_pago:     p.valor_pago,
      metodo_pago:    p.metodo_pago,
      referencia:     p.referencia,
      estado:         p.estado,
      id_venta:       venta?.id_venta  ?? p.id_venta ?? null,
      numero_cuota:   cuota?.numero_cuota ?? null,
      id_factura:     factura?.id_factura ?? null,
      numero_factura: factura?.numero_factura ?? null,
      proyecto:       lote?.proyecto?.nombre ?? "—",
      codigo_lote:    lote?.codigo_lote      ?? "—",
      comprador:      comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
      numero_recibo:  p.recibo_pago?.[0]?.recibo?.numero_recibo ?? null,
    };
  }));
};

exports.create = async (req, res) => {
  const { fecha_pago, metodo_pago, referencia, id_factura, cuotas: cuotasBody } = req.body;

  let cuotas       = cuotasBody;
  let id_cuota_pago = null; // cuota derivada de la factura

  if (id_factura) {
    const { data: cf, error: ecf } = await supabase.schema(SCHEMA)
      .from("cuota_factura")
      .select("id_cuota, cuota:id_cuota(valor_cuota)")
      .eq("id_factura", id_factura)
      .single();
    if (ecf || !cf) return res.status(400).json({ error: "Factura no encontrada o sin cuota vinculada" });
    id_cuota_pago = cf.id_cuota;
    cuotas = [{ id_cuota: cf.id_cuota, valor_aplicado: Number(cf.cuota.valor_cuota) }];
  }

  if (!cuotas || cuotas.length === 0)
    return res.status(400).json({ error: "Debe seleccionar una factura o cuota" });

  const valor_pago = cuotas.reduce((s, c) => s + Number(c.valor_aplicado), 0);

  const { data: pago, error: ep } = await supabase.schema(SCHEMA).from("pago")
    .insert([{ fecha_pago, valor_pago, metodo_pago, referencia: referencia || null }]).select().single();
  if (ep) return res.status(400).json({ error: ep.message });

  const { error: ec } = await supabase.schema(SCHEMA).from("cuota_pago").insert(
    cuotas.map(c => ({ id_pago: pago.id_pago, id_cuota: c.id_cuota, valor_aplicado: Number(c.valor_aplicado) }))
  );
  if (ec) return res.status(400).json({ error: ec.message });

  if (id_factura && id_cuota_pago) {
    // Pago directo contra factura: marcar cuota y factura como pagadas de inmediato
    await Promise.all([
      supabase.schema(SCHEMA).from("cuota").update({ estado: "pagada" }).eq("id_cuota", id_cuota_pago),
      supabase.schema(SCHEMA).from("factura").update({ estado: "pagada" }).eq("id_factura", id_factura),
    ]);
  } else if (cuotas?.length) {
    // Path legacy con array de cuotas: marcar pagada solo si se cubrió el valor completo
    const ids = cuotas.map(c => c.id_cuota);
    const { data: cuotasDB } = await supabase.schema(SCHEMA)
      .from("cuota").select("id_cuota, valor_cuota").in("id_cuota", ids);
    if (cuotasDB) {
      for (const db of cuotasDB) {
        const c = cuotas.find(x => Number(x.id_cuota) === Number(db.id_cuota));
        if (c && Number(c.valor_aplicado) >= Number(db.valor_cuota)) {
          await supabase.schema(SCHEMA).from("cuota")
            .update({ estado: "pagada" }).eq("id_cuota", db.id_cuota);
        }
      }
    }
  }

  const numero_recibo = `REC-${String(pago.id_pago).padStart(6, "0")}`;
  const fecha_emision = new Date().toISOString().split("T")[0];
  const { data: recibo } = await supabase.schema(SCHEMA).from("recibo")
    .insert([{ numero_recibo, fecha_emision, emitido_por: req.usuario?.email || "sistema" }])
    .select().single();
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

  if (id_cuota_propuesta) {
    const { data: cf } = await supabase.schema(SCHEMA)
      .from("cuota_factura")
      .select("factura:id_factura(estado)")
      .eq("id_cuota", id_cuota_propuesta);
    const tieneFactura = (cf || []).some(r => r.factura?.estado === "emitida");
    if (!tieneFactura) return res.status(400).json({ error: "La cuota no tiene una factura emitida. Comunicate con la oficina." });
  }

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

exports.getContrast = async (req, res) => {
  const { data: payments, error: ep } = await supabase.schema(SCHEMA)
    .from('pago')
    .select(`
      *,
      comprador:id_comprador(nombres, apellidos),
      venta:id_venta(lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre))),
      cuota_pago(id_cuota, valor_aplicado, cuota:id_cuota(numero_cuota))
    `)
    .eq('estado', 'pendiente_revision')
    .eq('metodo_pago', 'transferencia');

  if (ep) return res.status(500).json({ error: ep.message });

  const { data: transactions, error: et } = await supabase.schema(SCHEMA)
    .from('bank_transaction')
    .select('*')
    .is('id_pago', null)
    .not('amount', 'is', null);

  if (et) return res.status(500).json({ error: et.message });

  const matches = [];

  for (const pago of (payments || [])) {
    const pagoAmount = Math.abs(Number(pago.valor_pago));
    const pagoRef    = (pago.referencia || '').replace(/\s+/g, '').toLowerCase();
    const pagoDate   = new Date(pago.fecha_pago);

    for (const tx of (transactions || [])) {
      const txAmount = Math.abs(Number(tx.amount));
      const txRef    = (tx.reference || '').replace(/\s+/g, '').toLowerCase();
      const txDate   = new Date(tx.transaction_date);

      let score          = 0;
      let amountMatch    = false;
      let referenceMatch = 'none';

      if (pagoAmount === txAmount) { score += 60; amountMatch = true; }

      if (pagoRef && txRef) {
        if (pagoRef === txRef)                                          { score += 30; referenceMatch = 'exact'; }
        else if (pagoRef.includes(txRef) || txRef.includes(pagoRef))   { score += 15; referenceMatch = 'partial'; }
      }

      const diffMs      = Math.abs(txDate - pagoDate);
      const diffMinutes = diffMs / (1000 * 60);
      const diffHours   = diffMs / (1000 * 60 * 60);
      const diffDays    = diffMs / (1000 * 60 * 60 * 24);
      let dateDiffHuman = '';

      if (diffMinutes < 60) {
        dateDiffHuman = diffMinutes < 1 ? 'mismo momento' : `${Math.round(diffMinutes)} minuto(s)`;
        score += 10;
      } else if (diffHours < 24) {
        dateDiffHuman = `${Math.round(diffHours)} hora(s)`;
        score += 10;
      } else if (diffDays <= 1) {
        dateDiffHuman = '1 dia'; score += 8;
      } else if (diffDays <= 3) {
        dateDiffHuman = `${Math.round(diffDays)} dias`; score += 5;
      } else if (diffDays <= 7) {
        dateDiffHuman = `${Math.round(diffDays)} dias`; score += 2;
      } else {
        dateDiffHuman = `${Math.round(diffDays)} dias`;
      }

      if (score > 0) {
        matches.push({
          pago,
          transaction:     tx,
          score,
          amount_match:    amountMatch,
          reference_match: referenceMatch,
          date_diff_days:  Math.round(diffDays),
          date_diff_human: dateDiffHuman,
        });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);

  const seen     = new Set();
  const seenTx   = new Set();
  const best     = matches.filter(m => {
    if (seen.has(m.pago.id_pago) || seenTx.has(m.transaction.id_transaction)) return false;
    seen.add(m.pago.id_pago);
    seenTx.add(m.transaction.id_transaction);
    return true;
  });

  const matchedIds = new Set(best.map(m => m.pago.id_pago));
  const unmatched  = (payments || [])
    .filter(p => !matchedIds.has(p.id_pago))
    .map(p => ({
      pago:            p,
      transaction:     null,
      score:           0,
      amount_match:    false,
      reference_match: 'none',
      date_diff_days:  null,
      date_diff_human: null,
      manual:          true,
    }));

  res.json([...best, ...unmatched]);
};

exports.acceptBatch = async (req, res) => {
  const { validations } = req.body;
  if (!Array.isArray(validations) || validations.length === 0)
    return res.status(400).json({ error: 'validations must be a non-empty array' });

  const results = [];

  for (const { id_pago, id_transaction } of validations) {
    const { data: pagoActual, error: ep0 } = await supabase.schema(SCHEMA)
      .from('pago')
      .select('id_pago, valor_pago, id_cuota_propuesta')
      .eq('id_pago', id_pago)
      .single();

    if (ep0 || !pagoActual) { results.push({ id_pago, ok: false, error: ep0?.message || 'Pago no encontrado' }); continue; }

    const { data: pago, error: ep } = await supabase.schema(SCHEMA)
      .from('pago')
      .update({ estado: 'aceptado' })
      .eq('id_pago', id_pago)
      .select()
      .single();

    if (ep) { results.push({ id_pago, ok: false, error: ep.message }); continue; }

    if (id_transaction) {
      await supabase.schema(SCHEMA)
        .from('bank_transaction')
        .update({ id_pago, updated_at: new Date().toISOString() })
        .eq('id_transaction', id_transaction);
    }

    await supabase.schema(SCHEMA).from('auditoria').insert([{
      tabla_afectada: 'pago',
      id_registro:    id_pago,
      campo:          'estado',
      valor_anterior: 'pendiente_revision',
      valor_nuevo:    'aceptado',
      usuario_db:     req.usuario.email,
      motivo:         id_transaction ? `validacion_transaccion_bancaria:${id_transaction}` : 'aprobacion_manual_baucher',
    }]);

    // Si el pago tiene cuota propuesta, crear cuota_pago y cerrar cuota + factura
    if (pagoActual.id_cuota_propuesta) {
      const idCuota = pagoActual.id_cuota_propuesta;

      const { data: cuota } = await supabase.schema(SCHEMA)
        .from('cuota').select('id_cuota, valor_cuota').eq('id_cuota', idCuota).single();

      if (cuota) {
        await supabase.schema(SCHEMA).from('cuota_pago').insert([{
          id_pago:        id_pago,
          id_cuota:       idCuota,
          valor_aplicado: Number(pagoActual.valor_pago),
        }]).then(() => {}).catch(() => {});

        if (Number(pagoActual.valor_pago) >= Number(cuota.valor_cuota)) {
          await supabase.schema(SCHEMA).from('cuota')
            .update({ estado: 'pagada' }).eq('id_cuota', idCuota);

          // Buscar factura emitida vinculada a esta cuota y marcarla pagada
          const { data: cf } = await supabase.schema(SCHEMA)
            .from('cuota_factura')
            .select('id_factura, factura:id_factura(estado)')
            .eq('id_cuota', idCuota);

          const facturaEmitida = (cf || []).find(r => r.factura?.estado === 'emitida');
          if (facturaEmitida) {
            await supabase.schema(SCHEMA).from('factura')
              .update({ estado: 'pagada' }).eq('id_factura', facturaEmitida.id_factura);
          }
        }
      }
    }

    const { data: existeLink } = await supabase.schema(SCHEMA)
      .from("recibo_pago").select("id_recibo").eq("id_pago", id_pago).maybeSingle();

    let reciboCreado = null;
    let reciboError  = null;

    if (!existeLink) {
      const numero_recibo = `REC-${String(id_pago).padStart(6, "0")}`;
      const fecha_emision = new Date().toISOString().split("T")[0];
      const emitido_por   = req.usuario?.email || "sistema";

      // Recover an orphaned recibo (inserted in a previous attempt but recibo_pago failed)
      let idRecibo = null;
      const { data: orphan } = await supabase.schema(SCHEMA)
        .from("recibo").select("id_recibo").eq("numero_recibo", numero_recibo).maybeSingle();

      if (orphan) {
        idRecibo = orphan.id_recibo;
        reciboCreado = orphan;
      } else {
        const { data: nuevo, error: er } = await supabase.schema(SCHEMA)
          .from("recibo")
          .insert([{ numero_recibo, fecha_emision, emitido_por }])
          .select()
          .single();
        if (!er && nuevo) { idRecibo = nuevo.id_recibo; reciboCreado = nuevo; }
        else reciboError = er?.message || "Error al insertar recibo";
      }

      if (idRecibo) {
        const { error: erp } = await supabase.schema(SCHEMA)
          .from("recibo_pago")
          .insert([{ id_recibo: idRecibo, id_pago }]);
        if (erp) { reciboError = `recibo_pago: ${erp.message}`; reciboCreado = null; }
      }
    }

    results.push({ id_pago, ok: true, pago, recibo: reciboCreado, recibo_error: reciboError });
  }

  res.json(results);
};
