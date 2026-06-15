const supabase    = require("../config/supabase");
const saldos      = require("../services/saldos.service");
const usuariosSvc = require("../services/usuarios.service");
const SCHEMA      = "condor";

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

// §4.3/RN-03: when a cuota is restructured (subdivided or un-subdivided), the active
// facturas of the opposite scope must not coexist. Annuls the 'emitida' ones (audited).
// Returns { blocked: true } without changes if any matched factura is 'parcialmente_pagada'
// (has receipts) — those cannot be annulled for operational reasons.
// scope: 'cuota' → cuota-level facturas (id_fraccion null); 'fracciones' → fracción-level.
async function anularFacturasActivas(id_cuota, { scope, motivo, usuario }) {
  const { data } = await supabase.schema(SCHEMA)
    .from("cuota_factura")
    .select("id_fraccion, factura:id_factura(id_factura, estado)")
    .eq("id_cuota", id_cuota);

  const matched = (data || []).filter(cf => {
    if (!ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado)) return false;
    if (scope === "cuota")      return cf.id_fraccion === null;
    if (scope === "fracciones") return cf.id_fraccion !== null;
    return true; // 'all'
  });

  if (matched.some(cf => cf.factura.estado === "parcialmente_pagada")) {
    return { blocked: true, annulled: [] };
  }

  const annulled = [];
  for (const cf of matched) {
    await supabase.schema(SCHEMA).from("factura")
      .update({ estado: "anulada" }).eq("id_factura", cf.factura.id_factura);
    await supabase.schema(SCHEMA).from("auditoria").insert([{
      tabla_afectada: "factura",
      id_registro:    cf.factura.id_factura,
      campo:          "anulacion",
      valor_anterior: cf.factura.estado,
      valor_nuevo:    "anulada",
      usuario_db:     usuario,
      fecha_cambio:   new Date().toISOString(),
      motivo,
    }]);
    annulled.push(cf.factura.id_factura);
  }
  return { blocked: false, annulled };
}
exports.anularFacturasActivas = anularFacturasActivas;

