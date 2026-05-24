const supabase = require("../config/supabase");
const SCHEMA   = "condor";

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
            venta_comprador(comprador(nombres, apellidos, documento))
          )
        )
      )
    `)
    .order("fecha_emision", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(f => {
    const link  = f.cuota_factura?.[0];
    const cuota = link?.cuota;
    const lote  = cuota?.venta?.lote;
    const comp  = cuota?.venta?.venta_comprador?.[0]?.comprador;
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
      cuota_factura(id_cuota, id_fraccion),
      venta(
        id_venta,
        estado,
        lote(codigo_lote, proyecto(nombre)),
        venta_comprador(comprador(nombres, apellidos))
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
    const comp = c.venta?.venta_comprador?.[0]?.comprador;
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
      if (!facturasExistentes.some(cf => cf.id_fraccion === null)) {
        result.push({ ...base, valor_cuota: c.valor_cuota, tiene_fracciones: false });
      }
    } else {
      const fraccionesFacturadas = new Set(facturasExistentes.map(cf => cf.id_fraccion).filter(Boolean));
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

exports.generarPendientes = async (req, res) => {
  const ESTADOS_FACTURABLES = ["activa", "pre_mora", "en_mora"];
  const hoy    = new Date().toISOString().split("T")[0];
  const periodo = _periodo();

  const { data: cuotas, error: ec } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select(`
      id_cuota, id_venta, numero_cuota, valor_cuota,
      cuota_fraccion(id_fraccion),
      cuota_factura(id_cuota),
      venta(id_venta, estado, lote:id_lote(proyecto:id_proyecto(sigla)))
    `)
    .lte("fecha_vencimiento", hoy)
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
    const sigla = c.venta?.lote?.proyecto?.sigla || "GEN";
    try {
      const n = await _nextConsec("FV", periodo);
      const numero_factura = `FV-${periodo}-${sigla}-${String(n).padStart(5, "0")}`;
      const { data: f, error: ef } = await supabase.schema(SCHEMA).from("factura")
        .insert([{ numero_factura, fecha_emision: hoy, valor_facturado: c.valor_cuota, estado: "emitida" }])
        .select("id_factura").single();
      if (!ef && f) {
        await supabase.schema(SCHEMA).from("cuota_factura")
          .insert([{ id_factura: f.id_factura, id_cuota: c.id_cuota }]);
        generadas++;
      }
    } catch {}
  }

  res.json({ generadas });
};

exports.create = async (req, res) => {
  const { fecha_emision, valor_facturado, estado, observaciones, id_cuota, id_fraccion } = req.body;
  let numero_factura;
  try {
    numero_factura = await _buildNumFactura(id_cuota || null);
  } catch(e) {
    return res.status(500).json({ error: `Error al generar número de factura: ${e.message}` });
  }
  const { data: factura, error: ef } = await supabase.schema(SCHEMA).from("factura")
    .insert([{ numero_factura, fecha_emision, valor_facturado, estado: estado || "emitida", observaciones }])
    .select().single();
  if (ef) return res.status(400).json({ error: ef.message });
  if (id_cuota) {
    await supabase.schema(SCHEMA).from("cuota_factura").insert([{
      id_cuota,
      id_factura:  factura.id_factura,
      id_fraccion: id_fraccion || null,
    }]);
  }
  res.status(201).json(factura);
};

exports.getMisFacturas = async (req, res) => {
  const id_comprador = req.usuario.id_comprador;
  if (!id_comprador) return res.status(400).json({ error: "Sin comprador vinculado" });

  const { data: vc, error: ev } = await supabase.schema(SCHEMA)
    .from("venta_comprador").select("id_venta").eq("id_comprador", id_comprador);

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
      .eq("id_comprador", id_comprador)
      .eq("estado", "pendiente_revision")
      .in("id_cuota_propuesta", idsCuotas);

    const cuotasConComprobante = new Set((pagosPendientes || []).map(p => p.id_cuota_propuesta));
    for (const r of result) {
      r.tiene_comprobante_pendiente = cuotasConComprobante.has(r.id_cuota);
    }
  }

  res.json(result);
};

exports.anular = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("factura").update({ estado: "anulada" }).eq("id_factura", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
