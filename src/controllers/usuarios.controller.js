const supabase = require('../config/supabase');

async function listarUsuarios(req, res) {
  const { data, error } = await supabase
    .schema('condor')
    .from('usuarios')
    .select(`
      id_usuario, firebase_uid, email, activo, fecha_creacion,
      roles:id_rol ( id_rol, nombre ),
      comprador:id_comprador ( id_comprador, nombres, apellidos ),
      comisionista:id_comisionista ( id_comisionista, nombres, apellidos )
    `)
    .order('fecha_creacion', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}

async function listarRoles(req, res) {
  const { data, error } = await supabase
    .schema('condor')
    .from('roles')
    .select('id_rol, nombre, descripcion')
    .order('id_rol');

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}

async function crearUsuario(req, res) {
  const { email, id_rol, nombres, apellidos, documento, telefono } = req.body;

  if (!email || !id_rol) {
    return res.status(400).json({ error: 'email e id_rol son obligatorios' });
  }

  const { data: rolData, error: rolError } = await supabase
    .schema('condor')
    .from('roles')
    .select('nombre')
    .eq('id_rol', id_rol)
    .single();

  if (rolError || !rolData) {
    return res.status(400).json({ error: 'Rol no encontrado' });
  }

  const rolNombre = rolData.nombre;
  const esCompradorOComisionista = rolNombre === 'comprador' || rolNombre === 'comisionista';

  if (esCompradorOComisionista && (!nombres || !apellidos || !documento)) {
    return res.status(400).json({ error: 'Para compradores y comisionistas: nombres, apellidos y documento son obligatorios' });
  }

  try {
    let id_comprador = null;
    let id_comisionista = null;

    if (rolNombre === 'comprador') {
      const { data: existente } = await supabase
        .schema('condor')
        .from('comprador')
        .select('id_comprador')
        .eq('documento', documento)
        .single();

      if (existente) {
        return res.status(409).json({ error: 'Ya existe un comprador con ese documento' });
      }

      const { data: comp, error: errC } = await supabase
        .schema('condor')
        .from('comprador')
        .insert([{ tipo_persona: 'natural', documento, nombres, apellidos, telefono: telefono || null, mail: email, estado: 'activo' }])
        .select('id_comprador')
        .single();

      if (errC) return res.status(400).json({ error: errC.message });
      id_comprador = comp.id_comprador;
    }

    if (rolNombre === 'comisionista') {
      const { data: existente } = await supabase
        .schema('condor')
        .from('comisionista')
        .select('id_comisionista')
        .eq('documento', documento)
        .single();

      if (existente) {
        return res.status(409).json({ error: 'Ya existe un comisionista con ese documento' });
      }

      const { data: comis, error: errCo } = await supabase
        .schema('condor')
        .from('comisionista')
        .insert([{ documento, nombres, apellidos, telefono: telefono || null, mail: email }])
        .select('id_comisionista')
        .single();

      if (errCo) return res.status(400).json({ error: errCo.message });
      id_comisionista = comis.id_comisionista;
    }

    const { data, error } = await supabase
      .schema('condor')
      .from('usuarios')
      .insert([{ email, id_rol, id_comprador, id_comisionista }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function actualizarUsuario(req, res) {
  const { id } = req.params;
  const { id_rol, activo, id_comprador, id_comisionista, nombres, apellidos, documento, telefono } = req.body;

  const updates = {};
  if (id_rol          !== undefined) updates.id_rol          = id_rol;
  if (activo          !== undefined) updates.activo          = activo;
  if (id_comprador    !== undefined) updates.id_comprador    = id_comprador;
  if (id_comisionista !== undefined) updates.id_comisionista = id_comisionista;

  try {
    if (id_rol && nombres && apellidos && documento) {
      const { data: rolData } = await supabase
        .schema('condor')
        .from('roles')
        .select('nombre')
        .eq('id_rol', id_rol)
        .single();

      const { data: usuarioActual } = await supabase
        .schema('condor')
        .from('usuarios')
        .select('email, id_comprador, id_comisionista')
        .eq('id_usuario', id)
        .single();

      if (rolData?.nombre === 'comprador' && !usuarioActual?.id_comprador) {
        const { data: comp, error: errC } = await supabase
          .schema('condor')
          .from('comprador')
          .insert([{ tipo_persona: 'natural', documento, nombres, apellidos, telefono: telefono || null, mail: usuarioActual.email, estado: 'activo' }])
          .select('id_comprador')
          .single();
        if (errC) return res.status(400).json({ error: errC.message });
        updates.id_comprador = comp.id_comprador;
      }

      if (rolData?.nombre === 'comisionista' && !usuarioActual?.id_comisionista) {
        const { data: comis, error: errCo } = await supabase
          .schema('condor')
          .from('comisionista')
          .insert([{ documento, nombres, apellidos, telefono: telefono || null, mail: usuarioActual.email }])
          .select('id_comisionista')
          .single();
        if (errCo) return res.status(400).json({ error: errCo.message });
        updates.id_comisionista = comis.id_comisionista;
      }
    }

    const { data, error } = await supabase
      .schema('condor')
      .from('usuarios')
      .update(updates)
      .eq('id_usuario', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function desactivarUsuario(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .schema('condor')
    .from('usuarios')
    .update({ activo: false })
    .eq('id_usuario', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
}

module.exports = {
  listarUsuarios,
  listarRoles,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
};
