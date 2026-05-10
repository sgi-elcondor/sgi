const router = require("express").Router();
const ctrl   = require("../controllers/comisionistas.controller");
router.get("/comisiones", ctrl.getComisiones);
router.get("/",     ctrl.getAll);
router.post("/",    ctrl.create);
router.put("/:id",  ctrl.update);
module.exports = router;
