const supabase      = require("../config/supabase");
const respaldosSvc  = require("../services/respaldos.service");
const twoFactor     = require("../services/two-factor.service");
const configService = require("../services/config.service");
const auditoria      = require("../services/auditoria.service");
const notif           = require("../services/notificaciones.service");

// Tables that can be individually restored. Mirrors the tables backup.yml
// actually dumps — keep in sync if the schema grows.
const TABLAS_RESTAURABLES = new Set([
  "proyecto", "lote", "venta", "venta_comprador", "venta_comisionista",
  "cuota", "cuota_fraccion", "cuota_pago", "cuota_factura",
  "pago", "recibo", "recibo_pago", "factura", "bank_transaction",
  "pago_comision", "observacion_juridica", "gasto",
  "requerimiento", "requerimiento_item", "recepcion", "recepcion_item",
  "inventario_movimiento", "usuarios",
]);

// Same step-up shape as usuarios.controller.js verificarStepUp (SEG-07): the
// challenge must belong to the CALLER, never to the target of the action.
async function verificarStepUp(req, res) {
  const { step_up_challenge_id, step_up_codigo } = req.body;
  if (!step_up_challenge_id || !step_up_codigo) {
    res.status(400).json({ error: "Esta acción requiere confirmar tu identidad de nuevo.", code: "STEP_UP_REQUERIDO" });
    return false;
  }
  const resultado = await twoFactor.verificarCodigo(step_up_challenge_id, step_up_codigo);
  if (!resultado.ok || resultado.id_usuario !== req.usuario?.id_usuario) {
    res.status(401).json({ error: "El código de confirmación es incorrecto o venció.", code: resultado.error || "STEP_UP_INVALIDO" });
    return false;
  }
  return true;
}

// GET /api/v1/respaldos
async function listar(req, res) {
  try {
    const data = await respaldosSvc.listar();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v1/respaldos/restauraciones/:id
async function obtenerRestauracion(req, res) {
  try {
    const data = await respaldosSvc.obtenerRestauracion(req.params.id);
    if (!data) return res.status(404).json({ error: "Restauración no encontrada" });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v1/respaldos/:id/descargar
async function descargar(req, res) {
  try {
    const respaldo = await respaldosSvc.obtener(req.params.id);
    if (!respaldo) return res.status(404).json({ error: "Respaldo no encontrado" });

    const { data, error } = await supabase.storage
      .from("respaldos")
      .createSignedUrl(respaldo.ubicacion, 300);
    if (error) throw new Error(error.message);

    await auditoria.log({
      tabla:   "respaldo",
      id:      respaldo.id_respaldo,
      campo:   "descarga",
      usuario: req.usuario.email,
      motivo:  "descarga_manual",
    });

    return res.json({ url: data.signedUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/v1/respaldos/:id/restaurar  Body: { alcance, step_up_challenge_id, step_up_codigo }
async function restaurar(req, res) {
  try {
    const idRespaldo = Number(req.params.id);
    const { alcance } = req.body;

    if (!alcance || (alcance !== "ALL" && !TABLAS_RESTAURABLES.has(alcance))) {
      return res.status(422).json({ error: "Alcance de restauración inválido." });
    }

    if (!(await verificarStepUp(req, res))) return;

    const respaldo = await respaldosSvc.obtener(idRespaldo);
    if (!respaldo || respaldo.estado !== "completado") {
      return res.status(404).json({ error: "Ese respaldo no está disponible para restaurar." });
    }

    const restauracion = await respaldosSvc.crearSolicitudRestauracion({
      id_respaldo: idRespaldo,
      alcance,
      id_usuario:  req.usuario.id_usuario,
    });

    const esTotal = alcance === "ALL";
    if (esTotal) {
      await configService.set("modo_mantenimiento", true, req.usuario.id_usuario);
    }

    try {
      await respaldosSvc.dispararWorkflowRestore({
        id_restauracion: restauracion.id_restauracion,
        id_respaldo:     idRespaldo,
        alcance,
        ubicacion:       respaldo.ubicacion,
        ubicacion_r2:    respaldo.ubicacion_r2,
      });
    } catch (dispatchErr) {
      await respaldosSvc.marcarRestauracionFallida(restauracion.id_restauracion, dispatchErr.message);
      if (esTotal) await configService.set("modo_mantenimiento", false, req.usuario.id_usuario);
      return res.status(502).json({ error: "No se pudo iniciar la restauración: " + dispatchErr.message });
    }

    await auditoria.log({
      tabla:   "respaldo_restauracion",
      id:      restauracion.id_restauracion,
      campo:   "estado",
      nuevo:   "en_progreso",
      usuario: req.usuario.email,
      motivo:  `Restauración de respaldo #${idRespaldo} (alcance: ${alcance})`,
    });

    notif.crear({
      paraRoles:  ["admin"],
      excepto:    req.usuario.id_usuario,
      titulo:     `Restauración de respaldo en curso (${esTotal ? "total" : alcance})`,
      mensaje:    `${req.usuario.email} inició la restauración del respaldo #${idRespaldo}.`,
      vista:      "respaldos",
      referencia: String(restauracion.id_restauracion),
    }).catch(() => {});

    return res.status(202).json({ id_restauracion: restauracion.id_restauracion, estado: "en_progreso" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { listar, obtenerRestauracion, descargar, restaurar, TABLAS_RESTAURABLES };
