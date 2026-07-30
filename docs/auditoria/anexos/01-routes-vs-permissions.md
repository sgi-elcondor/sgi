# Anexo A · Rutas montadas vs. ROUTE_PERMISSIONS

_Generado por `tools/audit/01-routes-vs-permissions.js` el 2026-07-30T02:03:03.157Z._

**Resumen:** P0=0 · P1=0 · P2=6 · INFO=17

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-RP003 | P2 | authz-descentralizada | Autorización fuera del mapa central: PATCH /api/v1/ventas/:id/cancelar | src/routes/ventas.routes.js:13<br>src/controllers/ventas.controller.js:714 |
| AUD-RP004 | P2 | authz-descentralizada | Autorización fuera del mapa central: DELETE /api/v1/ventas/:id | src/routes/ventas.routes.js:14<br>src/controllers/ventas.controller.js:654 |
| AUD-RP006 | P2 | authz-descentralizada | Autorización fuera del mapa central: GET /api/v1/requerimientos/stream | src/routes/requerimientos.routes.js:5<br>src/controllers/requerimientos.controller.js:300 |
| AUD-RP010 | P2 | authz-descentralizada | Param no numérico ⇒ el permiso central nunca se evalúa: GET /api/v1/config/:clave | src/routes/config.routes.js:5<br>src/controllers/config.controller.js:51 |
| AUD-RP011 | P2 | authz-descentralizada | Param no numérico ⇒ el permiso central nunca se evalúa: PATCH /api/v1/config/:clave | src/routes/config.routes.js:6<br>src/controllers/config.controller.js:65 |
| AUD-RP018 | P2 | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/comisionistas/comisiones | src/routes/comisionistas.routes.js:4<br>src/routes/comisionistas.routes.js:5 |
| AUD-RP001 | INFO | authn | Router público por diseño: /api/v1/auth | src/index.js:135 |
| AUD-RP002 | INFO | authn | Router público por diseño: /api/v1/public | src/index.js:138 |
| AUD-RP005 | INFO | authz | Sin entrada en ROUTE_PERMISSIONS: POST /api/v1/uploads/avatar | src/routes/uploads.routes.js:19<br>src/controllers/uploads.controller.js:4 |
| AUD-RP007 | INFO | authz | Sin entrada en ROUTE_PERMISSIONS: GET /api/v1/requerimientos/contadores | src/routes/requerimientos.routes.js:6<br>src/controllers/requerimientos.controller.js:326 |
| AUD-RP008 | INFO | authz | Sin entrada en ROUTE_PERMISSIONS: GET /api/v1/notificaciones | src/routes/notificaciones.routes.js:4<br>src/controllers/notificaciones.controller.js:4 |
| AUD-RP009 | INFO | authz | Sin entrada en ROUTE_PERMISSIONS: PATCH /api/v1/notificaciones/leidas | src/routes/notificaciones.routes.js:5<br>src/controllers/notificaciones.controller.js:17 |
| AUD-RP012 | INFO | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/proyectos | src/routes/proyectos.routes.js:3<br>src/routes/proyectos.routes.js:4 |
| AUD-RP013 | INFO | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/lotes | src/routes/lotes.routes.js:3<br>src/routes/lotes.routes.js:5 |
| AUD-RP014 | INFO | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/compradores | src/routes/compradores.routes.js:5<br>src/routes/compradores.routes.js:6 |
| AUD-RP015 | INFO | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/ventas | src/routes/ventas.routes.js:8<br>src/routes/ventas.routes.js:9 |
| AUD-RP016 | INFO | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/pagos/mis-pagos | src/routes/pagos.routes.js:4<br>src/routes/pagos.routes.js:5 |
| AUD-RP017 | INFO | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/pagos | src/routes/pagos.routes.js:8<br>src/routes/pagos.routes.js:15 |
| AUD-RP019 | INFO | granularidad-permisos | Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/empresas-aliadas | src/routes/empresas_aliadas.routes.js:4<br>src/routes/empresas_aliadas.routes.js:5 |
| AUD-RP020 | INFO | cobertura-auditoria | Línea de ruta/mount no interpretable por el auditor | src/index.js:74 |
| AUD-RP021 | INFO | cobertura-auditoria | Línea de ruta/mount no interpretable por el auditor | src/index.js:86 |
| AUD-RP022 | INFO | cobertura-auditoria | Línea de ruta/mount no interpretable por el auditor | src/index.js:106 |
| AUD-RP023 | INFO | cobertura-auditoria | Línea de ruta/mount no interpretable por el auditor | src/index.js:123 |

