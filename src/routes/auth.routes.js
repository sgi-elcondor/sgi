const express  = require('express');
const router   = express.Router();
const { registrarUsuario, miPerfil, completarPerfil, actualizarMiPerfil, actualizarAvatar, enviarEmailReset } = require('../controllers/auth.controller');
const { verificarToken }   = require('../middlewares/auth.middleware');
const { verificarPermiso } = require('../middlewares/permisos.middleware');

router.post('/reset-password-email', enviarEmailReset);

router.get('/perfil',            verificarToken, miPerfil);
router.put('/perfil',            verificarToken, actualizarMiPerfil);
router.put('/avatar',            verificarToken, actualizarAvatar);
router.post('/completar-perfil', verificarToken, completarPerfil);
router.post('/usuarios',         verificarToken, verificarPermiso, registrarUsuario);

module.exports = router;
