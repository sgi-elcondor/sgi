const supabase = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const [{ data: compradores, error }, { data: usuarios }] = await Promise.all([
    supabase.schema(SCHEMA).from("comprador").select("*").order("nombres"),
    supabase.schema(SCHEMA).from("usuarios").select("id_comprador, photo_url").not("id_comprador", "is", null),
  ]);
  if (error) return res.status(500).json({ error: error.message });

  const photoMap = {};
  (usuarios || []).forEach(u => { if (u.id_comprador) photoMap[u.id_comprador] = u.photo_url; });

  res.json((compradores || []).map(c => ({ ...c, photo_url: photoMap[c.id_comprador] || null })));
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("comprador").select("*").eq("id_comprador", req.params.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado } = req.body;

  const { data: existentes, error: dupError } = await supabase.schema(SCHEMA)
    .from("comprador").select("id_comprador").eq("documento", documento).limit(1);
  if (dupError) return res.status(500).json({ error: dupError.message });
  if (existentes && existentes.length)
    return res.status(409).json({ error: "Ya existe un comprador registrado con ese documento." });

  const { data, error } = await supabase.schema(SCHEMA).from("comprador")
    .insert([{ tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado: estado || "activo" }])
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.update = async (req, res) => {
  const { tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado } = req.body;

  if (documento !== undefined) {
    const { data: existentes, error: dupError } = await supabase.schema(SCHEMA)
      .from("comprador").select("id_comprador")
      .eq("documento", documento).neq("id_comprador", req.params.id).limit(1);
    if (dupError) return res.status(500).json({ error: dupError.message });
    if (existentes && existentes.length)
      return res.status(409).json({ error: "Ya existe otro comprador registrado con ese documento." });
  }

  const { data, error } = await supabase.schema(SCHEMA).from("comprador")
    .update({ tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado })
    .eq("id_comprador", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
