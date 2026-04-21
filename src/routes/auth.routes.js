const express  = require('express');
const router   = express.Router();
const { registrarUsuario, miPerfil } = require('../controllers/auth.controller');
const { verificarToken }  = require('../middlewares/auth.middleware');
const { verificarPermiso } = require('../middlewares/permisos.middleware');

router.get('/perfil',   verificarToken, miPerfil);
router.post('/usuarios', verificarToken, verificarPermiso, registrarUsuario);

module.exports = router;