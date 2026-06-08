const supabase = require("../config/supabase");
const saldos   = require("../services/saldos.service");
const SCHEMA   = "condor";

const ESTADOS_FACTURA_ACTIVA = ["emitida", "parcialmente_pagada"];

function _periodo() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function _nextConsec(prefijo, periodo) {
  const { data, error } = await supabase.rpc("next_consecutivo_condor", {
    p_prefijo: prefijo,
    p_periodo: periodo,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function _buildNumFactura(id_cuota) {
  const periodo = _periodo();
  let sigla = "GEN";
  if (id_cuota) {
    const { data } = await supabase.schema(SCHEMA)
      .from("cuota")
      .select("venta:id_venta(lote:id_lote(proyecto:id_proyecto(sigla)))")
      .eq("id_cuota", id_cuota)
      .single();
    sigla = data?.venta?.lote?.proyecto?.sigla || "GEN";
  }
  const n = await _nextConsec("FV", periodo);
  return `FV-${periodo}-${sigla}-${String(n).padStart(5, "0")}`;
}

// RN-10: the value to bill is the current saldo (cuota or fracción), discounting receipts.
async function _saldoParaFactura(id_cuota, id_fraccion) {
  if (id_fraccion) {
    const f = await saldos.getSaldoFraccion(id_fraccion);
    return f ? Number(f.saldo_pendiente) : 0;
  }
  const c = await saldos.getSaldoCuota(id_cuota);
  return c ? Number(c.saldo_pendiente) : 0;
}

// RN-03: at most one active factura (emitida/parcialmente_pagada) per cuota/fracción.
async function _facturaActivaDe(id_cuota, id_fraccion) {
  const { data } = await supabase.schema(SCHEMA)
    .from("cuota_factura")
    .select("id_fraccion, factura:id_factura(id_factura, numero_factura, valor_facturado, estado)")
    .eq("id_cuota", id_cuota);
  const match = (data || []).find(cf =>
    (id_fraccion ? cf.id_fraccion === id_fraccion : cf.id_fraccion === null) &&
    ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado)
  );
  return match?.factura || null;
}

// Emits the single active factura for a cuota/fracción, or reuses the existing one
// (RN-03). valor defaults to the current saldo; an explicit valorAcordado (<= saldo)
// supports a partial-payment agreement (Modalidad A, 8.1). Only the aux reaches this.
async function _emitirFactura(id_cuota, id_fraccion = null, opts = {}) {
  const { valorAcordado = null, observaciones = null, fecha_emision = null } = opts;

  const existing = await _facturaActivaDe(id_cuota, id_fraccion);
  if (existing) return { factura: existing, reused: true };

  const saldo = await _saldoParaFactura(id_cuota, id_fraccion);
  if (saldo <= 0) return { error: "La cuota ya está cubierta; no hay saldo para facturar" };

  let valor = saldo;
  if (valorAcordado != null) {
    if (valorAcordado <= 0)    return { error: "El valor a facturar debe ser mayor a 0" };
    if (valorAcordado > saldo) return { error: "El valor a facturar no puede superar el saldo pendiente" };
    valor = valorAcordado;
  }

  let numero_factura;
  try { numero_factura = await _buildNumFactura(id_cuota); }
  catch (e) { return { error: `Error al generar número de factura: ${e.message}` }; }

  const { data: factura, error } = await supabase.schema(SCHEMA).from("factura")
    .insert([{
      numero_factura,
      fecha_emision: fecha_emision || new Date().toISOString().split("T")[0],
      valor_facturado: valor,
      estado: "emitida",
      observaciones,
    }])
    .select().single();
  if (error) return { error: error.message };

  await supabase.schema(SCHEMA).from("cuota_factura")
    .insert([{ id_factura: factura.id_factura, id_cuota, id_fraccion: id_fraccion || null }]);

  return { factura, reused: false };
}

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("factura")
    .select(`
      id_factura, numero_factura, fecha_emision, valor_facturado, estado, observaciones,
      cuota_factura(
        id_fraccion,
        cuota:id_cuota(
          id_cuota, numero_cuota, fecha_vencimiento, valor_cuota, estado,
          venta(
            id_venta,
            lote(codigo_lote, proyecto(nombre)),
            venta_comprador(usuario:id_usuario(nombres, apellidos, documento))
          )
        )
      )
    `)
    .order("fecha_emision", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const { data: pagosEnRevision } = await supabase.schema(SCHEMA)
    .from('pago')
    .select('id_cuota_propuesta')
    .eq('estado', 'pendiente_revision')
    .not('id_cuota_propuesta', 'is', null);
  const cuotasEnRevision = new Set((pagosEnRevision || []).map(p => p.id_cuota_propuesta));

  res.json((data || [])
    .filter(f => {
      const cuota = f.cuota_factura?.[0]?.cuota;
      return cuota?.estado !== 'pagada' && !cuotasEnRevision.has(cuota?.id_cuota);
    })
    .map(f => {
    const link  = f.cuota_factura?.[0];
    const cuota = link?.cuota;
    const lote  = cuota?.venta?.lote;
    const comp  = cuota?.venta?.venta_comprador?.[0]?.usuario;
    return {
      id_factura:        f.id_factura,
      numero_factura:    f.numero_factura,
      fecha_emision:     f.fecha_emision,
      valor_facturado:   f.valor_facturado,
      estado:            f.estado,
      observaciones:     f.observaciones,
      id_fraccion:       link?.id_fraccion         ?? null,
      id_venta:          cuota?.venta?.id_venta    ?? null,
      id_cuota:          cuota?.id_cuota           ?? null,
      numero_cuota:      cuota?.numero_cuota        ?? null,
      fecha_vencimiento: cuota?.fecha_vencimiento   ?? null,
      proyecto:          lote?.proyecto?.nombre     ?? "—",
      codigo_lote:       lote?.codigo_lote          ?? "—",
      comprador:         comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
    };
  }));
};
  
exports.getCuotasSinFactura = async (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  const ESTADOS_FACTURABLES = ["activa", "pre_mora", "en_mora"];

  const { data, error } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      id_cuota, numero_cuota, fecha_vencimiento, valor_cuota, estado,
      cuota_fraccion(id_fraccion, numero_fraccion, valor_fraccion, fecha_propuesta),
      cuota_factura(id_cuota, id_fraccion, factura:id_factura(estado)),
      venta(
        id_venta,
        estado,
        lote(codigo_lote, proyecto(nombre)),
        venta_comprador(usuario:id_usuario(nombres, apellidos))
      )
    `)
    .lte("fecha_vencimiento", hoy)
    .neq("estado", "pagada")
    .order("fecha_vencimiento");

  if (error) return res.status(500).json({ error: error.message });

  const result = [];

  for (const c of (data || [])) {
    if (!ESTADOS_FACTURABLES.includes(c.venta?.estado)) continue;

    const lote = c.venta?.lote;
    const comp = c.venta?.venta_comprador?.[0]?.usuario;
    const base = {
      id_cuota:          c.id_cuota,
      id_venta:          c.venta?.id_venta ?? null,
      estado_venta:      c.venta?.estado   ?? null,
      numero_cuota:      c.numero_cuota,
      fecha_vencimiento: c.fecha_vencimiento,
      estado:            c.estado,
      proyecto:          lote?.proyecto?.nombre ?? "—",
      codigo_lote:       lote?.codigo_lote      ?? "—",
      comprador:         comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
    };

    const fracciones         = c.cuota_fraccion || [];
    const facturasExistentes = c.cuota_factura  || [];

    if (fracciones.length === 0) {
      if (!facturasExistentes.some(cf => cf.id_fraccion === null && ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado))) {
        result.push({ ...base, valor_cuota: c.valor_cuota, tiene_fracciones: false });
      }
    } else {
      const fraccionesFacturadas = new Set(
        facturasExistentes
          .filter(cf => ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado))
          .map(cf => cf.id_fraccion)
          .filter(Boolean)
      );
      for (const f of fracciones) {
        if (!fraccionesFacturadas.has(f.id_fraccion)) {
          result.push({
            ...base,
            id_fraccion:       f.id_fraccion,
            numero_fraccion:   f.numero_fraccion,
            total_fracciones:  fracciones.length,
            valor_cuota:       f.valor_fraccion,
            fecha_vencimiento: f.fecha_propuesta || c.fecha_vencimiento,
            tiene_fracciones:  true,
          });
        }
      }
    }
  }

  res.json(result);
};

// Proactive model: bill overdue cuotas and those about to fall due within N days.
const PROACTIVE_DIAS = 10;

exports.generarPendientes = async (req, res) => {
  const ESTADOS_FACTURABLES = ["activa", "pre_mora", "en_mora"];
  const limite = new Date();
  limite.setDate(limite.getDate() + PROACTIVE_DIAS);
  const limiteStr = limite.toISOString().split("T")[0];

  const { data: cuotas, error: ec } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      id_cuota, id_venta, numero_cuota, valor_cuota,
      cuota_fraccion(id_fraccion),
      cuota_factura(id_cuota),
      venta(id_venta, estado)
    `)
    .lte("fecha_vencimiento", limiteStr)
    .neq("estado", "pagada");
  if (ec) return res.status(500).json({ error: ec.message });

  const pendientes = (cuotas || []).filter(c =>
    !c.cuota_factura?.length &&
    !c.cuota_fraccion?.length &&
    ESTADOS_FACTURABLES.includes(c.venta?.estado)
  );
  if (!pendientes.length) return res.json({ generadas: 0 });

  let generadas = 0;
  for (const c of pendientes) {
    const { factura, reused } = await _emitirFactura(c.id_cuota, null);
    if (factura && !reused) generadas++;
  }

  res.json({ generadas });
};

exports.create = async (req, res) => {
  const { fecha_emision, valor_facturado, observaciones, id_cuota, id_fraccion } = req.body;
  if (!id_cuota) return res.status(400).json({ error: "id_cuota requerido" });

  const { data: cuota } = await supabase.schema(SCHEMA)
    .from("cuota").select("estado").eq("id_cuota", id_cuota).single();
  if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" });
  if (cuota.estado === "pagada") return res.status(400).json({ error: "La cuota ya está pagada" });

  const valorAcordado = valor_facturado != null && Number(valor_facturado) > 0 ? Number(valor_facturado) : null;
  const { factura, reused, error } = await _emitirFactura(id_cuota, id_fraccion || null, {
    valorAcordado, observaciones: observaciones || null, fecha_emision: fecha_emision || null,
  });
  if (error) return res.status(400).json({ error });
  res.status(reused ? 200 : 201).json(factura);
};

exports.getMisFacturas = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  if (!id_usuario) return res.status(400).json({ error: "Sin usuario vinculado" });

  const { data: vc, error: ev } = await supabase.schema(SCHEMA)
    .from("venta_comprador").select("id_venta").eq("id_usuario", id_usuario);

  if (ev || !vc?.length) return res.json([]);

  const ventaIds = vc.map(v => v.id_venta);

  const { data: cuotas, error: ec } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      id_cuota, numero_cuota, fecha_vencimiento, valor_cuota, id_venta,
      cuota_factura(id_fraccion, factura:id_factura(id_factura, numero_factura, valor_facturado, estado, fecha_emision)),
      cuota_fraccion(id_fraccion, numero_fraccion, valor_fraccion),
      cuota_pago(valor_aplicado, pago:id_pago(estado)),
      venta:id_venta(lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)))
    `)
    .in("id_venta", ventaIds)
    .neq("estado", "pagada");

  if (ec) return res.status(500).json({ error: ec.message });

  const result = [];
  for (const c of (cuotas || [])) {
    const fracciones = (c.cuota_fraccion || []).sort((a, b) => a.numero_fraccion - b.numero_fraccion);

    const facturasEmitidas = (c.cuota_factura || [])
      .filter(cf => cf.factura?.estado === "emitida")
      .map(cf => ({ ...cf.factura, id_fraccion: cf.id_fraccion }));

    if (!facturasEmitidas.length) continue;

    const lote = c.venta?.lote;
    let visibleFacturas = facturasEmitidas;

    if (fracciones.length > 0) {
      const totalAceptado = (c.cuota_pago || [])
        .filter(cp => cp.pago?.estado === "aceptado")
        .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);

      const coveredFracciones = new Set();
      let remaining = totalAceptado;
      for (const f of fracciones) {
        if (remaining >= Number(f.valor_fraccion)) {
          coveredFracciones.add(f.id_fraccion);
          remaining -= Number(f.valor_fraccion);
        } else {
          break;
        }
      }

      visibleFacturas = facturasEmitidas.filter(f => !coveredFracciones.has(f.id_fraccion));
    }

    if (!visibleFacturas.length) continue;

    for (const factura of visibleFacturas) {
      result.push({
        id_factura:        factura.id_factura,
        numero_factura:    factura.numero_factura,
        valor_facturado:   factura.valor_facturado,
        fecha_emision:     factura.fecha_emision,
        id_cuota:          c.id_cuota,
        numero_cuota:      c.numero_cuota,
        fecha_vencimiento: c.fecha_vencimiento,
        id_venta:          c.id_venta,
        proyecto:          lote?.proyecto?.nombre ?? "—",
        codigo_lote:       lote?.codigo_lote      ?? "—",
      });
    }
  }

  const idsCuotas = result.map(r => r.id_cuota);
  if (idsCuotas.length) {
    const { data: pagosPendientes } = await supabase.schema(SCHEMA)
      .from("pago")
      .select("id_cuota_propuesta")
      .eq("id_usuario", id_usuario)
      .eq("estado", "pendiente_revision")
      .in("id_cuota_propuesta", idsCuotas);

    const cuotasConComprobante = new Set((pagosPendientes || []).map(p => p.id_cuota_propuesta));
    for (const r of result) {
      r.tiene_comprobante_pendiente = cuotasConComprobante.has(r.id_cuota);
    }
  }

  res.json(result);
};

exports.emitirParaCuota = async (req, res) => {
  const { id_cuota } = req.body;
  if (!id_cuota) return res.status(400).json({ error: "id_cuota requerido" });

  const id_usuario = req.usuario.id_usuario;

  const { data: cuota, error: ec } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      id_cuota, numero_cuota, valor_cuota, estado,
      cuota_fraccion(id_fraccion, numero_fraccion, valor_fraccion),
      cuota_factura(id_fraccion, factura:id_factura(id_factura, estado, numero_factura, valor_facturado)),
      cuota_pago(valor_aplicado, pago:id_pago(estado)),
      venta:id_venta(
        id_venta, estado,
        lote:id_lote(proyecto:id_proyecto(sigla)),
        venta_comprador(id_usuario)
      )
    `)
    .eq("id_cuota", id_cuota)
    .single();

  if (ec || !cuota) return res.status(404).json({ error: "Cuota no encontrada" });

  const ownsVenta = (cuota.venta?.venta_comprador || []).some(vc => vc.id_usuario === id_usuario);
  if (!ownsVenta) return res.status(403).json({ error: "No tienes acceso a esta cuota" });

  if (cuota.estado === "pagada") return res.status(400).json({ error: "Esta cuota ya esta pagada" });

  const fracciones = (cuota.cuota_fraccion || []).sort((a, b) => a.numero_fraccion - b.numero_fraccion);
  const fraccionesFacturadas = new Set(
    (cuota.cuota_factura || [])
      .filter(cf => cf.factura?.estado !== 'anulada')
      .map(cf => cf.id_fraccion)
      .filter(Boolean)
  );
  const fraccionPendiente = fracciones.find(f => !fraccionesFacturadas.has(f.id_fraccion)) || null;

  if (fraccionPendiente) {
    const existingFrac = (cuota.cuota_factura || [])
      .find(cf => cf.id_fraccion === fraccionPendiente.id_fraccion && ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado));
    if (existingFrac) {
      return res.json({
        id_factura:       existingFrac.factura.id_factura,
        numero_factura:   existingFrac.factura.numero_factura,
        valor_facturado:  existingFrac.factura.valor_facturado,
        numero_fraccion:  fraccionPendiente.numero_fraccion,
        total_fracciones: fracciones.length,
      });
    }

    const hoy = new Date().toISOString().split("T")[0];
    let numero_factura;
    try { numero_factura = await _buildNumFactura(id_cuota); }
    catch (e) { return res.status(500).json({ error: `Error al generar numero de factura: ${e.message}` }); }

    const { data: factura, error: ef } = await supabase.schema(SCHEMA)
      .from("factura")
      .insert([{ numero_factura, fecha_emision: hoy, valor_facturado: fraccionPendiente.valor_fraccion, estado: "emitida" }])
      .select().single();
    if (ef) return res.status(500).json({ error: ef.message });

    await supabase.schema(SCHEMA).from("cuota_factura").insert([{
      id_factura:  factura.id_factura,
      id_cuota,
      id_fraccion: fraccionPendiente.id_fraccion,
    }]);

    return res.status(201).json({
      id_factura:       factura.id_factura,
      numero_factura:   factura.numero_factura,
      valor_facturado:  factura.valor_facturado,
      numero_fraccion:  fraccionPendiente.numero_fraccion,
      total_fracciones: fracciones.length,
    });
  }

  // No fracciones: deduct any accepted abono payments already applied to this cuota
  const yaPagado = (cuota.cuota_pago || [])
    .filter(cp => cp.pago?.estado === 'aceptado')
    .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);
  const valorAFacturar = Math.max(0, Number(cuota.valor_cuota) - yaPagado);

  if (valorAFacturar <= 0)
    return res.status(400).json({ error: "Esta cuota ya tiene un abono que la cubre completamente" });

  const existing = (cuota.cuota_factura || [])
    .find(cf => cf.id_fraccion === null && ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado));
  if (existing) {
    if (Number(existing.factura.valor_facturado) !== valorAFacturar) {
      await supabase.schema(SCHEMA).from("factura")
        .update({ valor_facturado: valorAFacturar })
        .eq("id_factura", existing.factura.id_factura);
    }
    return res.json({
      id_factura:      existing.factura.id_factura,
      numero_factura:  existing.factura.numero_factura,
      valor_facturado: valorAFacturar,
    });
  }

  const hoy = new Date().toISOString().split("T")[0];
  let numero_factura;
  try {
    numero_factura = await _buildNumFactura(id_cuota);
  } catch (e) {
    return res.status(500).json({ error: `Error al generar numero de factura: ${e.message}` });
  }

  const { data: factura, error: ef } = await supabase.schema(SCHEMA)
    .from("factura")
    .insert([{ numero_factura, fecha_emision: hoy, valor_facturado: valorAFacturar, estado: "emitida" }])
    .select()
    .single();

  if (ef) return res.status(500).json({ error: ef.message });

  await supabase.schema(SCHEMA).from("cuota_factura").insert([{
    id_factura: factura.id_factura,
    id_cuota,
  }]);

  res.status(201).json({
    id_factura:      factura.id_factura,
    numero_factura:  factura.numero_factura,
    valor_facturado: factura.valor_facturado,
  });
};

exports.anular = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("factura").update({ estado: "anulada" }).eq("id_factura", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
