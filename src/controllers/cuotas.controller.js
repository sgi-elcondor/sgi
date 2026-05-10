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
    .insert([{ id_venta, numero_cuota, fecha_vencimiento, valor_cuota, es_extraordinaria: es_extraordinaria || false }]).select().single();
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
