const router = require("express").Router();
const ctrl   = require("../controllers/ventas.controller");
router.get("/reportes/financiero", ctrl.getEstadoFinanciero);
router.get("/",    ctrl.getAll);
router.get("/:id", ctrl.getById);
router.post("/",   ctrl.create);
router.post("/solicitud", ctrl.createSolicitud);
module.exports = router;
