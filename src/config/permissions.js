// Map: HTTP method + full path from root -> { recurso, accion }
// The middleware builds the key from req.originalUrl (not req.path) so it keeps
// the /api/v1 prefix, and strips numeric segments only: a route with a
// non-numeric param never matches here and must authorize in its controller.
const ROUTE_PERMISSIONS = {
  'GET /api/v1/usuarios':              { recurso: 'usuarios',      accion: 'leer' },
  'POST /api/v1/usuarios':             { recurso: 'usuarios',      accion: 'crear' },
  'PUT /api/v1/usuarios':              { recurso: 'usuarios',      accion: 'actualizar' },
  'GET /api/v1/usuarios/roles':        { recurso: 'usuarios',      accion: 'leer' },
  'PATCH /api/v1/usuarios/desactivar':   { recurso: 'usuarios',      accion: 'actualizar' },
  'PATCH /api/v1/usuarios/desbloquear': { recurso: 'usuarios',      accion: 'actualizar' },

  'GET /api/v1/proyectos':             { recurso: 'proyectos',     accion: 'leer' },
  'POST /api/v1/proyectos':            { recurso: 'proyectos',     accion: 'crear' },
  'PUT /api/v1/proyectos':             { recurso: 'proyectos',     accion: 'actualizar' },
  'PATCH /api/v1/proyectos/ubicacion': { recurso: 'proyectos',     accion: 'editar_ubicacion' },

  'GET /api/v1/lotes':                 { recurso: 'lotes',         accion: 'leer' },
  'POST /api/v1/lotes':                { recurso: 'lotes',         accion: 'crear' },
  'PUT /api/v1/lotes':                 { recurso: 'lotes',         accion: 'actualizar' },
  'PATCH /api/v1/lotes/geometria':     { recurso: 'lotes',         accion: 'editar_geometria' },
  'POST /api/v1/lotes/geometria-batch': { recurso: 'lotes',        accion: 'editar_geometria' },

  'GET /api/v1/ventas':                { recurso: 'ventas',        accion: 'leer' },
  'POST /api/v1/ventas':               { recurso: 'ventas',        accion: 'crear' },
  'POST /api/v1/ventas/solicitud':     { recurso: 'ventas',        accion: 'solicitar' },
  'PATCH /api/v1/ventas/financiero':   { recurso: 'ventas',        accion: 'editar_financiero' },

  'GET /api/v1/cuotas/pendientes':     { recurso: 'cuotas',        accion: 'leer' },
  'GET /api/v1/cuotas/vencidas':       { recurso: 'cuotas',        accion: 'leer' },
  'GET /api/v1/cuotas/venta':          { recurso: 'cuotas',        accion: 'leer' },
  'POST /api/v1/cuotas':               { recurso: 'cuotas',        accion: 'crear' },
  'PATCH /api/v1/cuotas/valores':      { recurso: 'cuotas',        accion: 'editar_valores' },
  'PATCH /api/v1/cuotas/venta/valores': { recurso: 'cuotas',       accion: 'editar_valores' },
  'PUT /api/v1/cuotas/venta/plan':      { recurso: 'cuotas',       accion: 'editar_valores' },
  'GET /api/v1/cuotas/fracciones':      { recurso: 'cuotas',        accion: 'leer' },
  'POST /api/v1/cuotas/fracciones':     { recurso: 'cuotas',        accion: 'editar_valores' },
  'DELETE /api/v1/cuotas/fracciones':   { recurso: 'cuotas',        accion: 'editar_valores' },
  'DELETE /api/v1/cuotas':              { recurso: 'cuotas',        accion: 'eliminar' },

  'GET /api/v1/pagos':                       { recurso: 'pagos', accion: 'leer' },
  'POST /api/v1/pagos':                      { recurso: 'pagos', accion: 'crear' },

  'GET /api/v1/facturas':              { recurso: 'facturas',      accion: 'leer' },
  'POST /api/v1/facturas':             { recurso: 'facturas',      accion: 'crear' },
  'GET /api/v1/facturas/solicitudes':  { recurso: 'facturas',      accion: 'leer' },
  'PATCH /api/v1/facturas/solicitudes': { recurso: 'facturas',     accion: 'crear' },
  'PATCH /api/v1/facturas/anular':     { recurso: 'facturas',      accion: 'crear' },

  'GET /api/v1/recibos':                        { recurso: 'recibos', accion: 'leer' },
  'POST /api/v1/recibos/generar-pendientes':    { recurso: 'recibos', accion: 'crear' },

  'GET /api/v1/compradores':                  { recurso: 'compradores',   accion: 'leer' },
  'GET /api/v1/compradores/buscar-usuario':   { recurso: 'compradores',   accion: 'leer' },
  'POST /api/v1/compradores':          { recurso: 'compradores',   accion: 'crear' },
  'PUT /api/v1/compradores':           { recurso: 'compradores',   accion: 'actualizar' },

  'GET /api/v1/comisionistas':                        { recurso: 'comisionistas', accion: 'leer' },
  'POST /api/v1/comisionistas':                       { recurso: 'comisionistas', accion: 'crear' },
  'PUT /api/v1/comisionistas':                        { recurso: 'comisionistas', accion: 'actualizar' },
  'GET /api/v1/comisionistas/comisiones':             { recurso: 'comisionistas', accion: 'leer' },
  'POST /api/v1/comisionistas/ventas/micropago':      { recurso: 'comisionistas', accion: 'actualizar' },
  'PATCH /api/v1/comisionistas/ventas/pagada':        { recurso: 'comisionistas', accion: 'actualizar' },

  'GET /api/v1/reportes/juridico':          { recurso: 'alertas_jur',  accion: 'leer' },
  'GET /api/v1/reportes/comisiones-gerencia':   { recurso: 'reportes',     accion: 'leer' },
  'GET /api/v1/reportes/proyeccion-ingresos':   { recurso: 'reportes',     accion: 'leer' },

  'GET /api/v1/reportes/panel':             { recurso: 'dashboard', accion: 'ver_operacion' },
  'GET /api/v1/reportes/cartera-hoy':       { recurso: 'dashboard', accion: 'ver_cartera' },
  'GET /api/v1/reportes/comisiones':        { recurso: 'dashboard', accion: 'ver_comisiones' },
  'GET /api/v1/reportes/alertas':           { recurso: 'dashboard', accion: 'ver_juridico' },

  'GET /api/v1/juridico/cartera':            { recurso: 'alertas_jur',      accion: 'leer' },
  'GET /api/v1/juridico/observaciones':      { recurso: 'observaciones_jur', accion: 'leer' },
  'POST /api/v1/juridico/observaciones':     { recurso: 'observaciones_jur', accion: 'crear' },



  'GET /api/v1/ventas/mis-ventas':   { recurso: 'mis_ventas',  accion: 'leer' },

  'GET /api/v1/pagos/mis-pagos':     { recurso: 'mis_pagos',   accion: 'leer' },
  'POST /api/v1/pagos/comprador':    { recurso: 'mis_pagos',   accion: 'crear' },

  'GET /api/v1/facturas/mis-facturas':      { recurso: 'mis_facturas', accion: 'leer' },
  'POST /api/v1/facturas/solicitar':        { recurso: 'mis_facturas', accion: 'leer' },

  'GET /api/v1/recibos/mis-recibos': { recurso: 'mis_recibos', accion: 'leer' },

  'GET /api/v1/cuotas/mis-cuotas/documentos': { recurso: 'mis_ventas', accion: 'leer' },

  'POST /api/v1/uploads/baucher':    { recurso: 'uploads',     accion: 'crear' },
  'POST /api/v1/uploads/lote-foto':  { recurso: 'lotes',       accion: 'actualizar' },
  'GET /api/v1/roles':          { recurso: 'roles', accion: 'leer' },
  'GET /api/v1/roles/permisos': { recurso: 'roles', accion: 'leer' },
  'PUT /api/v1/roles/permisos': { recurso: 'roles', accion: 'actualizar' },
  'PATCH /api/v1/roles/manual': { recurso: 'roles', accion: 'actualizar' },
  'GET /api/v1/bank-transactions':        { recurso: 'bank_transactions', accion: 'leer' },
  'POST /api/v1/bank-transactions/batch': { recurso: 'bank_transactions', accion: 'crear' },
  'PUT /api/v1/bank-transactions':        { recurso: 'bank_transactions', accion: 'actualizar' },
  'DELETE /api/v1/bank-transactions':     { recurso: 'bank_transactions', accion: 'eliminar' },

  'GET /api/v1/pagos/contrast':            { recurso: 'validacion_pagos',  accion: 'leer' },
  'PATCH /api/v1/pagos/accept-batch':     { recurso: 'validacion_pagos',  accion: 'crear' },
  'PATCH /api/v1/pagos/reject-batch':     { recurso: 'validacion_pagos',  accion: 'crear' },

  'GET /api/v1/gastos':                   { recurso: 'gastos', accion: 'leer' },
  'GET /api/v1/gastos/resumen':           { recurso: 'gastos', accion: 'leer' },
  'POST /api/v1/gastos':                  { recurso: 'gastos', accion: 'crear' },
  'PUT /api/v1/gastos':                   { recurso: 'gastos', accion: 'actualizar' },

  'GET /api/v1/recepciones/pendientes':   { recurso: 'recepciones', accion: 'leer' },
  'GET /api/v1/recepciones/historial':    { recurso: 'recepciones', accion: 'leer' },
  'GET /api/v1/recepciones':              { recurso: 'recepciones', accion: 'leer' },
  'POST /api/v1/recepciones':             { recurso: 'recepciones', accion: 'crear' },

  'GET /api/v1/requerimientos/mis-requerimientos': { recurso: 'requerimientos', accion: 'leer' },
  'POST /api/v1/requerimientos':                   { recurso: 'requerimientos', accion: 'crear' },
  'PATCH /api/v1/requerimientos/cancelar':         { recurso: 'requerimientos', accion: 'crear' },
  'GET /api/v1/requerimientos/aprobaciones':       { recurso: 'requerimientos', accion: 'leer' },
  'GET /api/v1/requerimientos/historial':          { recurso: 'requerimientos', accion: 'leer' },
  'GET /api/v1/requerimientos/desembolsos':        { recurso: 'requerimientos', accion: 'desembolsar' },
  'PATCH /api/v1/requerimientos/desembolsar':      { recurso: 'requerimientos', accion: 'desembolsar' },
  'GET /api/v1/requerimientos/autorizacion':       { recurso: 'recepciones',    accion: 'leer' },
  'GET /api/v1/requerimientos/trazabilidad':       { recurso: 'requerimientos', accion: 'leer' },
  'PATCH /api/v1/requerimientos/entregar':         { recurso: 'recepciones',    accion: 'crear' },
  'PATCH /api/v1/requerimientos/aprobar-jefe':     { recurso: 'requerimientos', accion: 'aprobar_jefe' },
  'PATCH /api/v1/requerimientos/aprobar-final':    { recurso: 'requerimientos', accion: 'aprobar_final' },
  'PATCH /api/v1/requerimientos/aprobar-dueno':    { recurso: 'requerimientos', accion: 'aprobar_dueno' },
  'PATCH /api/v1/requerimientos/aprobar-gerencia': { recurso: 'requerimientos', accion: 'aprobar_gerencia' },
  'PATCH /api/v1/requerimientos/rechazar':         { recurso: 'requerimientos', accion: 'leer' },

  'GET /api/v1/config':          { recurso: 'config', accion: 'leer' },
  // No entries for /config/:clave on purpose: `:clave` is not numeric, so the
  // middleware can never build a key that matches this map. Both GET and PATCH
  // authorize inside config.controller.js (_puedeConfig).

  'GET /api/v1/empresas-aliadas':  { recurso: 'empresas_aliadas', accion: 'leer' },
  'POST /api/v1/empresas-aliadas': { recurso: 'empresas_aliadas', accion: 'crear' },
  'PUT /api/v1/empresas-aliadas':  { recurso: 'empresas_aliadas', accion: 'actualizar' },

  'GET /api/v1/respaldos':                  { recurso: 'respaldos', accion: 'leer' },
  'GET /api/v1/respaldos/descargar':        { recurso: 'respaldos', accion: 'leer' },
  'GET /api/v1/respaldos/restauraciones':   { recurso: 'respaldos', accion: 'leer' },
  'POST /api/v1/respaldos/restaurar':       { recurso: 'respaldos', accion: 'restaurar' },

  // SEG-09: rutas que estaban montadas sin entrada (solo exigían token)
  'GET /api/v1/lotes/disponibles':           { recurso: 'lotes',         accion: 'leer' },
  'GET /api/v1/ventas/estado-financiero':    { recurso: 'dashboard',     accion: 'ver_operacion' },
  'GET /api/v1/ventas/reportes/financiero':  { recurso: 'reportes',      accion: 'leer' },
  'GET /api/v1/facturas/cuotas-sin-factura': { recurso: 'facturas',      accion: 'leer' },
  'POST /api/v1/facturas/generar-pendientes': { recurso: 'facturas',     accion: 'crear' },
  'GET /api/v1/reportes/cartera':            { recurso: 'reportes',      accion: 'leer' },
  'GET /api/v1/reportes/recaudo':            { recurso: 'reportes',      accion: 'leer' },
  'GET /api/v1/reportes/auditoria':          { recurso: 'auditoria_log', accion: 'leer' },
  'POST /api/v1/reportes/mora-sync':         { recurso: 'reportes',      accion: 'mora_sync' },

};

module.exports = ROUTE_PERMISSIONS;


