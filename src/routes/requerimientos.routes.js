const router = require("express").Router();
const ctrl   = require("../controllers/requerimientos.controller");

router.get("/mis-requerimientos",  ctrl.getMios);
router.get("/aprobaciones",        ctrl.getAprobaciones);
router.post("/",                   ctrl.create);
router.patch("/:id/cancelar",      ctrl.cancelar);
router.patch("/:id/aprobar-jefe",  ctrl.aprobarJefe);
router.patch("/:id/aprobar-final", ctrl.aprobarFinal);
router.patch("/:id/rechazar",      ctrl.rechazar);

module.exports = router;
