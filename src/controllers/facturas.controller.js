const supabase = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("factura")
    .select(`
      id_factura, numero_factura, fecha_emision, valor_facturado, estado, observaciones,
      cuota_factura(
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
    const cuota = f.cuota_factura?.[0]?.cuota;
    const lote  = cuota?.venta?.lote;
    const comp  = cuota?.venta?.venta_comprador?.[0]?.comprador;
    return {
      id_factura:        f.id_factura,
      numero_factura:    f.numero_factura,
      fecha_emision:     f.fecha_emision,
      valor_facturado:   f.valor_facturado,
      estado:            f.estado,
      observaciones:     f.observaciones,
      id_venta:          cuota?.venta?.id_venta    ?? null,
      id_cuota:          cuota?.id_cuota          ?? null,
      numero_cuota:      cuota?.numero_cuota       ?? null,
      fecha_vencimiento: cuota?.fecha_vencimiento  ?? null,
      proyecto:          lote?.proyecto?.nombre    ?? "—",
      codigo_lote:       lote?.codigo_lote         ?? "—",
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
      cuota_factura(id_cuota),
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

  res.json(
    (data || [])
      .filter(c =>
        !c.cuota_factura?.length &&
        ESTADOS_FACTURABLES.includes(c.venta?.estado)
      )
      .map(c => {
        const lote = c.venta?.lote;
        const comp = c.venta?.venta_comprador?.[0]?.comprador;
        return {
          id_cuota:          c.id_cuota,
          id_venta:          c.venta?.id_venta      ?? null,
          estado_venta:      c.venta?.estado        ?? null,
          numero_cuota:      c.numero_cuota,
          fecha_vencimiento: c.fecha_vencimiento,
          valor_cuota:       c.valor_cuota,
          estado:            c.estado,
          proyecto:          lote?.proyecto?.nombre ?? "—",
          codigo_lote:       lote?.codigo_lote      ?? "—",
          comprador:         comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
        };
      })
  );
};

exports.generarPendientes = async (req, res) => {
  const ESTADOS_FACTURABLES = ["activa", "pre_mora", "en_mora"];
  const hoy = new Date().toISOString().split("T")[0];
  const yr  = new Date().getFullYear() % 100;

  const { data: cuotas, error: ec } = await supabase.schema(SCHEMA)
    .from("cuota")
    .select("id_cuota, id_venta, numero_cuota, valor_cuota, cuota_factura(id_cuota), venta(id_venta, estado)")
    .lte("fecha_vencimiento", hoy)
    .neq("estado", "pagada");
  if (ec) return res.status(500).json({ error: ec.message });

  const pendientes = (cuotas || []).filter(c =>
    !c.cuota_factura?.length && ESTADOS_FACTURABLES.includes(c.venta?.estado)
  );
  if (!pendientes.length) return res.json({ generadas: 0 });

  const facturas = pendientes.map(c => ({
    numero_factura:  yr * 10_000_000 + (c.id_venta || 0) * 1000 + (c.numero_cuota || 0),
    fecha_emision:   hoy,
    valor_facturado: c.valor_cuota,
    estado:          "emitida",
  }));

  const { data: creadas, error: ef } = await supabase.schema(SCHEMA)
    .from("factura").insert(facturas).select("id_factura");
  if (ef) return res.status(400).json({ error: ef.message });

  const links = creadas.map((f, i) => ({ id_factura: f.id_factura, id_cuota: pendientes[i].id_cuota }));
  await supabase.schema(SCHEMA).from("cuota_factura").insert(links);

  res.json({ generadas: creadas.length });
};

exports.create = async (req, res) => {
  const { numero_factura, fecha_emision, valor_facturado, estado, observaciones, id_cuota } = req.body;
  const { data: factura, error: ef } = await supabase.schema(SCHEMA).from("factura")
    .insert([{ numero_factura, fecha_emision, valor_facturado, estado: estado || "emitida", observaciones }]).select().single();
  if (ef) return res.status(400).json({ error: ef.message });
  if (id_cuota) {
    await supabase.schema(SCHEMA).from("cuota_factura").insert([{ id_cuota, id_factura: factura.id_factura }]);
  }
  res.status(201).json(factura);
};

exports.anular = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("factura").update({ estado: "anulada" }).eq("id_factura", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
