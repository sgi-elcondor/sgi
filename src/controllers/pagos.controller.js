const supabase              = require("../config/supabase");
const SCHEMA                = "condor";
const consecutivos          = require("../services/consecutivos.service");
const auditoria             = require("../services/auditoria.service");
const recibos               = require("../services/recibos.service");
const { marcarPagadaSiCubre } = require("../services/cuotas.service");
const { verificarComision } = require("../services/comisiones.service");

async function aplicarPagoACuotas(pago, email) {
  const { id_pago, id_venta, id_cuota_propuesta, valor_pago } = pago;

  // If a DB trigger on pago UPDATE already inserted cuota_pago records, skip allocation entirely
  // to avoid double-applying the payment to subsequent cuotas.
  const { count: yaAsignado } = await supabase.schema(SCHEMA)
    .from('cuota_pago')
    .select('id_pago', { count: 'exact', head: true })
    .eq('id_pago', id_pago);
  if (yaAsignado > 0) return;

  // Pending cuotas for this sale, ordered chronologically
  const { data: cuotas } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_cuota, numero_cuota, valor_cuota, estado')
    .eq('id_venta', id_venta)
    .not('estado', 'eq', 'pagada')
    .order('numero_cuota');

  if (!cuotas || cuotas.length === 0) return;

  // Already-applied accepted amounts per cuota
  const { data: aplicados } = await supabase.schema(SCHEMA)
    .from('cuota_pago')
    .select('id_cuota, valor_aplicado, pago:id_pago(estado)')
    .in('id_cuota', cuotas.map(c => c.id_cuota));

  const pagadoPor = {};
  for (const ap of (aplicados || [])) {
    if (ap.pago?.estado === 'aceptado') {
      pagadoPor[ap.id_cuota] = (pagadoPor[ap.id_cuota] || 0) + Number(ap.valor_aplicado);
    }
  }

  // Proposed cuota goes first
  let ordenadas = [...cuotas];
  if (id_cuota_propuesta) {
    const idx = ordenadas.findIndex(c => c.id_cuota === Number(id_cuota_propuesta));
    if (idx > 0) {
      const [prop] = ordenadas.splice(idx, 1);
      ordenadas.unshift(prop);
    }
  }

  // Greedy allocation
  let restante = Number(valor_pago);
  const filasCuotaPago    = [];
  const cuotasAMarcarPagas = [];

  for (const cuota of ordenadas) {
    if (restante <= 0) break;
    const yaPagado  = pagadoPor[cuota.id_cuota] || 0;
    const pendiente = Number(cuota.valor_cuota) - yaPagado;
    if (pendiente <= 0) continue;

    const aplicar = Math.min(restante, pendiente);
    filasCuotaPago.push({ id_cuota: cuota.id_cuota, id_pago, valor_aplicado: aplicar });
    if (yaPagado + aplicar >= Number(cuota.valor_cuota)) {
      cuotasAMarcarPagas.push(cuota.id_cuota);
    }
    restante -= aplicar;
  }

  // Capture estado before inserting so we can undo a DB trigger that fires on cuota_pago INSERT
  const estadoOrig = {};
  for (const c of cuotas) estadoOrig[c.id_cuota] = c.estado;

  if (filasCuotaPago.length > 0) {
    await supabase.schema(SCHEMA).from('cuota_pago').insert(filasCuotaPago);

    // The DB has a trigger on cuota_pago INSERT that can incorrectly mark a cuota as 'pagada'
    // even for partial payments. Restore the original estado for cuotas that should NOT be fully paid.
    for (const fila of filasCuotaPago) {
      if (cuotasAMarcarPagas.includes(fila.id_cuota)) continue;
      const { data: chk } = await supabase.schema(SCHEMA)
        .from('cuota').select('estado').eq('id_cuota', fila.id_cuota).single();
      if (chk?.estado === 'pagada') {
        await supabase.schema(SCHEMA).from('cuota')
          .update({ estado: estadoOrig[fila.id_cuota] || 'activa' })
          .eq('id_cuota', fila.id_cuota);
      }
    }
  }

  for (const id_cuota of cuotasAMarcarPagas) {
    await supabase.schema(SCHEMA).from('cuota').update({ estado: 'pagada' }).eq('id_cuota', id_cuota);
    const { data: facturaLinks } = await supabase.schema(SCHEMA)
      .from('cuota_factura').select('id_factura').eq('id_cuota', id_cuota);
    if (facturaLinks?.length) {
      await supabase.schema(SCHEMA).from('factura')
        .update({ estado: 'pagada' })
        .in('id_factura', facturaLinks.map(f => f.id_factura))
        .eq('estado', 'emitida');
    }
  }
}

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("pago")
    .select(`
      id_pago, numero_pago, fecha_pago, valor_pago, metodo_pago, referencia,
      estado, url_baucher, numero_cuenta_origen, tipo_pago, id_venta,
      venta:id_venta(
        lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)),
        venta_comprador(comprador:id_comprador(nombres, apellidos))
      ),
      cuota_pago(
        valor_aplicado,
        cuota:id_cuota(
          numero_cuota,
          cuota_factura(factura:id_factura(numero_factura))
        )
      ),
      recibo_pago(recibo:id_recibo(numero_recibo))
    `)
    .order("fecha_pago", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(p => {
    const lote      = p.venta?.lote;
    const comp      = p.venta?.venta_comprador?.[0]?.comprador;
    const cuotaPago = p.cuota_pago?.[0];
    const factura   = cuotaPago?.cuota?.cuota_factura?.[0]?.factura;
    return {
      id_pago:              p.id_pago,
      numero_pago:          p.numero_pago,
      fecha_pago:           p.fecha_pago,
      valor_pago:           p.valor_pago,
      metodo_pago:          p.metodo_pago,
      referencia:           p.referencia,
      estado:               p.estado,
      url_baucher:          p.url_baucher,
      numero_cuenta_origen: p.numero_cuenta_origen,
      tipo_pago:            p.tipo_pago,
      id_venta:             p.id_venta,
      comprador:            comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
      proyecto:             lote?.proyecto?.nombre ?? "—",
      codigo_lote:          lote?.codigo_lote      ?? "—",
      numero_cuota:         cuotaPago?.cuota?.numero_cuota         ?? null,
      numero_factura:       factura?.numero_factura                ?? null,
      numero_recibo:        p.recibo_pago?.[0]?.recibo?.numero_recibo ?? null,
    };
  }));
};

