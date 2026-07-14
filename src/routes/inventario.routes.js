const router = require("express").Router();
const ctrl   = require("../controllers/inventario.controller");

router.get("/stock",       ctrl.getStock);
router.get("/movimientos", ctrl.getMovimientos);

module.exports = router;
