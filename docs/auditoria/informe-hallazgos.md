# Informe consolidado de auditoría — SGI El Cóndor

_Generado por `npm run audit` el 2026-07-31T06:41:26.150Z._


## Resumen

| Severidad | Cantidad | Significado |
|---|---|---|
| P0 | 0 | Bloquea la entrega |
| P1 | 0 | Degrada la entrega |
| P2 | 37 | Deuda / limpieza |
| INFO | 38 | Verificado, aceptado o límite de cobertura |

## Anexos

| Anexo | P0 | P1 | P2 | INFO |
|---|---|---|---|---|
| [Anexo A · Rutas montadas vs. ROUTE_PERMISSIONS](anexos/01-routes-vs-permissions.md) | 0 | 0 | 6 | 17 |
| [Anexo B · Endpoints consumidos por la SPA vs. rutas montadas](anexos/02-frontend-vs-backend.md) | 0 | 0 | 18 | 2 |
| [Anexo C · Consistencia de vistas (registro, navegación, permisos, build)](anexos/03-views-consistency.md) | 0 | 0 | 0 | 6 |
| [Anexo D · Consultas del backend vs. esquema real de la base de datos](anexos/04-db-vs-code.md) | 0 | 0 | 0 | 6 |
| [Anexo E · Modelo de autorización: código vs. base de datos](anexos/05-permissions-db-drift.md) | 0 | 0 | 5 | 3 |
| [Anexo G · Código, archivos y dependencias sin uso](anexos/06-dead-code.md) | 0 | 0 | 0 | 4 |
| [Anexo H · Vulnerabilidades en dependencias de producción](anexos/07-dependencies.md) | 0 | 0 | 8 | 0 |

## Hallazgos P2

