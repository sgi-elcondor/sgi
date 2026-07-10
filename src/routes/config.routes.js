const router = require("express").Router();
const ctrl   = require("../controllers/config.controller");

router.get("/",           ctrl.listar);
router.get("/:clave",     ctrl.get);
router.patch("/:clave",   ctrl.actualizar);

module.exports = router;
