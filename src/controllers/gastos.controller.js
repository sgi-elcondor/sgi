const supabase = require("../config/supabase");
const SCHEMA = "condor";
const CATEGORIAS = ["vehiculos", "nomina", "servicios", "otros"];

exports.getAll = async (req, res) => {
  const { id_proyecto, categoria, fecha_desde, fecha_hasta } = req.query;

  let q = supabase.schema(SCHEMA).from("gasto")
    .select("*, proyecto:id_proyecto(nombre)")
    .order("fecha", { ascending: false });

  if (id_proyecto) q = q.eq("id_proyecto", Number(id_proyecto));
  if (categoria)   q = q.eq("categoria", categoria);
  if (fecha_desde) q = q.gte("fecha", fecha_desde);
  if (fecha_hasta) q = q.lte("fecha", fecha_hasta);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
};

exports.getResumen = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("gasto")
    .select("id_proyecto, categoria, valor, proyecto:id_proyecto(nombre)");

  if (error) return res.status(500).json({ error: error.message });

  const map = {};
  for (const row of data || []) {
    const key = `${row.id_proyecto}_${row.categoria}`;
    if (!map[key]) {
      map[key] = {
        id_proyecto:     row.id_proyecto,
        proyecto_nombre: row.proyecto?.nombre || null,
        categoria:       row.categoria,
        total:           0,
        cantidad:        0,
      };
    }
    map[key].total    += Number(row.valor);
    map[key].cantidad += 1;
  }

  res.json(Object.values(map));
};

exports.create = async (req, res) => {
  const {
    id_proyecto, fecha, descripcion, valor, categoria,
    detalle_recurso, medio_pago, cuenta_origen,
    responsable_entrega, responsable_recibe, comprobante_url,
  } = req.body;

  if (!id_proyecto || !fecha || !descripcion || valor === undefined || !categoria) {
    return res.status(422).json({ error: "id_proyecto, fecha, descripcion, valor y categoria son requeridos" });
  }

  if (!CATEGORIAS.includes(categoria)) {
    return res.status(422).json({ error: `Categoria invalida. Opciones: ${CATEGORIAS.join(", ")}` });
  }

  const MEDIOS = ["efectivo", "transferencia"];
  if (medio_pago && !MEDIOS.includes(medio_pago)) {
    return res.status(422).json({ error: "medio_pago invalido. Opciones: efectivo, transferencia" });
  }

  const { data, error } = await supabase.schema(SCHEMA).from("gasto")
    .insert([{
      id_proyecto:         Number(id_proyecto),
      fecha,
      descripcion:         descripcion.trim(),
      valor:               Number(valor),
      categoria,
      detalle_recurso:     detalle_recurso?.trim() || null,
      medio_pago:          medio_pago || "efectivo",
      cuenta_origen:       medio_pago === "transferencia" ? (cuenta_origen?.trim() || null) : null,
      responsable_entrega: responsable_entrega?.trim() || null,
      responsable_recibe:  responsable_recibe?.trim()  || null,
      comprobante_url:     comprobante_url || null,
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabase.schema(SCHEMA).from("auditoria").insert([{
    tabla_afectada: "gasto",
    id_registro:    data.id_gasto,
    campo:          "created",
    valor_anterior: null,
    valor_nuevo:    JSON.stringify({ id_proyecto, fecha, descripcion, valor, categoria }),
    usuario_db:     req.usuario?.email || "sistema",
    motivo:         "Registro de gasto operativo",
  }]);

  res.status(201).json(data);
};

exports.update = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: "ID invalido" });

  const {
    fecha, descripcion, valor, categoria, detalle_recurso,
    medio_pago, cuenta_origen, responsable_entrega, responsable_recibe, comprobante_url,
  } = req.body;

  if (categoria && !CATEGORIAS.includes(categoria)) {
    return res.status(422).json({ error: `Categoria invalida. Opciones: ${CATEGORIAS.join(", ")}` });
  }

  const { data: actual, error: eRead } = await supabase.schema(SCHEMA).from("gasto")
    .select("*").eq("id_gasto", id).single();

  if (eRead || !actual) return res.status(404).json({ error: "Gasto no encontrado" });

  const updates = {};
  if (fecha !== undefined)                updates.fecha                = fecha;
  if (descripcion !== undefined)          updates.descripcion          = descripcion.trim();
  if (valor !== undefined)                updates.valor                = Number(valor);
  if (categoria !== undefined)            updates.categoria            = categoria;
  if (detalle_recurso !== undefined)      updates.detalle_recurso      = detalle_recurso?.trim() || null;
  if (medio_pago !== undefined)           updates.medio_pago           = medio_pago;
  if (cuenta_origen !== undefined)        updates.cuenta_origen        = medio_pago === "transferencia" ? (cuenta_origen?.trim() || null) : null;
  if (responsable_entrega !== undefined)  updates.responsable_entrega  = responsable_entrega?.trim() || null;
  if (responsable_recibe !== undefined)   updates.responsable_recibe   = responsable_recibe?.trim()  || null;
  if (comprobante_url !== undefined)      updates.comprobante_url      = comprobante_url || null;

  if (Object.keys(updates).length === 0) return res.status(200).json({ message: "Sin cambios" });

  const auditRows = Object.entries(updates).map(([campo, nuevo]) => ({
    tabla_afectada: "gasto",
    id_registro:    id,
    campo,
    valor_anterior: actual[campo] != null ? String(actual[campo]) : null,
    valor_nuevo:    nuevo != null ? String(nuevo) : null,
    usuario_db:     req.usuario?.email || "sistema",
    motivo:         null,
  }));

  await supabase.schema(SCHEMA).from("auditoria").insert(auditRows);

  const { data, error: eUpd } = await supabase.schema(SCHEMA).from("gasto")
    .update(updates).eq("id_gasto", id).select().single();

  if (eUpd) return res.status(400).json({ error: eUpd.message });
  res.json(data);
};
