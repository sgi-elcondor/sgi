const router = require("express").Router();
const ctrl   = require("../controllers/inventario.controller");

router.get("/stock", ctrl.getStock);

module.exports = router;
