const supabase = require("../config/supabase");
const saldos   = require("../services/saldos.service");
const facturas = require("./facturas.controller");
const SCHEMA   = "condor";

exports.getByVenta = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("cuota")
    .select("*").eq("id_venta", req.params.idVenta).order("numero_cuota");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// RN-19: the comprador views the factura, pago and recibo of one of their own cuotas (or a
// fraction), reusing the same PDF builders / detail as the aux. Ownership-checked. Returns
// the most relevant of each document, or null when it does not exist yet.
exports.getMisDocumentos = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  if (!id_usuario) return res.status(400).json({ error: "Sin usuario vinculado" });

  const idCuota = Number(req.params.idCuota);
  if (!idCuota) return res.status(400).json({ error: "ID de cuota inválido" });
  const idFraccion = req.query.fraccion ? Number(req.query.fraccion) : null;

  const { data: c, error } = await supabase.schema(SCHEMA).from("cuota")
    .select(`
      id_cuota, numero_cuota, fecha_vencimiento, id_venta,
      venta:id_venta(
        id_venta,
        lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)),
        venta_comprador(id_usuario, usuario:id_usuario(nombres, apellidos, documento))
      ),
      cuota_factura(id_fraccion, factura:id_factura(id_factura, numero_factura, estado, fecha_emision, valor_facturado, observaciones)),
      cuota_pago(pago:id_pago(id_pago, numero_pago, fecha_pago, valor_pago, metodo_pago, referencia, estado, recibo_pago(recibo:id_recibo(id_recibo, numero_recibo, fecha_emision, emitido_por, observaciones))))
    `)
    .eq("id_cuota", idCuota).single();

  if (error || !c) return res.status(404).json({ error: "Cuota no encontrada" });

  const owner = (c.venta?.venta_comprador || []).find(vc => vc.id_usuario === id_usuario);
  if (!owner) return res.status(403).json({ error: "No tienes acceso a esta cuota" });

  const comp        = owner.usuario;
  const comprador   = comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—";
  const documento   = comp?.documento ?? null;
  const proyecto    = c.venta?.lote?.proyecto?.nombre ?? "—";
  const codigo_lote = c.venta?.lote?.codigo_lote ?? "—";
  const id_venta    = c.venta?.id_venta ?? c.id_venta ?? null;

  // Factura: most relevant non-anulada (pagada > parcialmente_pagada > emitida), scoped to the
  // fraction when one is requested.
  let facLinks = c.cuota_factura || [];
  if (idFraccion != null) facLinks = facLinks.filter(cf => cf.id_fraccion === idFraccion);
  const facturas   = facLinks.map(cf => cf.factura).filter(Boolean);
  const facturaRaw = facturas.find(f => f.estado === "pagada")
    || facturas.find(f => f.estado === "parcialmente_pagada")
    || facturas.find(f => f.estado === "emitida")
    || facturas.find(f => f.estado !== "anulada")
    || null;

  // Pago: an accepted one first (it has a recibo), otherwise the latest pending/rejected one.
  const pagosAceptados = (c.cuota_pago || []).map(cp => cp.pago).filter(p => p && p.estado === "aceptado");
  const { data: otrosPagos } = await supabase.schema(SCHEMA).from("pago")
    .select("id_pago, numero_pago, estado, fecha_pago")
    .eq("id_cuota_propuesta", idCuota)
    .eq("id_usuario", id_usuario)
    .neq("estado", "aceptado")
    .order("fecha_pago", { ascending: false });
  const pagoSel = pagosAceptados[0] || (otrosPagos && otrosPagos[0]) || null;

  // Recibo: from an accepted pago of the cuota.
  const pagoConRecibo = pagosAceptados.find(p => p.recibo_pago?.[0]?.recibo) || null;
  const reciboRaw     = pagoConRecibo?.recibo_pago?.[0]?.recibo || null;

  // Shared document-chain numbers so the factura, pago and recibo PDFs render the same trace.
  const numeroPagoChain   = pagoSel?.numero_pago ?? null;
  const numeroReciboChain = reciboRaw?.numero_recibo ?? null;

  const factura = facturaRaw ? {
    id_factura:        facturaRaw.id_factura,
    numero_factura:    facturaRaw.numero_factura,
    estado:            facturaRaw.estado,
    fecha_emision:     facturaRaw.fecha_emision,
    valor_facturado:   facturaRaw.valor_facturado,
    observaciones:     facturaRaw.observaciones,
    id_venta,
    comprador, proyecto, codigo_lote,
    numero_cuota:      c.numero_cuota,
    fecha_vencimiento: c.fecha_vencimiento,
    numero_pago:       numeroPagoChain,
    numero_recibo:     numeroReciboChain,
  } : null;

  const pago = pagoSel ? { id_pago: pagoSel.id_pago, numero_pago: pagoSel.numero_pago ?? null, estado: pagoSel.estado } : null;

  const recibo = reciboRaw ? {
    id_recibo:      reciboRaw.id_recibo,
    numero_recibo:  reciboRaw.numero_recibo,
    fecha_emision:  reciboRaw.fecha_emision ?? pagoConRecibo?.fecha_pago?.split("T")[0] ?? null,
    emitido_por:    reciboRaw.emitido_por ?? "Sistema SGI",
    observaciones:  reciboRaw.observaciones ?? null,
    valor_pago:     pagoConRecibo?.valor_pago ?? null,
    metodo_pago:    pagoConRecibo?.metodo_pago ?? null,
    referencia:     pagoConRecibo?.referencia ?? null,
    fecha_pago:     pagoConRecibo?.fecha_pago ?? null,
    id_venta,
    comprador, documento, proyecto, codigo_lote,
    numero_cuota:   c.numero_cuota,
    numero_factura: facturaRaw?.numero_factura ?? null,
    numero_pago:    pagoConRecibo?.numero_pago ?? null,
  } : null;

  res.json({ factura, recibo, pago });
};

