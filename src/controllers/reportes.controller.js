const supabase = require("../config/supabase"); // ? sin llaves {}
const SCHEMA   = "condor";

exports.getPanelDiario = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("v_aux_panel_operaciones_diarias").select("*").single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getCarteraConsolidada = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_cartera_consolidada").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getAlertasJuridicas = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_alertas_juridicas").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getCarteraHoy = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_dir_cartera_resumen_hoy").select("*").single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getRecaudoHistorico = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_dir_recaudo_facturacion_historico").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getComisionesResumen = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_dir_comisiones_resumen").select("*").single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getCarteraJuridica = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_cartera_juridica").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getAuditoria = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("vw_auditoria_basica_operaciones").select("*").limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getComisionesJefe = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("venta_comisionista")
    .select(`
      id_venta, valor_comision, pagada, fecha_ganada, fecha_pagado, estado,
      comisionista:id_comisionista(nombres, apellidos),
      venta:id_venta(
        id_venta, fecha_venta, valor_total,
        lote:id_lote(codigo_lote, manzana, numero_lote, proyecto:id_proyecto(nombre)),
        venta_comprador(comprador:id_comprador(nombres, apellidos))
      )
    `)
    .order("id_venta", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const rows     = data || [];
  const ventaIds = rows.map(r => r.id_venta).filter(Boolean);

  if (ventaIds.length > 0) {
    const [{ data: micropagos }, { data: cuotas }] = await Promise.all([
      supabase.schema(SCHEMA)
        .from("pago_comision")
        .select("id_venta, id_pago_comision, valor, fecha, nota, numero_pago")
        .in("id_venta", ventaIds)
        .order("fecha", { ascending: true }),
      supabase.schema(SCHEMA)
        .from("cuota")
        .select("id_venta, estado, valor_cuota")
        .in("id_venta", ventaIds),
    ]);

    const microMap       = {};
    const pagadoPorVenta = {};

    for (const m of micropagos || []) {
      if (!microMap[m.id_venta]) microMap[m.id_venta] = [];
      microMap[m.id_venta].push(m);
    }
    for (const c of cuotas || []) {
      if (c.estado === "pagada")
        pagadoPorVenta[c.id_venta] = (pagadoPorVenta[c.id_venta] || 0) + Number(c.valor_cuota);
    }

    rows.forEach(r => {
      const micros      = microMap[r.id_venta] || [];
      const totalPagado = pagadoPorVenta[r.id_venta] || 0;
      const valorTotal  = Number(r.venta?.valor_total) || 0;
      const umbral30    = valorTotal * 0.3;

      r.micropagos       = micros;
      r.total_micropagos = micros.reduce((s, m) => s + Number(m.valor || 0), 0);
      r.ganada = r.estado === "ganada" || r.estado === "pagada"
        || (umbral30 > 0 && totalPagado >= umbral30);
    });
  }

  res.json(rows);
};
