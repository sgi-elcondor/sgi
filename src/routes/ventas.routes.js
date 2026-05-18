const router = require("express").Router();
const ctrl   = require("../controllers/ventas.controller");

router.get("/estado-financiero", ctrl.getEstadoFinanciero);
router.get("/reportes/financiero", ctrl.getEstadoFinanciero);

router.get("/mis-ventas", ctrl.getMisVentas);
router.get("/",    ctrl.getAll);
router.get("/:id", ctrl.getById);
router.post("/",   ctrl.create);
router.post("/solicitud", ctrl.createSolicitud);
router.patch("/:id/financiero", ctrl.updateFinanciero);

module.exports = router;