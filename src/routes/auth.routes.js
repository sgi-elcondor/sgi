const express  = require('express');
const router   = express.Router();
const { registrarUsuario, miPerfil, miRol, completarPerfil, actualizarMiPerfil, actualizarAvatar, enviarEmailReset, vincularCuenta, loginStatus, loginFailed, loginSuccess } = require('../controllers/auth.controller');
const { verificarToken, verificarTokenFirebase } = require('../middlewares/auth.middleware');
const { verificarPermiso } = require('../middlewares/permisos.middleware');

router.post('/reset-password-email', enviarEmailReset);
router.post('/vincular',         verificarTokenFirebase, vincularCuenta);

router.post('/login-status',  loginStatus);
router.post('/login-failed',  loginFailed);
router.post('/login-success', loginSuccess);

router.get('/perfil',            verificarToken, miPerfil);
router.get('/mi-rol',            verificarToken, miRol);
router.put('/perfil',            verificarToken, actualizarMiPerfil);
router.put('/avatar',            verificarToken, actualizarAvatar);
router.post('/completar-perfil', verificarToken, completarPerfil);
router.post('/usuarios',         verificarToken, verificarPermiso, registrarUsuario);

module.exports = router;