| ID | Categoría | Hallazgo | Ubicación | Acción |
|---|---|---|---|---|
| AUD-RP003 | authz-descentralizada | Autorización fuera del mapa central: PATCH /api/v1/ventas/:id/cancelar | src/routes/ventas.routes.js:13<br>src/controllers/ventas.controller.js:714 | Deuda de consistencia: la lista de roles/permisos hardcodeada no es configurable desde la vista Permisos. Evaluar migrar a ROUTE_PERMISSIONS. |
| AUD-RP004 | authz-descentralizada | Autorización fuera del mapa central: DELETE /api/v1/ventas/:id | src/routes/ventas.routes.js:14<br>src/controllers/ventas.controller.js:654 | Deuda de consistencia: la lista de roles/permisos hardcodeada no es configurable desde la vista Permisos. Evaluar migrar a ROUTE_PERMISSIONS. |
| AUD-RP006 | authz-descentralizada | Autorización fuera del mapa central: GET /api/v1/requerimientos/stream | src/routes/requerimientos.routes.js:5<br>src/controllers/requerimientos.controller.js:297 | Deuda de consistencia: la lista de roles/permisos hardcodeada no es configurable desde la vista Permisos. Evaluar migrar a ROUTE_PERMISSIONS. |
| AUD-RP010 | authz-descentralizada | Param no numérico ⇒ el permiso central nunca se evalúa: GET /api/v1/config/:clave | src/routes/config.routes.js:5<br>src/controllers/config.controller.js:51 | Aceptable, pero documentar la excepción: el permiso vive en el controller y NO es visible en ROUTE_PERMISSIONS. |
| AUD-RP011 | authz-descentralizada | Param no numérico ⇒ el permiso central nunca se evalúa: PATCH /api/v1/config/:clave | src/routes/config.routes.js:6<br>src/controllers/config.controller.js:65 | Aceptable, pero documentar la excepción: el permiso vive en el controller y NO es visible en ROUTE_PERMISSIONS. |
| AUD-RP018 | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/comisionistas/comisiones | src/routes/comisionistas.routes.js:4<br>src/routes/comisionistas.routes.js:5 | Verificar que ambas operaciones deban compartir sensibilidad; si no, diferenciar la ruta o validar en el controller. |
| AUD-FB001 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/auth/usuarios | src/routes/auth.routes.js:26 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB002 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/proyectos/:id | src/routes/proyectos.routes.js:4 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB003 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/compradores/:id | src/routes/compradores.routes.js:6 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB004 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/ventas/reportes/financiero | src/routes/ventas.routes.js:5 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB005 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: PATCH /api/v1/ventas/:id/financiero | src/routes/ventas.routes.js:12 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB006 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/cuotas/venta/:idVenta | src/routes/cuotas.routes.js:6 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB007 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/cuotas | src/routes/cuotas.routes.js:13 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB008 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: PATCH /api/v1/cuotas/:id/valores | src/routes/cuotas.routes.js:14 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB009 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/pagos/mis-pagos/:id | src/routes/pagos.routes.js:5 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB010 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/pagos/:id | src/routes/pagos.routes.js:15 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB011 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/facturas/generar-pendientes | src/routes/facturas.routes.js:6 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB012 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/reportes/juridico | src/routes/reportes.routes.js:10 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB013 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/reportes/mora-sync | src/routes/reportes.routes.js:13 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB014 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/roles/:id/permisos | src/routes/roles.routes.js:5 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB015 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/uploads/lote-foto | src/routes/uploads.routes.js:20 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB016 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/gastos/resumen | src/routes/gastos.routes.js:4 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB017 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/requerimientos/stream | src/routes/requerimientos.routes.js:5 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-FB018 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/config | src/routes/config.routes.js:4 | Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos. |
| AUD-PD001 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: uploads:avatar | condor.permisos | Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones. |
| AUD-PD002 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: mis_facturas:crear | condor.permisos | Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones. |
| AUD-PD004 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:generar | condor.permisos | Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones. |
| AUD-PD005 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:leer | condor.permisos | Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones. |
| AUD-PD006 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:reenviar | condor.permisos | Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones. |
| AUD-DEP001 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: @google-cloud/firestore | package.json<br>node_modules/@google-cloud/firestore | Planificar la actualización con prueba del flujo afectado. |
| AUD-DEP002 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: @google-cloud/storage | package.json<br>node_modules/@google-cloud/storage | Planificar la actualización con prueba del flujo afectado. |
| AUD-DEP003 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: firebase-admin | package.json<br>node_modules/firebase-admin | Planificar la actualización con prueba del flujo afectado. |
| AUD-DEP004 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: gaxios | package.json<br>node_modules/gaxios | Ejecutar `npm audit fix`, correr `npm test` y `npm run build`, y re-auditar. |
| AUD-DEP005 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: google-gax | package.json<br>node_modules/google-gax | Planificar la actualización con prueba del flujo afectado. |
| AUD-DEP006 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: retry-request | package.json<br>node_modules/retry-request | Planificar la actualización con prueba del flujo afectado. |
| AUD-DEP007 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: teeny-request | package.json<br>node_modules/teeny-request | Planificar la actualización con prueba del flujo afectado. |
| AUD-DEP008 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: uuid | package.json<br>node_modules/uuid | Planificar la actualización con prueba del flujo afectado. |

## Verificados y aceptados

