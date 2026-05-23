const supabase              = require("../config/supabase");
const SCHEMA                = "condor";
const consecutivos          = require("../services/consecutivos.service");
const auditoria             = require("../services/auditoria.service");
const recibos               = require("../services/recibos.service");
const { marcarPagadaSiCubre } = require("../services/cuotas.service");
const { verificarComision } = require("../services/comisiones.service");

async function aplicarPagoACuotas(pago, email) {
  const { id_pago, id_venta, id_cuota_propuesta, valor_pago } = pago;

  // Pending cuotas for this sale, ordered chronologically
  const { data: cuotas } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_cuota, numero_cuota, valor_cuota')
    .eq('id_venta', id_venta)
    .eq('estado', 'pendiente')
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

  if (filasCuotaPago.length > 0) {
    await supabase.schema(SCHEMA).from('cuota_pago').insert(filasCuotaPago);
  }

  for (const id_cuota of cuotasAMarcarPagas) {
    await supabase.schema(SCHEMA).from('cuota').update({ estado: 'pagada' }).eq('id_cuota', id_cuota);
  }
}

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
    .eq("id_venta", id_venta).eq("estado", "pendiente")
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
    if (pagoActual.estado === 'aceptado') {
      results.push({ id_pago, ok: false, error: 'El pago ya fue aceptado' });
      continue;
    }

    const { data: pago, error: ep } = await supabase.schema(SCHEMA)
      .from('pago')
      .update({ estado: 'aceptado' })
      .eq('id_pago', id_pago)
      .select()
      .single();

    if (ep) { results.push({ id_pago, ok: false, error: ep.message }); continue; }

    await supabase.schema(SCHEMA)
      .from('bank_transaction')
      .update({ id_pago, updated_at: new Date().toISOString() })
      .eq('id_transaction', id_transaction);

    await supabase.schema(SCHEMA).from('auditoria').insert([{
      tabla_afectada: 'pago',
      id_registro:    id_pago,
      campo:          'estado',
      valor_anterior: 'pendiente_revision',
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

    // Auto-generate receipt if not already linked
    const { data: reciboExist } = await supabase.schema(SCHEMA)
      .from('recibo_pago').select('id_recibo').eq('id_pago', id_pago).maybeSingle();

    if (!reciboExist) {
      const numero_recibo = `REC-${String(id_pago).padStart(6, '0')}`;
      const { data: recibo } = await supabase.schema(SCHEMA).from('recibo')
        .insert([{ numero_recibo, emitido_por: req.usuario.email }]).select().single();
      if (recibo) {
        await supabase.schema(SCHEMA).from('recibo_pago')
          .insert([{ id_recibo: recibo.id_recibo, id_pago }]);
      }
    }

    results.push({ id_pago, ok: true, pago, comision_causada });
  }

  res.json(results);
};
