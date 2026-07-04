const router = require("express").Router();
const ctrl   = require("../controllers/requerimientos.controller");

router.get("/mis-requerimientos",  ctrl.getMios);
router.post("/",                   ctrl.create);
router.patch("/:id/cancelar",      ctrl.cancelar);

module.exports = router;
