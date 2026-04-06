const router = require("express").Router();
const ctrl   = require("../controllers/facturas.controller");
router.get("/",         ctrl.getAll);
router.post("/",        ctrl.create);
router.patch("/:id/anular", ctrl.anular);
module.exports = router;
