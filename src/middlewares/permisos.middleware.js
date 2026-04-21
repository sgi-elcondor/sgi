const ROUTE_PERMISSIONS = require('../config/permissions');

// 2. Verifica si el usuario tiene el permiso requerido para la ruta
function verificarPermiso(req, res, next) {
  // Normaliza la ruta quitando IDs numéricos: /api/ventas/42 → /api/ventas
  const rutaBase = req.path.replace(/\/\d+/g, '').replace(/\/$/, '');
  const clave    = `${req.method} ${rutaBase}`;

  const requerido = ROUTE_PERMISSIONS[clave];

  // Si la ruta no está en el mapa, solo requiere estar autenticado
  if (!requerido) return next();

  const tiene = req.usuario?.permisos?.has(
    `${requerido.recurso}:${requerido.accion}`
  );

  if (!tiene) {
    return res.status(403).json({
      error: 'No tienes permiso para esta acción',
      requerido: `${requerido.recurso}:${requerido.accion}`,
    });
  }

  next();
}

module.exports = { verificarPermiso };