## Detalle

### AUD-RP003 · P2 · Autorización fuera del mapa central: PATCH /api/v1/ventas/:id/cancelar

- **Ubicación:** `src/routes/ventas.routes.js:13`, `src/controllers/ventas.controller.js:714`
- **Detalle:** Clave calculada `PATCH /api/v1/ventas/cancelar` ausente del mapa ⇒ el middleware sólo exige autenticación. Mitigado en el controller `src/controllers/ventas.controller.js:714` (chequeo de req.usuario.rol, lista de roles hardcodeada + respuesta 403).
- **Acción propuesta:** Deuda de consistencia: la lista de roles/permisos hardcodeada no es configurable desde la vista Permisos. Evaluar migrar a ROUTE_PERMISSIONS.

### AUD-RP004 · P2 · Autorización fuera del mapa central: DELETE /api/v1/ventas/:id

- **Ubicación:** `src/routes/ventas.routes.js:14`, `src/controllers/ventas.controller.js:654`
- **Detalle:** Clave calculada `DELETE /api/v1/ventas` ausente del mapa ⇒ el middleware sólo exige autenticación. Mitigado en el controller `src/controllers/ventas.controller.js:654` (chequeo de req.usuario.rol, lista de roles hardcodeada + respuesta 403).
- **Acción propuesta:** Deuda de consistencia: la lista de roles/permisos hardcodeada no es configurable desde la vista Permisos. Evaluar migrar a ROUTE_PERMISSIONS.

### AUD-RP006 · P2 · Autorización fuera del mapa central: GET /api/v1/requerimientos/stream

- **Ubicación:** `src/routes/requerimientos.routes.js:5`, `src/controllers/requerimientos.controller.js:300`
- **Detalle:** Clave calculada `GET /api/v1/requerimientos/stream` ausente del mapa ⇒ el middleware sólo exige autenticación. Mitigado en el controller `src/controllers/requerimientos.controller.js:300` (helper _puede*() + respuesta 403).
- **Acción propuesta:** Deuda de consistencia: la lista de roles/permisos hardcodeada no es configurable desde la vista Permisos. Evaluar migrar a ROUTE_PERMISSIONS.

### AUD-RP010 · P2 · Param no numérico ⇒ el permiso central nunca se evalúa: GET /api/v1/config/:clave

- **Ubicación:** `src/routes/config.routes.js:5`, `src/controllers/config.controller.js:51`
- **Detalle:** El middleware sólo elimina segmentos numéricos (`/\d+/g`). Con :clave la clave en runtime es `GET /api/v1/config/<valor>`, que no existe en el mapa. Mitigado en el controller `src/controllers/config.controller.js:51` (helper _puede*() + respuesta 403).
- **Acción propuesta:** Aceptable, pero documentar la excepción: el permiso vive en el controller y NO es visible en ROUTE_PERMISSIONS.

### AUD-RP011 · P2 · Param no numérico ⇒ el permiso central nunca se evalúa: PATCH /api/v1/config/:clave

- **Ubicación:** `src/routes/config.routes.js:6`, `src/controllers/config.controller.js:65`
- **Detalle:** El middleware sólo elimina segmentos numéricos (`/\d+/g`). Con :clave la clave en runtime es `PATCH /api/v1/config/<valor>`, que no existe en el mapa. Mitigado en el controller `src/controllers/config.controller.js:65` (helper _puede*() + respuesta 403).
- **Acción propuesta:** Aceptable, pero documentar la excepción: el permiso vive en el controller y NO es visible en ROUTE_PERMISSIONS.

### AUD-RP018 · P2 · Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/comisionistas/comisiones

- **Ubicación:** `src/routes/comisionistas.routes.js:4`, `src/routes/comisionistas.routes.js:5`
- **Detalle:** Rutas afectadas: /api/v1/comisionistas/comisiones , /api/v1/comisionistas/:id/comisiones. Comparten el permiso `comisionistas:leer`; no se pueden autorizar por separado.
- **Acción propuesta:** Verificar que ambas operaciones deban compartir sensibilidad; si no, diferenciar la ruta o validar en el controller.

### AUD-RP001 · INFO · Router público por diseño: /api/v1/auth

- **Ubicación:** `src/index.js:135`
- **Detalle:** Montado en la línea 135, antes del guard de la línea 162. Superficie pública documentada.
- **Aceptado tras verificación** (severidad original INFO): Superficie pública documentada (login, registro, reset, verificación). Cada ruta sensible del router aplica verificarToken o rateLimit explícitamente.
- **Acción propuesta:** Ninguna; documentar en el Documento Técnico.

