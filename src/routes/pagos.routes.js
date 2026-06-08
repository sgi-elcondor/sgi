const router = require("express").Router();
const ctrl   = require("../controllers/pagos.controller");

router.get("/mis-pagos",  ctrl.getMisPagos);
router.post("/comprador", ctrl.createCompradorPago);

router.get("/",           ctrl.getAll);
router.post("/",          ctrl.create);

router.get('/contrast',       ctrl.getContrast);
router.patch('/accept-batch', ctrl.acceptBatch);
router.patch('/reject-batch', ctrl.rejectBatch);

module.exports = router;

