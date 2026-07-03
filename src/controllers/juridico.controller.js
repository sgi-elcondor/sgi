const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

exports.getCarteraJuridica = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from('vw_cartera_juridica').select('*');
  if (error) return res.status(500).json({ error: error.message });

  // The cartera view does not expose codigo_venta; attach it so juridico shows the same
  // descriptive venta code as every other view.
  const ids = [...new Set((data || []).map(r => r.id_venta).filter(Boolean))];
  if (ids.length) {
    const { data: ventas } = await supabase.schema(SCHEMA)
      .from('venta').select('id_venta, codigo_venta').in('id_venta', ids);
    const codes = new Map((ventas || []).map(v => [v.id_venta, v.codigo_venta]));
    for (const r of (data || [])) r.codigo_venta = codes.get(r.id_venta) ?? null;
  }

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
