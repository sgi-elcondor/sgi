const router = require("express").Router();
const ctrl   = require("../controllers/gastos.controller");

router.get("/resumen", ctrl.getResumen);
router.get("/",        ctrl.getAll);
router.post("/",       ctrl.create);
router.put("/:id",     ctrl.update);

module.exports = router;