// Emits the single active factura for a cuota/fracción, or reuses the existing one
// (RN-03). valor defaults to the current saldo; an explicit valorAcordado (<= saldo)
// supports a partial-payment agreement (Modalidad A, 8.1). Only the aux reaches this.
async function _emitirFactura(id_cuota, id_fraccion = null, opts = {}) {
  const { valorAcordado = null, observaciones = null, fecha_emision = null } = opts;

  // RN-06: no factura is emitted for a cuota whose comprador is inactive.
  const inactivos = await usuariosSvc.inactivosDeCuota(id_cuota);
  if (inactivos.length)
    return { error: `No se puede emitir la factura: el comprador ${usuariosSvc.nombresInactivos(inactivos)} está inactivo.` };

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
          cuota_pago(valor_aplicado, pago:id_pago(estado, numero_pago, recibo_pago(recibo:id_recibo(numero_recibo)))),
          cuota_fraccion(id_fraccion, numero_fraccion, valor_fraccion),
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

  // RN-19: the aux sees every active factura, including those whose cuota has a payment
  // under review (so a freshly emitted factura is never hidden from the aux list).
  res.json((data || [])
    .filter(f => f.cuota_factura?.[0]?.cuota?.estado !== 'pagada')
    .map(f => {
    const link  = f.cuota_factura?.[0];
    const cuota = link?.cuota;
    const lote  = cuota?.venta?.lote;
    const comp  = cuota?.venta?.venta_comprador?.[0]?.usuario;

    // RN-10: remaining saldo to settle this factura (cuota- or fracción-level).
    const totalAceptado = saldos._sumRecibosAceptados(cuota?.cuota_pago);
    let saldoBase = Math.max(0, Number(cuota?.valor_cuota ?? f.valor_facturado) - totalAceptado);
    if (link?.id_fraccion) {
      let remaining = totalAceptado;
      for (const fr of (cuota?.cuota_fraccion || []).sort((a, b) => a.numero_fraccion - b.numero_fraccion)) {
        const v = Number(fr.valor_fraccion);
        const pagado = Math.min(v, Math.max(0, remaining));
        remaining = Math.max(0, remaining - v);
        if (fr.id_fraccion === link.id_fraccion) { saldoBase = Math.max(0, v - pagado); break; }
      }
    }
    const valorAPagar = Math.min(Number(f.valor_facturado), saldoBase);

    // Document chain traceability: number of the accepted pago and its recibo, if any.
    const pagoAceptado = (cuota?.cuota_pago || [])
      .map(cp => cp.pago)
      .find(pg => pg?.estado === "aceptado");
    const numeroPago   = pagoAceptado?.numero_pago ?? null;
    const numeroRecibo = pagoAceptado?.recibo_pago?.[0]?.recibo?.numero_recibo ?? null;

    return {
      id_factura:        f.id_factura,
      numero_factura:    f.numero_factura,
      fecha_emision:     f.fecha_emision,
      valor_facturado:   f.valor_facturado,
      valor_a_pagar:     valorAPagar,
      estado:            f.estado,
      observaciones:     f.observaciones,
      id_fraccion:       link?.id_fraccion         ?? null,
      id_venta:          cuota?.venta?.id_venta    ?? null,
      id_cuota:          cuota?.id_cuota           ?? null,
      numero_cuota:      cuota?.numero_cuota        ?? null,
      numero_pago:       numeroPago,
      numero_recibo:     numeroRecibo,
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
      cuota_pago(valor_aplicado, pago:id_pago(estado, recibo_pago(id_recibo))),
      venta(
        id_venta,
        estado,
        lote(codigo_lote, proyecto(nombre)),
        venta_comprador(usuario:id_usuario(nombres, apellidos))
      )
    `)
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

    const totalRecibos       = saldos._sumRecibosAceptados(c.cuota_pago);
    const fracciones         = c.cuota_fraccion || [];
    const facturasExistentes = c.cuota_factura  || [];

    if (fracciones.length === 0) {
      // RN-10: only offer a due cuota (parent date reached) with no active factura AND saldo.
      if (c.fecha_vencimiento > hoy) continue;
      const tieneActiva = facturasExistentes.some(cf => cf.id_fraccion === null && ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado));
      const saldo = Math.max(0, Number(c.valor_cuota) - totalRecibos);
      if (!tieneActiva && saldo > 0) {
        result.push({ ...base, valor_cuota: saldo, tiene_fracciones: false });
      }
    } else {
      const fraccionesFacturadas = new Set(
        facturasExistentes
          .filter(cf => ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado))
          .map(cf => cf.id_fraccion)
          .filter(Boolean)
      );
      // §3.3: offer each fracción by its OWN due date (fecha_propuesta), not the parent's,
      // and only those neither already billed nor already covered by receipts.
      for (const fc of saldos._coberturaFracciones(fracciones, totalRecibos)) {
        if (fraccionesFacturadas.has(fc.id_fraccion)) continue;
        if (fc.saldo_pendiente <= 0) continue;
        const fFecha = fc.fecha_propuesta || c.fecha_vencimiento;
        if (fFecha > hoy) continue;
        const diasFrac = Math.floor((Date.now() - new Date(fFecha).getTime()) / 86_400_000);
        result.push({
          ...base,
          id_fraccion:       fc.id_fraccion,
          numero_fraccion:   fc.numero_fraccion,
          total_fracciones:  fracciones.length,
          valor_cuota:       fc.saldo_pendiente,
          fecha_vencimiento: fFecha,
          estado:            saldos.clasificarMora(diasFrac),
          tiene_fracciones:  true,
        });
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
      id_cuota, id_venta, numero_cuota, valor_cuota, fecha_vencimiento,
      cuota_fraccion(id_fraccion, numero_fraccion, fecha_propuesta),
      cuota_factura(id_fraccion, factura:id_factura(estado)),
      venta(id_venta, estado)
    `)
    .neq("estado", "pagada");
  if (ec) return res.status(500).json({ error: ec.message });

  // Bill each cuota (or each of its fracciones) due within the window and without an ACTIVE
  // factura. §3.3: each fracción is evaluated by its OWN fecha_propuesta, not the parent's.
  // An anulada factura does not count, so a previously-rejected item gets billed again.
  let generadas = 0;
  for (const c of (cuotas || [])) {
    if (!ESTADOS_FACTURABLES.includes(c.venta?.estado)) continue;

    const fracciones = c.cuota_fraccion || [];
    if (fracciones.length) {
      const facturadas = new Set(
        (c.cuota_factura || [])
          .filter(cf => ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado))
          .map(cf => cf.id_fraccion)
          .filter(Boolean)
      );
      for (const f of fracciones) {
        if (facturadas.has(f.id_fraccion)) continue;
        if ((f.fecha_propuesta || c.fecha_vencimiento) > limiteStr) continue;
        const { factura, reused } = await _emitirFactura(c.id_cuota, f.id_fraccion);
        if (factura && !reused) generadas++;
      }
    } else {
      if (c.fecha_vencimiento > limiteStr) continue;
      const tieneActiva = (c.cuota_factura || [])
        .some(cf => ESTADOS_FACTURA_ACTIVA.includes(cf.factura?.estado));
      if (tieneActiva) continue;
      const { factura, reused } = await _emitirFactura(c.id_cuota, null);
      if (factura && !reused) generadas++;
    }
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
      cuota_pago(valor_aplicado, pago:id_pago(estado, recibo_pago(id_recibo))),
      venta:id_venta(lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)))
    `)
    .in("id_venta", ventaIds)
    .neq("estado", "pagada");

  if (ec) return res.status(500).json({ error: ec.message });

  const result = [];
  for (const c of (cuotas || [])) {
    const fracciones = (c.cuota_fraccion || []).sort((a, b) => a.numero_fraccion - b.numero_fraccion);

    const facturasEmitidas = (c.cuota_factura || [])
      .filter(cf => ["emitida", "parcialmente_pagada"].includes(cf.factura?.estado))
      .map(cf => ({ ...cf.factura, id_fraccion: cf.id_fraccion }));

    if (!facturasEmitidas.length) continue;

    const lote = c.venta?.lote;
    const totalAceptado = saldos._sumRecibosAceptados(c.cuota_pago);

    // Per-fracción remaining saldo (greedy) and the set already covered.
    const saldoPorFraccion  = {};
    const coveredFracciones = new Set();
    if (fracciones.length > 0) {
      let remaining = totalAceptado;
      for (const f of fracciones) {
        const v      = Number(f.valor_fraccion);
        const pagado = Math.min(v, Math.max(0, remaining));
        remaining    = Math.max(0, remaining - v);
        saldoPorFraccion[f.id_fraccion] = Math.max(0, v - pagado);
        if (pagado >= v) coveredFracciones.add(f.id_fraccion);
      }
    }
    const saldoCuota = Math.max(0, Number(c.valor_cuota) - totalAceptado);

    const visibleFacturas = fracciones.length > 0
      ? facturasEmitidas.filter(f => !coveredFracciones.has(f.id_fraccion))
      : facturasEmitidas;

    if (!visibleFacturas.length) continue;

    for (const factura of visibleFacturas) {
      // RN-10: pay the remaining saldo, never more than the factura value.
      const saldoBase    = factura.id_fraccion
        ? (saldoPorFraccion[factura.id_fraccion] ?? Number(factura.valor_facturado))
        : saldoCuota;
      const valorAPagar  = Math.min(Number(factura.valor_facturado), saldoBase);
      result.push({
        id_factura:        factura.id_factura,
        numero_factura:    factura.numero_factura,
        valor_facturado:   factura.valor_facturado,
        valor_a_pagar:     valorAPagar,
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

// RN-06/RN-11: the comprador never emits a factura. For a cuota with no active factura
// (typically an early payment of a future cuota), the comprador requests it and the aux emits.
exports.solicitarFactura = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  if (!id_usuario) return res.status(400).json({ error: "Sin usuario vinculado" });

  const { id_cuota, nota } = req.body;
  if (!id_cuota) return res.status(400).json({ error: "id_cuota requerido" });

  const { data: cuota } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select("id_cuota, estado, venta:id_venta(venta_comprador(id_usuario))")
    .eq("id_cuota", id_cuota)
    .single();
  if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" });

  const owns = (cuota.venta?.venta_comprador || []).some(vc => vc.id_usuario === id_usuario);
  if (!owns) return res.status(403).json({ error: "No tienes acceso a esta cuota" });
  if (cuota.estado === "pagada") return res.status(400).json({ error: "Esta cuota ya está pagada" });

  const activa = await _facturaActivaDe(id_cuota, null);
  if (activa) return res.status(400).json({ error: "Esta cuota ya tiene una factura activa; puedes pagarla directamente" });

  const { data: existente } = await supabase.schema(SCHEMA)
    .from("solicitud_factura")
    .select("id_solicitud")
    .eq("id_cuota", id_cuota)
    .eq("id_usuario", id_usuario)
    .eq("estado", "pendiente")
    .maybeSingle();
  if (existente) return res.status(200).json({ ...existente, ya_existia: true });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("solicitud_factura")
    .insert([{ id_cuota, id_usuario, nota: nota || null }])
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.getSolicitudes = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("solicitud_factura")
    .select(`
      id_solicitud, id_cuota, nota, created_at,
      usuario:id_usuario(nombres, apellidos, documento),
      cuota:id_cuota(
        numero_cuota, fecha_vencimiento, valor_cuota, estado,
        venta:id_venta(id_venta, lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)))
      )
    `)
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(s => {
    const comp  = s.usuario;
    const cuota = s.cuota;
    const lote  = cuota?.venta?.lote;
    return {
      id_solicitud:      s.id_solicitud,
      id_cuota:          s.id_cuota,
      id_venta:          cuota?.venta?.id_venta ?? null,
      numero_cuota:      cuota?.numero_cuota ?? null,
      fecha_vencimiento: cuota?.fecha_vencimiento ?? null,
      valor_cuota:       cuota?.valor_cuota ?? null,
      nota:              s.nota,
      created_at:        s.created_at,
      comprador:         comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
      documento:         comp?.documento ?? null,
      proyecto:          lote?.proyecto?.nombre ?? "—",
      codigo_lote:       lote?.codigo_lote ?? "—",
    };
  }));
};

exports.resolverSolicitud = async (req, res) => {
  const id_solicitud = Number(req.params.id);
  if (!id_solicitud) return res.status(400).json({ error: "id de solicitud inválido" });

  const { accion } = req.body;
  if (!["atender", "descartar"].includes(accion))
    return res.status(400).json({ error: "accion debe ser 'atender' o 'descartar'" });

  const { data: sol, error: es } = await supabase.schema(SCHEMA)
    .from("solicitud_factura").select("id_solicitud, id_cuota, estado").eq("id_solicitud", id_solicitud).single();
  if (es || !sol) return res.status(404).json({ error: "Solicitud no encontrada" });
  if (sol.estado !== "pendiente") return res.status(400).json({ error: "La solicitud ya fue resuelta" });

  let factura = null;
  if (accion === "atender") {
    const r = await _emitirFactura(sol.id_cuota, null);
    if (r.error) return res.status(400).json({ error: r.error });
    factura = r.factura;
  }

  const nuevoEstado = accion === "atender" ? "atendida" : "descartada";
  const { error: eu } = await supabase.schema(SCHEMA)
    .from("solicitud_factura")
    .update({ estado: nuevoEstado, resolved_at: new Date().toISOString() })
    .eq("id_solicitud", id_solicitud);
  if (eu) return res.status(400).json({ error: eu.message });

  res.json({ id_solicitud, estado: nuevoEstado, factura });
};

// §4.2/§4.3: a factura is annulled only to fix data errors, and only while 'emitida'
// (no receipts applied). RN-18/RN-20: the annulment is recorded with user and motivo.
exports.anular = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id de factura inválido" });

  const { motivo } = req.body;
  if (!motivo || String(motivo).trim().length < 5)
    return res.status(400).json({ error: "Debes indicar el motivo de la anulación" });

  const { data: factura, error: ef } = await supabase.schema(SCHEMA)
    .from("factura").select("id_factura, estado").eq("id_factura", id).single();
  if (ef || !factura) return res.status(404).json({ error: "Factura no encontrada" });
  if (factura.estado !== "emitida")
    return res.status(400).json({ error: "Solo se puede anular una factura emitida sin pagos aplicados" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("factura").update({ estado: "anulada" }).eq("id_factura", id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  await supabase.schema(SCHEMA).from("auditoria").insert([{
    tabla_afectada: "factura",
    id_registro:    id,
    campo:          "anulacion",
    valor_anterior: factura.estado,
    valor_nuevo:    "anulada",
    usuario_db:     req.usuario.email,
    fecha_cambio:   new Date().toISOString(),
    motivo:         String(motivo).trim(),
  }]);

  res.json(data);
};
