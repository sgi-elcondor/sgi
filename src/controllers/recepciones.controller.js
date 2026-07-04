const supabase     = require("../config/supabase");
const auditoria    = require("../services/auditoria.service");
const emailService = require("../services/email.service");

const SCHEMA = "condor";
const ESTADOS_ABIERTOS = ["desembolsado", "recibido_parcial"];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/recepciones/pendientes
// Lista los requerimientos abiertos (desembolsados o recibidos parcialmente)
// con sus items y cuánto queda por recibir.
// ─────────────────────────────────────────────────────────────────────────────
exports.getPendientes = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("requerimiento")
    .select(`
      id_requerimiento, numero, descripcion, fecha_solicitud, fecha_desembolso,
      estado, valor_total, observaciones,
      proyecto:id_proyecto ( id_proyecto, nombre, sigla ),
      items:requerimiento_item (
        id_item, descripcion, unidad, cantidad_solicitada, precio_unitario,
        recibido:recepcion_item ( cantidad )
      )
    `)
    .in("estado", ESTADOS_ABIERTOS)
    .order("fecha_desembolso", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(_normalizarRequerimientos(data));
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/recepciones/historial
// Requerimientos con actividad de recepción: completados (en_inventario) y
// parciales, con el resumen de entregas registradas.
// ─────────────────────────────────────────────────────────────────────────────
exports.getHistorial = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("requerimiento")
    .select(`
      id_requerimiento, numero, descripcion, fecha_solicitud, fecha_desembolso,
      estado, valor_total, observaciones,
      proyecto:id_proyecto ( id_proyecto, nombre, sigla ),
      items:requerimiento_item (
        id_item, descripcion, unidad, cantidad_solicitada, precio_unitario,
        recibido:recepcion_item ( cantidad )
      ),
      recepciones:recepcion ( id_recepcion, fecha, comprobante_url )
    `)
    .in("estado", ["recibido_parcial", "en_inventario"])
    .order("id_requerimiento", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const normalizados = _normalizarRequerimientos(data);
  normalizados.forEach((n, i) => {
    const recs = (data[i].recepciones || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    n.entregas        = recs.length;
    n.ultima_entrega  = recs[0]?.fecha || null;
  });

  res.json(normalizados);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/recepciones/:idRequerimiento
// Detalle completo de un requerimiento + historial de recepciones.
// ─────────────────────────────────────────────────────────────────────────────
exports.getDetalle = async (req, res) => {
  const id = Number(req.params.idRequerimiento);
  if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("requerimiento")
    .select(`
      id_requerimiento, numero, descripcion, fecha_solicitud, fecha_desembolso,
      estado, valor_total, observaciones,
      proyecto:id_proyecto ( id_proyecto, nombre, sigla ),
      items:requerimiento_item (
        id_item, descripcion, unidad, cantidad_solicitada, precio_unitario,
        recibido:recepcion_item ( cantidad )
      ),
      recepciones:recepcion (
        id_recepcion, fecha, observaciones, comprobante_url, created_at,
        almacenista:id_almacenista ( id_usuario, nombres, apellidos ),
        detalle:recepcion_item (
          id_recepcion_item, cantidad,
          item:id_item ( id_item, descripcion, unidad )
        )
      )
    `)
    .eq("id_requerimiento", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });

  const normalizado = _normalizarRequerimientos([data])[0];
  normalizado.recepciones = (data.recepciones || [])
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(rc => ({
      id_recepcion:    rc.id_recepcion,
      fecha:           rc.fecha,
      observaciones:   rc.observaciones,
      comprobante_url: rc.comprobante_url,
      almacenista:     rc.almacenista
                         ? `${rc.almacenista.nombres || ""} ${rc.almacenista.apellidos || ""}`.trim()
                         : "—",
      detalle: (rc.detalle || []).map(d => ({
        id_item:     d.item?.id_item,
        descripcion: d.item?.descripcion,
        unidad:      d.item?.unidad,
        cantidad:    Number(d.cantidad),
      })),
    }));

  res.json(normalizado);
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/recepciones
// Body: { id_requerimiento, fecha?, observaciones?, comprobante_url?, items: [{ id_item, cantidad }] }
// Registra una recepción y recalcula el estado del requerimiento.
// ─────────────────────────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  const { id_requerimiento, fecha, observaciones, comprobante_url, items } = req.body;

  if (!id_requerimiento)               return res.status(400).json({ error: "id_requerimiento es obligatorio" });
  if (!Array.isArray(items) || !items.length)
                                       return res.status(400).json({ error: "Debe registrarse al menos un ítem recibido" });

  // 1. Validar el requerimiento existe y está abierto
  const { data: req0, error: reqErr } = await supabase.schema(SCHEMA)
    .from("requerimiento")
    .select(`
      id_requerimiento, numero, descripcion, estado, id_solicitante, valor_total,
      items:requerimiento_item (
        id_item, descripcion, unidad, cantidad_solicitada,
        recibido:recepcion_item ( cantidad )
      )
    `)
    .eq("id_requerimiento", id_requerimiento)
    .single();

  if (reqErr || !req0)                       return res.status(404).json({ error: "Requerimiento no encontrado" });
  if (!ESTADOS_ABIERTOS.includes(req0.estado))
    return res.status(409).json({ error: `El requerimiento está en estado '${req0.estado}' y no admite recepciones` });

  // 2. Validar items y cantidades
  const itemsMap = new Map();
  for (const it of req0.items || []) {
    const recibido = (it.recibido || []).reduce((s, r) => s + Number(r.cantidad), 0);
    itemsMap.set(it.id_item, {
      ...it,
      cantidad_solicitada: Number(it.cantidad_solicitada),
      cantidad_recibida_previa: recibido,
      cantidad_pendiente:       Math.max(0, Number(it.cantidad_solicitada) - recibido),
    });
  }

  const itemsParaInsertar = [];
  for (const inc of items) {
    const id_item  = Number(inc.id_item);
    const cantidad = Number(inc.cantidad);
    if (!id_item || !Number.isFinite(cantidad) || cantidad <= 0) continue;

    const ref = itemsMap.get(id_item);
    if (!ref) return res.status(400).json({ error: `El ítem ${id_item} no pertenece al requerimiento` });
    if (cantidad > ref.cantidad_pendiente) {
      return res.status(400).json({
        error: `La cantidad recibida (${cantidad}) excede lo pendiente (${ref.cantidad_pendiente}) para el ítem "${ref.descripcion}"`,
      });
    }
    itemsParaInsertar.push({ id_item, cantidad });
  }

  if (!itemsParaInsertar.length)
    return res.status(400).json({ error: "Ningún ítem válido con cantidad > 0 para registrar" });

  // 3. Insertar la recepción (cabecera)
  const { data: nuevaRecep, error: recErr } = await supabase.schema(SCHEMA)
    .from("recepcion")
    .insert([{
      id_requerimiento,
      fecha:          fecha || new Date().toISOString().slice(0, 10),
      observaciones:  observaciones || null,
      comprobante_url: comprobante_url || null,
      id_almacenista: req.usuario.id_usuario,
    }])
    .select("id_recepcion")
    .single();

  if (recErr) return res.status(500).json({ error: recErr.message });

  // 4. Insertar los items de la recepción
  const itemRows = itemsParaInsertar.map(r => ({
    id_recepcion: nuevaRecep.id_recepcion,
    id_item:      r.id_item,
    cantidad:     r.cantidad,
  }));
  const { error: itErr } = await supabase.schema(SCHEMA).from("recepcion_item").insert(itemRows);
  if (itErr) {
    // rollback de la recepción
    await supabase.schema(SCHEMA).from("recepcion").delete().eq("id_recepcion", nuevaRecep.id_recepcion);
    return res.status(500).json({ error: itErr.message });
  }

  // 5. Recalcular estado del requerimiento
  for (const r of itemsParaInsertar) {
    const ref = itemsMap.get(r.id_item);
    ref.cantidad_recibida_total = ref.cantidad_recibida_previa + r.cantidad;
  }
  const todoCompleto = Array.from(itemsMap.values()).every(it => {
    const total = (it.cantidad_recibida_total ?? it.cantidad_recibida_previa);
    return total >= it.cantidad_solicitada;
  });

  const nuevoEstado = todoCompleto ? "en_inventario" : "recibido_parcial";

  if (nuevoEstado !== req0.estado) {
    await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update({ estado: nuevoEstado })
      .eq("id_requerimiento", id_requerimiento);

    await auditoria.log({
      tabla:    "requerimiento",
      id:       id_requerimiento,
      campo:    "estado",
      anterior: req0.estado,
      nuevo:    nuevoEstado,
      usuario:  req.usuario.email,
      motivo:   "recepcion_almacenista",
    });
  }

  // 6. Notificar al peticionario que su material llegó (best-effort)
  try {
    if (req0.id_solicitante) {
      const { data: solicitante } = await supabase.schema(SCHEMA)
        .from("usuarios").select("email, activo")
        .eq("id_usuario", req0.id_solicitante).single();

      if (solicitante?.activo && solicitante.email) {
        const recibidoTxt = itemsParaInsertar
          .map(r => {
            const ref = itemsMap.get(r.id_item);
            return `${ref?.descripcion || "ítem"} × ${r.cantidad}${ref?.unidad ? " " + ref.unidad : ""}`;
          })
          .join(", ");

        const completa = nuevoEstado === "en_inventario";
        await emailService.sendRequerimientoEstadoEmail(solicitante.email, {
          asunto:  completa
            ? `Tu requerimiento ${req0.numero} está completo en inventario — El Cóndor`
            : `Llegó una entrega de tu requerimiento ${req0.numero} — El Cóndor`,
          titulo:  completa ? "¡Material completo en inventario!" : "Llegó parte de tu material",
          mensaje: completa
            ? `El almacenista recibió la última entrega de tu requerimiento <strong>${req0.numero}</strong> (${req0.descripcion}). Todo el material está en inventario: ${recibidoTxt}.`
            : `El almacenista registró una entrega parcial de tu requerimiento <strong>${req0.numero}</strong> (${req0.descripcion}). Recibido en esta entrega: ${recibidoTxt}. El resto sigue pendiente.`,
          numero:  req0.numero,
        });
      }
    }
  } catch (e) {
    console.error("[recepciones] Notificación al peticionario falló:", e.message);
  }

  res.status(201).json({
    id_recepcion:     nuevaRecep.id_recepcion,
    id_requerimiento,
    estado_nuevo:     nuevoEstado,
    estado_cambiado:  nuevoEstado !== req0.estado,
    items_registrados: itemsParaInsertar.length,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function _normalizarRequerimientos(rows) {
  return (rows || []).map(r => {
    const items = (r.items || []).map(it => {
      const recibida = (it.recibido || []).reduce((s, rc) => s + Number(rc.cantidad), 0);
      const solicitada = Number(it.cantidad_solicitada);
      return {
        id_item:             it.id_item,
        descripcion:         it.descripcion,
        unidad:              it.unidad,
        cantidad_solicitada: solicitada,
        cantidad_recibida:   recibida,
        cantidad_pendiente:  Math.max(0, solicitada - recibida),
        precio_unitario:     Number(it.precio_unitario || 0),
      };
    });

    const totalSol = items.reduce((s, it) => s + it.cantidad_solicitada, 0);
    const totalRec = items.reduce((s, it) => s + it.cantidad_recibida, 0);
    const progresoPct = totalSol > 0 ? Math.round((totalRec / totalSol) * 100) : 0;

    return {
      id_requerimiento: r.id_requerimiento,
      numero:           r.numero,
      descripcion:      r.descripcion,
      fecha_solicitud:  r.fecha_solicitud,
      fecha_desembolso: r.fecha_desembolso,
      estado:           r.estado,
      valor_total:      Number(r.valor_total || 0),
      observaciones:    r.observaciones,
      proyecto:         r.proyecto?.nombre || "—",
      sigla:            r.proyecto?.sigla || "",
      progreso_pct:     progresoPct,
      items,
    };
  });
}
