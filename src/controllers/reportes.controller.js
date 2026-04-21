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
