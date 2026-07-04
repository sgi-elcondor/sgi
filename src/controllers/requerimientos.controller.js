const supabase     = require("../config/supabase");
const auditoria    = require("../services/auditoria.service");
const consecutivos = require("../services/consecutivos.service");
const emailService = require("../services/email.service");

const SCHEMA     = "condor";
const CATEGORIAS = ["materiales", "herramientas", "equipos", "servicios", "otros"];
const URGENCIAS  = ["baja", "media", "alta"];

function validarCampos({ descripcion, categoria, urgencia, justificacion, items }) {
  if (!descripcion || !String(descripcion).trim()) {
    return "La descripción del requerimiento es obligatoria";
  }
  if (!CATEGORIAS.includes(categoria)) {
    return `Categoría inválida. Opciones: ${CATEGORIAS.join(", ")}`;
  }
  if (!URGENCIAS.includes(urgencia)) {
    return `Urgencia inválida. Opciones: ${URGENCIAS.join(", ")}`;
  }
  if (!justificacion || !String(justificacion).trim()) {
    return "La justificación es obligatoria";
  }
  if (!Array.isArray(items) || items.length === 0) {
    return "Debes agregar al menos un ítem";
  }
  for (const it of items) {
    if (!it.descripcion || !String(it.descripcion).trim()) {
      return "Cada ítem debe tener una descripción";
    }
    const cantidad = Number(it.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return `El ítem "${it.descripcion}" debe tener una cantidad mayor a cero`;
    }
    const precio = Number(it.precio_unitario);
    if (!Number.isFinite(precio) || precio < 0) {
      return `El ítem "${it.descripcion}" debe tener un monto estimado válido`;
    }
  }
  return null;
}

