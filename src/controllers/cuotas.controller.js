const supabase = require("../config/supabase");
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

exports.updateEstado = async (req, res) => {
  const { estado } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("cuota")
    .update({ estado }).eq("id_cuota", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

exports.updateValores = async (req, res) => {
  if (req.usuario.rol !== 'auxiliar_contable') {
    return res.status(403).json({ error: 'Solo el auxiliar contable puede editar valores de cuotas' });
  }

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de cuota inválido' });

  const { valor_cuota, fecha_vencimiento, motivo } = req.body;

  if (valor_cuota !== undefined && (typeof valor_cuota !== 'number' || valor_cuota <= 0)) {
    return res.status(400).json({ error: 'valor_cuota debe ser un número mayor a 0' });
  }
  if (fecha_vencimiento !== undefined && isNaN(Date.parse(fecha_vencimiento))) {
    return res.status(400).json({ error: 'fecha_vencimiento no es una fecha válida' });
  }
  if (valor_cuota === undefined && fecha_vencimiento === undefined) {
    return res.status(400).json({ error: 'Debe enviar valor_cuota o fecha_vencimiento' });
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

exports.getPendientes = async (req, res) => {
  const { rango_pago } = req.query;

  const { data, error } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select("*, venta(lote(codigo_lote, proyecto(nombre)), venta_comprador(comprador(nombres, apellidos, documento, rango_pago))), cuota_fraccion(id_fraccion)")
    .neq("estado", "pagada")
    .order("fecha_vencimiento");
  if (error) return res.status(500).json({ error: error.message });

  const hoy = Date.now();
  let result = (data || []).map(c => {
    const lote      = c.venta?.lote;
    const comprador = c.venta?.venta_comprador?.[0]?.comprador;
    const dias      = Math.floor((hoy - new Date(c.fecha_vencimiento).getTime()) / 86_400_000);
    return {
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
      valor_cuota:       c.valor_cuota,
      valor_pendiente:   c.valor_cuota,
      estado:            c.estado,
      tiene_fracciones:  (c.cuota_fraccion?.length || 0) > 0,
    };
  });

  if (rango_pago) result = result.filter(c => c.rango_pago === rango_pago);

  res.json(result);
};

exports.getVencidas = async (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select("*, venta(lote(codigo_lote, proyecto(nombre)), venta_comprador(comprador(nombres, apellidos)))")
    .lt("fecha_vencimiento", hoy)
    .neq("estado", "pagada")
    .order("fecha_vencimiento");
  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(c => {
    const lote      = c.venta?.lote;
    const comprador = c.venta?.venta_comprador?.[0]?.comprador;
    const dias      = Math.floor((Date.now() - new Date(c.fecha_vencimiento).getTime()) / 86_400_000);
    return {
      id_cuota:          c.id_cuota,
      proyecto:          lote?.proyecto?.nombre || "—",
      codigo_lote:       lote?.codigo_lote      || "—",
      comprador:         comprador ? `${comprador.nombres} ${comprador.apellidos || ""}`.trim() : "—",
      numero_cuota:      c.numero_cuota,
      fecha_vencimiento: c.fecha_vencimiento,
      dias_atraso:       dias,
      valor_cuota:       c.valor_cuota,
      valor_pendiente:   c.valor_cuota,
      estado:            c.estado,
    };
  }));
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

exports.getMisCuotas = async (req, res) => {
  const id_comprador = req.usuario.id_comprador;
  if (!id_comprador) return res.status(400).json({ error: "Sin comprador vinculado" });

  const { data: vcData, error: vcErr } = await supabase.schema(SCHEMA)
    .from("venta_comprador")
    .select("id_venta")
    .eq("id_comprador", id_comprador);

  if (vcErr) return res.status(500).json({ error: vcErr.message });
  const ventaIds = (vcData || []).map(vc => vc.id_venta);
  if (!ventaIds.length) return res.json([]);

  const { data, error } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      id_cuota, id_venta, numero_cuota, tipo,
      fecha_vencimiento, valor_cuota, estado, es_extraordinaria,
      cuota_pago (
        valor_aplicado,
        pago:id_pago ( id_pago, estado, fecha_pago, metodo_pago )
      ),
      venta:id_venta (
        lote:id_lote (
          codigo_lote,
          proyecto:id_proyecto (nombre)
        )
      )
    `)
    .in("id_venta", ventaIds)
    .order("numero_cuota");

  if (error) return res.status(500).json({ error: error.message });

  const hoy = new Date();

  res.json((data || []).map(c => {
    const pagadoAceptado = (c.cuota_pago || [])
      .filter(cp => cp.pago?.estado === "aceptado")
      .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);
    const enRevision = (c.cuota_pago || [])
      .filter(cp => cp.pago?.estado === "pendiente_revision")
      .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);
    const dias = Math.floor((new Date(c.fecha_vencimiento + "T12:00:00") - hoy) / 86_400_000);
    return {
      id_cuota:          c.id_cuota,
      id_venta:          c.id_venta,
      numero_cuota:      c.numero_cuota,
      tipo:              c.tipo,
      fecha_vencimiento: c.fecha_vencimiento,
      valor_cuota:       Number(c.valor_cuota),
      estado:            c.estado,
      es_extraordinaria: c.es_extraordinaria,
      valor_pagado:      pagadoAceptado,
      valor_pendiente:   Math.max(0, Number(c.valor_cuota) - pagadoAceptado),
      valor_en_revision: enRevision,
      dias_restantes:    dias,
      lote:              c.venta?.lote?.codigo_lote   || "�",
      proyecto:          c.venta?.lote?.proyecto?.nombre || "�",
    };
  }));
};
