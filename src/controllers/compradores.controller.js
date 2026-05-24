const supabase = require("../config/supabase");
const admin    = require("../config/firebase");
const SCHEMA   = "condor";

async function compradorRolId() {
  const { data } = await supabase.schema(SCHEMA).from("roles").select("id_rol").eq("nombre", "comprador").single();
  return data?.id_rol ?? null;
}

exports.getAll = async (req, res) => {
  const id_rol = await compradorRolId();
  if (!id_rol) return res.status(500).json({ error: "Rol comprador no encontrado" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("usuarios")
    .select("id_usuario, email, activo, firebase_uid, photo_url, nombres, apellidos, documento, tipo_persona, tipo_documento, telefono, rango_pago, fecha_creacion")
    .eq("id_rol", id_rol)
    .order("nombres");

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(u => ({ ...u, has_access: !!u.firebase_uid })));
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("usuarios")
    .select("id_usuario, email, activo, firebase_uid, photo_url, nombres, apellidos, documento, tipo_persona, tipo_documento, telefono, rango_pago, fecha_creacion")
    .eq("id_usuario", req.params.id)
    .single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

exports.searchUser = async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);

  const id_rol = await compradorRolId();

  const { data, error } = await supabase.schema(SCHEMA).from("usuarios")
    .select("id_usuario, email, id_rol")
    .ilike("email", `%${q}%`)
    .limit(6);

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(u => ({ ...u, is_comprador: u.id_rol === id_rol })));
};

exports.create = async (req, res) => {
  const { tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado, rango_pago } = req.body;

  if (!mail) return res.status(400).json({ error: "El correo electrónico es obligatorio." });

  const id_rol = await compradorRolId();
  if (!id_rol) return res.status(500).json({ error: "Rol comprador no encontrado en el sistema." });

  const { data: docExistente } = await supabase.schema(SCHEMA)
    .from("usuarios").select("id_usuario").eq("documento", documento).limit(1);
  if (docExistente?.length) return res.status(409).json({ error: "Ya existe un usuario registrado con ese documento." });

  const { data: emailExistente } = await supabase.schema(SCHEMA)
    .from("usuarios").select("id_usuario, id_rol").eq("email", mail).maybeSingle();
  if (emailExistente) {
    if (emailExistente.id_rol === id_rol) return res.status(409).json({ error: "Este correo ya pertenece a un comprador registrado." });
    return res.status(409).json({ error: "Este correo ya está registrado con otro rol en el sistema." });
  }

  const { data: usuario, error: errU } = await supabase.schema(SCHEMA)
    .from("usuarios")
    .insert([{
      email:          mail,
      id_rol,
      tipo_persona:   tipo_persona   || "natural",
      tipo_documento: tipo_documento || null,
      documento,
      nombres,
      apellidos,
      telefono:       telefono       || null,
      rango_pago:     rango_pago     || null,
      activo:         estado !== "inactivo",
    }])
    .select()
    .single();

  if (errU) return res.status(400).json({ error: errU.message });

  let access_link = null;
  try {
    try { await admin.auth().createUser({ email: mail, emailVerified: true }); }
    catch (fbErr) { if (fbErr.code !== "auth/email-already-exists") throw fbErr; }
    access_link = await admin.auth().generatePasswordResetLink(mail);
  } catch (_) {}

  res.status(201).json({ ...usuario, access_link });
};

exports.update = async (req, res) => {
  const { tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado, rango_pago } = req.body;

  if (documento !== undefined) {
    const { data: existentes } = await supabase.schema(SCHEMA)
      .from("usuarios").select("id_usuario")
      .eq("documento", documento).neq("id_usuario", req.params.id).limit(1);
    if (existentes?.length) return res.status(409).json({ error: "Ya existe otro usuario registrado con ese documento." });
  }

  const updates = {};
  if (tipo_persona    !== undefined) updates.tipo_persona    = tipo_persona;
  if (tipo_documento  !== undefined) updates.tipo_documento  = tipo_documento;
  if (documento       !== undefined) updates.documento       = documento;
  if (nombres         !== undefined) updates.nombres         = nombres;
  if (apellidos       !== undefined) updates.apellidos       = apellidos;
  if (telefono        !== undefined) updates.telefono        = telefono || null;
  if (mail            !== undefined) updates.email           = mail;
  if (estado          !== undefined) updates.activo          = estado !== "inactivo";
  if (rango_pago      !== undefined) updates.rango_pago      = rango_pago || null;

  const { data, error } = await supabase.schema(SCHEMA)
    .from("usuarios").update(updates).eq("id_usuario", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
