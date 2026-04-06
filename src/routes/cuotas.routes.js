const router = require("express").Router();
const ctrl   = require("../controllers/cuotas.controller");
router.get("/vencidas",          ctrl.getVencidas);
router.get("/venta/:idVenta",    ctrl.getByVenta);
router.post("/",                 ctrl.create);
router.patch("/:id/estado",      ctrl.updateEstado);
module.exports = router;
