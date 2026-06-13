const supabase       = require("../config/supabase");
const recibosService = require("../services/recibos.service");
const SCHEMA         = "condor";

// RN-02/RN-19: a recibo exists only when a pago was accepted. No synthetic, virtual
// or negative-ID receipts. This mirrors getMisRecibos so the aux and the comprador see
// exactly the same receipts.
exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("pago")
    .select(`
      id_pago, numero_pago, fecha_pago, valor_pago, metodo_pago, referencia, estado, id_venta,
      recibo_pago(
        recibo:id_recibo(id_recibo, numero_recibo, fecha_emision, emitido_por, observaciones)
      ),
      cuota_pago(
        valor_aplicado,
        cuota:id_cuota(
          id_cuota, numero_cuota,
          cuota_factura(factura:id_factura(id_factura, numero_factura, estado)),
          venta:id_venta(
            id_venta,
            lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)),
            venta_comprador(usuario:id_usuario(nombres, apellidos, documento))
          )
        )
      )
    `)
    .eq("estado", "aceptado")
    .order("fecha_pago", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || [])
    .filter(p => p.recibo_pago && p.recibo_pago.length > 0)
    .map(p => {
      const recibo  = p.recibo_pago[0].recibo;
      const cp      = p.cuota_pago?.[0];
      const cuota   = cp?.cuota;
      const venta   = cuota?.venta;
      const lote    = venta?.lote;
      const comp    = venta?.venta_comprador?.[0]?.usuario;
      const factura = cuota?.cuota_factura?.[0]?.factura;
      return {
        id_recibo:      recibo.id_recibo,
        numero_recibo:  recibo.numero_recibo,
        fecha_emision:  recibo.fecha_emision ?? p.fecha_pago?.split("T")[0] ?? null,
        emitido_por:    recibo.emitido_por ?? "Sistema SGI",
        observaciones:  recibo.observaciones ?? null,
        id_pago:        p.id_pago,
        numero_pago:    p.numero_pago ?? null,
        fecha_pago:     p.fecha_pago,
        valor_pago:     p.valor_pago,
        metodo_pago:    p.metodo_pago,
        referencia:     p.referencia,
        estado_pago:    p.estado,
        id_venta:       venta?.id_venta         ?? p.id_venta ?? null,
        numero_cuota:   cuota?.numero_cuota     ?? null,
        id_factura:     factura?.id_factura     ?? null,
        numero_factura: factura?.numero_factura ?? null,
        proyecto:       lote?.proyecto?.nombre  ?? "—",
        codigo_lote:    lote?.codigo_lote       ?? "—",
        comprador:      comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
        documento:      comp?.documento         ?? null,
      };
    }));
};

// Backfills receipts for accepted payments that lack one. Delegates to the single
// recibos.service so every recibo follows the same RC-YYYYMM-NNNNN numbering (RN-21).
exports.generarRecibos = async (req, res) => {
  const emitido_por = req.usuario?.email || "sistema";

  const { data: pagos, error: ep } = await supabase.schema(SCHEMA)
    .from("pago")
    .select("id_pago, numero_pago, recibo_pago(id_recibo)")
    .eq("estado", "aceptado");

  if (ep) return res.status(500).json({ error: ep.message });

  const pendientes = (pagos || []).filter(p => !p.recibo_pago?.length);
  if (!pendientes.length) return res.json({ generados: 0, pendientes: 0, primer_error: null });

  let generados   = 0;
  let primerError = null;

  for (const p of pendientes) {
    const { error } = await recibosService.crearParaPago({
      id_pago:     p.id_pago,
      numero_pago: p.numero_pago || undefined,
      emitido_por,
    });
    if (error) { if (!primerError) primerError = `pago ${p.id_pago}: ${error}`; }
    else generados++;
  }

  res.json({ generados, pendientes: pendientes.length, primer_error: primerError });
};

exports.getMisRecibos = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  if (!id_usuario) return res.status(400).json({ error: "Sin usuario vinculado" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("pago")
    .select(`
      id_pago, numero_pago, fecha_pago, valor_pago, metodo_pago, referencia, estado, id_venta,
      recibo_pago(
        recibo:id_recibo(id_recibo, numero_recibo, fecha_emision, emitido_por, observaciones)
      ),
      cuota_pago(
        cuota:id_cuota(
          id_cuota, numero_cuota,
          cuota_factura(factura:id_factura(id_factura, numero_factura, estado)),
          venta:id_venta(
            id_venta,
            lote:id_lote(codigo_lote, proyecto:id_proyecto(nombre)),
            venta_comprador(usuario:id_usuario(nombres, apellidos, documento))
          )
        )
      )
    `)
    .eq("id_usuario", id_usuario)
    .eq("estado", "aceptado")
    .order("fecha_pago", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || [])
    .filter(p => p.recibo_pago && p.recibo_pago.length > 0)
    .map(p => {
      const recibo  = p.recibo_pago[0].recibo;
      const cp      = p.cuota_pago?.[0];
      const cuota   = cp?.cuota;
      const venta   = cuota?.venta;
      const lote    = venta?.lote;
      const comp    = venta?.venta_comprador?.[0]?.usuario;
      const factura = cuota?.cuota_factura?.[0]?.factura;
      return {
        id_recibo:      recibo?.id_recibo,
        numero_recibo:  recibo?.numero_recibo,
        fecha_emision:  recibo?.fecha_emision  ?? p.fecha_pago?.split("T")[0] ?? null,
        emitido_por:    recibo?.emitido_por    ?? "Sistema SGI",
        observaciones:  recibo?.observaciones  ?? null,
        id_pago:        p.id_pago,
        numero_pago:    p.numero_pago ?? null,
        fecha_pago:     p.fecha_pago,
        valor_pago:     p.valor_pago,
        metodo_pago:    p.metodo_pago,
        referencia:     p.referencia,
        estado_pago:    p.estado,
        id_venta:       venta?.id_venta         ?? p.id_venta ?? null,
        numero_cuota:   cuota?.numero_cuota     ?? null,
        id_factura:     factura?.id_factura     ?? null,
        numero_factura: factura?.numero_factura ?? null,
        proyecto:       lote?.proyecto?.nombre  ?? "—",
        codigo_lote:    lote?.codigo_lote       ?? "—",
        comprador:      comp ? `${comp.nombres} ${comp.apellidos || ""}`.trim() : "—",
        documento:      comp?.documento         ?? null,
      };
    })
  );
};
