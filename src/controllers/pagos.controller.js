const supabase              = require("../config/supabase");
const SCHEMA                = "condor";
const consecutivos          = require("../services/consecutivos.service");
const auditoria             = require("../services/auditoria.service");
const recibos               = require("../services/recibos.service");
const { marcarPagadaSiCubre } = require("../services/cuotas.service");
const { verificarComision } = require("../services/comisiones.service");
const { actualizarMora }    = require("../services/mora.service");

async function aplicarPagoACuotas(pago, email) {
  const { id_pago, id_venta, id_cuota_propuesta, valor_pago, tipo_pago } = pago;

  // If a DB trigger on pago UPDATE already inserted cuota_pago records, skip allocation entirely
  // to avoid double-applying the payment to subsequent cuotas.
  const { count: yaAsignado } = await supabase.schema(SCHEMA)
    .from('cuota_pago')
    .select('id_pago', { count: 'exact', head: true })
    .eq('id_pago', id_pago);
  if (yaAsignado > 0) return;

  // amortizacion payments apply to the last cuota first; regular payments apply forward
  const ascending = tipo_pago !== 'amortizacion';
  const { data: cuotas } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_cuota, numero_cuota, valor_cuota, estado')
    .eq('id_venta', id_venta)
    .not('estado', 'eq', 'pagada')
    .order('numero_cuota', { ascending });

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
        venta_comprador(usuario:id_usuario(nombres, apellidos))
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
    const comp      = p.venta?.venta_comprador?.[0]?.usuario;
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
  const { fecha_pago, metodo_pago, referencia, cuotas, url_baucher, numero_cuenta_origen } = req.body;

  if (!cuotas || cuotas.length === 0)
    return res.status(400).json({ error: "Debe seleccionar al menos una cuota" });
  if (!fecha_pago)  return res.status(400).json({ error: "fecha_pago es obligatorio" });
  if (!metodo_pago) return res.status(400).json({ error: "metodo_pago es obligatorio" });

  const valor_pago = cuotas.reduce((s, c) => s + Number(c.valor_aplicado), 0);
  if (!valor_pago || valor_pago <= 0)
    return res.status(400).json({ error: "El valor del pago debe ser mayor a 0" });

  const id_cuota_propuesta = cuotas[0].id_cuota;

  const { data: cuotaInfo } = await supabase.schema(SCHEMA)
    .from("cuota").select("id_venta, numero_cuota, estado").eq("id_cuota", id_cuota_propuesta).single();
  if (cuotaInfo?.estado === "pagada")
    return res.status(400).json({ error: `La cuota #${cuotaInfo.numero_cuota} ya está completamente pagada` });

  const id_venta = cuotaInfo?.id_venta ?? null;
  let id_usuario_comprador = null;
  if (id_venta) {
    const { data: vc } = await supabase.schema(SCHEMA)
      .from("venta_comprador").select("id_usuario").eq("id_venta", id_venta).limit(1).single();
    id_usuario_comprador = vc?.id_usuario ?? null;
  }

  // RN-22: a cuota with a payment already under review cannot receive another.
  const { count: yaEnRevision } = await supabase.schema(SCHEMA)
    .from("pago")
    .select("id_pago", { count: "exact", head: true })
    .eq("id_cuota_propuesta", id_cuota_propuesta)
    .eq("estado", "pendiente_revision");
  if (yaEnRevision > 0)
    return res.status(400).json({ error: "Ya hay un pago en revisión para esta cuota" });

  // RN-08: every payment is born 'pendiente_revision', even when the aux registers it
  // in the office. Allocation to cuotas and recibo generation happen ONLY on acceptance
  // (acceptBatch), which is the single path where a payment becomes income (RN-02/RN-07).
  const { data: pago, error: ep } = await supabase.schema(SCHEMA).from("pago")
    .insert([{
      fecha_pago,
      valor_pago,
      metodo_pago,
      referencia:           referencia || null,
      estado:               "pendiente_revision",
      id_venta,
      id_usuario:           id_usuario_comprador,
      id_cuota_propuesta,
      tipo_pago:            "cuota",
      url_baucher:          url_baucher          || null,
      numero_cuenta_origen: numero_cuenta_origen || null,
    }]).select().single();
  if (ep) return res.status(400).json({ error: ep.message });

  const nombreOp = [req.usuario.nombres, req.usuario.apellidos].filter(Boolean).join(' ') || req.usuario.email;
  await auditoria.log({
    tabla: 'pago', id: pago.id_pago, campo: 'creacion',
    anterior: null,
    nuevo: JSON.stringify({ valor: valor_pago, metodo: metodo_pago, cuota: id_cuota_propuesta }),
    usuario: req.usuario.email,
    motivo: `registro_pago_oficina:nombre:${nombreOp}:rol:${req.usuario.rol || 'auxiliar_contable'}`,
  });

  res.status(201).json(pago);
};

