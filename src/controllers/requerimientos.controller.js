const supabase     = require("../config/supabase");
const auditoria    = require("../services/auditoria.service");
const consecutivos = require("../services/consecutivos.service");
const emailService = require("../services/email.service");
const events       = require("../services/events.service");
const notif        = require("../services/notificaciones.service");
const inventario   = require("../services/inventario.service");
const config       = require("../services/config.service");

const SCHEMA     = "condor";
const CATEGORIAS = ["materiales", "herramientas", "equipos", "servicios", "otros"];
const URGENCIAS  = ["baja", "media", "alta"];

// POL-02: purchases above this threshold require dual sign (dueno + gerencia).
// The value is read from condor.config_sistema.umbral_compra_grande (editable
// by admin from the Permisos view). config.service falls back to 5.000.000 COP
// if the key is missing (fresh install before the migration ran).
async function _umbralCompraGrande() {
  const raw = await config.get("umbral_compra_grande");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 5_000_000;
}

// A requerimiento is 'large' when its total ≥ umbral. Both firms
// (aprobado_dueno_por, aprobado_gerencia_por) are required in that case; small
// purchases still use the legacy single 'aprobar-final' path.
function _esCompraGrande(valorTotal, umbral) {
  return Number(valorTotal || 0) >= Number(umbral || 0);
}

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

    _emitLive(req.usuario, { id_requerimiento: reqCreado.id_requerimiento, numero: reqCreado.numero, estado: "pendiente_jefe" });

    notif.crear({
      paraRoles:  ["jefe_area"],
      excepto:    req.usuario.id_usuario,
      titulo:     `Nuevo requerimiento ${reqCreado.numero}`,
      mensaje:    `${reqCreado.descripcion} — pendiente de tu aprobación`,
      vista:      "aprobaciones",
      referencia: reqCreado.numero,
    }).catch(() => {});

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

    _emitLive(req.usuario, { id_requerimiento: id, numero: reqRow.numero, estado: "cancelado" });

    notif.crear({
      paraRoles:  ["jefe_area"],
      excepto:    req.usuario.id_usuario,
      titulo:     `${reqRow.numero} cancelado por el solicitante`,
      mensaje:    motivo,
      vista:      "aprobaciones",
      referencia: reqRow.numero,
    }).catch(() => {});

    return res.json({ ok: true, numero: reqRow.numero, estado: "cancelado" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Approval flow (REQ-02 / REQ-03) ─────────────────────────────────────────

function _puede(reqUsuario, accion) {
  return reqUsuario.rol === "admin" || reqUsuario.permisos?.has(`requerimientos:${accion}`);
}

// ── Live updates (REQ-07) ───────────────────────────────────────────────────

// Any role that participates in the requerimiento flow may listen to the stream.
const STREAM_PERMS = [
  "requerimientos:leer", "requerimientos:aprobar_jefe", "requerimientos:aprobar_final",
  "requerimientos:aprobar_dueno", "requerimientos:aprobar_gerencia",
  "requerimientos:desembolsar", "recepciones:leer",
];

function _puedeStream(reqUsuario) {
  return reqUsuario.rol === "admin" || STREAM_PERMS.some(p => reqUsuario.permisos?.has(p));
}

// GET /api/v1/requerimientos/stream (SSE).
// EventSource cannot send an Authorization header, so index.js maps ?token=
// into the header before the global auth middleware runs.
function stream(req, res) {
  if (!_puedeStream(req.usuario)) {
    return res.status(403).json({ error: "No tienes permisos del módulo de requerimientos" });
  }

  res.writeHead(200, {
    "Content-Type":      "text/event-stream",
    "Cache-Control":     "no-cache, no-transform",
    "Connection":        "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 5000\n\n");

  const unsubscribe = events.subscribe(res, req.usuario);
  req.on("close", unsubscribe);
}

// Fire-and-forget notification of a state transition to every listener.
function _emitLive(reqUsuario, datos) {
  try {
    events.emit({ tipo: "requerimiento", por: reqUsuario?.id_usuario ?? null, ...datos });
  } catch (_) { /* never blocks the request */ }
}

// GET /api/v1/requerimientos/contadores
// Pending counts for the caller's role — feeds the live sidebar badges.
async function getContadores(req, res) {
  try {
    const conteo = async (estados) => {
      const { count } = await supabase.schema(SCHEMA)
        .from("requerimiento")
        .select("id_requerimiento", { count: "exact", head: true })
        .in("estado", estados);
      return count || 0;
    };

    const out = {};
    const esAdmin = req.usuario.rol === "admin";
    const puede = (accion) => esAdmin || req.usuario.permisos?.has(`requerimientos:${accion}`);

    // Aprobaciones pendientes: se cuentan cuando el caller puede firmar en ese nivel.
    // Los large-purchase pending (aprobado_jefe) son visibles para dueno/gerencia con
    // los permisos correspondientes. `aprobar_final` los mostraba antes también, pero
    // POL-02 ya no permite firmarlos por esa ruta, así que solo cuentan si el usuario
    // tiene la firma de compra grande.
    let aprobaciones = 0;
    if (puede("aprobar_jefe"))     aprobaciones += await conteo(["pendiente_jefe"]);
    if (puede("aprobar_final") || puede("aprobar_dueno") || puede("aprobar_gerencia")) {
      // Sin filtro por umbral (contar el estado global). El backend valida en la firma
      // real si aplica el nivel del usuario; el badge es aproximación amigable.
      aprobaciones += await conteo(["aprobado_jefe"]);
    }
    if (aprobaciones) out.aprobaciones = aprobaciones;

    if (puede("desembolsar")) {
      const n = await conteo(["pendiente_tesoreria"]);
      if (n) out.desembolsos = n;
    }

    if (esAdmin || req.usuario.permisos?.has("recepciones:leer")) {
      const n = await conteo(["desembolsado", "recibido_parcial", "en_inventario"]);
      if (n) out.recepciones = n;
    }

    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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

// Fire-and-forget email helper (RN-28). SMTP calls (Gmail) can hang under
// network issues, so we never `await` them inside the request handler — the
// endpoint responds immediately and the emails go out in the background.
// Failures are logged only; they never affect the persisted transition.
function _emailsBackground(label, fn) {
  Promise.resolve().then(fn).catch(e => {
    console.error(`[requerimientos] Notificación background (${label}) falló:`, e.message);
  });
}

// GET /api/v1/requerimientos/aprobaciones
// Inbox for approvers. Includes POL-02 dual-sign metadata so the client can render
// the correct action button (aprobar-final / aprobar-dueno / aprobar-gerencia).
async function getAprobaciones(req, res) {
  try {
    const puedeJefe     = _puede(req.usuario, "aprobar_jefe");
    const puedeFinal    = _puede(req.usuario, "aprobar_final");
    const puedeDueno    = _puede(req.usuario, "aprobar_dueno");
    const puedeGerencia = _puede(req.usuario, "aprobar_gerencia");
    if (!puedeJefe && !puedeFinal && !puedeDueno && !puedeGerencia) {
      return res.status(403).json({ error: "No tienes permisos de aprobación" });
    }

    const estados = [];
    if (puedeJefe)                                                estados.push("pendiente_jefe");
    if (puedeFinal || puedeDueno || puedeGerencia)                estados.push("aprobado_jefe");

    const { data, error } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, fecha_solicitud, estado,
        valor_total, categoria, urgencia, justificacion,
        fecha_aprobado_jefe, fecha_aprobado_dueno, fecha_aprobado_gerencia,
        solicitante:id_solicitante (nombres, apellidos, email),
        aprobador_jefe:aprobado_jefe_por     (nombres, apellidos),
        aprobador_dueno:aprobado_dueno_por    (id_usuario, nombres, apellidos),
        aprobador_gerencia:aprobado_gerencia_por (id_usuario, nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .in("estado", estados)
      .order("fecha_solicitud", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const umbral = await _umbralCompraGrande();

    return res.json((data || []).map(r => {
      const grande = _esCompraGrande(r.valor_total, umbral);
      const firmaDueno    = r.aprobador_dueno    ? `${r.aprobador_dueno.nombres || ""} ${r.aprobador_dueno.apellidos || ""}`.trim() : null;
      const firmaGerencia = r.aprobador_gerencia ? `${r.aprobador_gerencia.nombres || ""} ${r.aprobador_gerencia.apellidos || ""}`.trim() : null;

      // Nivel visible en el badge:
      //   'jefe'     → pendiente_jefe
      //   'final'    → aprobado_jefe + compra chica (single sign)
      //   'dueno'    → aprobado_jefe + compra grande, falta firma del dueño (o solo falta esa)
      //   'gerencia' → aprobado_jefe + compra grande, falta co-firma de gerencia (dueño ya firmó)
      let nivel;
      if (r.estado === "pendiente_jefe") nivel = "jefe";
      else if (!grande)                  nivel = "final";
      else if (!r.aprobador_dueno)       nivel = "dueno";
      else                               nivel = "gerencia";

      return {
        ...r,
        solicitante:    `${r.solicitante?.nombres || ""} ${r.solicitante?.apellidos || ""}`.trim() || r.solicitante?.email || "—",
        aprobador_jefe:     r.aprobador_jefe ? `${r.aprobador_jefe.nombres || ""} ${r.aprobador_jefe.apellidos || ""}`.trim() : null,
        aprobador_dueno:    firmaDueno,
        aprobador_dueno_id: r.aprobador_dueno?.id_usuario ?? null,
        aprobador_gerencia:    firmaGerencia,
        aprobador_gerencia_id: r.aprobador_gerencia?.id_usuario ?? null,
        proyecto: r.proyecto?.nombre || null,
        sigla:    r.proyecto?.sigla || null,
        nivel,
        es_compra_grande: grande,
        umbral_actual:    umbral,
        firmas_faltantes: r.estado === "aprobado_jefe" && grande
          ? [!firmaDueno && "dueno", !firmaGerencia && "gerencia"].filter(Boolean)
          : [],
      };
    }));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v1/requerimientos/historial
// Decision history for approvers: everything that already passed (or failed) review.
async function getHistorial(req, res) {
  try {
    const acciones = ["aprobar_jefe", "aprobar_final", "aprobar_dueno", "aprobar_gerencia"];
    if (!acciones.some(a => _puede(req.usuario, a))) {
      return res.status(403).json({ error: "No tienes permisos de aprobación" });
    }

    const { data, error } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, fecha_solicitud, estado,
        valor_total, categoria, urgencia, justificacion, motivo_rechazo,
        fecha_aprobado_jefe, fecha_aprobado_final, fecha_aprobado_dueno, fecha_aprobado_gerencia, fecha_desembolso,
        solicitante:id_solicitante (nombres, apellidos, email),
        aprobador_jefe:aprobado_jefe_por (nombres, apellidos),
        aprobador_final:aprobado_final_por (nombres, apellidos),
        aprobador_dueno:aprobado_dueno_por (nombres, apellidos),
        aprobador_gerencia:aprobado_gerencia_por (nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .in("estado", ["aprobado_jefe", "pendiente_tesoreria", "desembolsado", "recibido_parcial", "en_inventario", "entregado", "rechazado"])
      .order("id_requerimiento", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const umbral = await _umbralCompraGrande();
    const nombre = u => u ? `${u.nombres || ""} ${u.apellidos || ""}`.trim() : null;

    return res.json((data || []).map(r => ({
      ...r,
      solicitante:        `${r.solicitante?.nombres || ""} ${r.solicitante?.apellidos || ""}`.trim() || r.solicitante?.email || "—",
      aprobador_jefe:     nombre(r.aprobador_jefe),
      aprobador_final:    nombre(r.aprobador_final),
      aprobador_dueno:    nombre(r.aprobador_dueno),
      aprobador_gerencia: nombre(r.aprobador_gerencia),
      proyecto: r.proyecto?.nombre || null,
      sigla:    r.proyecto?.sigla || null,
      es_compra_grande: _esCompraGrande(r.valor_total, umbral),
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function _getRequerimiento(id) {
  const { data } = await supabase.schema(SCHEMA)
    .from("requerimiento")
    .select(`
      id_requerimiento, numero, descripcion, estado, valor_total, urgencia, categoria, id_solicitante,
      aprobado_dueno_por, fecha_aprobado_dueno,
      aprobado_gerencia_por, fecha_aprobado_gerencia
    `)
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

    _emitLive(req.usuario, { id_requerimiento: id, numero: r.numero, estado: "aprobado_jefe" });

    // POL-02: escalate the notification based on purchase size. Small purchases
    // only need the dueño's single signature; large ones need dueño + gerencia
    // to co-sign, so both roles get pinged with the correct instruction.
    const umbral = await _umbralCompraGrande();
    const grande = _esCompraGrande(r.valor_total, umbral);

    if (grande) {
      notif.crear({
        paraRoles:  ["dueno"],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} — compra grande, requiere tu firma como dueño`,
        mensaje:    `${r.descripcion} · Se necesita tu firma y la co-firma de gerencia.`,
        vista:      "aprobaciones",
        referencia: r.numero,
      }).catch(() => {});
      notif.crear({
        paraRoles:  ["gerencia"],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} — compra grande, requiere tu co-firma como gerencia`,
        mensaje:    `${r.descripcion} · Se necesita la firma del dueño y tu co-firma.`,
        vista:      "aprobaciones",
        referencia: r.numero,
      }).catch(() => {});
    } else {
      notif.crear({
        paraRoles:  ["dueno", "gerencia"],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} listo para tu aprobación final`,
        mensaje:    r.descripcion,
        vista:      "aprobaciones",
        referencia: r.numero,
      }).catch(() => {});
    }

    notif.crear({
      paraIds:    [r.id_solicitante],
      excepto:    req.usuario.id_usuario,
      titulo:     `${r.numero} aprobado por el jefe de área`,
      mensaje:    grande
        ? "Sigue la aprobación del dueño y la co-firma de gerencia (compra grande)."
        : "Sigue la aprobación final del dueño.",
      vista:      "requerimientos",
      referencia: r.numero,
    }).catch(() => {});

    _emailsBackground("aprobacion_jefe", async () => {
      if (grande) {
        const [duenos, gerentes] = await Promise.all([
          _emailsDeRol("dueno"),
          _emailsDeRol("gerencia"),
        ]);
        await Promise.all([
          _notificar(duenos, {
            asunto:  `Requerimiento ${r.numero} listo para tu firma como dueño — El Cóndor`,
            titulo:  "Aprobación de dueño pendiente (compra grande)",
            mensaje: `El jefe de área aprobó el requerimiento <strong>${r.numero}</strong> (${r.descripcion}). Como es una compra grande (≥ ${umbral.toLocaleString("es-CO")} COP), se requiere tu firma como dueño y la co-firma de gerencia para autorizar el desembolso.`,
            numero:  r.numero,
            valor_total: r.valor_total,
          }),
          _notificar(gerentes, {
            asunto:  `Requerimiento ${r.numero} listo para tu co-firma como gerencia — El Cóndor`,
            titulo:  "Co-firma de gerencia pendiente (compra grande)",
            mensaje: `El jefe de área aprobó el requerimiento <strong>${r.numero}</strong> (${r.descripcion}). Como es una compra grande (≥ ${umbral.toLocaleString("es-CO")} COP), se requiere tu co-firma como gerencia y la firma del dueño para autorizar el desembolso.`,
            numero:  r.numero,
            valor_total: r.valor_total,
          }),
        ]);
      } else {
        const finales = [...await _emailsDeRol("dueno"), ...await _emailsDeRol("gerencia")];
        await _notificar([...new Set(finales)], {
          asunto:  `Requerimiento ${r.numero} listo para tu aprobación final — El Cóndor`,
          titulo:  "Aprobación final pendiente",
          mensaje: `El jefe de área aprobó el requerimiento <strong>${r.numero}</strong> (${r.descripcion}). Falta la aprobación final para autorizar el desembolso.`,
          numero:  r.numero,
          valor_total: r.valor_total,
        });
      }
    });

    return res.json({ ok: true, numero: r.numero, estado: "aprobado_jefe", es_compra_grande: grande });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/requerimientos/:id/aprobar-dueno  (POL-02, compras grandes)
// Firma del dueño en una compra grande. Cuando la co-firma de gerencia también
// está puesta, la transición a `pendiente_tesoreria` se ejecuta en la misma
// operación (guardada por `.is('aprobado_dueno_por', null)` para evitar dobles firmas).
async function aprobarDueno(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const r = await _getRequerimiento(id);
    if (!r) return res.status(404).json({ error: "Requerimiento no encontrado" });
    if (r.estado !== "aprobado_jefe") {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}'; la firma del dueño requiere que el jefe lo haya aprobado primero.` });
    }

    const umbral = await _umbralCompraGrande();
    if (!_esCompraGrande(r.valor_total, umbral)) {
      return res.status(409).json({
        error: `Esta no es una compra grande (< ${umbral.toLocaleString("es-CO")} COP). Fírmala con /aprobar-final.`,
        code:  "NO_ES_COMPRA_GRANDE",
      });
    }
    if (r.aprobado_dueno_por) {
      return res.status(409).json({ error: "Esta compra ya fue firmada por el dueño." });
    }
    if (r.aprobado_gerencia_por === req.usuario.id_usuario) {
      return res.status(409).json({ error: "No puedes firmar como dueño si ya co-firmaste como gerencia. Se requieren dos personas distintas." });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const gerenciaFirmo = r.aprobado_gerencia_por != null;

    const updates = {
      aprobado_dueno_por:   req.usuario.id_usuario,
      fecha_aprobado_dueno: hoy,
    };
    if (gerenciaFirmo) {
      updates.estado                = "pendiente_tesoreria";
      updates.aprobado_final_por    = req.usuario.id_usuario;
      updates.fecha_aprobado_final  = hoy;
    }

    const { data: updated, error: eUpd } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update(updates)
      .eq("id_requerimiento", id)
      .eq("estado", "aprobado_jefe")
      .is("aprobado_dueno_por", null)
      .select("id_requerimiento");

    if (eUpd || !updated?.length) {
      return res.status(400).json({ error: eUpd?.message || "No se pudo firmar (el estado cambió)." });
    }

    await auditoria.log({
      tabla: "requerimiento", id, campo: gerenciaFirmo ? "estado" : "aprobado_dueno_por",
      anterior: gerenciaFirmo ? "aprobado_jefe" : null,
      nuevo:    gerenciaFirmo ? "pendiente_tesoreria" : String(req.usuario.id_usuario),
      usuario:  req.usuario.email,
      motivo:   gerenciaFirmo ? "aprobacion_dual_completa (dueno cerro)" : "firma_dueno (compra grande)",
    });

    const estadoNuevo = gerenciaFirmo ? "pendiente_tesoreria" : "aprobado_jefe";
    _emitLive(req.usuario, { id_requerimiento: id, numero: r.numero, estado: estadoNuevo, firma: "dueno" });

    if (gerenciaFirmo) {
      // Transición completa: notificar tesorería y al solicitante.
      notif.crear({
        paraRoles:  ["tesorero"],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} aprobado (doble firma) — gestionar desembolso`,
        mensaje:    r.descripcion,
        vista:      "desembolsos",
        referencia: r.numero,
      }).catch(() => {});
      notif.crear({
        paraIds:    [r.id_solicitante],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} recibió la doble firma`,
        mensaje:    "Dueño y gerencia firmaron. Pasó a tesorería para el desembolso.",
        vista:      "requerimientos",
        referencia: r.numero,
      }).catch(() => {});
      _emailsBackground("doble_firma_completa_dueno", async () => {
        const [tesoreros, solicitante] = await Promise.all([
          _emailsDeRol("tesorero"),
          _emailDeUsuario(r.id_solicitante),
        ]);
        await Promise.all([
          _notificar(tesoreros, {
            asunto:  `Requerimiento ${r.numero} aprobado (doble firma) — gestionar desembolso — El Cóndor`,
            titulo:  "Nuevo requerimiento en tesorería",
            mensaje: `El requerimiento <strong>${r.numero}</strong> (${r.descripcion}) recibió la doble firma dueño + gerencia y pasa a tesorería.`,
            numero:  r.numero,
            valor_total: r.valor_total,
          }),
          _notificar([solicitante], {
            asunto:  `Tu requerimiento ${r.numero} fue aprobado (doble firma) — El Cóndor`,
            titulo:  "¡Requerimiento aprobado!",
            mensaje: `Tu requerimiento <strong>${r.numero}</strong> (${r.descripcion}) recibió la firma del dueño y la co-firma de gerencia. Pasó a tesorería para el desembolso.`,
            numero:  r.numero,
            valor_total: r.valor_total,
          }),
        ]);
      });
    } else {
      // Solo falta gerencia — pingar únicamente a ese rol.
      notif.crear({
        paraRoles:  ["gerencia"],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} — falta tu co-firma como gerencia`,
        mensaje:    `El dueño ya firmó. Solo falta tu co-firma para autorizar el desembolso.`,
        vista:      "aprobaciones",
        referencia: r.numero,
      }).catch(() => {});
      _emailsBackground("cofirma_gerencia_pendiente", async () => {
        const gerentes = await _emailsDeRol("gerencia");
        await _notificar(gerentes, {
          asunto:  `Requerimiento ${r.numero} — falta tu co-firma como gerencia — El Cóndor`,
          titulo:  "Co-firma de gerencia pendiente",
          mensaje: `El dueño firmó el requerimiento <strong>${r.numero}</strong> (${r.descripcion}). Solo falta tu co-firma como gerencia para autorizar el desembolso.`,
          numero:  r.numero,
          valor_total: r.valor_total,
        });
      });
    }

    return res.json({
      ok: true, numero: r.numero, estado: estadoNuevo, firma: "dueno",
      requiere_cofirma: !gerenciaFirmo,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/requerimientos/:id/aprobar-gerencia  (POL-02, co-firma en compras grandes)
async function aprobarGerencia(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const r = await _getRequerimiento(id);
    if (!r) return res.status(404).json({ error: "Requerimiento no encontrado" });
    if (r.estado !== "aprobado_jefe") {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}'; la co-firma de gerencia requiere que el jefe lo haya aprobado primero.` });
    }

    const umbral = await _umbralCompraGrande();
    if (!_esCompraGrande(r.valor_total, umbral)) {
      return res.status(409).json({
        error: `Esta no es una compra grande (< ${umbral.toLocaleString("es-CO")} COP). No requiere co-firma de gerencia.`,
        code:  "NO_ES_COMPRA_GRANDE",
      });
    }
    if (r.aprobado_gerencia_por) {
      return res.status(409).json({ error: "Esta compra ya fue co-firmada por gerencia." });
    }
    if (r.aprobado_dueno_por === req.usuario.id_usuario) {
      return res.status(409).json({ error: "No puedes co-firmar como gerencia si ya firmaste como dueño. Se requieren dos personas distintas." });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const duenoFirmo = r.aprobado_dueno_por != null;

    const updates = {
      aprobado_gerencia_por:   req.usuario.id_usuario,
      fecha_aprobado_gerencia: hoy,
    };
    if (duenoFirmo) {
      updates.estado               = "pendiente_tesoreria";
      updates.aprobado_final_por   = req.usuario.id_usuario;
      updates.fecha_aprobado_final = hoy;
    }

    const { data: updated, error: eUpd } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update(updates)
      .eq("id_requerimiento", id)
      .eq("estado", "aprobado_jefe")
      .is("aprobado_gerencia_por", null)
      .select("id_requerimiento");

    if (eUpd || !updated?.length) {
      return res.status(400).json({ error: eUpd?.message || "No se pudo co-firmar (el estado cambió)." });
    }

    await auditoria.log({
      tabla: "requerimiento", id, campo: duenoFirmo ? "estado" : "aprobado_gerencia_por",
      anterior: duenoFirmo ? "aprobado_jefe" : null,
      nuevo:    duenoFirmo ? "pendiente_tesoreria" : String(req.usuario.id_usuario),
      usuario:  req.usuario.email,
      motivo:   duenoFirmo ? "aprobacion_dual_completa (gerencia cerro)" : "cofirma_gerencia (compra grande)",
    });

    const estadoNuevo = duenoFirmo ? "pendiente_tesoreria" : "aprobado_jefe";
    _emitLive(req.usuario, { id_requerimiento: id, numero: r.numero, estado: estadoNuevo, firma: "gerencia" });

    if (duenoFirmo) {
      notif.crear({
        paraRoles:  ["tesorero"],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} aprobado (doble firma) — gestionar desembolso`,
        mensaje:    r.descripcion,
        vista:      "desembolsos",
        referencia: r.numero,
      }).catch(() => {});
      notif.crear({
        paraIds:    [r.id_solicitante],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} recibió la doble firma`,
        mensaje:    "Dueño y gerencia firmaron. Pasó a tesorería para el desembolso.",
        vista:      "requerimientos",
        referencia: r.numero,
      }).catch(() => {});
      _emailsBackground("doble_firma_completa_gerencia", async () => {
        const [tesoreros, solicitante] = await Promise.all([
          _emailsDeRol("tesorero"),
          _emailDeUsuario(r.id_solicitante),
        ]);
        await Promise.all([
          _notificar(tesoreros, {
            asunto:  `Requerimiento ${r.numero} aprobado (doble firma) — gestionar desembolso — El Cóndor`,
            titulo:  "Nuevo requerimiento en tesorería",
            mensaje: `El requerimiento <strong>${r.numero}</strong> (${r.descripcion}) recibió la doble firma dueño + gerencia y pasa a tesorería.`,
            numero:  r.numero,
            valor_total: r.valor_total,
          }),
          _notificar([solicitante], {
            asunto:  `Tu requerimiento ${r.numero} fue aprobado (doble firma) — El Cóndor`,
            titulo:  "¡Requerimiento aprobado!",
            mensaje: `Tu requerimiento <strong>${r.numero}</strong> (${r.descripcion}) recibió la firma del dueño y la co-firma de gerencia. Pasó a tesorería para el desembolso.`,
            numero:  r.numero,
            valor_total: r.valor_total,
          }),
        ]);
      });
    } else {
      notif.crear({
        paraRoles:  ["dueno"],
        excepto:    req.usuario.id_usuario,
        titulo:     `${r.numero} — falta tu firma como dueño`,
        mensaje:    `Gerencia ya co-firmó. Solo falta tu firma para autorizar el desembolso.`,
        vista:      "aprobaciones",
        referencia: r.numero,
      }).catch(() => {});
      _emailsBackground("firma_dueno_pendiente", async () => {
        const duenos = await _emailsDeRol("dueno");
        await _notificar(duenos, {
          asunto:  `Requerimiento ${r.numero} — falta tu firma como dueño — El Cóndor`,
          titulo:  "Firma de dueño pendiente",
          mensaje: `Gerencia co-firmó el requerimiento <strong>${r.numero}</strong> (${r.descripcion}). Solo falta tu firma como dueño para autorizar el desembolso.`,
          numero:  r.numero,
          valor_total: r.valor_total,
        });
      });
    }

    return res.json({
      ok: true, numero: r.numero, estado: estadoNuevo, firma: "gerencia",
      requiere_cofirma: !duenoFirmo,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/requerimientos/:id/aprobar-final  (REQ-03: aprobado_jefe → pendiente_tesoreria)
// Small purchases only. Large purchases (valor_total ≥ umbral) require the dual-sign
// endpoints /aprobar-dueno + /aprobar-gerencia (POL-02).
async function aprobarFinal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const r = await _getRequerimiento(id);
    if (!r) return res.status(404).json({ error: "Requerimiento no encontrado" });
    if (r.estado !== "aprobado_jefe") {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}'; la aprobación final requiere que el jefe lo haya aprobado primero` });
    }

    const umbral = await _umbralCompraGrande();
    if (_esCompraGrande(r.valor_total, umbral)) {
      return res.status(409).json({
        error:  `Esta es una compra grande (≥ ${umbral.toLocaleString("es-CO")} COP). Requiere firma del dueño y co-firma de gerencia por separado.`,
        code:   "COMPRA_GRANDE_REQUIERE_DUAL_SIGN",
        umbral,
      });
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

    _emitLive(req.usuario, { id_requerimiento: id, numero: r.numero, estado: "pendiente_tesoreria" });

    notif.crear({
      paraRoles:  ["tesorero"],
      excepto:    req.usuario.id_usuario,
      titulo:     `${r.numero} aprobado — gestionar desembolso`,
      mensaje:    r.descripcion,
      vista:      "desembolsos",
      referencia: r.numero,
    }).catch(() => {});
    notif.crear({
      paraIds:    [r.id_solicitante],
      excepto:    req.usuario.id_usuario,
      titulo:     `${r.numero} recibió la aprobación final`,
      mensaje:    "Pasó a tesorería para el desembolso",
      vista:      "requerimientos",
      referencia: r.numero,
    }).catch(() => {});

    // REQ-03: tesorería takes over and the tesorero gets notified; the requester too.
    _emailsBackground("aprobacion_final", async () => {
      const [tesoreros, solicitante] = await Promise.all([
        _emailsDeRol("tesorero"),
        _emailDeUsuario(r.id_solicitante),
      ]);
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
    });

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

    // El caller puede rechazar si tiene CUALQUIERA de los permisos válidos para el estado.
    // Compras grandes en aprobado_jefe pueden ser rechazadas por dueño o gerencia (ambos son
    // firmantes válidos); compras chicas siguen usando aprobar_final.
    let permisosValidos;
    if (r.estado === "pendiente_jefe") {
      permisosValidos = ["aprobar_jefe"];
    } else if (r.estado === "aprobado_jefe") {
      const umbral = await _umbralCompraGrande();
      permisosValidos = _esCompraGrande(r.valor_total, umbral)
        ? ["aprobar_dueno", "aprobar_gerencia"]
        : ["aprobar_final"];
    } else {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}' y no admite rechazo` });
    }

    const puedeRechazar = permisosValidos.some(p => _puede(req.usuario, p));
    if (!puedeRechazar) {
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

    _emitLive(req.usuario, { id_requerimiento: id, numero: r.numero, estado: "rechazado" });

    notif.crear({
      paraIds:    [r.id_solicitante],
      excepto:    req.usuario.id_usuario,
      titulo:     `${r.numero} fue rechazado`,
      mensaje:    motivo,
      vista:      "requerimientos",
      referencia: r.numero,
    }).catch(() => {});

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
        fecha_entrega, entrega_receptor,
        solicitante:id_solicitante (nombres, apellidos, email),
        aprobador_jefe:aprobado_jefe_por (nombres, apellidos),
        aprobador_final:aprobado_final_por (nombres, apellidos),
        desembolsador:desembolsado_por (nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .in("estado", ["pendiente_tesoreria", "desembolsado", "recibido_parcial", "en_inventario", "entregado"])
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

    _emitLive(req.usuario, { id_requerimiento: id, numero: r.numero, estado: "desembolsado" });

    notif.crear({
      paraRoles:  ["almacenista"],
      excepto:    req.usuario.id_usuario,
      titulo:     `${r.numero} desembolsado — preparar recepción`,
      mensaje:    r.descripcion,
      vista:      "recepciones",
      referencia: r.numero,
    }).catch(() => {});
    notif.crear({
      paraIds:    [r.id_solicitante],
      excepto:    req.usuario.id_usuario,
      titulo:     `${r.numero} fue desembolsado`,
      mensaje:    "El material queda en proceso de compra y entrega",
      vista:      "requerimientos",
      referencia: r.numero,
    }).catch(() => {});

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

// ── Entrega al peticionario (INV-02) ─────────────────────────────────────────

// GET /api/v1/requerimientos/autorizacion?numero=REQ-...
// Pre-loaded delivery authorization for the almacenista: the en_inventario
// requerimiento with requester and RECEIVED quantities per item.
async function getAutorizacion(req, res) {
  try {
    const numero = String(req.query.numero || "").trim();
    if (!numero) return res.status(400).json({ error: "Indica el número del requerimiento" });

    const { data: r, error } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, estado, valor_total, categoria, urgencia,
        fecha_solicitud, fecha_desembolso, id_proyecto,
        solicitante:id_solicitante (nombres, apellidos, email, telefono, documento),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (
          id_item, descripcion, unidad, cantidad_solicitada,
          recibido:recepcion_item ( cantidad )
        )
      `)
      .ilike("numero", numero)
      .single();

    if (error || !r) return res.status(404).json({ error: `No se encontró el requerimiento '${numero}'` });

    if (r.estado === "entregado") {
      return res.status(409).json({ error: `${r.numero} ya fue entregado` });
    }
    if (r.estado !== "en_inventario") {
      return res.status(409).json({
        error: `${r.numero} está en estado '${r.estado}': aún no tiene el material completo en inventario`,
      });
    }

    return res.json({
      id_requerimiento: r.id_requerimiento,
      numero:      r.numero,
      descripcion: r.descripcion,
      estado:      r.estado,
      categoria:   r.categoria,
      urgencia:    r.urgencia,
      fecha_solicitud:  r.fecha_solicitud,
      fecha_desembolso: r.fecha_desembolso,
      solicitante: `${r.solicitante?.nombres || ""} ${r.solicitante?.apellidos || ""}`.trim() || r.solicitante?.email || "—",
      solicitante_documento: r.solicitante?.documento || null,
      solicitante_telefono:  r.solicitante?.telefono || null,
      proyecto: r.proyecto?.nombre || null,
      sigla:    r.proyecto?.sigla || null,
      items: (r.items || []).map(it => ({
        id_item:     it.id_item,
        descripcion: it.descripcion,
        unidad:      it.unidad,
        cantidad_recibida: (it.recibido || []).reduce((s, rc) => s + Number(rc.cantidad), 0),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/requerimientos/:id/entregar
// Body: { receptor? }. Hands the material over: stock salidas + estado 'entregado'.
async function entregar(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const { data: r } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, estado, categoria, id_proyecto, id_solicitante,
        items:requerimiento_item (
          id_item, descripcion, unidad,
          recibido:recepcion_item ( cantidad )
        )
      `)
      .eq("id_requerimiento", id)
      .single();

    if (!r) return res.status(404).json({ error: "Requerimiento no encontrado" });
    if (r.estado !== "en_inventario") {
      return res.status(409).json({ error: `El requerimiento está en estado '${r.estado}'; solo se entrega lo que está en inventario` });
    }

    const receptor = String(req.body?.receptor || "").trim() || null;
    const hoy      = new Date().toISOString().slice(0, 10);

    const { data: updated, error: eUpd } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .update({
        estado:           "entregado",
        fecha_entrega:    hoy,
        entregado_por:    req.usuario.id_usuario,
        entrega_receptor: receptor,
      })
      .eq("id_requerimiento", id)
      .eq("estado", "en_inventario")
      .select("id_requerimiento");

    if (eUpd || !updated?.length) {
      return res.status(400).json({ error: eUpd?.message || "No se pudo registrar la entrega (el estado cambió)" });
    }

    // Stock salidas for the received quantities (best-effort ledger).
    inventario.registrarSalidas({
      requerimiento: r,
      id_usuario:    req.usuario.id_usuario,
      items: (r.items || []).map(it => ({
        descripcion: it.descripcion,
        unidad:      it.unidad,
        cantidad:    (it.recibido || []).reduce((s, rc) => s + Number(rc.cantidad), 0),
      })),
    }).catch(() => {});

    await auditoria.log({
      tabla: "requerimiento", id, campo: "estado",
      anterior: "en_inventario", nuevo: "entregado",
      usuario: req.usuario.email,
      motivo: receptor ? `entrega a ${receptor}` : "entrega al solicitante",
    });

    _emitLive(req.usuario, { id_requerimiento: id, numero: r.numero, estado: "entregado" });

    notif.crear({
      paraIds:    [r.id_solicitante],
      excepto:    req.usuario.id_usuario,
      titulo:     `${r.numero} entregado`,
      mensaje:    receptor ? `Material entregado a ${receptor}` : "Tu material fue entregado en bodega",
      vista:      "requerimientos",
      referencia: r.numero,
    }).catch(() => {});

    try {
      const solicitante = await _emailDeUsuario(r.id_solicitante);
      await _notificar([solicitante], {
        asunto:  `Tu requerimiento ${r.numero} fue entregado — El Cóndor`,
        titulo:  "¡Material entregado!",
        mensaje: `El almacenista entregó el material de tu requerimiento <strong>${r.numero}</strong> (${r.descripcion})${receptor ? ` a <strong>${receptor}</strong>` : ""}. Con esto el proceso queda completo.`,
        numero:  r.numero,
      });
    } catch (e) { console.error("[requerimientos] Notificación de entrega falló:", e.message); }

    return res.json({ ok: true, numero: r.numero, estado: "entregado" });
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
        fecha_aprobado_jefe, fecha_aprobado_final, fecha_aprobado_dueno, fecha_aprobado_gerencia, motivo_rechazo,
        fecha_entrega, entrega_receptor,
        aprobador_jefe:aprobado_jefe_por (nombres, apellidos),
        aprobador_final:aprobado_final_por (nombres, apellidos),
        aprobador_dueno:aprobado_dueno_por (nombres, apellidos),
        aprobador_gerencia:aprobado_gerencia_por (nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario)
      `)
      .eq("id_solicitante", req.usuario.id_usuario)
      .order("id_requerimiento", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const umbral = await _umbralCompraGrande();
    const nombre = u => u ? `${u.nombres || ""} ${u.apellidos || ""}`.trim() : null;

    return res.json((data || []).map(r => ({
      ...r,
      aprobador_jefe:     nombre(r.aprobador_jefe),
      aprobador_final:    nombre(r.aprobador_final),
      aprobador_dueno:    nombre(r.aprobador_dueno),
      aprobador_gerencia: nombre(r.aprobador_gerencia),
      proyecto: r.proyecto?.nombre || null,
      sigla:    r.proyecto?.sigla || null,
      es_compra_grande: _esCompraGrande(r.valor_total, umbral),
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Trazabilidad completa (INV-04) ──────────────────────────────────────────

function _nombreDe(u) {
  return u ? `${u.nombres || ""} ${u.apellidos || ""}`.trim() || null : null;
}

function _buildTrazabilidad(r, bitacora, esGrande, umbral) {
  const fmtItems = its => (its || [])
    .map(d => `${d.item?.descripcion || "ítem"} × ${Number(d.cantidad)}${d.item?.unidad ? " " + d.item.unidad : ""}`)
    .join(", ");

  const rechazo     = (bitacora || []).find(b => b.valor_nuevo === "rechazado")  || null;
  const cancelacion = (bitacora || []).find(b => b.valor_nuevo === "cancelado") || null;

  const pasos = [];

  pasos.push({
    paso:        "solicitud",
    label:       "Requerimiento creado",
    estado:      "hecho",
    fecha:       r.fecha_solicitud,
    responsable: _nombreDe(r.solicitante) || r.solicitante?.email || null,
    documento:   { tipo: "requerimiento", label: r.numero, url: null },
    detalle:     `${(r.items || []).length} ítem(s) · ${r.categoria} · urgencia ${r.urgencia}`,
  });

  if (r.estado === "cancelado") {
    pasos.push({
      paso:        "cancelacion",
      label:       "Cancelado por el solicitante",
      estado:      "fallido",
      fecha:       cancelacion?.fecha_cambio || null,
      responsable: cancelacion?.usuario_db || null,
      documento:   null,
      detalle:     cancelacion?.motivo || null,
    });
    return pasos;
  }

  if (r.estado === "rechazado" && !r.fecha_aprobado_jefe) {
    pasos.push({
      paso:        "aprobacion_jefe",
      label:       "Rechazado por el jefe de área",
      estado:      "fallido",
      fecha:       rechazo?.fecha_cambio || null,
      responsable: rechazo?.usuario_db || null,
      documento:   null,
      detalle:     r.motivo_rechazo || rechazo?.motivo || null,
    });
    return pasos;
  }
  pasos.push({
    paso:        "aprobacion_jefe",
    label:       "Aprobación del jefe de área",
    estado:      r.fecha_aprobado_jefe ? "hecho" : "pendiente",
    fecha:       r.fecha_aprobado_jefe || null,
    responsable: _nombreDe(r.aprobador_jefe),
    documento:   null,
    detalle:     null,
  });

  if (r.estado === "rechazado") {
    pasos.push({
      paso:        "aprobacion_final",
      label:       esGrande ? "Rechazado en la doble firma" : "Rechazado en la aprobación final",
      estado:      "fallido",
      fecha:       rechazo?.fecha_cambio || null,
      responsable: rechazo?.usuario_db || null,
      documento:   null,
      detalle:     r.motivo_rechazo || rechazo?.motivo || null,
    });
    return pasos;
  }

  if (esGrande) {
    pasos.push({
      paso:        "firma_dueno",
      label:       `Firma del dueño (compra grande ≥ $${Number(umbral).toLocaleString("es-CO")})`,
      estado:      r.fecha_aprobado_dueno ? "hecho" : "pendiente",
      fecha:       r.fecha_aprobado_dueno || null,
      responsable: _nombreDe(r.aprobador_dueno),
      documento:   null,
      detalle:     null,
    });
    pasos.push({
      paso:        "firma_gerencia",
      label:       "Co-firma de gerencia",
      estado:      r.fecha_aprobado_gerencia ? "hecho" : "pendiente",
      fecha:       r.fecha_aprobado_gerencia || null,
      responsable: _nombreDe(r.aprobador_gerencia),
      documento:   null,
      detalle:     null,
    });
  } else {
    pasos.push({
      paso:        "aprobacion_final",
      label:       "Aprobación final del dueño",
      estado:      r.fecha_aprobado_final ? "hecho" : "pendiente",
      fecha:       r.fecha_aprobado_final || null,
      responsable: _nombreDe(r.aprobador_final),
      documento:   null,
      detalle:     null,
    });
  }

  const desembolsado = !!r.fecha_desembolso;
  pasos.push({
    paso:        "desembolso",
    label:       "Desembolso de tesorería",
    estado:      desembolsado ? "hecho" : "pendiente",
    fecha:       r.fecha_desembolso || null,
    responsable: _nombreDe(r.desembolsador),
    documento:   r.comprobante_desembolso_url
                   ? { tipo: "comprobante", label: "Comprobante del pago", url: r.comprobante_desembolso_url }
                   : null,
    detalle:     desembolsado
                   ? `Pagado $${Number(r.valor_desembolsado || 0).toLocaleString("es-CO")}${r.id_gasto ? ` · gasto #${r.id_gasto}` : ""}`
                   : null,
  });

  const recepciones = (r.recepciones || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  recepciones.forEach((rc, i) => {
    pasos.push({
      paso:        "recepcion",
      label:       `Recepción ${i + 1} de ${recepciones.length}`,
      estado:      "hecho",
      fecha:       rc.fecha,
      responsable: _nombreDe(rc.almacenista),
      documento:   rc.comprobante_url
                     ? { tipo: "comprobante", label: "Comprobante de entrega", url: rc.comprobante_url }
                     : null,
      detalle:     [fmtItems(rc.detalle), rc.observaciones].filter(Boolean).join(" · ") || null,
    });
  });

  if (["desembolsado", "recibido_parcial"].includes(r.estado)) {
    pasos.push({
      paso:        "recepcion",
      label:       recepciones.length ? "Recepción del material restante" : "Recepción del material",
      estado:      "pendiente",
      fecha:       null,
      responsable: null,
      documento:   null,
      detalle:     null,
    });
  }

  const entregadoHecho = r.estado === "entregado";
  pasos.push({
    paso:        "entrega",
    label:       entregadoHecho ? "Entrega del material" : "Entrega al solicitante",
    estado:      entregadoHecho ? "hecho" : "pendiente",
    fecha:       r.fecha_entrega || null,
    responsable: _nombreDe(r.entregador),
    documento:   null,
    detalle:     entregadoHecho
                   ? (r.entrega_receptor ? `Recibido por ${r.entrega_receptor}` : "Entregado al solicitante")
                   : null,
  });

  return pasos;
}

// GET /api/v1/requerimientos/:id/trazabilidad
// Full chain of a material (INV-04): solicitud → aprobaciones (single or dual
// sign per POL-02) → desembolso → recepciones → entrega. Elevated roles and
// permissions see any requerimiento; plain requesters only their own.
async function getTrazabilidad(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de requerimiento inválido" });

    const { data: r, error } = await supabase.schema(SCHEMA)
      .from("requerimiento")
      .select(`
        id_requerimiento, numero, descripcion, estado, valor_total, categoria, urgencia,
        justificacion, motivo_rechazo, id_solicitante, id_gasto,
        fecha_solicitud, fecha_aprobado_jefe, fecha_aprobado_final,
        fecha_aprobado_dueno, fecha_aprobado_gerencia,
        fecha_desembolso, fecha_entrega, entrega_receptor,
        valor_desembolsado, comprobante_desembolso_url,
        solicitante:id_solicitante (nombres, apellidos, email),
        aprobador_jefe:aprobado_jefe_por (nombres, apellidos),
        aprobador_final:aprobado_final_por (nombres, apellidos),
        aprobador_dueno:aprobado_dueno_por (nombres, apellidos),
        aprobador_gerencia:aprobado_gerencia_por (nombres, apellidos),
        desembolsador:desembolsado_por (nombres, apellidos),
        entregador:entregado_por (nombres, apellidos),
        proyecto:id_proyecto (nombre, sigla),
        items:requerimiento_item (id_item, descripcion, unidad, cantidad_solicitada, precio_unitario),
        recepciones:recepcion (
          id_recepcion, fecha, observaciones, comprobante_url, created_at,
          almacenista:id_almacenista (nombres, apellidos),
          detalle:recepcion_item ( cantidad, item:id_item (descripcion, unidad) )
        )
      `)
      .eq("id_requerimiento", id)
      .single();

    if (error || !r) return res.status(404).json({ error: "Requerimiento no encontrado" });

    const elevado =
      ["admin", "auditoria", "gerencia", "dueno"].includes(req.usuario.rol) ||
      ["aprobar_jefe", "aprobar_final", "aprobar_dueno", "aprobar_gerencia", "desembolsar"]
        .some(a => req.usuario.permisos?.has(`requerimientos:${a}`)) ||
      req.usuario.permisos?.has("recepciones:leer");

    if (!elevado && r.id_solicitante !== req.usuario.id_usuario) {
      return res.status(403).json({ error: "Solo puedes consultar la trazabilidad de tus propios requerimientos" });
    }

    const { data: bitacora } = await supabase.schema(SCHEMA)
      .from("auditoria")
      .select("valor_nuevo, usuario_db, motivo, fecha_cambio")
      .eq("tabla_afectada", "requerimiento")
      .eq("id_registro", id)
      .eq("campo", "estado")
      .in("valor_nuevo", ["rechazado", "cancelado"])
      .order("fecha_cambio", { ascending: false });

    const umbral   = await _umbralCompraGrande();
    const esGrande = _esCompraGrande(r.valor_total, umbral);

    return res.json({
      id_requerimiento: r.id_requerimiento,
      numero:           r.numero,
      descripcion:      r.descripcion,
      estado:           r.estado,
      valor_total:      Number(r.valor_total || 0),
      categoria:        r.categoria,
      urgencia:         r.urgencia,
      proyecto:         r.proyecto?.nombre || null,
      sigla:            r.proyecto?.sigla || null,
      solicitante:      _nombreDe(r.solicitante) || r.solicitante?.email || "—",
      es_compra_grande: esGrande,
      timeline:         _buildTrazabilidad(r, bitacora, esGrande, umbral),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  create, getMios, cancelar,
  getAprobaciones, getHistorial, aprobarJefe, aprobarFinal, aprobarDueno, aprobarGerencia, rechazar,
  getDesembolsos, desembolsar,
  getAutorizacion, entregar, getTrazabilidad,
  stream, getContadores,
  CATEGORIAS, URGENCIAS,
};
