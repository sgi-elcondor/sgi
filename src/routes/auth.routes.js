const express  = require('express');
const router   = express.Router();
const { registrarUsuario, miPerfil, miRol, completarPerfil, actualizarMiPerfil, actualizarAvatar, enviarEmailReset, vincularCuenta, login } = require('../controllers/auth.controller');
const { verificarToken, verificarTokenFirebase } = require('../middlewares/auth.middleware');
const { verificarPermiso } = require('../middlewares/permisos.middleware');
const { rateLimit } = require('../middlewares/rate-limit.middleware');

router.post('/reset-password-email', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), enviarEmailReset);
router.post('/vincular',         verificarTokenFirebase, vincularCuenta);

// Server-side password login (authoritative lockout). Per-IP rate limited to slow brute force.
router.post('/login', rateLimit({ windowMs: 10 * 60 * 1000, max: 20 }), login);

router.get('/perfil',            verificarToken, miPerfil);
router.get('/mi-rol',            verificarToken, miRol);
router.put('/perfil',            verificarToken, actualizarMiPerfil);
router.put('/avatar',            verificarToken, actualizarAvatar);
router.post('/completar-perfil', verificarToken, completarPerfil);
router.post('/usuarios',         verificarToken, verificarPermiso, registrarUsuario);

module.exports = router;