exports.createAbonoExtraordinario = async (req, res) => {
  const { id_venta, valor_abono, fecha_pago, metodo_pago, referencia, url_baucher, numero_cuenta_origen } = req.body;

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
    .insert([{
      fecha_pago, valor_pago: totalAplicado, metodo_pago,
      referencia:           referencia           || null,
      url_baucher:          url_baucher          || null,
      numero_cuenta_origen: numero_cuenta_origen || null,
      numero_pago: pagConsec.numero_pago, tipo_pago: "abono_extraordinario", estado: "aceptado", id_venta,
    }])
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

  actualizarMora().catch(e => console.error('[mora]', e.message));

  return res.status(201).json({ message: "Abono extraordinario registrado correctamente", pago, recibo: recibo || null, recibo_error: reciboError || null, total_aplicado: totalAplicado, cuotas_afectadas: cuotasAfectadas });
};

exports.getMisPagos = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  if (!id_usuario) return res.status(400).json({ error: "Sin usuario vinculado" });

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
    .eq("id_usuario", id_usuario)
    .order("fecha_pago", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
};

exports.createCompradorPago = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  if (!id_usuario) return res.status(400).json({ error: "Sin usuario vinculado" });

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
      .select("id_usuario")
      .eq("id_venta", id_venta)
      .eq("id_usuario", id_usuario)
      .single();
    if (!vc) return res.status(403).json({ error: "No tienes acceso a esta venta" });
  }

  if (id_cuota_propuesta) {
    const { data: cuotaData } = await supabase.schema(SCHEMA)
      .from("cuota").select("estado, numero_cuota").eq("id_cuota", id_cuota_propuesta).single();
    if (cuotaData?.estado === "pagada")
      return res.status(400).json({ error: `La cuota #${cuotaData.numero_cuota} ya está pagada` });

    const { count: yaEnRevision } = await supabase.schema(SCHEMA)
      .from("pago")
      .select("id_pago", { count: "exact", head: true })
      .eq("id_cuota_propuesta", id_cuota_propuesta)
      .eq("estado", "pendiente_revision");
    if (yaEnRevision > 0)
      return res.status(400).json({ error: "Ya hay un comprobante en revisión para esta cuota" });
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
      id_usuario,
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
  // All payments under review, regardless of method (RN-08). Transferencias get a bank
  // cross-match; efectivo/cheque/permuta always go to manual review.
  const { data: payments, error: ep } = await supabase.schema(SCHEMA)
    .from('pago')
    .select('*, usuario:id_usuario(nombres, apellidos), venta:id_venta(lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre))), cuota_pago(id_cuota, valor_aplicado, cuota:id_cuota(numero_cuota))')
    .eq('estado', 'pendiente_revision');

  if (ep) return res.status(500).json({ error: ep.message });

  const { data: transactions, error: et } = await supabase.schema(SCHEMA)
    .from('bank_transaction')
    .select('*')
    .is('id_pago', null)
    .not('amount', 'is', null);

  if (et) return res.status(500).json({ error: et.message });

  // Build best candidate per pago (all transactions scored)
  const candidatePerPago = {};

  for (const pago of (payments || [])) {
    // Only transferencias are cross-matched against bank transactions; the rest fall
    // through to the manual-review block below.
    if (pago.metodo_pago !== 'transferencia') continue;

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

      if (pagoRef && txRef && pagoRef !== '0' && txRef !== '0') {
        if (pagoRef === txRef)                                        { score += 30; referenceMatch = 'exact'; }
        else if (pagoRef.includes(txRef) || txRef.includes(pagoRef)) { score += 15; referenceMatch = 'partial'; }
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

      const prev = candidatePerPago[pago.id_pago];
      if (!prev || score > prev.score) {
        candidatePerPago[pago.id_pago] = {
          pago,
          transaction:     tx,
          score,
          amount_match:    amountMatch,
          reference_match: referenceMatch,
          date_diff_days:  Math.round(diffDays),
          date_diff_human: dateDiffHuman,
        };
      }
    }
  }

  // A match is meaningful only if at least amount or reference coincide
  const isMeaningful = c => c && (c.amount_match || c.reference_match !== 'none');

  // Assign transactions to pagos: best meaningful match wins, dedup by transaction
  const byScore = Object.values(candidatePerPago)
    .filter(isMeaningful)
    .sort((a, b) => b.score - a.score);

  const usedTx    = new Set();
  const matchedPago = new Set();
  const result    = [];

  for (const candidate of byScore) {
    const txId = candidate.transaction.id_transaction;
    if (usedTx.has(txId) || matchedPago.has(candidate.pago.id_pago)) continue;
    usedTx.add(txId);
    matchedPago.add(candidate.pago.id_pago);
    result.push({ ...candidate, manual: false });
  }

  // Pagos with no meaningful match → manual review (always visible)
  for (const pago of (payments || [])) {
    if (!matchedPago.has(pago.id_pago)) {
      result.push({
        pago,
        transaction:     null,
        score:           0,
        amount_match:    false,
        reference_match: 'none',
        date_diff_days:  null,
        date_diff_human: null,
        manual:          true,
      });
    }
  }

  result.sort((a, b) => b.score - a.score);

  res.json(result);
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
      .select('id_pago, valor_pago, id_venta, id_cuota_propuesta, estado, tipo_pago')
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

  actualizarMora().catch(e => console.error('[mora]', e.message));

  res.json(results);
};

