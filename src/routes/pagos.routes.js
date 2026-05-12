const router = require("express").Router();
const ctrl   = require("../controllers/pagos.controller");
router.get("/mis-pagos",  ctrl.getMisPagos);
router.post("/comprador", ctrl.createCompradorPago);
router.get("/",           ctrl.getAll);
router.post("/",          ctrl.create);
module.exports = router;
