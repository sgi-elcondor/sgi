const router = require("express").Router();
const ctrl   = require("../controllers/requerimientos.controller");

router.get("/mis-requerimientos",  ctrl.getMios);
router.get("/stream",              ctrl.stream);
router.get("/contadores",          ctrl.getContadores);
router.get("/aprobaciones",        ctrl.getAprobaciones);
router.get("/historial",           ctrl.getHistorial);
router.get("/desembolsos",         ctrl.getDesembolsos);
router.get("/autorizacion",        ctrl.getAutorizacion);
router.get("/:id/trazabilidad",    ctrl.getTrazabilidad);
router.post("/",                   ctrl.create);
router.patch("/:id/cancelar",      ctrl.cancelar);
router.patch("/:id/aprobar-jefe",     ctrl.aprobarJefe);
router.patch("/:id/aprobar-final",    ctrl.aprobarFinal);
router.patch("/:id/aprobar-dueno",    ctrl.aprobarDueno);
router.patch("/:id/aprobar-gerencia", ctrl.aprobarGerencia);
router.patch("/:id/rechazar",         ctrl.rechazar);
router.patch("/:id/desembolsar",      ctrl.desembolsar);
router.patch("/:id/entregar",         ctrl.entregar);

module.exports = router;
