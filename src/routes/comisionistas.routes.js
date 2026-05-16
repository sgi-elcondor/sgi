const router = require("express").Router();
const ctrl   = require("../controllers/comisionistas.controller");

router.get("/comisiones",                        ctrl.getComisiones);
router.get("/:id/comisiones",                   ctrl.getComisionesDetail);
router.post("/ventas/:ventaId/micropago",        ctrl.registrarMicropago);
router.patch("/ventas/:ventaId/pagada",          ctrl.togglePagada);
router.get("/",    ctrl.getAll);
router.post("/",   ctrl.create);
router.put("/:id", ctrl.update);

module.exports = router;