### AUD-RP002 · INFO · Router público por diseño: /api/v1/public

- **Ubicación:** `src/index.js:138`
- **Detalle:** Montado en la línea 138, antes del guard de la línea 162. Superficie pública documentada.
- **Aceptado tras verificación** (severidad original INFO): Catálogo público de la landing (proyectos, lotes, asesores) con Cache-Control 60 s.
- **Acción propuesta:** Ninguna; documentar en el Documento Técnico.

### AUD-RP005 · INFO · Sin entrada en ROUTE_PERMISSIONS: POST /api/v1/uploads/avatar

- **Ubicación:** `src/routes/uploads.routes.js:19`, `src/controllers/uploads.controller.js:4`
- **Detalle:** Clave calculada `POST /api/v1/uploads/avatar` ausente del mapa ⇒ el middleware sólo exige autenticación. El controller `src/controllers/uploads.controller.js:4` no contiene ninguna validación de rol/permiso. Parece endpoint de auto-servicio; verificar el filtro por req.usuario.
- **Aceptado tras verificación** (severidad original INFO): Endpoint de auto-servicio: sube el avatar del propio usuario autenticado. Sin identificador ajeno en el payload.
- **Acción propuesta:** Confirmar el filtro por req.usuario en el controller y documentarlo como endpoint de auto-servicio.

### AUD-RP007 · INFO · Sin entrada en ROUTE_PERMISSIONS: GET /api/v1/requerimientos/contadores

- **Ubicación:** `src/routes/requerimientos.routes.js:6`, `src/controllers/requerimientos.controller.js:326`
- **Detalle:** Clave calculada `GET /api/v1/requerimientos/contadores` ausente del mapa ⇒ el middleware sólo exige autenticación. El controller `src/controllers/requerimientos.controller.js:326` usa chequeo de req.usuario.rol, permisos.has() pero no se detecta un 403 explícito: verificar que realmente corte el acceso.
- **Aceptado tras verificación** (severidad original P1): Verificado en requerimientos.controller.js:326-360: cada contador se calcula sólo si el caller tiene el permiso del nivel correspondiente (helper `puede()`), devolviendo 0 si no. No expone datos de terceros; no requiere 403 porque un usuario sin permisos recibe contadores vacíos.
- **Acción propuesta:** Registrar `'GET /api/v1/requerimientos/contadores': { recurso, accion }` en src/config/permissions.js.

### AUD-RP008 · INFO · Sin entrada en ROUTE_PERMISSIONS: GET /api/v1/notificaciones

- **Ubicación:** `src/routes/notificaciones.routes.js:4`, `src/controllers/notificaciones.controller.js:4`
- **Detalle:** Clave calculada `GET /api/v1/notificaciones` ausente del mapa ⇒ el middleware sólo exige autenticación. El controller `src/controllers/notificaciones.controller.js:4` no contiene ninguna validación de rol/permiso. Parece endpoint de auto-servicio; verificar el filtro por req.usuario.
- **Aceptado tras verificación** (severidad original INFO): Auto-servicio: notificaciones.controller filtra por req.usuario.id_usuario.
- **Acción propuesta:** Confirmar el filtro por req.usuario en el controller y documentarlo como endpoint de auto-servicio.

### AUD-RP009 · INFO · Sin entrada en ROUTE_PERMISSIONS: PATCH /api/v1/notificaciones/leidas

- **Ubicación:** `src/routes/notificaciones.routes.js:5`, `src/controllers/notificaciones.controller.js:17`
- **Detalle:** Clave calculada `PATCH /api/v1/notificaciones/leidas` ausente del mapa ⇒ el middleware sólo exige autenticación. El controller `src/controllers/notificaciones.controller.js:17` no contiene ninguna validación de rol/permiso. Parece endpoint de auto-servicio; verificar el filtro por req.usuario.
- **Aceptado tras verificación** (severidad original INFO): Auto-servicio: marca leídas sólo las notificaciones del propio usuario.
- **Acción propuesta:** Confirmar el filtro por req.usuario en el controller y documentarlo como endpoint de auto-servicio.

### AUD-RP012 · INFO · Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/proyectos

- **Ubicación:** `src/routes/proyectos.routes.js:3`, `src/routes/proyectos.routes.js:4`
- **Detalle:** Rutas afectadas: /api/v1/proyectos , /api/v1/proyectos/:id. Comparten el permiso `proyectos:leer`; no se pueden autorizar por separado. Patrón lista+detalle del mismo recurso: aceptable.
- **Acción propuesta:** Ninguna; documentar que lista y detalle comparten permiso.

