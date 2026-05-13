const router = require('express').Router();
const ctrl   = require('../controllers/juridico.controller');

router.get('/cartera',                   ctrl.getCarteraJuridica);
router.get('/:id_venta/observaciones',   ctrl.getObservaciones);
router.post('/observaciones',            ctrl.createObservacion);

module.exports = router;
