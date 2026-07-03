const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/public.controller');

router.get('/proyectos', ctrl.getProyectos);
router.get('/lotes',     ctrl.getLotesDisponibles);
router.get('/asesores',  ctrl.getAsesores);

module.exports = router;
