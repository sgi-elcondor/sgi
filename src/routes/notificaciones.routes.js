const router = require("express").Router();
const ctrl   = require("../controllers/notificaciones.controller");

router.get("/",             ctrl.getMias);
router.patch("/leidas",     ctrl.marcarLeidas);

module.exports = router;
