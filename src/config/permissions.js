// Mapa: método HTTP + ruta base → { recurso, accion }
// Modifica este archivo para cambiar qué permiso exige cada endpoint
const ROUTE_PERMISSIONS = { 
  'GET /api/usuarios':         { recurso: 'usuarios', accion: 'leer' },
  'POST /api/usuarios':        { recurso: 'usuarios', accion: 'crear' },
  'PUT /api/usuarios':         { recurso: 'usuarios', accion: 'actualizar' },
  'PATCH /api/usuarios':       { recurso: 'usuarios', accion: 'actualizar' },
  'GET /api/usuarios/roles':   { recurso: 'usuarios', accion: 'leer' },
  'PATCH /api/usuarios/desactivar': { recurso: 'usuarios', accion: 'actualizar' },

  'GET /api/proyectos':       { recurso: 'proyectos',     accion: 'leer' },
  'POST /api/proyectos':      { recurso: 'proyectos',     accion: 'crear' },
  'PUT /api/proyectos':       { recurso: 'proyectos',     accion: 'actualizar' },

  'GET /api/lotes':           { recurso: 'lotes',         accion: 'leer' },
  'POST /api/lotes':          { recurso: 'lotes',         accion: 'crear' },
  'PUT /api/lotes':           { recurso: 'lotes',         accion: 'actualizar' },

  'GET /api/ventas':          { recurso: 'ventas',        accion: 'leer' },
  'POST /api/ventas':         { recurso: 'ventas',        accion: 'crear' },
  'PUT /api/ventas':          { recurso: 'ventas',        accion: 'actualizar' },

  'GET /api/cuotas':          { recurso: 'cuotas',        accion: 'leer' },
  'POST /api/cuotas':         { recurso: 'cuotas',        accion: 'crear' },
  'PUT /api/cuotas':          { recurso: 'cuotas',        accion: 'actualizar' },

  'GET /api/pagos':           { recurso: 'pagos',         accion: 'leer' },
  'POST /api/pagos':          { recurso: 'pagos',         accion: 'crear' },

  'GET /api/facturas':        { recurso: 'facturas',      accion: 'leer' },
  'POST /api/facturas':       { recurso: 'facturas',      accion: 'crear' },
  'PUT /api/facturas':        { recurso: 'facturas',      accion: 'actualizar' },

  'GET /api/recibos':         { recurso: 'recibos',       accion: 'leer' },
  'POST /api/recibos':        { recurso: 'recibos',       accion: 'crear' },

  'GET /api/compradores':     { recurso: 'compradores',   accion: 'leer' },
  'POST /api/compradores':    { recurso: 'compradores',   accion: 'crear' },
  'PUT /api/compradores':     { recurso: 'compradores',   accion: 'actualizar' },

  'GET /api/comisionistas':   { recurso: 'comisionistas', accion: 'leer' },
  'POST /api/comisionistas':  { recurso: 'comisionistas', accion: 'crear' },

  'GET /api/reportes':        { recurso: 'reportes',      accion: 'leer' },
  'GET /api/reportes/dir':    { recurso: 'reportes_dir',  accion: 'leer' },
  'GET /api/reportes/jur':    { recurso: 'alertas_jur',   accion: 'leer' },

  'POST /api/ventas/solicitud': { recurso: 'ventas', accion: 'solicitar' },

  'GET /api/mi-cuenta':       { recurso: 'mi_cuenta',     accion: 'leer' },
};

module.exports = ROUTE_PERMISSIONS;