exports.rejectBatch = async (req, res) => {
  const { pagos } = req.body;
  if (!Array.isArray(pagos) || pagos.length === 0)
    return res.status(400).json({ error: 'pagos must be a non-empty array' });

  const results = [];

  for (const { id_pago, motivo } of pagos) {
    const { data: pagoActual, error: eLeer } = await supabase.schema(SCHEMA)
      .from('pago')
      .select('id_pago, estado, id_venta, id_cuota_propuesta')
      .eq('id_pago', id_pago)
      .single();

    if (eLeer || !pagoActual) {
      results.push({ id_pago, ok: false, error: 'Pago no encontrado' });
      continue;
    }

    if (pagoActual.estado !== 'pendiente_revision') {
      results.push({ id_pago, ok: false, error: 'El pago no está en revisión' });
      continue;
    }

    const { error: eUpdate } = await supabase.schema(SCHEMA)
      .from('pago')
      .update({ estado: 'rechazado' })
      .eq('id_pago', id_pago);

    if (eUpdate) {
      results.push({ id_pago, ok: false, error: eUpdate.message });
      continue;
    }

    await supabase.schema(SCHEMA).from('auditoria').insert([{
      tabla_afectada: 'pago',
      id_registro:    id_pago,
      campo:          'estado',
      valor_anterior: 'pendiente_revision',
      valor_nuevo:    'rechazado',
      usuario_db:     req.usuario.email,
      motivo:         motivo ? `rechazo_manual:${motivo}` : 'rechazo_manual',
    }]);

    if (pagoActual.id_cuota_propuesta) {
      const { data: cfLinks } = await supabase.schema(SCHEMA)
        .from('cuota_factura')
        .select('id_factura, factura:id_factura(estado)')
        .eq('id_cuota', pagoActual.id_cuota_propuesta);
      const idsToAnnul = (cfLinks || [])
        .filter(cf => cf.factura?.estado === 'emitida')
        .map(cf => cf.id_factura);
      if (idsToAnnul.length > 0) {
        await supabase.schema(SCHEMA)
          .from('factura')
          .update({ estado: 'anulada' })
          .in('id_factura', idsToAnnul);
      }
    }

    results.push({ id_pago, ok: true });
  }

  res.json(results);
};
