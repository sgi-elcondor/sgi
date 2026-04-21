const supabase = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("venta")
    .select("*, lote(codigo_lote, manzana, numero_lote, proyecto(nombre))").order("fecha_venta", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("venta")
    .select("*, lote(*, proyecto(nombre)), venta_comprador(*, comprador(*)), venta_comisionista(*, comisionista(*))")
    .eq("id_venta", req.params.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { id_lote, valor_total, cuota_inicial, estado, observaciones, compradores, id_comisionista, porcentaje_comision } = req.body; 

  const { data: venta, error: eventa } = await supabase.schema(SCHEMA).from("venta")
    .insert([{ id_lote, valor_total, cuota_inicial, estado: estado || "activa", observaciones }]).select().single();
  if (eventa) return res.status(400).json({ error: eventa.message });

  if (compradores && compradores.length > 0) {
    const rows = compradores.map(c => ({ id_venta: venta.id_venta, id_comprador: c.id_comprador, porcentaje: c.porcentaje }));
    const { error: ec } = await supabase.schema(SCHEMA).from("venta_comprador").insert(rows);
    if (ec) return res.status(400).json({ error: ec.message });
  }
  
  if (id_comisionista) {
    const { error: eco } = await supabase.schema(SCHEMA).from("venta_comisionista")
      .insert([{ id_venta: venta.id_venta, id_comisionista, porcentaje_comision: porcentaje_comision || 5 }]);
    if (eco) return res.status(400).json({ error: eco.message });
  }
  res.status(201).json(venta);
};

exports.getEstadoFinanciero = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("v_aux_ventas_estado_financiero").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// Crea una venta con estado "pendiente_autorizacion" — exclusivo para asesor_comercial
exports.createSolicitud = async (req, res) => {
  const { id_lote, valor_total, cuota_inicial, observaciones, compradores, id_comisionista, porcentaje_comision } = req.body;

  const { data: venta, error: eventa } = await supabase.schema(SCHEMA).from("venta")
    .insert([{ id_lote, valor_total, cuota_inicial, estado: "pendiente_autorizacion", observaciones }]).select().single();
  if (eventa) return res.status(400).json({ error: eventa.message });

  if (compradores && compradores.length > 0) {
    const rows = compradores.map(c => ({ id_venta: venta.id_venta, id_comprador: c.id_comprador, porcentaje: c.porcentaje }));
    const { error: ec } = await supabase.schema(SCHEMA).from("venta_comprador").insert(rows);
    if (ec) return res.status(400).json({ error: ec.message });
  }

  if (id_comisionista) {
    const { error: eco } = await supabase.schema(SCHEMA).from("venta_comisionista")
      .insert([{ id_venta: venta.id_venta, id_comisionista, porcentaje_comision: porcentaje_comision || 5 }]);
    if (eco) return res.status(400).json({ error: eco.message });
  }

  res.status(201).json(venta);
};