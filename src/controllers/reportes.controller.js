const supabase            = require("../config/supabase");
const SCHEMA              = "condor";
const { actualizarMora }  = require("../services/mora.service");
const saldos              = require("../services/saldos.service");

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

exports.getProyeccionIngresos = async (req, res) => {
  try {
    const { data: ventasActivas, error: errVentas } = await supabase
      .schema(SCHEMA).from("venta").select("id_venta").eq("estado", "activa");
    if (errVentas) return res.status(500).json({ error: errVentas.message });

    const ventaIds = (ventasActivas || []).map(v => v.id_venta);
    if (!ventaIds.length) return res.json(_buildProjection([]));

    const { data: cuotas, error } = await supabase
      .schema(SCHEMA)
      .from("cuota")
      .select("id_venta, valor_cuota, fecha_vencimiento, cuota_pago(valor_aplicado, pago:id_pago(estado, recibo_pago(id_recibo)))")
      .neq("estado", "pagada")
      .in("id_venta", ventaIds)
      .not("fecha_vencimiento", "is", null);

    if (error) return res.status(500).json({ error: error.message });

    // RN-10: project the remaining saldo (value minus accepted receipts), not the gross cuota.
    const pendientes = (cuotas || [])
      .map(c => ({
        id_venta:          c.id_venta,
        fecha_vencimiento: c.fecha_vencimiento,
        valor_cuota:       Math.max(0, Number(c.valor_cuota) - saldos._sumRecibosAceptados(c.cuota_pago)),
      }))
      .filter(c => c.valor_cuota > 0);

    res.json(_buildProjection(pendientes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function _buildProjection(cuotas) {
  const today  = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  const grouped = {};
  cuotas.forEach(c => {
    const mes = String(c.fecha_vencimiento || "").slice(0, 7);
    if (mes.length < 7) return;
    if (!grouped[mes]) grouped[mes] = { total_esperado: 0, cantidad_cuotas: 0, ventas: new Set() };
    grouped[mes].total_esperado += Number(c.valor_cuota || 0);
    grouped[mes].cantidad_cuotas++;
    grouped[mes].ventas.add(c.id_venta);
  });

  return months.map(mes => ({
    mes,
    total_esperado:   grouped[mes]?.total_esperado   || 0,
    cantidad_cuotas:  grouped[mes]?.cantidad_cuotas  || 0,
    ventas_afectadas: grouped[mes]?.ventas.size      || 0,
  }));
}

exports.getComisionesGerencia = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("venta_comisionista")
    .select(`
      id_venta, valor_comision, pagada, fecha_ganada, fecha_pagado, estado,
      usuario:id_usuario(nombres, apellidos),
      venta:id_venta(
        id_venta, codigo_venta, fecha_venta, valor_total, total_permutas,
        lote:id_lote(codigo_lote, manzana, numero_lote, proyecto:id_proyecto(nombre)),
        venta_comprador(usuario:id_usuario(nombres, apellidos))
      )
    `)
    .order("id_venta", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const rows     = data || [];
  const ventaIds = rows.map(r => r.id_venta).filter(Boolean);

  if (ventaIds.length > 0) {
    const [{ data: micropagos }, { data: pagosVenta }] = await Promise.all([
      supabase.schema(SCHEMA)
        .from("pago_comision")
        .select("id_venta, id_pago_comision, valor, fecha, nota, numero_pago")
        .in("id_venta", ventaIds)
        .order("fecha", { ascending: true }),
      supabase.schema(SCHEMA)
        .from("pago")
        .select("id_venta, valor_pago, estado, recibo_pago(id_recibo)")
        .in("id_venta", ventaIds)
        .eq("estado", "aceptado"),
    ]);

    const microMap       = {};
    const pagadoPorVenta = {};

    for (const m of micropagos || []) {
      if (!microMap[m.id_venta]) microMap[m.id_venta] = [];
      microMap[m.id_venta].push(m);
    }
    // RN-10/RN-19: total paid per venta = receipt-backed payments, same criterion as
    // verificarComision and the cuota views (single source of truth).
    for (const p of pagosVenta || []) {
      if (saldos.pagoLiquidado(p))
        pagadoPorVenta[p.id_venta] = (pagadoPorVenta[p.id_venta] || 0) + Number(p.valor_pago);
    }

    rows.forEach(r => {
      const micros      = microMap[r.id_venta] || [];
      // Permutas count as payment toward the 30% threshold (business rule).
      const totalPagado = (pagadoPorVenta[r.id_venta] || 0) + (Number(r.venta?.total_permutas) || 0);
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


exports.syncMora = async (req, res) => {
  try {
    const result = await actualizarMora();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
