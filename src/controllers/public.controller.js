const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

// Public, read-only showcase endpoints. Mounted BEFORE verificarToken in index.js, so they
// require no authentication. Each one exposes only curated, public-safe fields.

exports.getProyectos = async (req, res) => {
  try {
    const { data, error } = await supabase.schema(SCHEMA)
      .from('proyecto')
      .select('id_proyecto, nombre, ubicacion, descripcion')
      .order('nombre');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getLotesDisponibles = async (req, res) => {
  try {
    const { data, error } = await supabase.schema(SCHEMA)
      .from('lote')
      .select('id_lote, id_proyecto, codigo_lote, manzana, numero_lote, area_m2, dimensiones, precio_base, descripcion')
      .eq('estado', 'disponible')
      .order('codigo_lote');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAsesores = async (req, res) => {
  try {
    const { data: roles } = await supabase.schema(SCHEMA)
      .from('roles')
      .select('id_rol')
      .in('nombre', ['asesor', 'asesor_comercial']);
    const ids = (roles || []).map(r => r.id_rol);
    if (!ids.length) return res.json([]);

    const { data, error } = await supabase.schema(SCHEMA)
      .from('usuarios')
      .select('nombres, apellidos, telefono, email, photo_url')
      .in('id_rol', ids)
      .eq('activo', true)
      .order('nombres');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