exports.create = async (req, res) => {
const { id_venta, numero_cuota, fecha_vencimiento, valor_cuota, es_extraordinaria } = req.body;

const { data, error } = await supabase.schema(SCHEMA).from("cuota")
  .insert([{
    id_venta,
    numero_cuota,
    fecha_vencimiento,
    valor_cuota,
    estado: "pendiente",
    es_extraordinaria: es_extraordinaria || false
  }])
  .select()
  .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.updateValores = async (req, res) => {
  if (req.usuario.rol !== 'auxiliar_contable') {
    return res.status(403).json({ error: 'Solo el auxiliar contable puede editar valores de cuotas' });
  }

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de cuota inválido' });

  const { valor_cuota, fecha_vencimiento, motivo } = req.body;

  // A/RN-17: changing a single cuota value in isolation would break the total debt
  // (Σcuotas = financed value). Value changes must go through the balanced plan endpoint.
  if (valor_cuota !== undefined) {
    return res.status(400).json({ error: 'Para cambiar el valor usa el reajuste del plan de cuotas (debe cuadrar con el valor financiado).' });
  }
  if (fecha_vencimiento !== undefined && isNaN(Date.parse(fecha_vencimiento))) {
    return res.status(400).json({ error: 'fecha_vencimiento no es una fecha válida' });
  }
  if (fecha_vencimiento === undefined) {
    return res.status(400).json({ error: 'Debe enviar fecha_vencimiento' });
  }

  const { data: actual, error: readErr } = await supabase
    .schema(SCHEMA).from('cuota')
    .select('valor_cuota, fecha_vencimiento, estado')
    .eq('id_cuota', id)
    .single();

  if (readErr || !actual) return res.status(404).json({ error: 'Cuota no encontrada' });
  if (actual.estado === 'pagada') {
    return res.status(400).json({ error: 'No se puede editar una cuota pagada' });
  }

  // Log to audit before updating (one entry per modified field)
  const registros = [];
  if (valor_cuota !== undefined && valor_cuota !== actual.valor_cuota) {
    registros.push({
      tabla_afectada: 'cuota',
      id_registro:    id,
      campo:          'valor_cuota',
      valor_anterior: String(actual.valor_cuota),
      valor_nuevo:    String(valor_cuota),
      usuario_db:     req.usuario.email,
      fecha_cambio:   new Date().toISOString(),
      motivo:         motivo || 'edicion_auxiliar_contable',
    });
  }
  if (fecha_vencimiento !== undefined && fecha_vencimiento !== actual.fecha_vencimiento) {
    registros.push({
      tabla_afectada: 'cuota',
      id_registro:    id,
      campo:          'fecha_vencimiento',
      valor_anterior: actual.fecha_vencimiento,
      valor_nuevo:    fecha_vencimiento,
      usuario_db:     req.usuario.email,
      fecha_cambio:   new Date().toISOString(),
      motivo:         motivo || 'edicion_auxiliar_contable',
    });
  }

  if (registros.length > 0) {
    await supabase.schema(SCHEMA).from('auditoria').insert(registros);
  }

  const cambios = {};
  if (valor_cuota !== undefined)    cambios.valor_cuota = valor_cuota;
  if (fecha_vencimiento !== undefined) cambios.fecha_vencimiento = fecha_vencimiento;

  const { data, error } = await supabase
    .schema(SCHEMA).from('cuota')
    .update(cambios)
    .eq('id_cuota', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// A/RN-17/§8.4: editing cuota values must preserve the total debt. The sum of ALL the
// venta's cuotas must stay equal to the financed value (valor_total − permutas). The aux
// sends a balanced batch of changes; if it does not balance, the whole change is rejected.
exports.rebalanceValores = async (req, res) => {
  if (req.usuario.rol !== 'auxiliar_contable') {
    return res.status(403).json({ error: 'Solo el auxiliar contable puede editar valores de cuotas' });
  }

  const idVenta = Number(req.params.idVenta);
  if (!idVenta) return res.status(400).json({ error: 'ID de venta inválido' });

  const { cambios, motivo } = req.body;
  if (!Array.isArray(cambios) || cambios.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos un cambio' });
  }
  if (!motivo || String(motivo).trim().length < 20) {
    return res.status(400).json({ error: 'El motivo es obligatorio (mín. 20 caracteres)' });
  }

  const { data: venta, error: vErr } = await supabase.schema(SCHEMA)
    .from('venta').select('valor_total, total_permutas').eq('id_venta', idVenta).single();
  if (vErr || !venta) return res.status(404).json({ error: 'Venta no encontrada' });

  const { data: cuotas, error: cErr } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select(`id_cuota, numero_cuota, valor_cuota, fecha_vencimiento, estado,
      cuota_pago(valor_aplicado, pago:id_pago(estado, recibo_pago(id_recibo))),
      cuota_fraccion(id_fraccion),
      cuota_factura(id_fraccion, factura:id_factura(estado))`)
    .eq('id_venta', idVenta);
  if (cErr) return res.status(500).json({ error: cErr.message });

  const byId = new Map((cuotas || []).map(c => [c.id_cuota, c]));

  for (const ch of cambios) {
    const c = byId.get(Number(ch.id_cuota));
    if (!c) return res.status(400).json({ error: `La cuota ${ch.id_cuota} no pertenece a esta venta` });

    const cambiaValor = ch.valor_cuota !== undefined && Number(ch.valor_cuota) !== Number(c.valor_cuota);
    if (ch.valor_cuota !== undefined) {
      if (typeof ch.valor_cuota !== 'number' || ch.valor_cuota <= 0) {
        return res.status(400).json({ error: 'valor_cuota debe ser un número mayor a 0' });
      }
      if (cambiaValor && c.estado === 'pagada') {
        return res.status(400).json({ error: `La cuota #${c.numero_cuota} está pagada y su valor no puede cambiar` });
      }
      const pagado = saldos._sumRecibosAceptados(c.cuota_pago);
      if (Number(ch.valor_cuota) < pagado) {
        return res.status(400).json({ error: `La cuota #${c.numero_cuota} ya tiene recibos por ${pagado}; su valor no puede ser menor` });
      }
      // §3.3/§4.3: a subdivided cuota or one with an active factura cannot change its value
      // here, or its fracciones / factura would be left inconsistent.
      if (cambiaValor && (c.cuota_fraccion || []).length > 0) {
        return res.status(400).json({ error: `La cuota #${c.numero_cuota} está subdividida; ajusta sus fracciones desde "Subdividir".` });
      }
      if (cambiaValor && (c.cuota_factura || []).some(cf => ['emitida', 'parcialmente_pagada'].includes(cf.factura?.estado))) {
        return res.status(400).json({ error: `La cuota #${c.numero_cuota} tiene una factura activa; anúlala antes de cambiar su valor.` });
      }
    }
    if (ch.fecha_vencimiento !== undefined && isNaN(Date.parse(ch.fecha_vencimiento))) {
      return res.status(400).json({ error: 'fecha_vencimiento no es una fecha válida' });
    }
  }

  // The sum of all cuotas (after applying value changes) must equal the financed value.
  const nuevoValor = new Map((cuotas || []).map(c => [c.id_cuota, Number(c.valor_cuota)]));
  for (const ch of cambios) {
    if (ch.valor_cuota !== undefined) nuevoValor.set(Number(ch.id_cuota), Number(ch.valor_cuota));
  }
  const sumTotal   = [...nuevoValor.values()].reduce((s, v) => s + v, 0);
  const financiado = Number(venta.valor_total) - (Number(venta.total_permutas) || 0);
  const tolerancia = Math.max(1, (cuotas || []).length);
  if (Math.abs(sumTotal - financiado) > tolerancia) {
    return res.status(400).json({
      error: `El plan no cuadra: las cuotas suman ${sumTotal} y deben sumar ${financiado} (valor financiado). Ajusta los valores para repartir la diferencia.`,
      sum_actual:  sumTotal,
      financiado,
    });
  }

  const registros = [];
  const now = new Date().toISOString();
  for (const ch of cambios) {
    const c = byId.get(Number(ch.id_cuota));
    const updates = {};
    if (ch.valor_cuota !== undefined && Number(ch.valor_cuota) !== Number(c.valor_cuota)) {
      updates.valor_cuota = Number(ch.valor_cuota);
      registros.push({ tabla_afectada: 'cuota', id_registro: c.id_cuota, campo: 'valor_cuota', valor_anterior: String(c.valor_cuota), valor_nuevo: String(ch.valor_cuota), usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim() });
    }
    if (ch.fecha_vencimiento !== undefined && ch.fecha_vencimiento !== c.fecha_vencimiento) {
      updates.fecha_vencimiento = ch.fecha_vencimiento;
      registros.push({ tabla_afectada: 'cuota', id_registro: c.id_cuota, campo: 'fecha_vencimiento', valor_anterior: c.fecha_vencimiento, valor_nuevo: ch.fecha_vencimiento, usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim() });
    }
    if (Object.keys(updates).length) {
      const { error: uErr } = await supabase.schema(SCHEMA).from('cuota').update(updates).eq('id_cuota', c.id_cuota);
      if (uErr) return res.status(400).json({ error: uErr.message });
    }
  }
  if (registros.length) await supabase.schema(SCHEMA).from('auditoria').insert(registros);

  res.json({ ok: true, financiado, sum: sumTotal, cambios: registros.length });
};

// Task 1: full plan editor. Lets the aux/admin edit cuota values, dates AND the number of
// cuotas in a single balanced operation, from the venta detail. The client sends the desired
// list of cuotas; existing ones carry their id_cuota, new ones come without it, and omitted
// existing ones are deleted. Rules enforced:
//  - RN-17/§8.4: the sum of ALL cuotas must stay equal to the financed value (valor_total − permutas).
//  - RN-03/RN-04/§3.3: a cuota that is paid, has receipts, an active factura or fracciones is
//    locked — its value cannot change and it cannot be deleted.
//  - RN-20: every change (create/edit/delete) is audited with an explicit motivo.
//  - RN-16: the mora/estado is never set here; it stays calculated.
// Existing cuota numbers are preserved (so already-emitted facturas/recibos keep their label);
// new cuotas are appended after the current max numero_cuota.
exports.setPlan = async (req, res) => {
  if (!['auxiliar_contable', 'admin'].includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Solo el auxiliar contable puede editar el plan de cuotas' });
  }

  const idVenta = Number(req.params.idVenta);
  if (!idVenta) return res.status(400).json({ error: 'ID de venta inválido' });

  const { cuotas: deseadas, motivo, valor_total, cuota_inicial } = req.body;
  if (!Array.isArray(deseadas) || deseadas.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos una cuota' });
  }
  if (!motivo || String(motivo).trim().length < 20) {
    return res.status(400).json({ error: 'El motivo es obligatorio (mín. 20 caracteres)' });
  }

  const { data: venta, error: vErr } = await supabase.schema(SCHEMA)
    .from('venta').select('id_lote, valor_total, cuota_inicial, total_permutas, lote:id_lote(precio_base)').eq('id_venta', idVenta).single();
  if (vErr || !venta) return res.status(404).json({ error: 'Venta no encontrada' });

  // The editor updates the venta's valor_total / cuota_inicial atomically with the plan; the new
  // values drive the two balance targets below so the plan can never be left descuadrado.
  const permutas = Number(venta.total_permutas) || 0;
  const newVt = valor_total   !== undefined ? Number(valor_total)   : Number(venta.valor_total);
  const newCi = cuota_inicial !== undefined ? Number(cuota_inicial) : (Number(venta.cuota_inicial) || 0);
  if (!Number.isFinite(newVt) || newVt <= 0) {
    return res.status(400).json({ error: 'El valor total debe ser mayor a 0' });
  }
  if (!Number.isFinite(newCi) || newCi < 0) {
    return res.status(400).json({ error: 'La cuota inicial no puede ser negativa' });
  }
  if (newCi > newVt) {
    return res.status(400).json({ error: 'La cuota inicial no puede superar el valor total' });
  }

  const { data: actuales, error: cErr } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select(`id_cuota, numero_cuota, tipo, valor_cuota, fecha_vencimiento, estado,
      cuota_pago(valor_aplicado, pago:id_pago(estado, recibo_pago(id_recibo))),
      cuota_fraccion(id_fraccion),
      cuota_factura(id_factura, factura:id_factura(estado))`)
    .eq('id_venta', idVenta);
  if (cErr) return res.status(500).json({ error: cErr.message });

  const byId = new Map((actuales || []).map(c => [c.id_cuota, c]));

  const lockInfo = (c) => {
    const pagado          = saldos._sumRecibosAceptados(c.cuota_pago);
    const facturaActiva   = (c.cuota_factura || []).some(cf => ['emitida', 'parcialmente_pagada'].includes(cf.factura?.estado));
    const tieneFracciones = (c.cuota_fraccion || []).length > 0;
    const tieneDocs       = (c.cuota_pago || []).length > 0 || (c.cuota_factura || []).length > 0 || tieneFracciones;
    const valorLocked     = c.estado === 'pagada' || pagado >= Number(c.valor_cuota) || facturaActiva || tieneFracciones;
    return { pagado, facturaActiva, tieneFracciones, tieneDocs, valorLocked };
  };

  // Validate each desired cuota and flag the existing ones that stay.
  const idsDeseados = new Set();
  for (const d of deseadas) {
    const valor = Number(d.valor_cuota);
    if (!Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({ error: 'Cada cuota debe tener un valor mayor a 0' });
    }
    if (!d.fecha_vencimiento || isNaN(Date.parse(d.fecha_vencimiento))) {
      return res.status(400).json({ error: 'Cada cuota debe tener una fecha de vencimiento válida' });
    }
    if (d.id_cuota == null) continue;

    const c = byId.get(Number(d.id_cuota));
    if (!c) return res.status(400).json({ error: `La cuota ${d.id_cuota} no pertenece a esta venta` });
    idsDeseados.add(Number(d.id_cuota));

    const lk = lockInfo(c);
    if (lk.valorLocked && valor !== Number(c.valor_cuota)) {
      const razon = c.estado === 'pagada' ? 'está pagada'
        : lk.facturaActiva   ? 'tiene una factura activa'
        : lk.tieneFracciones ? 'está subdividida'
        :                      'tiene recibos';
      return res.status(400).json({ error: `La cuota #${c.numero_cuota} ${razon}; su valor no puede cambiar. Anula la factura o quita la subdivisión antes.` });
    }
    if (!lk.valorLocked && valor < lk.pagado) {
      return res.status(400).json({ error: `La cuota #${c.numero_cuota} ya tiene recibos por ${lk.pagado}; su valor no puede ser menor` });
    }
  }

  // Existing cuotas omitted from the desired list → delete, only if completely clean.
  const aEliminar = (actuales || []).filter(c => !idsDeseados.has(c.id_cuota));
  for (const c of aEliminar) {
    if (lockInfo(c).tieneDocs) {
      return res.status(400).json({ error: `La cuota #${c.numero_cuota} tiene pagos, factura o subdivisiones; no puede eliminarse` });
    }
  }

  // RN-17/§8.4: the plan must preserve the total debt. TWO balance targets are enforced so that
  // changing valor_total or cuota_inicial forces a rebalance: the inicial cuotas must sum to the
  // cuota inicial, and the regular cuotas to the financed value (valor_total − inicial − permutas).
  const tipoDe = (d) => d.id_cuota != null
    ? (byId.get(Number(d.id_cuota))?.tipo === 'inicial' ? 'inicial' : 'regular')
    : (d.tipo === 'inicial' ? 'inicial' : 'regular');
  const sumTipo = (t) => deseadas.filter(d => tipoDe(d) === t).reduce((s, d) => s + Number(d.valor_cuota), 0);
  const sumInicial = sumTipo('inicial');
  const sumRegular = sumTipo('regular');
  const targetInicial = newCi;
  const targetRegular = Math.max(0, newVt - newCi - permutas);
  const tolI = Math.max(1, deseadas.filter(d => tipoDe(d) === 'inicial').length || 1);
  const tolR = Math.max(1, deseadas.filter(d => tipoDe(d) === 'regular').length || 1);
  if (Math.abs(sumInicial - targetInicial) > tolI) {
    return res.status(400).json({
      error: `Las cuotas iniciales suman ${sumInicial} y deben sumar ${targetInicial} (cuota inicial). Ajusta las cuotas iniciales.`,
      sum_inicial: sumInicial, target_inicial: targetInicial,
    });
  }
  if (Math.abs(sumRegular - targetRegular) > tolR) {
    return res.status(400).json({
      error: `Las cuotas regulares suman ${sumRegular} y deben sumar ${targetRegular} (valor financiado). Ajusta las cuotas regulares.`,
      sum_regular: sumRegular, target_regular: targetRegular,
    });
  }
  const financiado = targetRegular;
  const sumDeseada = sumInicial + sumRegular;

  const now   = new Date().toISOString();
  const audit = [];

  // 0) Update the venta's financial values if they changed (audited, RN-20).
  const ventaUpdates = {};
  if (valor_total !== undefined && Number(valor_total) !== Number(venta.valor_total)) {
    ventaUpdates.valor_total = newVt;
    audit.push({ tabla_afectada: 'venta', id_registro: idVenta, campo: 'valor_total', valor_anterior: String(venta.valor_total), valor_nuevo: String(newVt), usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim() });
  }
  if (cuota_inicial !== undefined && Number(cuota_inicial) !== (Number(venta.cuota_inicial) || 0)) {
    ventaUpdates.cuota_inicial = newCi;
    audit.push({ tabla_afectada: 'venta', id_registro: idVenta, campo: 'cuota_inicial', valor_anterior: String(venta.cuota_inicial || 0), valor_nuevo: String(newCi), usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim() });
  }
  if (Object.keys(ventaUpdates).length) {
    const { error: vUpdErr } = await supabase.schema(SCHEMA).from('venta').update(ventaUpdates).eq('id_venta', idVenta);
    if (vUpdErr) return res.status(400).json({ error: vUpdErr.message });
  }

  // Keep the lote's base price in sync with the sale value so the lotes and proyectos views match.
  if (ventaUpdates.valor_total !== undefined && venta.id_lote) {
    const prevPrecio = venta.lote?.precio_base;
    const { error: loteErr } = await supabase.schema(SCHEMA)
      .from('lote').update({ precio_base: newVt }).eq('id_lote', venta.id_lote);
    if (loteErr) return res.status(400).json({ error: loteErr.message });
    audit.push({ tabla_afectada: 'lote', id_registro: venta.id_lote, campo: 'precio_base', valor_anterior: prevPrecio != null ? String(prevPrecio) : null, valor_nuevo: String(newVt), usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim() });
  }

  // 1) Deletes (clean cuotas only).
  if (aEliminar.length) {
    const { error: eDel } = await supabase.schema(SCHEMA)
      .from('cuota').delete().in('id_cuota', aEliminar.map(c => c.id_cuota));
    if (eDel) return res.status(400).json({ error: eDel.message });
    for (const c of aEliminar) {
      audit.push({
        tabla_afectada: 'cuota', id_registro: c.id_cuota, campo: 'eliminacion',
        valor_anterior: JSON.stringify({ numero: c.numero_cuota, valor: c.valor_cuota, fecha: c.fecha_vencimiento }),
        valor_nuevo: null, usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim(),
      });
    }
  }

  // 2) Updates (existing cuotas that stay).
  for (const d of deseadas) {
    if (d.id_cuota == null) continue;
    const c = byId.get(Number(d.id_cuota));
    const updates = {};
    if (Number(d.valor_cuota) !== Number(c.valor_cuota)) {
      updates.valor_cuota = Number(d.valor_cuota);
      audit.push({ tabla_afectada: 'cuota', id_registro: c.id_cuota, campo: 'valor_cuota', valor_anterior: String(c.valor_cuota), valor_nuevo: String(d.valor_cuota), usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim() });
    }
    if (d.fecha_vencimiento !== c.fecha_vencimiento) {
      updates.fecha_vencimiento = d.fecha_vencimiento;
      audit.push({ tabla_afectada: 'cuota', id_registro: c.id_cuota, campo: 'fecha_vencimiento', valor_anterior: c.fecha_vencimiento, valor_nuevo: d.fecha_vencimiento, usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim() });
    }
    if (Object.keys(updates).length) {
      const { error: uErr } = await supabase.schema(SCHEMA).from('cuota').update(updates).eq('id_cuota', c.id_cuota);
      if (uErr) return res.status(400).json({ error: uErr.message });
    }
  }

  // 3) Inserts (new cuotas) — appended after the current max numero_cuota, in date order.
  let maxNum = (actuales || []).reduce((m, c) => Math.max(m, Number(c.numero_cuota) || 0), 0);
  const nuevas = deseadas
    .filter(d => d.id_cuota == null)
    .sort((a, b) => (a.fecha_vencimiento < b.fecha_vencimiento ? -1 : a.fecha_vencimiento > b.fecha_vencimiento ? 1 : 0))
    .map(d => ({
      id_venta:          idVenta,
      numero_cuota:      ++maxNum,
      tipo:              d.tipo === 'inicial' ? 'inicial' : 'regular',
      fecha_vencimiento: d.fecha_vencimiento,
      valor_cuota:       Number(d.valor_cuota),
      estado:            'pendiente',
      es_extraordinaria: false,
    }));
  if (nuevas.length) {
    const { data: inserted, error: iErr } = await supabase.schema(SCHEMA)
      .from('cuota').insert(nuevas).select('id_cuota, numero_cuota, valor_cuota, fecha_vencimiento');
    if (iErr) return res.status(400).json({ error: iErr.message });
    for (const ins of (inserted || [])) {
      audit.push({
        tabla_afectada: 'cuota', id_registro: ins.id_cuota, campo: 'creacion',
        valor_anterior: null, valor_nuevo: JSON.stringify({ numero: ins.numero_cuota, valor: ins.valor_cuota, fecha: ins.fecha_vencimiento }),
        usuario_db: req.usuario.email, fecha_cambio: now, motivo: String(motivo).trim(),
      });
    }
  }

  if (audit.length) await supabase.schema(SCHEMA).from('auditoria').insert(audit);

  res.json({
    ok: true,
    financiado,
    sum: sumDeseada,
    eliminadas:   aEliminar.length,
    creadas:      nuevas.length,
    actualizadas: deseadas.filter(d => d.id_cuota != null).length,
  });
};

exports.getPendientes = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      *,
      venta(lote(codigo_lote, proyecto(nombre)), venta_comprador(usuario:id_usuario(nombres, apellidos, documento))),
      cuota_fraccion(id_fraccion, numero_fraccion, valor_fraccion, fecha_propuesta),
      cuota_pago(valor_aplicado, pago:id_pago(estado, recibo_pago(id_recibo)))
    `)
    .neq("estado", "pagada")
    .order("fecha_vencimiento");
  if (error) return res.status(500).json({ error: error.message });

  const hoy    = Date.now();
  const result = [];

  for (const c of (data || [])) {
    const lote      = c.venta?.lote;
    const comprador = c.venta?.venta_comprador?.[0]?.usuario;
    const dias      = Math.floor((hoy - new Date(c.fecha_vencimiento).getTime()) / 86_400_000);

    const base = {
      id_cuota:          c.id_cuota,
      id_venta:          c.id_venta,
      proyecto:          lote?.proyecto?.nombre || "—",
      codigo_lote:       lote?.codigo_lote      || "—",
      comprador:         comprador ? `${comprador.nombres} ${comprador.apellidos || ""}`.trim() : "—",
      documento:         comprador?.documento   || "",
      numero_cuota:      c.numero_cuota,
      fecha_vencimiento: c.fecha_vencimiento,
      dias_atraso:       dias,
      // §3.1/RN-19: show the calculated contable state, not the stored flag.
      estado:            saldos.clasificarMora(dias),
    };

    const fracciones   = c.cuota_fraccion || [];
    const totalRecibos = saldos._sumRecibosAceptados(c.cuota_pago);

    if (fracciones.length === 0) {
      // RN-10: pending = value minus accepted receipts (single source criterion).
      const saldo = Math.max(0, Number(c.valor_cuota) - totalRecibos);
      result.push({ ...base, valor_cuota: c.valor_cuota, valor_pendiente: saldo, tiene_fracciones: false });
    } else {
      const pagadoAceptado = totalRecibos;
      let acumuladoFrac = 0;
      const fraccionesCompletadas = new Set();
      for (const f of fracciones) {
        acumuladoFrac += Number(f.valor_fraccion);
        if (pagadoAceptado >= acumuladoFrac) fraccionesCompletadas.add(f.id_fraccion);
      }
      for (const f of fracciones) {
        if (!fraccionesCompletadas.has(f.id_fraccion)) {
          // §3.3: each fracción has its own due date, so its mora state is derived from
          // fecha_propuesta, not the parent cuota's fecha_vencimiento.
          const fFecha   = f.fecha_propuesta || c.fecha_vencimiento;
          const diasFrac = Math.floor((hoy - new Date(fFecha).getTime()) / 86_400_000);
          result.push({
            ...base,
            id_fraccion:       f.id_fraccion,
            numero_fraccion:   f.numero_fraccion,
            total_fracciones:  fracciones.length,
            valor_cuota:       f.valor_fraccion,
            valor_pendiente:   f.valor_fraccion,
            fecha_vencimiento: fFecha,
            dias_atraso:       diasFrac,
            estado:            saldos.clasificarMora(diasFrac),
            tiene_fracciones:  true,
          });
        }
      }
    }
  }

  res.json(result);
};

exports.getVencidas = async (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      id_cuota, numero_cuota, fecha_vencimiento, valor_cuota,
      cuota_pago(valor_aplicado, pago:id_pago(estado, recibo_pago(id_recibo))),
      venta(lote(codigo_lote, proyecto(nombre)), venta_comprador(usuario:id_usuario(nombres, apellidos)))
    `)
    .lt("fecha_vencimiento", hoy)
    .neq("estado", "pagada")
    .order("fecha_vencimiento");
  if (error) return res.status(500).json({ error: error.message });

  const result = [];
  for (const c of (data || [])) {
    // RN-10/RN-16: real saldo and state derived from receipts, never from the stored estado.
    const totalRecibos = saldos._sumRecibosAceptados(c.cuota_pago);
    const saldo        = Math.max(0, Number(c.valor_cuota) - totalRecibos);
    if (saldo <= 0) continue;

    const lote      = c.venta?.lote;
    const comprador = c.venta?.venta_comprador?.[0]?.usuario;
    const dias      = Math.floor((Date.now() - new Date(c.fecha_vencimiento).getTime()) / 86_400_000);
    result.push({
      id_cuota:          c.id_cuota,
      proyecto:          lote?.proyecto?.nombre || "—",
      codigo_lote:       lote?.codigo_lote      || "—",
      comprador:         comprador ? `${comprador.nombres} ${comprador.apellidos || ""}`.trim() : "—",
      numero_cuota:      c.numero_cuota,
      fecha_vencimiento: c.fecha_vencimiento,
      dias_atraso:       dias,
      valor_cuota:       c.valor_cuota,
      valor_pendiente:   saldo,
      estado:            saldos.clasificarMora(dias),
    });
  }
  res.json(result);
};


exports.getFracciones = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid cuota ID' });

  const { data, error } = await supabase.schema(SCHEMA)
    .from('cuota_fraccion')
    .select('*')
    .eq('id_cuota', id)
    .order('numero_fraccion');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
};

