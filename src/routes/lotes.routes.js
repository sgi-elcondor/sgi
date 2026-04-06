const router = require("express").Router();
const ctrl   = require("../controllers/lotes.controller");
router.get("/",            ctrl.getAll);
router.get("/disponibles", ctrl.getDisponibles);
router.get("/:id",         ctrl.getById);
router.post("/",           ctrl.create);
router.put("/:id",         ctrl.update);
module.exports = router;
