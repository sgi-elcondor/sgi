const router = require("express").Router();
const ctrl   = require("../controllers/recibos.controller");
router.get("/mis-recibos", ctrl.getMisRecibos);
router.get("/",            ctrl.getAll);
router.post("/",           ctrl.create);
module.exports = router;