### AUD-RP013 · INFO · Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/lotes

- **Ubicación:** `src/routes/lotes.routes.js:3`, `src/routes/lotes.routes.js:5`
- **Detalle:** Rutas afectadas: /api/v1/lotes , /api/v1/lotes/:id. Comparten el permiso `lotes:leer`; no se pueden autorizar por separado. Patrón lista+detalle del mismo recurso: aceptable.
- **Acción propuesta:** Ninguna; documentar que lista y detalle comparten permiso.

### AUD-RP014 · INFO · Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/compradores

- **Ubicación:** `src/routes/compradores.routes.js:5`, `src/routes/compradores.routes.js:6`
- **Detalle:** Rutas afectadas: /api/v1/compradores , /api/v1/compradores/:id. Comparten el permiso `compradores:leer`; no se pueden autorizar por separado. Patrón lista+detalle del mismo recurso: aceptable.
- **Acción propuesta:** Ninguna; documentar que lista y detalle comparten permiso.

### AUD-RP015 · INFO · Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/ventas

- **Ubicación:** `src/routes/ventas.routes.js:8`, `src/routes/ventas.routes.js:9`
- **Detalle:** Rutas afectadas: /api/v1/ventas , /api/v1/ventas/:id. Comparten el permiso `ventas:leer`; no se pueden autorizar por separado. Patrón lista+detalle del mismo recurso: aceptable.
- **Acción propuesta:** Ninguna; documentar que lista y detalle comparten permiso.

### AUD-RP016 · INFO · Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/pagos/mis-pagos

- **Ubicación:** `src/routes/pagos.routes.js:4`, `src/routes/pagos.routes.js:5`
- **Detalle:** Rutas afectadas: /api/v1/pagos/mis-pagos , /api/v1/pagos/mis-pagos/:id. Comparten el permiso `mis_pagos:leer`; no se pueden autorizar por separado. Patrón lista+detalle del mismo recurso: aceptable.
- **Acción propuesta:** Ninguna; documentar que lista y detalle comparten permiso.

### AUD-RP017 · INFO · Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/pagos

- **Ubicación:** `src/routes/pagos.routes.js:8`, `src/routes/pagos.routes.js:15`
- **Detalle:** Rutas afectadas: /api/v1/pagos , /api/v1/pagos/:id. Comparten el permiso `pagos:leer`; no se pueden autorizar por separado. Patrón lista+detalle del mismo recurso: aceptable.
- **Acción propuesta:** Ninguna; documentar que lista y detalle comparten permiso.

### AUD-RP019 · INFO · Rutas distintas colapsan en la misma clave de permiso: GET /api/v1/empresas-aliadas

- **Ubicación:** `src/routes/empresas_aliadas.routes.js:4`, `src/routes/empresas_aliadas.routes.js:5`
- **Detalle:** Rutas afectadas: /api/v1/empresas-aliadas , /api/v1/empresas-aliadas/:id. Comparten el permiso `empresas_aliadas:leer`; no se pueden autorizar por separado. Patrón lista+detalle del mismo recurso: aceptable.
- **Acción propuesta:** Ninguna; documentar que lista y detalle comparten permiso.

### AUD-RP020 · INFO · Línea de ruta/mount no interpretable por el auditor

- **Ubicación:** `src/index.js:74`
- **Detalle:** `app.use((req, res, next) => {` — revisar a mano; no entró en el cruce automático.
- **Acción propuesta:** Revisión manual.

### AUD-RP021 · INFO · Línea de ruta/mount no interpretable por el auditor

- **Ubicación:** `src/index.js:86`
- **Detalle:** `app.use((req, res, next) => {` — revisar a mano; no entró en el cruce automático.
- **Acción propuesta:** Revisión manual.

### AUD-RP022 · INFO · Línea de ruta/mount no interpretable por el auditor

- **Ubicación:** `src/index.js:106`
- **Detalle:** `app.use((req, res, next) => {` — revisar a mano; no entró en el cruce automático.
- **Acción propuesta:** Revisión manual.

### AUD-RP023 · INFO · Línea de ruta/mount no interpretable por el auditor

- **Ubicación:** `src/index.js:123`
- **Detalle:** `app.use('/dist', express.static(path.join(__dirname, "..", "public", "dist"), {` — revisar a mano; no entró en el cruce automático.
- **Acción propuesta:** Revisión manual.
