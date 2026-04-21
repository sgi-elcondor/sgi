const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/usuarios.controller');

// Solo admin puede acceder a estas rutas
// (verificarPermiso lo bloquea si no tiene 'usuarios:leer' etc.)
router.get('/',          ctrl.listarUsuarios);
router.get('/roles',     ctrl.listarRoles);
router.post('/',         ctrl.crearUsuario);
router.put('/:id',       ctrl.actualizarUsuario);
router.patch('/:id/desactivar', ctrl.desactivarUsuario);

module.exports = router;