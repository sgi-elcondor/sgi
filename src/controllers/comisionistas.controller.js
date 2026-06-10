const supabase     = require("../config/supabase");
const consecutivos = require("../services/consecutivos.service");
const saldos       = require("../services/saldos.service");
const SCHEMA       = "condor";

async function comisionistaRolId() {
  const { data } = await supabase.schema(SCHEMA).from("roles").select("id_rol").eq("nombre", "comisionista").single();
  return data?.id_rol ?? null;
}

exports.getAll = async (req, res) => {
  const id_rol = await comisionistaRolId();
  if (!id_rol) return res.status(500).json({ error: "Rol comisionista no encontrado" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("usuarios")
    .select("id_usuario, email, activo, nombres, apellidos, documento, telefono, fecha_creacion")
    .eq("id_rol", id_rol)
    .order("nombres");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { documento, nombres, apellidos, telefono, mail } = req.body;

  const id_rol = await comisionistaRolId();
  if (!id_rol) return res.status(500).json({ error: "Rol comisionista no encontrado" });

  if (documento) {
    const { data: existing } = await supabase.schema(SCHEMA)
      .from("usuarios").select("id_usuario").eq("documento", documento).limit(1);
    if (existing?.length) return res.status(409).json({ error: "Ya existe un usuario con ese documento." });
  }

  const { data, error } = await supabase.schema(SCHEMA)
    .from("usuarios")
    .insert([{ documento: documento || null, nombres, apellidos, telefono: telefono || null, email: mail || null, id_rol, activo: true }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.update = async (req, res) => {
  const { documento, nombres, apellidos, telefono, mail } = req.body;

  const updates = {};
  if (documento !== undefined) updates.documento = documento;
  if (nombres   !== undefined) updates.nombres   = nombres;
  if (apellidos !== undefined) updates.apellidos = apellidos;
  if (telefono  !== undefined) updates.telefono  = telefono || null;
  if (mail      !== undefined) updates.email     = mail;

  const { data, error } = await supabase.schema(SCHEMA)
    .from("usuarios").update(updates).eq("id_usuario", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

exports.getComisiones = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_comisiones_causadas").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getComisionesDetail = async (req, res) => {
  const id = req.params.id;

  const { data: comisiones, error } = await supabase.schema(SCHEMA)
    .from("venta_comisionista")
    .select(`
      id_venta, id_usuario, valor_comision, estado, fecha_ganada, pagada, fecha_pagado,
      venta:id_venta(
        id_venta, valor_total, total_permutas, fecha_venta, estado,
        lote:id_lote(codigo_lote, manzana, numero_lote, proyecto:id_proyecto(nombre)),
        venta_comprador(usuario:id_usuario(nombres, apellidos, documento))
      )
    `)
    .eq("id_usuario", id)
    .order("id_venta", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const ventaIds = (comisiones || []).map(vc => vc.id_venta).filter(Boolean);

  let micropagosMap  = {};
  let pagadoPorVenta = {};

  if (ventaIds.length > 0) {
    const { data: pagosVenta } = await supabase.schema(SCHEMA)
      .from("pago")
      .select("id_venta, valor_pago, estado, recibo_pago(id_recibo)")
      .in("id_venta", ventaIds)
      .eq("estado", "aceptado");

    let micropagos;
    const { data: mpFull, error: mpErr } = await supabase.schema(SCHEMA)
      .from("pago_comision")
      .select("*, recibo:id_recibo(numero_recibo)")
      .in("id_venta", ventaIds).order("fecha", { ascending: false });

    if (mpErr) {
      const { data: mpBase } = await supabase.schema(SCHEMA)
        .from("pago_comision")
        .select("id_pago_comision, valor, fecha, nota, created_at")
        .in("id_venta", ventaIds).order("fecha", { ascending: false });
      micropagos = mpBase;
    } else {
      micropagos = mpFull;
    }

    for (const m of micropagos || []) {
      if (!micropagosMap[m.id_venta]) micropagosMap[m.id_venta] = [];
      micropagosMap[m.id_venta].push(m);
    }

    // RN-10/RN-19: total paid per venta = receipt-backed payments (single source criterion).
    for (const p of pagosVenta || []) {
      if (saldos.pagoLiquidado(p)) {
        pagadoPorVenta[p.id_venta] = (pagadoPorVenta[p.id_venta] || 0) + Number(p.valor_pago);
      }
    }
  }

  const result = (comisiones || []).map(vc => {
    const venta       = vc.venta;
    // Permutas count as payment toward the 30% threshold (business rule).
    const totalPagado = (pagadoPorVenta[vc.id_venta] || 0) + (Number(venta?.total_permutas) || 0);
    const valorTotal  = Number(venta?.valor_total) || 0;
    const umbral30    = valorTotal * 0.3;
    const ganada      = vc.estado === "ganada" || vc.estado === "pagada"
      || (umbral30 > 0 && totalPagado >= umbral30);

    return {
      id_venta:           vc.id_venta,
      valor_comision:     vc.valor_comision,
      estado_comision:    vc.estado,
      fecha_ganada:       vc.fecha_ganada,
      pagada:             vc.pagada || false,
      fecha_pagado:       vc.fecha_pagado,
      ganada,
      total_pagado_venta: totalPagado,
      umbral_30pct:       umbral30,
      porcentaje_pagado:  valorTotal > 0
        ? Math.min(100, Math.round((totalPagado / valorTotal) * 100))
        : 0,
      venta: {
        id_venta:    venta?.id_venta,
        valor_total: venta?.valor_total,
        fecha_venta: venta?.fecha_venta,
        estado:      venta?.estado,
        lote:        venta?.lote,
        compradores: (venta?.venta_comprador || []).map(r => r.usuario),
      },
      micropagos: micropagosMap[vc.id_venta] || [],
    };
  });

  res.json(result);
};

exports.registrarMicropago = async (req, res) => {
  const ventaId              = req.params.ventaId;
  const { valor, fecha, nota } = req.body;

  if (!valor || Number(valor) <= 0)
    return res.status(400).json({ error: "El valor debe ser mayor a 0" });
  if (!fecha)
    return res.status(400).json({ error: "La fecha es obligatoria" });

  const emitido_por = req.usuario?.email || "sistema";

  const { data, error } = await supabase.schema(SCHEMA)
    .from("pago_comision")
    .insert([{ id_venta: Number(ventaId), valor: Number(valor), fecha, nota: nota || null, registrado_por: emitido_por }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  let numero_recibo = null;
  try {
    const consec     = await consecutivos.nextMicropago();
    const fecha_emis = new Date().toISOString().split("T")[0];

    const { data: recibo } = await supabase.schema(SCHEMA)
      .from("recibo")
      .insert([{ numero_recibo: consec.numero_recibo, fecha_emision: fecha_emis, emitido_por }])
      .select().single();

    if (recibo) {
      numero_recibo = consec.numero_recibo;
      await supabase.schema(SCHEMA).from("pago_comision")
        .update({ numero_pago: consec.numero_micropago, id_recibo: recibo.id_recibo })
        .eq("id_pago_comision", data.id_pago_comision);
    }
  } catch (reciboErr) {
    console.error("[micropago-comision] recibo generation failed:", reciboErr?.message || reciboErr);
  }

  await supabase.schema(SCHEMA).from("auditoria").insert([{
    tabla_afectada: "pago_comision",
    id_registro:    data.id_pago_comision,
    campo:          "creacion",
    valor_anterior: null,
    valor_nuevo:    JSON.stringify({ id_venta: ventaId, valor: data.valor, fecha }),
    usuario_db:     emitido_por,
    motivo:         "micropago_comision",
  }]);

  res.status(201).json({ ...data, numero_recibo });
};

exports.togglePagada = async (req, res) => {
  const ventaId      = req.params.ventaId;
  const { pagada }   = req.body;
  const fecha_pagado = pagada ? new Date().toISOString().split("T")[0] : null;

  const { data: prev } = await supabase.schema(SCHEMA)
    .from("venta_comisionista").select("pagada").eq("id_venta", ventaId).single();

  const { data, error } = await supabase.schema(SCHEMA)
    .from("venta_comisionista")
    .update({ pagada: !!pagada, fecha_pagado })
    .eq("id_venta", ventaId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabase.schema(SCHEMA).from("auditoria").insert([{
    tabla_afectada: "venta_comisionista",
    id_registro:    ventaId,
    campo:          "pagada",
    valor_anterior: String(prev?.pagada ?? false),
    valor_nuevo:    String(!!pagada),
    usuario_db:     req.usuario?.email,
    motivo:         "cambio_estado_pago_comision",
  }]);

  res.json(data);
};
