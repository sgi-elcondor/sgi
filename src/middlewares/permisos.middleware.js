const ROUTE_PERMISSIONS = require('../config/permissions');

function verificarPermiso(req, res, next) {
  // Roles con acceso total — no necesitan permisos explícitos
  const ROLES_TOTALES = ['admin', 'auxiliar_contable'];
  if (ROLES_TOTALES.includes(req.usuario?.rol)) return next();

  // req.path dentro de middleware montado en /api viene sin ese prefijo (/ventas, no /api/ventas)
  // req.originalUrl siempre contiene la ruta completa con /api incluido
  const urlSinQuery = req.originalUrl.split('?')[0];
  const rutaBase    = urlSinQuery.replace(/\/\d+/g, '').replace(/\/$/, '');
  const clave       = `${req.method} ${rutaBase}`;

  const requerido = ROUTE_PERMISSIONS[clave];

  // Ruta no registrada en el mapa → solo requiere estar autenticado
  if (!requerido) return next();

  const tiene = req.usuario?.permisos?.has(
    `${requerido.recurso}:${requerido.accion}`
  );

  if (!tiene) {
    return res.status(403).json({
      error:     'No tienes permiso para esta acción',
      requerido: `${requerido.recurso}:${requerido.accion}`,
    });
  }

  next();
}

module.exports = { verificarPermiso };
