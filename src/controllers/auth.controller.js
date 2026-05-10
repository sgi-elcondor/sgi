const supabase = require('../config/supabase');

async function registrarUsuario(req, res) {
  const { firebase_uid, email, id_rol, id_comprador, id_comisionista } = req.body;

  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede registrar usuarios' });
  }

  const { data, error } = await supabase
    .schema('condor')
    .from('usuarios')
    .insert([{ firebase_uid, email, id_rol, id_comprador, id_comisionista }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
}

async function miPerfil(req, res) {
  const { email, rol, id_comprador, id_comisionista, permisos } = req.usuario;
  let profileData = {};

  try {
    if (rol === 'comprador' && id_comprador) {
      const { data } = await supabase.schema('condor').from('comprador')
        .select('nombres, apellidos, telefono')
        .eq('id_comprador', id_comprador)
        .single();
      if (data) profileData = data;
    } else if (rol === 'comisionista' && id_comisionista) {
      const { data } = await supabase.schema('condor').from('comisionista')
        .select('nombres, apellidos, telefono')
        .eq('id_comisionista', id_comisionista)
        .single();
      if (data) profileData = data;
    }
  } catch (_) {}

  return res.json({ email, rol, id_comprador, id_comisionista, permisos: [...permisos], ...profileData });
}

async function completarPerfil(req, res) {
  const { rol, email, id_comprador, id_comisionista } = req.usuario;
  const { documento, nombres, apellidos, telefono } = req.body;

  if (rol !== 'comprador' && rol !== 'comisionista') {
    return res.status(400).json({ error: 'Este endpoint solo aplica para compradores y comisionistas' });
  }

  if (rol === 'comprador' && id_comprador) {
    return res.status(400).json({ error: 'Este usuario ya tiene un comprador vinculado' });
  }

  if (rol === 'comisionista' && id_comisionista) {
    return res.status(400).json({ error: 'Este usuario ya tiene un comisionista vinculado' });
  }

  if (!documento || !nombres || !apellidos) {
    return res.status(400).json({ error: 'Documento, nombres y apellidos son obligatorios' });
  }

  try {
    if (rol === 'comprador') {
      const { data: existente } = await supabase
        .schema('condor')
        .from('comprador')
        .select('id_comprador')
        .eq('documento', documento)
        .single();

      if (existente) {
        return res.status(409).json({ error: 'Ya existe un comprador con ese documento de identidad' });
      }

      const { data: comprador, error: errC } = await supabase
        .schema('condor')
        .from('comprador')
        .insert([{ tipo_persona: 'natural', documento, nombres, apellidos, telefono: telefono || null, mail: email, estado: 'activo' }])
        .select('id_comprador')
        .single();

      if (errC) return res.status(400).json({ error: errC.message });

      await supabase
        .schema('condor')
        .from('usuarios')
        .update({ id_comprador: comprador.id_comprador })
        .eq('email', email);

      return res.json({ ok: true, id_comprador: comprador.id_comprador });
    }

    if (rol === 'comisionista') {
      const { data: existente } = await supabase
        .schema('condor')
        .from('comisionista')
        .select('id_comisionista')
        .eq('documento', documento)
        .single();

      if (existente) {
        return res.status(409).json({ error: 'Ya existe un comisionista con ese documento de identidad' });
      }

      const { data: comisionista, error: errCo } = await supabase
        .schema('condor')
        .from('comisionista')
        .insert([{ documento, nombres, apellidos, telefono: telefono || null, mail: email }])
        .select('id_comisionista')
        .single();

      if (errCo) return res.status(400).json({ error: errCo.message });

      await supabase
        .schema('condor')
        .from('usuarios')
        .update({ id_comisionista: comisionista.id_comisionista })
        .eq('email', email);

      return res.json({ ok: true, id_comisionista: comisionista.id_comisionista });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function actualizarMiPerfil(req, res) {
  const { rol, id_comprador, id_comisionista } = req.usuario;
  const { nombres, apellidos, telefono } = req.body;

  if (rol !== 'comprador' && rol !== 'comisionista') {
    return res.status(403).json({ error: 'Solo compradores y comisionistas pueden editar su perfil' });
  }

  if (!nombres || !apellidos) {
    return res.status(400).json({ error: 'Nombres y apellidos son obligatorios' });
  }

  try {
    if (rol === 'comprador' && id_comprador) {
      const { error } = await supabase.schema('condor').from('comprador')
        .update({ nombres, apellidos, telefono: telefono || null })
        .eq('id_comprador', id_comprador);
      if (error) return res.status(400).json({ error: error.message });
    } else if (rol === 'comisionista' && id_comisionista) {
      const { error } = await supabase.schema('condor').from('comisionista')
        .update({ nombres, apellidos, telefono: telefono || null })
        .eq('id_comisionista', id_comisionista);
      if (error) return res.status(400).json({ error: error.message });
    } else {
      return res.status(400).json({ error: 'No se encontro un perfil vinculado' });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { registrarUsuario, miPerfil, completarPerfil, actualizarMiPerfil };
