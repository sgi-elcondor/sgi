// Mapa: mÃ©todo HTTP + ruta completa desde raÃ­z â†’ { recurso, accion }
// Usar req.originalUrl (no req.path) en el middleware para que coincidan con /api/...
const ROUTE_PERMISSIONS = {
  'GET /api/usuarios':              { recurso: 'usuarios',      accion: 'leer' },
  'POST /api/usuarios':             { recurso: 'usuarios',      accion: 'crear' },
  'PUT /api/usuarios':              { recurso: 'usuarios',      accion: 'actualizar' },
  'PATCH /api/usuarios':            { recurso: 'usuarios',      accion: 'actualizar' },
  'GET /api/usuarios/roles':        { recurso: 'usuarios',      accion: 'leer' },
  'PATCH /api/usuarios/desactivar': { recurso: 'usuarios',      accion: 'actualizar' },

  'GET /api/proyectos':             { recurso: 'proyectos',     accion: 'leer' },
  'POST /api/proyectos':            { recurso: 'proyectos',     accion: 'crear' },
  'PUT /api/proyectos':             { recurso: 'proyectos',     accion: 'actualizar' },

  'GET /api/lotes':                 { recurso: 'lotes',         accion: 'leer' },
  'POST /api/lotes':                { recurso: 'lotes',         accion: 'crear' },
  'PUT /api/lotes':                 { recurso: 'lotes',         accion: 'actualizar' },

  'GET /api/ventas':                { recurso: 'ventas',        accion: 'leer' },
  'POST /api/ventas':               { recurso: 'ventas',        accion: 'crear' },
  'PUT /api/ventas':                { recurso: 'ventas',        accion: 'actualizar' },
  'POST /api/ventas/solicitud':     { recurso: 'ventas',        accion: 'solicitar' },
  'PATCH /api/ventas/financiero':   { recurso: 'ventas',        accion: 'editar_financiero' },

  'GET /api/cuotas':                { recurso: 'cuotas',        accion: 'leer' },
  'GET /api/cuotas/pendientes':     { recurso: 'cuotas',        accion: 'leer' },
  'GET /api/cuotas/vencidas':       { recurso: 'cuotas',        accion: 'leer' },
  'GET /api/cuotas/venta':          { recurso: 'cuotas',        accion: 'leer' },
  'POST /api/cuotas':               { recurso: 'cuotas',        accion: 'crear' },
  'PUT /api/cuotas':                { recurso: 'cuotas',        accion: 'actualizar' },
  'PATCH /api/cuotas/valores':      { recurso: 'cuotas',        accion: 'editar_valores' },

  'GET /api/pagos':                 { recurso: 'pagos',         accion: 'leer' },
  'POST /api/pagos':                { recurso: 'pagos',         accion: 'crear' },

  'GET /api/facturas':              { recurso: 'facturas',      accion: 'leer' },
  'POST /api/facturas':             { recurso: 'facturas',      accion: 'crear' },
  'PUT /api/facturas':              { recurso: 'facturas',      accion: 'actualizar' },

  'GET /api/recibos':                        { recurso: 'recibos', accion: 'leer' },
  'POST /api/recibos':                       { recurso: 'recibos', accion: 'crear' },
  'POST /api/recibos/generar-pendientes':    { recurso: 'recibos', accion: 'crear' },

  'GET /api/compradores':           { recurso: 'compradores',   accion: 'leer' },
  'POST /api/compradores':          { recurso: 'compradores',   accion: 'crear' },
  'PUT /api/compradores':           { recurso: 'compradores',   accion: 'actualizar' },

  'GET /api/comisionistas':                        { recurso: 'comisionistas', accion: 'leer' },
  'POST /api/comisionistas':                       { recurso: 'comisionistas', accion: 'crear' },
  'PUT /api/comisionistas':                        { recurso: 'comisionistas', accion: 'actualizar' },
  'GET /api/comisionistas/comisiones':             { recurso: 'comisionistas', accion: 'leer' },
  'POST /api/comisionistas/ventas/micropago':      { recurso: 'comisionistas', accion: 'actualizar' },
  'PATCH /api/comisionistas/ventas/pagada':        { recurso: 'comisionistas', accion: 'actualizar' },

  'GET /api/reportes':                   { recurso: 'reportes',     accion: 'leer' },
  'GET /api/reportes/dir':               { recurso: 'reportes_dir', accion: 'leer' },
  'GET /api/reportes/jur':               { recurso: 'alertas_jur',  accion: 'leer' },
  'GET /api/reportes/juridico':          { recurso: 'alertas_jur',  accion: 'leer' },
  'GET /api/reportes/comisiones-jefe':   { recurso: 'reportes',     accion: 'leer' },

  'GET /api/reportes/panel':             { recurso: 'dashboard', accion: 'ver_operacion' },
  'GET /api/reportes/cartera-hoy':       { recurso: 'dashboard', accion: 'ver_cartera' },
  'GET /api/reportes/comisiones':        { recurso: 'dashboard', accion: 'ver_comisiones' },
  'GET /api/reportes/alertas':           { recurso: 'dashboard', accion: 'ver_juridico' },

  'GET /api/juridico/cartera':            { recurso: 'alertas_jur',      accion: 'leer' },
  'GET /api/juridico/observaciones':      { recurso: 'observaciones_jur', accion: 'leer' },
  'POST /api/juridico/observaciones':     { recurso: 'observaciones_jur', accion: 'crear' },

  'GET /api/mi-cuenta':             { recurso: 'mi_cuenta',     accion: 'leer' },


  'GET /api/ventas/mis-ventas':   { recurso: 'mis_ventas',  accion: 'leer' },

  'GET /api/cuotas/mis-cuotas':   { recurso: 'mis_cuotas',  accion: 'leer' },

  'GET /api/pagos/mis-pagos':     { recurso: 'mis_pagos',   accion: 'leer' },
  'POST /api/pagos/comprador':    { recurso: 'mis_pagos',   accion: 'crear' },

  'GET /api/recibos/mis-recibos': { recurso: 'mis_recibos', accion: 'leer' },

  'POST /api/uploads/baucher':    { recurso: 'uploads',     accion: 'crear' },
  'GET /api/roles':          { recurso: 'roles', accion: 'leer' },
  'GET /api/roles/permisos': { recurso: 'roles', accion: 'leer' },
  'PUT /api/roles/permisos': { recurso: 'roles', accion: 'actualizar' },
  'GET /api/bank-transactions':        { recurso: 'bank_transactions', accion: 'leer' },
  'POST /api/bank-transactions/batch': { recurso: 'bank_transactions', accion: 'crear' },
  'PUT /api/bank-transactions':        { recurso: 'bank_transactions', accion: 'actualizar' },
  'DELETE /api/bank-transactions':     { recurso: 'bank_transactions', accion: 'eliminar' },

  'GET /api/pagos/contrast':           { recurso: 'validacion_pagos',  accion: 'leer' },
  'PATCH /api/pagos/accept-batch':     { recurso: 'validacion_pagos',  accion: 'crear' },

  'GET /api/gastos':                   { recurso: 'gastos', accion: 'leer' },
  'GET /api/gastos/resumen':           { recurso: 'gastos', accion: 'leer' },
  'POST /api/gastos':                  { recurso: 'gastos', accion: 'crear' },
  'PUT /api/gastos':                   { recurso: 'gastos', accion: 'actualizar' },

};

module.exports = ROUTE_PERMISSIONS;


