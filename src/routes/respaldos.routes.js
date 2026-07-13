const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/respaldos.controller");

router.get("/restauraciones/:id", ctrl.obtenerRestauracion);
router.get("/:id/descargar",      ctrl.descargar);
router.get("/",                   ctrl.listar);
router.post("/:id/restaurar",     ctrl.restaurar);

module.exports = router;