exports.setFracciones = async (req, res) => {
  if (req.usuario.rol !== 'auxiliar_contable') {
    return res.status(403).json({ error: 'Only auxiliar_contable can manage cuota fractions' });
  }

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid cuota ID' });

  const { fracciones } = req.body;
  if (!Array.isArray(fracciones) || fracciones.length === 0) {
    return res.status(400).json({ error: 'fracciones must be a non-empty array' });
  }

  for (const f of fracciones) {
    if (typeof f.valor_fraccion !== 'number' || f.valor_fraccion <= 0) {
      return res.status(400).json({ error: 'Each fraction must have a positive valor_fraccion' });
    }
  }

  const { data: cuota, error: cuotaErr } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_cuota, valor_cuota, estado')
    .eq('id_cuota', id)
    .single();

  if (cuotaErr || !cuota) return res.status(404).json({ error: 'Cuota not found' });
  if (cuota.estado === 'pagada') {
    return res.status(400).json({ error: 'Cannot subdivide a paid cuota' });
  }

  const sum = fracciones.reduce((s, f) => s + f.valor_fraccion, 0);
  if (Math.abs(sum - Number(cuota.valor_cuota)) > 1) {
    return res.status(400).json({
      error: `Sum of fractions (${sum}) must equal cuota value (${cuota.valor_cuota}) ±1`,
    });
  }

  // B/§4.3: (re)defining the subdivision invalidates every active factura of the cuota
  // (whole-cuota and any previous fracción). Annul the 'emitida' ones; block if any has
  // receipts (those cannot be annulled).
  const facPrevia = await facturas.anularFacturasActivas(id, {
    scope: 'all', usuario: req.usuario.email, motivo: 'subdivision_cuota',
  });
  if (facPrevia.blocked) {
    return res.status(400).json({ error: 'No se puede subdividir: ya hay una factura con pagos registrados para esta cuota o una de sus fracciones. Termina o anula ese cobro antes de subdividir.' });
  }

  const { error: delErr } = await supabase.schema(SCHEMA)
    .from('cuota_fraccion')
    .delete()
    .eq('id_cuota', id);

  if (delErr) return res.status(500).json({ error: delErr.message });

  const rows = fracciones.map((f, i) => ({
    id_cuota:        id,
    numero_fraccion: i + 1,
    valor_fraccion:  f.valor_fraccion,
    fecha_propuesta: f.fecha_propuesta || null,
    notas:           f.notas || null,
  }));

  const { data: inserted, error: insErr } = await supabase.schema(SCHEMA)
    .from('cuota_fraccion')
    .insert(rows)
    .select();

  if (insErr) return res.status(500).json({ error: insErr.message });

  await supabase.schema(SCHEMA).from('auditoria').insert({
    tabla_afectada: 'cuota_fraccion',
    id_registro:    id,
    campo:          'fracciones',
    valor_anterior: null,
    valor_nuevo:    JSON.stringify(rows.map(r => ({ n: r.numero_fraccion, v: r.valor_fraccion }))),
    usuario_db:     req.usuario.email,
    fecha_cambio:   new Date().toISOString(),
    motivo:         'subdivision_cuota',
  });

  res.status(201).json(inserted);
};

