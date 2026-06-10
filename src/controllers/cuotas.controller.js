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

exports.getPendientes = async (req, res) => {
  const { rango_pago } = req.query;

  const { data, error } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      *,
      venta(lote(codigo_lote, proyecto(nombre)), venta_comprador(usuario:id_usuario(nombres, apellidos, documento, rango_pago))),
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
      rango_pago:        comprador?.rango_pago  || null,
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
          result.push({
            ...base,
            id_fraccion:       f.id_fraccion,
            numero_fraccion:   f.numero_fraccion,
            total_fracciones:  fracciones.length,
            valor_cuota:       f.valor_fraccion,
            valor_pendiente:   f.valor_fraccion,
            fecha_vencimiento: f.fecha_propuesta || c.fecha_vencimiento,
            tiene_fracciones:  true,
          });
        }
      }
    }
  }

  const filtered = rango_pago ? result.filter(c => c.rango_pago === rango_pago) : result;
  res.json(filtered);
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