// POST /api/v1/requerimientos
// Body: { descripcion, id_proyecto?, categoria, urgencia, justificacion,
//         items: [{ descripcion, unidad?, cantidad, precio_unitario }] }
// Creates the requerimiento in 'pendiente_jefe' and notifies jefes de área (best-effort).
async function create(req, res) {
  try {
    const { descripcion, id_proyecto, categoria, urgencia, justificacion, items } = req.body;

    const errValidacion = validarCampos({ descripcion, categoria, urgencia, justificacion, items });
    if (errValidacion) return res.status(422).json({ error: errValidacion });

    const valorTotal = items.reduce(
      (s, it) => s + Number(it.cantidad) * Number(it.precio_unitario), 0
    );

    const numero = await consecutivos.next("REQ");
    const hoy    = new Date().toISOString().slice(0, 10);

    const { data: reqCreado, error: eReq } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .insert([{
        numero,
        descripcion:     String(descripcion).trim(),
        id_proyecto:     id_proyecto ? Number(id_proyecto) : null,
        fecha_solicitud: hoy,
        estado:          "pendiente_jefe",
        valor_total:     valorTotal,
        id_solicitante:  req.usuario.id_usuario,
        categoria,
        urgencia,
        justificacion:   String(justificacion).trim(),
      }])
      .select()
      .single();

    if (eReq) return res.status(400).json({ error: eReq.message });

    const itemRows = items.map(it => ({
      id_requerimiento:    reqCreado.id_requerimiento,
      descripcion:         String(it.descripcion).trim(),
      unidad:              String(it.unidad || "und").trim(),
      cantidad_solicitada: Number(it.cantidad),
      precio_unitario:     Number(it.precio_unitario),
    }));

    const { error: eItems } = await supabase.schema(SCHEMA)
      .from("requerimiento_item")
      .insert(itemRows);

    if (eItems) {
      await supabase.schema(SCHEMA).from("requerimiento")
        .delete().eq("id_requerimiento", reqCreado.id_requerimiento);
      return res.status(400).json({ error: "Error al guardar los ítems: " + eItems.message });
    }

    await auditoria.log({
      tabla:   "requerimiento",
      id:      reqCreado.id_requerimiento,
      campo:   "estado",
      nuevo:   "pendiente_jefe",
      usuario: req.usuario.email,
      motivo:  "creacion_requerimiento",
    });

    // Notify jefes de área. Best-effort: the requerimiento is already saved,
    // so an email failure must never fail the request.
    try {
      await notificarJefes(reqCreado, req.usuario, items.length);
    } catch (e) {
      console.error("[requerimientos] No se pudo notificar a jefes:", e.message);
    }

    return res.status(201).json(reqCreado);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function notificarJefes(reqCreado, solicitante, itemsCount) {
  const { data: rolJefe } = await supabase.schema(SCHEMA)
    .from("roles").select("id_rol").eq("nombre", "jefe_area").single();
  if (!rolJefe) return;

  const { data: jefes } = await supabase.schema(SCHEMA)
    .from("usuarios")
    .select("email")
    .eq("id_rol", rolJefe.id_rol)
    .eq("activo", true);

  const emails = (jefes || []).map(j => j.email).filter(Boolean);
  if (!emails.length) return;

  const { data: perfil } = await supabase.schema(SCHEMA)
    .from("usuarios")
    .select("nombres, apellidos")
    .eq("id_usuario", solicitante.id_usuario)
    .single();

  const nombreSolicitante =
    `${perfil?.nombres || ""} ${perfil?.apellidos || ""}`.trim() || solicitante.email;

  await Promise.allSettled(emails.map(to =>
    emailService.sendRequerimientoNuevoEmail(to, {
      numero:      reqCreado.numero,
      solicitante: nombreSolicitante,
      categoria:   reqCreado.categoria,
      urgencia:    reqCreado.urgencia,
      valor_total: reqCreado.valor_total,
      descripcion: reqCreado.descripcion,
      items_count: itemsCount,
    })
  ));
}

// PATCH /api/v1/requerimientos/:id/cancelar
// Body: { motivo }. Only the requester can cancel, and only while 'pendiente_jefe'.
async function cancelar(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const motivo = String(req.body?.motivo || "").trim();
    if (motivo.length < 5) {
      return res.status(422).json({ error: "Indica un motivo de cancelación (mínimo 5 caracteres)" });
    }

    const { data: reqRow, error: eGet } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select("id_requerimiento, numero, estado, id_solicitante")
      .eq("id_requerimiento", id)
      .single();

    if (eGet || !reqRow) return res.status(404).json({ error: "Requerimiento no encontrado" });

    if (req.usuario.rol !== "admin" && reqRow.id_solicitante !== req.usuario.id_usuario) {
      return res.status(403).json({ error: "Solo quien creó el requerimiento puede cancelarlo" });
    }

    if (reqRow.estado !== "pendiente_jefe") {
      return res.status(409).json({
        error: `El requerimiento está en estado '${reqRow.estado}' y ya no se puede cancelar`,
      });
    }

    const { error: eUpd } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update({ estado: "cancelado" })
      .eq("id_requerimiento", id)
      .eq("estado", "pendiente_jefe");

    if (eUpd) return res.status(400).json({ error: eUpd.message });

    await auditoria.log({
      tabla:    "requerimiento",
      id,
      campo:    "estado",
      anterior: "pendiente_jefe",
      nuevo:    "cancelado",
      usuario:  req.usuario.email,
      motivo,
    });

    return res.json({ ok: true, numero: reqRow.numero, estado: "cancelado" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v1/requerimientos/mis-requerimientos
async function getMios(req, res) {
  try {
    const { data, error } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, fecha_solicitud, fecha_desembolso, estado,
        valor_total, categoria, urgencia, justificacion, id_proyecto,
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .eq("id_solicitante", req.usuario.id_usuario)
      .order("id_requerimiento", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map(r => ({
      ...r,
      proyecto: r.proyecto?.nombre || null,
      sigla:    r.proyecto?.sigla || null,
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { create, getMios, cancelar, CATEGORIAS, URGENCIAS };
