# Anexo E · Modelo de autorización: código vs. base de datos

_Generado por `tools/audit/05-permissions-db-drift.js` el 2026-07-30T00:50:26.452Z._

**Resumen:** P0=0 · P1=0 · P2=8 · INFO=1

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-PD001 | P2 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: uploads:avatar | condor.permisos |
| AUD-PD002 | P2 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: mis_facturas:crear | condor.permisos |
| AUD-PD003 | P2 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:generar | condor.permisos |
| AUD-PD004 | P2 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:leer | condor.permisos |
| AUD-PD005 | P2 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:reenviar | condor.permisos |
| AUD-PD006 | P2 | permiso-muerto | Permiso de visibilidad de una vista que ya no existe: vista:inventario | condor.permisos |
| AUD-PD007 | P2 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: inventario:leer | condor.permisos |
| AUD-PD008 | P2 | permiso-muerto | Permiso que ninguna ruta exige y ninguna vista otorga: requerimientos:entregar | condor.permisos |
| AUD-PD009 | INFO | rol-inexistente | Nombre de rol usado en código que no existe en condor.roles: auditoria | src/controllers/requerimientos.controller.js:1740 |

## Detalle

### AUD-PD001 · P2 · Permiso que ninguna ruta exige y ninguna vista otorga: uploads:avatar

- **Ubicación:** `condor.permisos`
- **Detalle:** No aparece en ROUTE_PERMISSIONS ni en VISTA_API_MAP. Otorgado a: juridico, comisionista, asesor_comercial, auxiliar_contable (concesiones sin efecto).
- **Acción propuesta:** Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones.

### AUD-PD002 · P2 · Permiso que ninguna ruta exige y ninguna vista otorga: mis_facturas:crear

- **Ubicación:** `condor.permisos`
- **Detalle:** No aparece en ROUTE_PERMISSIONS ni en VISTA_API_MAP. Otorgado a: comprador (concesiones sin efecto).
- **Acción propuesta:** Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones.

### AUD-PD003 · P2 · Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:generar

- **Ubicación:** `condor.permisos`
- **Detalle:** No aparece en ROUTE_PERMISSIONS ni en VISTA_API_MAP. Otorgado a: juridico (concesiones sin efecto).
- **Acción propuesta:** Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones.

### AUD-PD004 · P2 · Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:leer

- **Ubicación:** `condor.permisos`
- **Detalle:** No aparece en ROUTE_PERMISSIONS ni en VISTA_API_MAP. Otorgado a: juridico (concesiones sin efecto).
- **Acción propuesta:** Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones.

### AUD-PD005 · P2 · Permiso que ninguna ruta exige y ninguna vista otorga: notificaciones_jur:reenviar

- **Ubicación:** `condor.permisos`
- **Detalle:** No aparece en ROUTE_PERMISSIONS ni en VISTA_API_MAP. Otorgado a: juridico (concesiones sin efecto).
- **Acción propuesta:** Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones.

### AUD-PD006 · P2 · Permiso de visibilidad de una vista que ya no existe: vista:inventario

- **Ubicación:** `condor.permisos`
- **Detalle:** `inventario` no está registrada en VIEWS (public/js/app.js). Sigue otorgado a: admin, jefe_area, almacenista, gerencia.
- **Acción propuesta:** Eliminar el permiso y sus concesiones, o registrar la vista si debía existir.

### AUD-PD007 · P2 · Permiso que ninguna ruta exige y ninguna vista otorga: inventario:leer

- **Ubicación:** `condor.permisos`
- **Detalle:** No aparece en ROUTE_PERMISSIONS ni en VISTA_API_MAP. Otorgado a: gerencia, admin, jefe_area, almacenista (concesiones sin efecto).
- **Acción propuesta:** Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones.

### AUD-PD008 · P2 · Permiso que ninguna ruta exige y ninguna vista otorga: requerimientos:entregar

- **Ubicación:** `condor.permisos`
- **Detalle:** No aparece en ROUTE_PERMISSIONS ni en VISTA_API_MAP. Otorgado a: almacenista (concesiones sin efecto).
- **Acción propuesta:** Confirmar si se valida dentro de algún controller; si no, eliminar el permiso y sus concesiones.

### AUD-PD009 · INFO · Nombre de rol usado en código que no existe en condor.roles: auditoria

- **Ubicación:** `src/controllers/requerimientos.controller.js:1740`
- **Detalle:** Roles reales en BD: admin, almacenista, asesor_comercial, auxiliar_contable, comisionista, comprador, dueno, gerencia, jefe_area, juridico, peticionario, tesorero, topografo, usuario. Si se usa en un fan-out de notificaciones, el envío no alcanza a nadie y el fallo es silencioso (RN-28 es best-effort).
- **Aceptado tras verificación** (severidad original P1): DECISIÓN DE ENTREGA (2026-07-29): no se crea el rol. Impacto verificado = nulo: sólo aparece en role-promotion.service.js:15 (lista de roles protegidos, guarda defensiva inofensiva) y en la trazabilidad INV-04 de requerimientos.controller.js, que ya admite admin/gerencia/dueno. La supervisión está cubierta: auditoria_log:leer lo tienen admin, dueno, gerencia y auxiliar_contable. Se corrigió CLAUDE.md, que lo listaba como rol existente.
- **Acción propuesta:** Corregir el literal o crear el rol.