| ID | Hallazgo | Severidad original | Motivo de aceptación |
|---|---|---|---|
| AUD-RP001 | Router público por diseño: /api/v1/auth | INFO | Superficie pública documentada (login, registro, reset, verificación). Cada ruta sensible del router aplica verificarToken o rateLimit explícitamente. |
| AUD-RP002 | Router público por diseño: /api/v1/public | INFO | Catálogo público de la landing (proyectos, lotes, asesores) con Cache-Control 60 s. |
| AUD-RP005 | Sin entrada en ROUTE_PERMISSIONS: POST /api/v1/uploads/avatar | INFO | Endpoint de auto-servicio: sube el avatar del propio usuario autenticado. Sin identificador ajeno en el payload. |
| AUD-RP007 | Sin entrada en ROUTE_PERMISSIONS: GET /api/v1/requerimientos/contadores | P1 | Verificado en requerimientos.controller.js:326-360: cada contador se calcula sólo si el caller tiene el permiso del nivel correspondiente (helper `puede()`), devolviendo 0 si no. No expone datos de terceros; no requiere 403 porque un usuario sin permisos recibe contadores vacíos. |
| AUD-RP008 | Sin entrada en ROUTE_PERMISSIONS: GET /api/v1/notificaciones | INFO | Auto-servicio: notificaciones.controller filtra por req.usuario.id_usuario. |
| AUD-RP009 | Sin entrada en ROUTE_PERMISSIONS: PATCH /api/v1/notificaciones/leidas | INFO | Auto-servicio: marca leídas sólo las notificaciones del propio usuario. |
| AUD-DB001 | RPC que vive en public y no en condor: next_consecutivo_condor() | P2 | Excepción conocida y documentada en CLAUDE.md: la función vive en public y se invoca sin .schema(). Mover la función o añadir el .schema() rompería todas las numeraciones. Se deja como está y se documenta. |
| AUD-DB002 | Objeto de BD que el backend nunca consulta: consecutivos | P2 | NO ELIMINAR. Es el estado del RPC next_consecutivo_condor (8 filas: prefijo, periodo, ultimo_numero). Ningún .from() la referencia porque sólo la lee y escribe la función en BD. Borrarla rompe TODAS las numeraciones del sistema: recibos RC-, pagos PAG-, micropagos MCOM-, facturas FV- y códigos de venta. |
| AUD-DB003 | Objeto de BD que el backend nunca consulta: vw_auditoria_juridica | P2 | Vista disponible y no consumida (4.709 filas derivadas). Se conserva: una vista no consume almacenamiento ni puede desincronizarse. Documentada como disponible en el Documento de Datos. |
| AUD-DB004 | Objeto de BD que el backend nunca consulta: vw_dir_auditoria | P2 | Vista disponible y no consumida (19.485 filas derivadas). Se conserva por el mismo motivo. |
| AUD-DB005 | Objeto de BD que el backend nunca consulta: vw_dir_recaudo_facturacion_hoy | P2 | Vista disponible y no consumida. El backend usa vw_dir_recaudo_facturacion_historico. Se conserva. |
| AUD-DB006 | Objeto de BD que el backend nunca consulta: vw_disponibilidad_comercial | P2 | Vista disponible y no consumida (34 lotes). El catálogo público se arma desde lote/proyecto. Se conserva. |
| AUD-PD003 | Permiso que ninguna ruta exige y ninguna vista otorga: config:actualizar | P2 | Falso positivo estructural: /config/:clave tiene un param no numérico, así que no puede tener entrada en ROUTE_PERMISSIONS (nunca coincidiría). El permiso SÍ se evalúa, dentro de config.controller.js:67 vía _puedeConfig(req, 'actualizar'). Es el coste de visibilidad de autorizar en el controller. |
| AUD-PD007 | Permiso que ninguna ruta exige y ninguna vista otorga: requerimientos:entregar | P2 | Verificado: la ruta PATCH /requerimientos/:id/entregar exige `recepciones:crear` (permissions.js:126) y el handler entregar() no valida nada por su cuenta. El permiso está otorgado a almacenista pero no concede nada; almacenista sí tiene recepciones:crear, así que INV-02 funciona. Concesión decorativa: se conserva para no tocar permisos en la ventana de entrega. |
| AUD-PD008 | Nombre de rol usado en código que no existe en condor.roles: auditoria | P1 | DECISIÓN DE ENTREGA (2026-07-29): no se crea el rol. Impacto verificado = nulo: sólo aparece en role-promotion.service.js:15 (lista de roles protegidos, guarda defensiva inofensiva) y en la trazabilidad INV-04 de requerimientos.controller.js, que ya admite admin/gerencia/dueno. La supervisión está cubierta: auditoria_log:leer lo tienen admin, dueno, gerencia y auxiliar_contable. Se corrigió CLAUDE.md, que lo listaba como rol existente. |
| AUD-DC001 | 1 console.log/debugger en src/index.js | P2 | Log de arranque del servidor (puerto de escucha). Observabilidad legítima, no depuración. |
| AUD-DC002 | 1 console.log/debugger en src/services/comisiones.service.js | P2 | Registra el evento de negocio 'comisión causada' con venta y monto acumulado. Es rastro operativo deseado en producción. |
| AUD-DC003 | 2 console.log/debugger en src/services/email.service.js | P2 | Registran la entrega efectiva de cada correo con el puerto usado (primario o alterno). No son depuración: son la observabilidad que esta misma auditoría señalaba como ausente, ya que el envío de correo es de mejor esfuerzo y su fallo era silencioso. Introducidos por el PR #116. |
| AUD-DC004 | 1 console.log/debugger en src/services/mora.service.js | P2 | Registra el resultado del cron actualizar_mora en cada corrida. Necesario para diagnosticar el job. |