exports.deleteFracciones = async (req, res) => {
  if (req.usuario.rol !== 'auxiliar_contable') {
    return res.status(403).json({ error: 'Only auxiliar_contable can delete cuota fractions' });
  }

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid cuota ID' });

  const { data: cuota, error: cuotaErr } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_cuota, estado')
    .eq('id_cuota', id)
    .single();

  if (cuotaErr || !cuota) return res.status(404).json({ error: 'Cuota not found' });
  if (cuota.estado === 'pagada') {
    return res.status(400).json({ error: 'Cannot modify fractions of a paid cuota' });
  }

  // §4.3: reverting to a whole cuota — annul the fracción facturas; block if any has receipts.
  const facFrac = await facturas.anularFacturasActivas(id, {
    scope: 'fracciones', usuario: req.usuario.email, motivo: 'eliminar_subdivision_cuota',
  });
  if (facFrac.blocked) {
    return res.status(400).json({ error: 'No se puede eliminar la subdivisión: una fracción tiene factura con pagos. Termina o anula ese cobro primero.' });
  }

  const { error: delErr } = await supabase.schema(SCHEMA)
    .from('cuota_fraccion')
    .delete()
    .eq('id_cuota', id);

  if (delErr) return res.status(500).json({ error: delErr.message });

  await supabase.schema(SCHEMA).from('auditoria').insert({
    tabla_afectada: 'cuota_fraccion',
    id_registro:    id,
    campo:          'fracciones',
    valor_anterior: 'subdivision_existente',
    valor_nuevo:    null,
    usuario_db:     req.usuario.email,
    fecha_cambio:   new Date().toISOString(),
    motivo:         'eliminar_subdivision_cuota',
  });

  res.json({ ok: true });
};

