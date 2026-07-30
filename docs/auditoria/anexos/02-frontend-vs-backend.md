# Anexo B · Endpoints consumidos por la SPA vs. rutas montadas

_Generado por `tools/audit/02-frontend-vs-backend.js` el 2026-07-30T01:54:41.689Z._

**Resumen:** P0=0 · P1=0 · P2=18 · INFO=2

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-FB001 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/auth/usuarios | src/routes/auth.routes.js:26 |
| AUD-FB002 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/proyectos/:id | src/routes/proyectos.routes.js:4 |
| AUD-FB003 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/compradores/:id | src/routes/compradores.routes.js:6 |
| AUD-FB004 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/ventas/reportes/financiero | src/routes/ventas.routes.js:5 |
| AUD-FB005 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: PATCH /api/v1/ventas/:id/financiero | src/routes/ventas.routes.js:12 |
| AUD-FB006 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/cuotas/venta/:idVenta | src/routes/cuotas.routes.js:6 |
| AUD-FB007 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/cuotas | src/routes/cuotas.routes.js:13 |
| AUD-FB008 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: PATCH /api/v1/cuotas/:id/valores | src/routes/cuotas.routes.js:14 |
| AUD-FB009 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/pagos/mis-pagos/:id | src/routes/pagos.routes.js:5 |
| AUD-FB010 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/pagos/:id | src/routes/pagos.routes.js:15 |
| AUD-FB011 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/facturas/generar-pendientes | src/routes/facturas.routes.js:6 |
| AUD-FB012 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/reportes/juridico | src/routes/reportes.routes.js:10 |
| AUD-FB013 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/reportes/mora-sync | src/routes/reportes.routes.js:13 |
| AUD-FB014 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/roles/:id/permisos | src/routes/roles.routes.js:5 |
| AUD-FB015 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: POST /api/v1/uploads/lote-foto | src/routes/uploads.routes.js:20 |
| AUD-FB016 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/gastos/resumen | src/routes/gastos.routes.js:4 |
| AUD-FB017 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/requerimientos/stream | src/routes/requerimientos.routes.js:5 |
| AUD-FB018 | P2 | endpoint-sin-consumidor | Endpoint que la SPA nunca llama: GET /api/v1/config | src/routes/config.routes.js:4 |
| AUD-FB019 | INFO | cobertura-auditoria | Llamada a la API construida dinámicamente (no verificable estáticamente) | public/js/views/finanzas/pagos.js:321 |
| AUD-FB020 | INFO | cobertura-auditoria | Llamada a la API construida dinámicamente (no verificable estáticamente) | public/js/views/finanzas/pagos.js:491 |

## Detalle

### AUD-FB001 · P2 · Endpoint que la SPA nunca llama: POST /api/v1/auth/usuarios

- **Ubicación:** `src/routes/auth.routes.js:26`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB002 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/proyectos/:id

- **Ubicación:** `src/routes/proyectos.routes.js:4`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB003 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/compradores/:id

- **Ubicación:** `src/routes/compradores.routes.js:6`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB004 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/ventas/reportes/financiero

- **Ubicación:** `src/routes/ventas.routes.js:5`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB005 · P2 · Endpoint que la SPA nunca llama: PATCH /api/v1/ventas/:id/financiero

- **Ubicación:** `src/routes/ventas.routes.js:12`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB006 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/cuotas/venta/:idVenta

- **Ubicación:** `src/routes/cuotas.routes.js:6`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB007 · P2 · Endpoint que la SPA nunca llama: POST /api/v1/cuotas

- **Ubicación:** `src/routes/cuotas.routes.js:13`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB008 · P2 · Endpoint que la SPA nunca llama: PATCH /api/v1/cuotas/:id/valores

- **Ubicación:** `src/routes/cuotas.routes.js:14`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB009 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/pagos/mis-pagos/:id

- **Ubicación:** `src/routes/pagos.routes.js:5`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB010 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/pagos/:id

- **Ubicación:** `src/routes/pagos.routes.js:15`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB011 · P2 · Endpoint que la SPA nunca llama: POST /api/v1/facturas/generar-pendientes

- **Ubicación:** `src/routes/facturas.routes.js:6`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB012 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/reportes/juridico

- **Ubicación:** `src/routes/reportes.routes.js:10`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB013 · P2 · Endpoint que la SPA nunca llama: POST /api/v1/reportes/mora-sync

- **Ubicación:** `src/routes/reportes.routes.js:13`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB014 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/roles/:id/permisos

- **Ubicación:** `src/routes/roles.routes.js:5`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB015 · P2 · Endpoint que la SPA nunca llama: POST /api/v1/uploads/lote-foto

- **Ubicación:** `src/routes/uploads.routes.js:20`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB016 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/gastos/resumen

- **Ubicación:** `src/routes/gastos.routes.js:4`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB017 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/requerimientos/stream

- **Ubicación:** `src/routes/requerimientos.routes.js:5`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB018 · P2 · Endpoint que la SPA nunca llama: GET /api/v1/config

- **Ubicación:** `src/routes/config.routes.js:4`
- **Detalle:** No se encontró ninguna llamada estática desde public/js. Puede ser superficie muerta, consumida dinámicamente, o de uso externo/manual.
- **Acción propuesta:** Confirmar si algún consumidor externo lo usa; si no, eliminar la ruta, su handler y su entrada de permisos.

### AUD-FB019 · INFO · Llamada a la API construida dinámicamente (no verificable estáticamente)

- **Ubicación:** `public/js/views/finanzas/pagos.js:321`
- **Detalle:** `try { p = await API.get(endpoint); }`
- **Acción propuesta:** Revisión manual del endpoint destino.

### AUD-FB020 · INFO · Llamada a la API construida dinámicamente (no verificable estáticamente)

- **Ubicación:** `public/js/views/finanzas/pagos.js:491`
- **Detalle:** `try { p = await API.get(endpoint); }`
- **Acción propuesta:** Revisión manual del endpoint destino.
