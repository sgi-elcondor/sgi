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

// ── Approval flow (REQ-02 / REQ-03) ─────────────────────────────────────────

function _puede(reqUsuario, accion) {
  return reqUsuario.rol === "admin" || reqUsuario.permisos?.has(`requerimientos:${accion}`);
}

async function _emailsDeRol(nombreRol) {
  const { data: rol } = await supabase.schema(SCHEMA)
    .from("roles").select("id_rol").eq("nombre", nombreRol).single();
  if (!rol) return [];
  const { data: usuarios } = await supabase.schema(SCHEMA)
    .from("usuarios").select("email")
    .eq("id_rol", rol.id_rol).eq("activo", true);
  return (usuarios || []).map(u => u.email).filter(Boolean);
}

async function _emailDeUsuario(idUsuario) {
  if (!idUsuario) return null;
  const { data } = await supabase.schema(SCHEMA)
    .from("usuarios").select("email, activo").eq("id_usuario", idUsuario).single();
  return data?.activo ? data.email : null;
}

function _notificar(emails, datos) {
  const list = (emails || []).filter(Boolean);
  if (!list.length) return Promise.resolve();
  return Promise.allSettled(list.map(to => emailService.sendRequerimientoEstadoEmail(to, datos)));
}

// GET /api/v1/requerimientos/aprobaciones
// Inbox for approvers: jefes see 'pendiente_jefe', final approvers see 'aprobado_jefe'.
async function getAprobaciones(req, res) {
  try {
    const puedeJefe  = _puede(req.usuario, "aprobar_jefe");
    const puedeFinal = _puede(req.usuario, "aprobar_final");
    if (!puedeJefe && !puedeFinal) {
      return res.status(403).json({ error: "No tienes permisos de aprobación" });
    }

    const estados = [];
    if (puedeJefe)  estados.push("pendiente_jefe");
    if (puedeFinal) estados.push("aprobado_jefe");

    const { data, error } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, fecha_solicitud, estado,
        valor_total, categoria, urgencia, justificacion,
        fecha_aprobado_jefe,
        solicitante:id_solicitante (nombres, apellidos, email),
        aprobador_jefe:aprobado_jefe_por (nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .in("estado", estados)
      .order("fecha_solicitud", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map(r => ({
      ...r,
      solicitante: `${r.solicitante?.nombres || ""} ${r.solicitante?.apellidos || ""}`.trim() || r.solicitante?.email || "—",
      aprobador_jefe: r.aprobador_jefe
        ? `${r.aprobador_jefe.nombres || ""} ${r.aprobador_jefe.apellidos || ""}`.trim()
        : null,
      proyecto: r.proyecto?.nombre || null,
      sigla:    r.proyecto?.sigla || null,
      nivel:    r.estado === "pendiente_jefe" ? "jefe" : "final",
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v1/requerimientos/historial
// Decision history for approvers: everything that already passed (or failed) review.
async function getHistorial(req, res) {
  try {
    if (!_puede(req.usuario, "aprobar_jefe") && !_puede(req.usuario, "aprobar_final")) {
      return res.status(403).json({ error: "No tienes permisos de aprobación" });
    }

    const { data, error } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, fecha_solicitud, estado,
        valor_total, categoria, urgencia, justificacion, motivo_rechazo,
        fecha_aprobado_jefe, fecha_aprobado_final, fecha_desembolso,
        solicitante:id_solicitante (nombres, apellidos, email),
        aprobador_jefe:aprobado_jefe_por (nombres, apellidos),
        aprobador_final:aprobado_final_por (nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .in("estado", ["aprobado_jefe", "pendiente_tesoreria", "desembolsado", "recibido_parcial", "en_inventario", "rechazado"])
      .order("id_requerimiento", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map(r => ({
      ...r,
      solicitante: `${r.solicitante?.nombres || ""} ${r.solicitante?.apellidos || ""}`.trim() || r.solicitante?.email || "—",
      aprobador_jefe:  r.aprobador_jefe  ? `${r.aprobador_jefe.nombres || ""} ${r.aprobador_jefe.apellidos || ""}`.trim()  : null,
      aprobador_final: r.aprobador_final ? `${r.aprobador_final.nombres || ""} ${r.aprobador_final.apellidos || ""}`.trim() : null,
      proyecto: r.proyecto?.nombre || null,
      sigla:    r.proyecto?.sigla || null,
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function _getRequerimiento(id) {
  const { data } = await supabase.schema(SCHEMA)
    .from("requerimiento")
    .select("id_requerimiento, numero, descripcion, estado, valor_total, urgencia, categoria, id_solicitante")
    .eq("id_requerimiento", id)
    .single();
  return data || null;
}

// PATCH /api/v1/requerimientos/:id/aprobar-jefe  (REQ-02: pendiente_jefe → aprobado_jefe)
async function aprobarJefe(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const r = await _getRequerimiento(id);
    if (!r) return res.status(404).json({ error: "Requerimiento no encontrado" });
    if (r.estado !== "pendiente_jefe") {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}'; solo se aprueban los pendientes de jefe` });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const { error: eUpd } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update({ estado: "aprobado_jefe", aprobado_jefe_por: req.usuario.id_usuario, fecha_aprobado_jefe: hoy })
      .eq("id_requerimiento", id)
      .eq("estado", "pendiente_jefe");

    if (eUpd) return res.status(400).json({ error: eUpd.message });

    await auditoria.log({
      tabla: "requerimiento", id, campo: "estado",
      anterior: "pendiente_jefe", nuevo: "aprobado_jefe",
      usuario: req.usuario.email, motivo: "aprobacion_jefe",
    });

    try {
      const duenos = await _emailsDeRol("gerencia");
      await _notificar(duenos, {
        asunto:  `Requerimiento ${r.numero} listo para tu aprobación final — El Cóndor`,
        titulo:  "Aprobación final pendiente",
        mensaje: `El jefe de área aprobó el requerimiento <strong>${r.numero}</strong> (${r.descripcion}). Falta tu aprobación final para autorizar el desembolso.`,
        numero:  r.numero,
        valor_total: r.valor_total,
      });
    } catch (e) { console.error("[requerimientos] Notificación a gerencia falló:", e.message); }

    return res.json({ ok: true, numero: r.numero, estado: "aprobado_jefe" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/requerimientos/:id/aprobar-final  (REQ-03: aprobado_jefe → pendiente_tesoreria)
async function aprobarFinal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const r = await _getRequerimiento(id);
    if (!r) return res.status(404).json({ error: "Requerimiento no encontrado" });
    if (r.estado !== "aprobado_jefe") {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}'; la aprobación final requiere que el jefe lo haya aprobado primero` });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const { error: eUpd } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update({ estado: "pendiente_tesoreria", aprobado_final_por: req.usuario.id_usuario, fecha_aprobado_final: hoy })
      .eq("id_requerimiento", id)
      .eq("estado", "aprobado_jefe");

    if (eUpd) return res.status(400).json({ error: eUpd.message });

    await auditoria.log({
      tabla: "requerimiento", id, campo: "estado",
      anterior: "aprobado_jefe", nuevo: "pendiente_tesoreria",
      usuario: req.usuario.email, motivo: "aprobacion_final",
    });

    // REQ-03: tesorería takes over and the tesorero gets notified; the requester too.
    try {
      const tesoreros    = await _emailsDeRol("tesorero");
      const solicitante  = await _emailDeUsuario(r.id_solicitante);
      await _notificar(tesoreros, {
        asunto:  `Requerimiento ${r.numero} aprobado — gestionar desembolso — El Cóndor`,
        titulo:  "Nuevo requerimiento en tesorería",
        mensaje: `El requerimiento <strong>${r.numero}</strong> (${r.descripcion}) recibió la aprobación final y pasa a tesorería para gestionar el desembolso.`,
        numero:  r.numero,
        valor_total: r.valor_total,
      });
      await _notificar([solicitante], {
        asunto:  `Tu requerimiento ${r.numero} fue aprobado — El Cóndor`,
        titulo:  "¡Requerimiento aprobado!",
        mensaje: `Tu requerimiento <strong>${r.numero}</strong> (${r.descripcion}) recibió la aprobación final y está en tesorería para el desembolso.`,
        numero:  r.numero,
        valor_total: r.valor_total,
      });
    } catch (e) { console.error("[requerimientos] Notificación de aprobación final falló:", e.message); }

    return res.json({ ok: true, numero: r.numero, estado: "pendiente_tesoreria" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/requerimientos/:id/rechazar
// Body: { motivo }. Level is inferred from the current estado; the caller must hold
// the matching approval permission (enforced here, not in ROUTE_PERMISSIONS).
async function rechazar(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const motivo = String(req.body?.motivo || "").trim();
    if (motivo.length < 5) {
      return res.status(422).json({ error: "Indica un motivo de rechazo (mínimo 5 caracteres)" });
    }

    const r = await _getRequerimiento(id);
    if (!r) return res.status(404).json({ error: "Requerimiento no encontrado" });

    const permisoRequerido =
      r.estado === "pendiente_jefe" ? "aprobar_jefe" :
      r.estado === "aprobado_jefe"  ? "aprobar_final" : null;

    if (!permisoRequerido) {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}' y no admite rechazo` });
    }
    if (!_puede(req.usuario, permisoRequerido)) {
      return res.status(403).json({ error: "No tienes permiso para rechazar en este nivel" });
    }

    const { error: eUpd } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update({ estado: "rechazado", motivo_rechazo: motivo })
      .eq("id_requerimiento", id)
      .eq("estado", r.estado);

    if (eUpd) return res.status(400).json({ error: eUpd.message });

    await auditoria.log({
      tabla: "requerimiento", id, campo: "estado",
      anterior: r.estado, nuevo: "rechazado",
      usuario: req.usuario.email, motivo,
    });

    try {
      const solicitante = await _emailDeUsuario(r.id_solicitante);
      await _notificar([solicitante], {
        asunto:  `Tu requerimiento ${r.numero} fue rechazado — El Cóndor`,
        titulo:  "Requerimiento rechazado",
        mensaje: `Tu requerimiento <strong>${r.numero}</strong> (${r.descripcion}) fue rechazado durante la revisión.`,
        numero:  r.numero,
        valor_total: r.valor_total,
        motivo,
      });
    } catch (e) { console.error("[requerimientos] Notificación de rechazo falló:", e.message); }

    return res.json({ ok: true, numero: r.numero, estado: "rechazado" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Desembolso por tesorería (REQ-04) ───────────────────────────────────────

// GET /api/v1/requerimientos/desembolsos
// Treasury inbox: 'pendiente_tesoreria' waiting for payment plus the disbursed history.
async function getDesembolsos(req, res) {
  try {
    const { data, error } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, fecha_solicitud, estado,
        valor_total, categoria, urgencia, justificacion, id_proyecto,
        fecha_aprobado_jefe, fecha_aprobado_final,
        fecha_desembolso, valor_desembolsado, comprobante_desembolso_url, id_gasto,
        solicitante:id_solicitante (nombres, apellidos, email),
        aprobador_jefe:aprobado_jefe_por (nombres, apellidos),
        aprobador_final:aprobado_final_por (nombres, apellidos),
        desembolsador:desembolsado_por (nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .in("estado", ["pendiente_tesoreria", "desembolsado", "recibido_parcial", "en_inventario"])
      .order("fecha_aprobado_final", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const nombre = u => u ? `${u.nombres || ""} ${u.apellidos || ""}`.trim() : null;

    return res.json((data || []).map(r => ({
      ...r,
      solicitante:     nombre(r.solicitante) || r.solicitante?.email || "—",
      aprobador_jefe:  nombre(r.aprobador_jefe),
      aprobador_final: nombre(r.aprobador_final),
      desembolsador:   nombre(r.desembolsador),
      proyecto: r.proyecto?.nombre || null,
      sigla:    r.proyecto?.sigla || null,
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/requerimientos/:id/desembolsar
// Body: { valor?, fecha?, comprobante_url, observaciones? }
// Marks the requerimiento as 'desembolsado', auto-creates the gasto (best-effort when
// the requerimiento has no project) and notifies almacenistas + the requester.
async function desembolsar(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const comprobanteUrl = String(req.body?.comprobante_url || "").trim();
    if (!comprobanteUrl) {
      return res.status(422).json({ error: "El comprobante del pago es obligatorio" });
    }

    const { data: r } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select("id_requerimiento, numero, descripcion, estado, valor_total, categoria, id_proyecto, id_solicitante")
      .eq("id_requerimiento", id)
      .single();

    if (!r) return res.status(404).json({ error: "Requerimiento no encontrado" });
    if (r.estado !== "pendiente_tesoreria") {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}'; solo se desembolsan los aprobados por el dueño` });
    }

    const valor = Number(req.body?.valor) > 0 ? Number(req.body.valor) : Number(r.valor_total || 0);
    if (!(valor > 0)) return res.status(422).json({ error: "El valor del desembolso debe ser mayor a cero" });

    const fecha         = req.body?.fecha || new Date().toISOString().slice(0, 10);
    const observaciones = String(req.body?.observaciones || "").trim();

    // 1. Auto-create the gasto. Best-effort: a missing project (gasto requires one)
    //    must not block the treasury operation; the warning is surfaced to the UI.
    let idGasto = null;
    let gastoWarning = null;
    const { data: gasto, error: eGasto } = await supabase.schema(SCHEMA)
      .from("gasto")
      .insert([{
        id_proyecto:     r.id_proyecto,
        fecha,
        descripcion:     `Desembolso requerimiento ${r.numero} — ${r.descripcion}`,
        valor,
        categoria:       r.categoria === "servicios" ? "servicios" : "otros",
        detalle_recurso: `Requerimiento ${r.numero} (${r.categoria})${observaciones ? " · " + observaciones : ""}`,
        comprobante_url: comprobanteUrl,
      }])
      .select("id_gasto")
      .single();

    if (eGasto) {
      gastoWarning = "El gasto automático no pudo crearse (" + eGasto.message + "); regístralo manualmente en Gastos.";
      console.error("[requerimientos] Gasto automático falló:", eGasto.message);
    } else {
      idGasto = gasto.id_gasto;
    }

    // 2. Move the requerimiento to 'desembolsado' (guarded by current estado).
    const { data: updated, error: eUpd } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update({
        estado:                     "desembolsado",
        fecha_desembolso:           fecha,
        desembolsado_por:           req.usuario.id_usuario,
        valor_desembolsado:         valor,
        comprobante_desembolso_url: comprobanteUrl,
        id_gasto:                   idGasto,
      })
      .eq("id_requerimiento", id)
      .eq("estado", "pendiente_tesoreria")
      .select("id_requerimiento");

    if (eUpd || !updated?.length) {
      if (idGasto) {
        await supabase.schema(SCHEMA).from("gasto").delete().eq("id_gasto", idGasto);
      }
      return res.status(400).json({ error: eUpd?.message || "No se pudo registrar el desembolso (el estado cambió)" });
    }

    await auditoria.log({
      tabla: "requerimiento", id, campo: "estado",
      anterior: "pendiente_tesoreria", nuevo: "desembolsado",
      usuario: req.usuario.email,
      motivo: `desembolso por $${valor}${idGasto ? ` (gasto #${idGasto})` : " (sin gasto automático)"}`,
    });

    if (idGasto) {
      await auditoria.log({
        tabla: "gasto", id: idGasto, campo: "creacion",
        nuevo: JSON.stringify({ valor, fecha, requerimiento: r.numero }),
        usuario: req.usuario.email,
        motivo: "gasto_automatico_desembolso",
      });
    }

    try {
      const almacenistas = await _emailsDeRol("almacenista");
      const solicitante  = await _emailDeUsuario(r.id_solicitante);
      await _notificar(almacenistas, {
        asunto:  `Requerimiento ${r.numero} desembolsado — preparar recepción — El Cóndor`,
        titulo:  "Material en camino",
        mensaje: `Tesorería desembolsó el requerimiento <strong>${r.numero}</strong> (${r.descripcion}). Cuando llegue el material, registra la recepción en el módulo Recepciones.`,
        numero:  r.numero,
        valor_total: valor,
      });
      await _notificar([solicitante], {
        asunto:  `Tu requerimiento ${r.numero} fue desembolsado — El Cóndor`,
        titulo:  "¡Desembolso realizado!",
        mensaje: `Tesorería realizó el pago de tu requerimiento <strong>${r.numero}</strong> (${r.descripcion}). El material queda en proceso de compra y entrega.`,
        numero:  r.numero,
        valor_total: valor,
      });
    } catch (e) { console.error("[requerimientos] Notificación de desembolso falló:", e.message); }

    return res.json({ ok: true, numero: r.numero, estado: "desembolsado", id_gasto: idGasto, gasto_warning: gastoWarning });
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
        fecha_aprobado_jefe, fecha_aprobado_final, motivo_rechazo,
        aprobador_jefe:aprobado_jefe_por (nombres, apellidos),
        aprobador_final:aprobado_final_por (nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .eq("id_solicitante", req.usuario.id_usuario)
      .order("id_requerimiento", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map(r => ({
      ...r,
      aprobador_jefe:  r.aprobador_jefe  ? `${r.aprobador_jefe.nombres || ""} ${r.aprobador_jefe.apellidos || ""}`.trim()  : null,
      aprobador_final: r.aprobador_final ? `${r.aprobador_final.nombres || ""} ${r.aprobador_final.apellidos || ""}`.trim() : null,
      proyecto: r.proyecto?.nombre || null,
      sigla:    r.proyecto?.sigla || null,
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  create, getMios, cancelar,
  getAprobaciones, getHistorial, aprobarJefe, aprobarFinal, rechazar,
  getDesembolsos, desembolsar,
  CATEGORIAS, URGENCIAS,
};
