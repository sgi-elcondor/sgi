const router = require("express").Router();
const ctrl   = require("../controllers/comisionistas.controller");
router.get("/comisiones", ctrl.getComisiones);
router.get("/",  ctrl.getAll);
router.post("/", ctrl.create);
module.exports = router;
