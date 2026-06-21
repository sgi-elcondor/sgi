const express  = require('express');
const router   = express.Router();
const { registrarUsuario, miPerfil, miRol, completarPerfil, actualizarMiPerfil, actualizarAvatar, enviarEmailReset, vincularCuenta } = require('../controllers/auth.controller');
const { verificarToken, verificarTokenFirebase } = require('../middlewares/auth.middleware');
const { verificarPermiso } = require('../middlewares/permisos.middleware');

router.post('/reset-password-email', enviarEmailReset);
router.post('/vincular',         verificarTokenFirebase, vincularCuenta);

router.get('/perfil',            verificarToken, miPerfil);
router.get('/mi-rol',            verificarToken, miRol);
router.put('/perfil',            verificarToken, actualizarMiPerfil);
router.put('/avatar',            verificarToken, actualizarAvatar);
router.post('/completar-perfil', verificarToken, completarPerfil);
router.post('/usuarios',         verificarToken, verificarPermiso, registrarUsuario);

module.exports = router;
