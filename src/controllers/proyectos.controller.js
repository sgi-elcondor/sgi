const supabase  = require("../config/supabase");
const auditoria = require("../services/auditoria.service");
const SCHEMA    = "condor";

// Keeps a lote code's sigla prefix in sync when a project's sigla changes:
//   - "EC1-A-22" with EC1→NUE  → "NUE-A-22"  (replace the leading sigla token)
//   - "EC1-A-22" with EC1→null → "A-22"      (drop the sigla token)
//   - "A-22"     with null→NUE  → "NUE-A-22"  (prepend the new sigla)
// Codes that carried a different (legacy/custom) prefix are left untouched.
// Returns the new code, or null when it shouldn't change.
function rewriteCodigoSigla(codigo, oldSigla, newSigla) {
  const current = String(codigo || "").trim();
  if (!current) return null;

  const old    = String(oldSigla || "").toUpperCase();
  const nue    = newSigla ? String(newSigla).toUpperCase() : "";
  const tokens = current.split("-");

  if (old && tokens[0].toUpperCase() === old) {
    if (nue) tokens[0] = nue;
    else     tokens.shift();
    const next = tokens.join("-");
    return next && next !== current ? next : null;
  }

  if (!old && nue && tokens[0].toUpperCase() !== nue) {
    return `${nue}-${current}`;
  }

  return null;
}

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("proyecto").select("*").order("nombre");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("proyecto").select("*").eq("id_proyecto", req.params.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

exports.create = async (req, res) => {
  const { nombre, sigla, ubicacion, descripcion } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("proyecto").insert([{ nombre, sigla: sigla || null, ubicacion: ubicacion || null, descripcion: descripcion || null }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.update = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: "ID de proyecto inválido" });

  const { data: actual, error: eRead } = await supabase.schema(SCHEMA)
    .from("proyecto").select("sigla").eq("id_proyecto", id).single();
  if (eRead || !actual) return res.status(404).json({ error: "Proyecto no encontrado" });

  const { nombre, sigla, ubicacion, descripcion, estado } = req.body;

  const updates = {};
  if (nombre      !== undefined) updates.nombre      = nombre;
  if (ubicacion   !== undefined) updates.ubicacion   = ubicacion || null;
  if (descripcion !== undefined) updates.descripcion = descripcion || null;
  if (estado      !== undefined) updates.estado      = estado;

  const newSigla = sigla !== undefined
    ? (sigla == null ? null : (String(sigla).trim().toUpperCase() || null))
    : undefined;
  if (newSigla !== undefined) updates.sigla = newSigla;

  if (nombre !== undefined && !String(nombre).trim()) {
    return res.status(422).json({ error: "El nombre del proyecto es obligatorio" });
  }

  const { data, error } = await supabase.schema(SCHEMA)
    .from("proyecto").update(updates).eq("id_proyecto", id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  // Sigla changed → propagate the sigla prefix to every lote code of the project so the
  // change is reflected everywhere (the ventas views read codigo_lote by join). Audited.
  const oldSigla = actual.sigla;
  const siglaChanged = newSigla !== undefined &&
    String(oldSigla || "").toUpperCase() !== String(newSigla || "").toUpperCase();

  if (siglaChanged) {
    await auditoria.log({
      tabla:    "proyecto",
      id,
      campo:    "sigla",
      anterior: oldSigla,
      nuevo:    newSigla,
      usuario:  req.usuario?.email || "sistema",
      motivo:   "edicion_proyecto",
    });

    const { data: lotes } = await supabase.schema(SCHEMA)
      .from("lote").select("id_lote, codigo_lote").eq("id_proyecto", id);

    for (const lote of (lotes || [])) {
      const nuevoCodigo = rewriteCodigoSigla(lote.codigo_lote, oldSigla, newSigla);
      if (!nuevoCodigo) continue;

      const { error: eLote } = await supabase.schema(SCHEMA)
        .from("lote").update({ codigo_lote: nuevoCodigo }).eq("id_lote", lote.id_lote);
      if (eLote) continue;

      await auditoria.log({
        tabla:    "lote",
        id:       lote.id_lote,
        campo:    "codigo_lote",
        anterior: lote.codigo_lote,
        nuevo:    nuevoCodigo,
        usuario:  req.usuario?.email || "sistema",
        motivo:   "sync_sigla_proyecto",
      });
    }
  }

  res.json(data);
};
