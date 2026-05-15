const router = require("express").Router();
const ctrl   = require("../controllers/facturas.controller");
router.get("/mis-facturas",            ctrl.getMisFacturas);
router.get("/cuotas-sin-factura",      ctrl.getCuotasSinFactura);
router.post("/generar-pendientes",     ctrl.generarPendientes);
router.get("/",             ctrl.getAll);
router.post("/",            ctrl.create);
router.patch("/:id/anular", ctrl.anular);
module.exports = router;
