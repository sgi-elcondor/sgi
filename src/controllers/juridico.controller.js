const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

exports.getCarteraJuridica = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from('vw_cartera_juridica').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getObservaciones = async (req, res) => {
  const id = parseInt(req.params.id_venta, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID de venta invalido' });
  const { data, error } = await supabase.schema(SCHEMA).from('observacion_juridica')
    .select('*').eq('id_venta', id).order('fecha_registro', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.createObservacion = async (req, res) => {
  const { id_venta, descripcion, estado_proceso } = req.body;
  if (!id_venta || !descripcion?.trim())
    return res.status(422).json({ error: 'id_venta y descripcion son requeridos' });

  const { data, error } = await supabase.schema(SCHEMA).from('observacion_juridica')
    .insert([{
      id_venta:       parseInt(id_venta, 10),
      descripcion:    descripcion.trim(),
      estado_proceso: estado_proceso?.trim() || null,
      usuario_db:     req.usuario.email,
    }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};
