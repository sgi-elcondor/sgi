# Anexo C · Consistencia de vistas (registro, navegación, permisos, build)

_Generado por `tools/audit/03-views-consistency.js` el 2026-07-30T00:29:23.910Z._

**Resumen:** P0=0 · P1=0 · P2=0 · INFO=1

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-VW001 | INFO | permisos-ui | Permiso de VISTA_API_MAP que ninguna ruta exige: mis_cuotas:leer (vista mis-cuotas) | src/controllers/roles.controller.js |

## Detalle

### AUD-VW001 · INFO · Permiso de VISTA_API_MAP que ninguna ruta exige: mis_cuotas:leer (vista mis-cuotas)

- **Ubicación:** `src/controllers/roles.controller.js`
- **Detalle:** No aparece como requisito de ninguna entrada de ROUTE_PERMISSIONS. Puede existir sólo para gating de UI, o ser un permiso obsoleto. Se confirma contra la tabla `permisos` en el anexo de drift de permisos.
- **Acción propuesta:** Confirmar contra BD; si no existe, eliminarlo del mapa.
