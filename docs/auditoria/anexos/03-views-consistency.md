# Anexo C · Consistencia de vistas (registro, navegación, permisos, build)

_Generado por `tools/audit/03-views-consistency.js` el 2026-07-30T01:54:41.718Z._

**Resumen:** P0=0 · P1=0 · P2=0 · INFO=6

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-VW001 | INFO | permisos-ui | Permiso de VISTA_API_MAP que ninguna ruta exige: mi_cuenta:leer (vista dashboard) | src/controllers/roles.controller.js |
| AUD-VW002 | INFO | permisos-ui | Permiso de VISTA_API_MAP que ninguna ruta exige: ventas:actualizar (vista ventas) | src/controllers/roles.controller.js |
| AUD-VW003 | INFO | permisos-ui | Permiso de VISTA_API_MAP que ninguna ruta exige: cuotas:actualizar (vista cuotas) | src/controllers/roles.controller.js |
| AUD-VW004 | INFO | permisos-ui | Permiso de VISTA_API_MAP que ninguna ruta exige: facturas:actualizar (vista facturas) | src/controllers/roles.controller.js |
| AUD-VW005 | INFO | permisos-ui | Permiso de VISTA_API_MAP que ninguna ruta exige: reportes_dir:leer (vista reportes) | src/controllers/roles.controller.js |
| AUD-VW006 | INFO | permisos-ui | Permiso de VISTA_API_MAP que ninguna ruta exige: mis_cuotas:leer (vista mis-cuotas) | src/controllers/roles.controller.js |

## Detalle

### AUD-VW001 · INFO · Permiso de VISTA_API_MAP que ninguna ruta exige: mi_cuenta:leer (vista dashboard)

- **Ubicación:** `src/controllers/roles.controller.js`
- **Detalle:** No aparece como requisito de ninguna entrada de ROUTE_PERMISSIONS. Puede existir sólo para gating de UI, o ser un permiso obsoleto. Se confirma contra la tabla `permisos` en el anexo de drift de permisos.
- **Acción propuesta:** Confirmar contra BD; si no existe, eliminarlo del mapa.

### AUD-VW002 · INFO · Permiso de VISTA_API_MAP que ninguna ruta exige: ventas:actualizar (vista ventas)

- **Ubicación:** `src/controllers/roles.controller.js`
- **Detalle:** No aparece como requisito de ninguna entrada de ROUTE_PERMISSIONS. Puede existir sólo para gating de UI, o ser un permiso obsoleto. Se confirma contra la tabla `permisos` en el anexo de drift de permisos.
- **Acción propuesta:** Confirmar contra BD; si no existe, eliminarlo del mapa.

### AUD-VW003 · INFO · Permiso de VISTA_API_MAP que ninguna ruta exige: cuotas:actualizar (vista cuotas)

- **Ubicación:** `src/controllers/roles.controller.js`
- **Detalle:** No aparece como requisito de ninguna entrada de ROUTE_PERMISSIONS. Puede existir sólo para gating de UI, o ser un permiso obsoleto. Se confirma contra la tabla `permisos` en el anexo de drift de permisos.
- **Acción propuesta:** Confirmar contra BD; si no existe, eliminarlo del mapa.

### AUD-VW004 · INFO · Permiso de VISTA_API_MAP que ninguna ruta exige: facturas:actualizar (vista facturas)

- **Ubicación:** `src/controllers/roles.controller.js`
- **Detalle:** No aparece como requisito de ninguna entrada de ROUTE_PERMISSIONS. Puede existir sólo para gating de UI, o ser un permiso obsoleto. Se confirma contra la tabla `permisos` en el anexo de drift de permisos.
- **Acción propuesta:** Confirmar contra BD; si no existe, eliminarlo del mapa.

### AUD-VW005 · INFO · Permiso de VISTA_API_MAP que ninguna ruta exige: reportes_dir:leer (vista reportes)

- **Ubicación:** `src/controllers/roles.controller.js`
- **Detalle:** No aparece como requisito de ninguna entrada de ROUTE_PERMISSIONS. Puede existir sólo para gating de UI, o ser un permiso obsoleto. Se confirma contra la tabla `permisos` en el anexo de drift de permisos.
- **Acción propuesta:** Confirmar contra BD; si no existe, eliminarlo del mapa.

### AUD-VW006 · INFO · Permiso de VISTA_API_MAP que ninguna ruta exige: mis_cuotas:leer (vista mis-cuotas)

- **Ubicación:** `src/controllers/roles.controller.js`
- **Detalle:** No aparece como requisito de ninguna entrada de ROUTE_PERMISSIONS. Puede existir sólo para gating de UI, o ser un permiso obsoleto. Se confirma contra la tabla `permisos` en el anexo de drift de permisos.
- **Acción propuesta:** Confirmar contra BD; si no existe, eliminarlo del mapa.
