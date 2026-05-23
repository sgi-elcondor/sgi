const supabase = require("../config/supabase");
const admin    = require("../config/firebase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const [{ data: compradores, error }, { data: usuarios }] = await Promise.all([
    supabase.schema(SCHEMA).from("comprador").select("*").order("nombres"),
    supabase.schema(SCHEMA).from("usuarios")
      .select("id_comprador, photo_url, firebase_uid, email")
      .not("id_comprador", "is", null),
  ]);
  if (error) return res.status(500).json({ error: error.message });

  const userMap = {};
  (usuarios || []).forEach(u => {
    if (u.id_comprador) userMap[u.id_comprador] = {
      photo_url:    u.photo_url,
      has_access:   !!u.firebase_uid,
      linked_email: u.email,
    };
  });

  res.json((compradores || []).map(c => ({
    ...c,
    photo_url:    userMap[c.id_comprador]?.photo_url    ?? null,
    has_access:   userMap[c.id_comprador]?.has_access   ?? false,
    linked_email: userMap[c.id_comprador]?.linked_email ?? null,
  })));
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("comprador")
    .select("*").eq("id_comprador", req.params.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

exports.searchUser = async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);

  const { data, error } = await supabase.schema(SCHEMA).from("usuarios")
    .select("id_usuario, email, id_comprador")
    .ilike("email", `%${q}%`)
    .limit(6);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
};

exports.create = async (req, res) => {
  const { tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado } = req.body;

  if (!mail) {
    return res.status(400).json({ error: "El correo electrónico es obligatorio para registrar un comprador." });
  }

  const { data: docExistente, error: dupDocError } = await supabase.schema(SCHEMA)
    .from("comprador").select("id_comprador").eq("documento", documento).limit(1);
  if (dupDocError) return res.status(500).json({ error: dupDocError.message });
  if (docExistente?.length)
    return res.status(409).json({ error: "Ya existe un comprador registrado con ese documento." });

  const { data: usuarioExistente } = await supabase.schema(SCHEMA)
    .from("usuarios").select("id_usuario, id_comprador").eq("email", mail).single();

  if (usuarioExistente?.id_comprador) {
    return res.status(409).json({ error: "Este correo ya tiene un perfil de comprador vinculado." });
  }

  const { data: comprador, error: errC } = await supabase.schema(SCHEMA)
    .from("comprador")
    .insert([{ tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado: estado || "activo" }])
    .select().single();
  if (errC) return res.status(400).json({ error: errC.message });

  if (usuarioExistente) {
    const { error: errLink } = await supabase.schema(SCHEMA).from("usuarios")
      .update({ id_comprador: comprador.id_comprador })
      .eq("id_usuario", usuarioExistente.id_usuario);

    if (errLink) {
      await supabase.schema(SCHEMA).from("comprador").delete().eq("id_comprador", comprador.id_comprador);
      return res.status(500).json({ error: "Error al vincular usuario existente: " + errLink.message });
    }
  } else {
    const { data: rolData, error: errRol } = await supabase.schema(SCHEMA)
      .from("roles").select("id_rol").eq("nombre", "comprador").single();

    if (errRol || !rolData) {
      await supabase.schema(SCHEMA).from("comprador").delete().eq("id_comprador", comprador.id_comprador);
      return res.status(500).json({ error: "No se encontró el rol de comprador en el sistema." });
    }

    const { error: errU } = await supabase.schema(SCHEMA).from("usuarios")
      .insert([{ email: mail, id_rol: rolData.id_rol, id_comprador: comprador.id_comprador }]);

    if (errU) {
      await supabase.schema(SCHEMA).from("comprador").delete().eq("id_comprador", comprador.id_comprador);
      return res.status(500).json({ error: "Error al crear cuenta de usuario: " + errU.message });
    }
  }

  let access_link = null;
  try {
    try {
      await admin.auth().createUser({ email: mail, emailVerified: true });
    } catch (fbErr) {
      if (fbErr.code !== "auth/email-already-exists") throw fbErr;
    }
    access_link = await admin.auth().generatePasswordResetLink(mail);
  } catch (_) {}

  res.status(201).json({ ...comprador, access_link });
};

exports.update = async (req, res) => {
  const { tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado } = req.body;

  if (documento !== undefined) {
    const { data: existentes, error: dupError } = await supabase.schema(SCHEMA)
      .from("comprador").select("id_comprador")
      .eq("documento", documento).neq("id_comprador", req.params.id).limit(1);
    if (dupError) return res.status(500).json({ error: dupError.message });
    if (existentes?.length)
      return res.status(409).json({ error: "Ya existe otro comprador registrado con ese documento." });
  }

  const { data, error } = await supabase.schema(SCHEMA).from("comprador")
    .update({ tipo_persona, tipo_documento, documento, nombres, apellidos, telefono, mail, estado })
    .eq("id_comprador", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
