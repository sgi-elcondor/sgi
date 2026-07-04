const router = require("express").Router();
const ctrl   = require("../controllers/recepciones.controller");

router.get("/pendientes",        ctrl.getPendientes);
router.get("/historial",         ctrl.getHistorial);
router.get("/:idRequerimiento",  ctrl.getDetalle);
router.post("/",                 ctrl.create);

module.exports = router;