exports.create = async (req, res) => {
  const { fecha_pago, metodo_pago, referencia, cuotas } = req.body;

  if (!cuotas || cuotas.length === 0)
    return res.status(400).json({ error: "Debe seleccionar al menos una cuota" });

  const valor_pago = cuotas.reduce((s, c) => s + Number(c.valor_aplicado), 0);

  // Derive id_venta and id_comprador from the first cuota so the buyer can see this payment
  const { data: cuotaInfo } = await supabase.schema(SCHEMA)
    .from("cuota").select("id_venta").eq("id_cuota", cuotas[0].id_cuota).single();

  const id_venta = cuotaInfo?.id_venta ?? null;
  let id_comprador = null;
  if (id_venta) {
    const { data: vc } = await supabase.schema(SCHEMA)
      .from("venta_comprador").select("id_comprador").eq("id_venta", id_venta).single();
    id_comprador = vc?.id_comprador ?? null;
  }

  let consec;
  try { consec = await consecutivos.nextPago(); }
  catch (e) { return res.status(500).json({ error: `Error al generar consecutivo: ${e.message}` }); }

  // 1. Crear registro de pago
  const { data: pago, error: ep } = await supabase.schema(SCHEMA).from("pago")
    .insert([{
      fecha_pago,
      valor_pago,
      metodo_pago,
      referencia:   referencia || null,
      numero_pago:  consec.numero_pago,
      estado:       "aceptado",
      id_venta,
      id_comprador,
    }]).select().single();
  if (ep) return res.status(400).json({ error: ep.message });

  // 2. Accept any pending comprobantes from this buyer on the same venta
  if (id_comprador && id_venta) {
    await supabase.schema(SCHEMA)
      .from('pago')
      .update({ estado: 'aceptado' })
      .eq('id_comprador', id_comprador)
      .eq('id_venta', id_venta)
      .eq('estado', 'pendiente_revision')
      .neq('id_pago', pago.id_pago);
  }

  // 4. Vincular cuotas al pago
  const ids = cuotas.map(c => c.id_cuota);

  // Capture estado before inserting so we can undo a DB trigger that fires on cuota_pago INSERT
  const { data: cuotasPreInsert } = await supabase.schema(SCHEMA)
    .from("cuota").select("id_cuota, valor_cuota, estado").in("id_cuota", ids);
  const estadoOrig = {};
  for (const c of (cuotasPreInsert || [])) estadoOrig[c.id_cuota] = c.estado;

  const cuotaRows = cuotas.map(c => ({
    id_pago:        pago.id_pago,
    id_cuota:       c.id_cuota,
    valor_aplicado: Number(c.valor_aplicado),
  }));
  const { error: ec } = await supabase.schema(SCHEMA).from("cuota_pago").insert(cuotaRows);
  if (ec) return res.status(400).json({ error: ec.message });

  // 5. Mark cuotas as paid based on cumulative accepted payments; undo trigger for partial payments
  const { data: cuotasDB } = await supabase.schema(SCHEMA)
    .from("cuota").select("id_cuota, valor_cuota").in("id_cuota", ids);
  const { data: pagosAplicados } = await supabase.schema(SCHEMA)
    .from("cuota_pago").select("id_cuota, valor_aplicado, pago:id_pago(estado)").in("id_cuota", ids);

  for (const db of (cuotasDB || [])) {
    const totalPagado = (pagosAplicados || [])
      .filter(cp => cp.id_cuota === db.id_cuota && cp.pago?.estado === "aceptado")
      .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);
    if (totalPagado >= Number(db.valor_cuota)) {
      await supabase.schema(SCHEMA).from("cuota")
        .update({ estado: "pagada" }).eq("id_cuota", db.id_cuota);
      const { data: facturaLinks } = await supabase.schema(SCHEMA)
        .from("cuota_factura").select("id_factura").eq("id_cuota", db.id_cuota);
      if (facturaLinks?.length) {
        await supabase.schema(SCHEMA).from("factura")
          .update({ estado: "pagada" })
          .in("id_factura", facturaLinks.map(f => f.id_factura))
          .eq("estado", "emitida");
      }
    } else {
      // The DB trigger may have incorrectly set estado='pagada' — restore original estado
      const { data: chk } = await supabase.schema(SCHEMA)
        .from("cuota").select("estado").eq("id_cuota", db.id_cuota).single();
      if (chk?.estado === "pagada") {
        await supabase.schema(SCHEMA).from("cuota")
          .update({ estado: estadoOrig[db.id_cuota] || "activa" })
          .eq("id_cuota", db.id_cuota);
      }
    }
  }

  // 4. Auto-generar recibo con consecutivo correcto
  const { recibo } = await recibos.crearParaPago({
    id_pago:     pago.id_pago,
    numero_pago: consec.numero_pago,
    emitido_por: req.usuario.email,
  });

  res.status(201).json({ ...pago, recibo: recibo || null });
};

