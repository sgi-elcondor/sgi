const router = require('express').Router();
const ctrl   = require('../controllers/roles.controller');

router.get('/',             ctrl.getAll);
router.get('/:id/permisos', ctrl.getPermisos);
router.put('/:id/permisos', ctrl.updatePermisos);
router.patch('/:id/manual', ctrl.updateManual);

module.exports = router;