exports.createAbonoExtraordinario = async (req, res) => {
  const { id_venta, valor_abono, fecha_pago, metodo_pago, referencia } = req.body;

  if (!id_venta)
    return res.status(400).json({ error: "id_venta es obligatorio" });
  if (!valor_abono || Number(valor_abono) <= 0)
    return res.status(400).json({ error: "valor_abono debe ser mayor a 0" });
  if (!fecha_pago)
    return res.status(400).json({ error: "fecha_pago es obligatorio" });
  if (!metodo_pago)
    return res.status(400).json({ error: "metodo_pago es obligatorio" });

  const allowedMethods = ["transferencia", "efectivo", "cheque", "permuta"];
  if (!allowedMethods.includes(metodo_pago))
    return res.status(400).json({ error: "metodo_pago invalido" });

  const valorAbono = Number(valor_abono);

  const { data: cuotasPendientes, error: errorCuotas } = await supabase
    .schema(SCHEMA).from("cuota")
    .select("id_cuota, id_venta, numero_cuota, valor_cuota, estado")
    .eq("id_venta", id_venta).not("estado", "eq", "pagada")
    .order("numero_cuota", { ascending: false });

  if (errorCuotas) return res.status(500).json({ error: errorCuotas.message });
  if (!cuotasPendientes || cuotasPendientes.length === 0)
    return res.status(400).json({ error: "La venta no tiene cuotas pendientes para aplicar el abono extraordinario" });

  const idsCuotas = cuotasPendientes.map(c => c.id_cuota);
  const { data: pagosPrevios, error: errorPagosPrevios } = await supabase
    .schema(SCHEMA).from("cuota_pago").select("id_cuota, valor_aplicado").in("id_cuota", idsCuotas);
  if (errorPagosPrevios) return res.status(500).json({ error: errorPagosPrevios.message });

  const totalPagadoPorCuota = {};
  for (const pp of (pagosPrevios || [])) {
    totalPagadoPorCuota[pp.id_cuota] = (totalPagadoPorCuota[pp.id_cuota] || 0) + Number(pp.valor_aplicado || 0);
  }

  let valorRestante = valorAbono;
  const cuotasAfectadas = [];
  for (const cuota of cuotasPendientes) {
    if (valorRestante <= 0) break;
    const valorCuota    = Number(cuota.valor_cuota);
    const totalPagado   = totalPagadoPorCuota[cuota.id_cuota] || 0;
    const saldoCuota    = Math.max(valorCuota - totalPagado, 0);
    if (saldoCuota <= 0) continue;
    const valorAplicado = Math.min(valorRestante, saldoCuota);
    cuotasAfectadas.push({
      id_cuota: cuota.id_cuota,
      numero_cuota: cuota.numero_cuota,
      valor_cuota: valorCuota,
      total_pagado_previo: totalPagado,
      saldo_cuota: saldoCuota,
      valor_aplicado: valorAplicado,
      estado_anterior: cuota.estado,
      estado_resultante: valorAplicado >= saldoCuota ? "pagada" : "pendiente",
    });
    valorRestante -= valorAplicado;
  }

  if (cuotasAfectadas.length === 0)
    return res.status(400).json({ error: "No se encontraron saldos pendientes para aplicar el abono extraordinario" });
  if (valorRestante > 0)
    return res.status(400).json({ error: "El valor del abono excede el saldo pendiente de las cuotas", valor_abono: valorAbono, valor_sin_aplicar: valorRestante, cuotas_afectadas: cuotasAfectadas });

  const totalAplicado = cuotasAfectadas.reduce((t, c) => t + Number(c.valor_aplicado), 0);

  let pagConsec;
  try { pagConsec = await consecutivos.nextPago(); }
  catch (e) { return res.status(500).json({ error: `Error al generar consecutivo: ${e.message}` }); }

  const { data: pago, error: errorPago } = await supabase.schema(SCHEMA).from("pago")
    .insert([{ fecha_pago, valor_pago: totalAplicado, metodo_pago, referencia: referencia || null, numero_pago: pagConsec.numero_pago, tipo_pago: "abono_extraordinario", estado: "aceptado", id_venta }])
    .select().single();
  if (errorPago) return res.status(400).json({ error: errorPago.message });

  const registrosCuotaPago = cuotasAfectadas.map(c => ({ id_pago: pago.id_pago, id_cuota: c.id_cuota, valor_aplicado: Number(c.valor_aplicado) }));
  const { error: errorCuotaPago } = await supabase.schema(SCHEMA).from("cuota_pago").insert(registrosCuotaPago);
  if (errorCuotaPago) return res.status(400).json({ error: errorCuotaPago.message });

  for (const cuota of cuotasAfectadas) {
    await marcarPagadaSiCubre(cuota.id_cuota, cuota.valor_aplicado);
    await auditoria.log({
      tabla: "cuota", id: cuota.id_cuota, campo: "abono_extraordinario",
      anterior: cuota.estado_anterior,
      nuevo: JSON.stringify({ id_pago: pago.id_pago, numero_pago: pagConsec.numero_pago, id_venta, numero_cuota: cuota.numero_cuota, valor_aplicado: cuota.valor_aplicado, estado_resultante: cuota.estado_resultante }),
      usuario: req.usuario?.email || "sistema", motivo: "abono_extraordinario",
    });
  }

  const { recibo, error: reciboError } = await recibos.crearParaPago({ id_pago: pago.id_pago, numero_pago: pagConsec.numero_pago, emitido_por: req.usuario?.email || "sistema" });

  return res.status(201).json({ message: "Abono extraordinario registrado correctamente", pago, recibo: recibo || null, recibo_error: reciboError || null, total_aplicado: totalAplicado, cuotas_afectadas: cuotasAfectadas });
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

exports.getContrast = async (req, res) => {
  const { data: payments, error: ep } = await supabase.schema(SCHEMA)
    .from('pago')
    .select('*, cuota_pago(id_cuota, valor_aplicado, cuota:id_cuota(numero_cuota))')
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

  res.json(best);
};

exports.acceptBatch = async (req, res) => {
  const { validations } = req.body;
  if (!Array.isArray(validations) || validations.length === 0)
    return res.status(400).json({ error: 'validations must be a non-empty array' });

  const results = [];

  for (const { id_pago, id_transaction } of validations) {
    // Fetch full pago details before updating
    const { data: pagoActual, error: eLeer } = await supabase.schema(SCHEMA)
      .from('pago')
      .select('id_pago, valor_pago, id_venta, id_cuota_propuesta, estado')
      .eq('id_pago', id_pago)
      .single();

    if (eLeer || !pagoActual) {
      results.push({ id_pago, ok: false, error: 'Pago no encontrado' });
      continue;
    }

    // A pago may be already 'aceptado' if it was auto-accepted by exports.create but never
    // allocated. Allow re-processing ONLY when it has no cuota_pago records yet.
    if (pagoActual.estado === 'aceptado') {
      const { count } = await supabase.schema(SCHEMA)
        .from('cuota_pago')
        .select('id_pago', { count: 'exact', head: true })
        .eq('id_pago', id_pago);
      if (count > 0) {
        results.push({ id_pago, ok: false, error: 'El pago ya fue aceptado y asignado' });
        continue;
      }
    }

    // Capture cuota state BEFORE updating pago.estado — a DB trigger on pago UPDATE may fire
    // and incorrectly mark cuotas as 'pagada' before our allocation logic runs.
    let cuotaSnapshot = null;
    if (pagoActual.id_cuota_propuesta && pagoActual.id_venta) {
      const { data: snap } = await supabase.schema(SCHEMA)
        .from('cuota')
        .select('id_cuota, valor_cuota, estado')
        .eq('id_cuota', pagoActual.id_cuota_propuesta)
        .single();
      cuotaSnapshot = snap || null;
    }

    let pago = pagoActual;
    if (pagoActual.estado !== 'aceptado') {
      const { data: updated, error: ep } = await supabase.schema(SCHEMA)
        .from('pago')
        .update({ estado: 'aceptado' })
        .eq('id_pago', id_pago)
        .select()
        .single();
      if (ep) { results.push({ id_pago, ok: false, error: ep.message }); continue; }
      pago = updated;
    }

    await supabase.schema(SCHEMA)
      .from('bank_transaction')
      .update({ id_pago, updated_at: new Date().toISOString() })
      .eq('id_transaction', id_transaction);

    await supabase.schema(SCHEMA).from('auditoria').insert([{
      tabla_afectada: 'pago',
      id_registro:    id_pago,
      campo:          'estado',
      valor_anterior: pagoActual.estado,
      valor_nuevo:    'aceptado',
      usuario_db:     req.usuario.email,
      motivo:         `validacion_transaccion_bancaria:${id_transaction}`,
    }]);

    // Allocate payment to cuotas and check commission threshold
    let comision_causada = false;
    if (pagoActual.id_venta) {
      await aplicarPagoACuotas(pagoActual, req.usuario.email);
      comision_causada = await verificarComision(pagoActual.id_venta, req.usuario.email).catch(() => false);
    }

    // Reconcile the proposed cuota after the DB trigger and aplicarPagoACuotas have run.
    if (cuotaSnapshot) {
      const { data: allCp } = await supabase.schema(SCHEMA)
        .from('cuota_pago')
        .select('valor_aplicado, pago:id_pago(estado)')
        .eq('id_cuota', cuotaSnapshot.id_cuota);
      const totalAceptado = (allCp || [])
        .filter(cp => cp.pago?.estado === 'aceptado')
        .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);

      if (totalAceptado < Number(cuotaSnapshot.valor_cuota)) {
        // Partial payment — DB trigger incorrectly set 'pagada', restore original estado
        const { data: chk } = await supabase.schema(SCHEMA)
          .from('cuota').select('estado').eq('id_cuota', cuotaSnapshot.id_cuota).single();
        if (chk?.estado === 'pagada') {
          await supabase.schema(SCHEMA).from('cuota')
            .update({ estado: cuotaSnapshot.estado || 'activa' })
            .eq('id_cuota', cuotaSnapshot.id_cuota);
        }
      } else {
        // Fully paid — ensure cuota is 'pagada' and mark all linked facturas
        await supabase.schema(SCHEMA).from('cuota')
          .update({ estado: 'pagada' }).eq('id_cuota', cuotaSnapshot.id_cuota);
        const { data: facturaLinks } = await supabase.schema(SCHEMA)
          .from('cuota_factura').select('id_factura').eq('id_cuota', cuotaSnapshot.id_cuota);
        if (facturaLinks?.length) {
          await supabase.schema(SCHEMA).from('factura')
            .update({ estado: 'pagada' })
            .in('id_factura', facturaLinks.map(f => f.id_factura))
            .eq('estado', 'emitida');
        }
      }
    }

    // Auto-generate receipt using the standard service (RC-YYYYMM-NNNNN format)
    await recibos.crearParaPago({
      id_pago,
      numero_pago: pago.numero_pago,
      emitido_por: req.usuario.email,
    });

    results.push({ id_pago, ok: true, pago, comision_causada });
  }

  res.json(results);
};
