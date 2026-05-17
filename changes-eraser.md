## [TÉCNICO] Refactorización arquitectural: permisos granulares, organización de vistas y capa de servicios

---

## ¿Qué se hizo y por qué?

El sistema tenía tres problemas de fondo que hacían difícil agregar funcionalidades nuevas:

1. **Los permisos eran todo-o-nada**: asignar "Pagos" a un rol le daba automáticamente `leer` + `crear`. No había forma de decir "Gerencia solo puede ver pagos, no registrarlos".
2. **Las vistas checkeaban el nombre del rol** (`if rol === "auxiliar_contable"`), lo que significaba que agregar un rol nuevo o cambiar permisos requería tocar el código de cada vista.
3. **El código de vistas estaba desorganizado**: sin estructura de carpetas, sin patrón consistente, con funciones duplicadas y múltiples entry points por módulo.

---

## Cambios principales

### 1. Sistema de permisos granular

**Antes:** Al asignar la vista `pagos` a un rol, el backend le daba automáticamente todos los permisos de API (`pagos:leer`, `pagos:crear`, etc.).

**Ahora:** La UI de permisos tiene **dos niveles**:
- **Nivel 1 — Módulo (toggle on/off):** controla si la opción aparece en el sidebar
- **Nivel 2 — Acciones (checkboxes):** controla qué puede hacer el rol dentro de ese módulo

```
Finanzas
  ┌─ Pagos  [● activado]
  │    ☑  Ver pagos registrados       (pagos:leer)
  │    ☐  Registrar y aplicar pagos   (pagos:crear)   ← gerencia no tiene esto
  │    ☑  Ver comprobantes            (mis_pagos:leer)
```

El API ahora acepta `{ vistas: ['pagos', 'ventas'], can: ['pagos:leer', 'ventas:leer', 'ventas:actualizar'] }`. El backend es retrocompatible: si solo llega `vistas`, usa el mapa anterior.

### 2. `AppState` — fuente de verdad de permisos en el frontend

Nuevo archivo `public/js/state.js` — objeto global que reemplaza los accesos directos a `window.currentUser`.

```js
// Antes (en cada vista)
if (window.currentUser?.rol === "auxiliar_contable") { ... }

// Ahora (en cada vista)
if (AppState.can("pagos", "crear")) { ... }
```

Métodos disponibles:
- `AppState.can(recurso, accion)` — ¿puede el usuario hacer esta acción?
- `AppState.hasVista(key)` — ¿aparece este módulo en su sidebar?
- `AppState.simulate(vistas, can)` — para el role-switcher del admin
- `AppState.restore(perfil)` — restaurar vista real del admin

El `/auth/perfil` ahora devuelve `can: ["pagos:leer", "ventas:actualizar", ...]` además de `vistas`.

### 3. Organización de vistas por dominio

```
public/js/views/
  dashboard.js                  ← widget registry (ver abajo)
  operacion/
    proyectos.js  lotes.js  compradores.js  ventas.js
  finanzas/
    cuotas.js  pagos.js  comisionistas.js  facturas.js
    recibos.js  gastos.js  transacciones.js  validacion-pagos.js
  control/
    reportes.js  alertas.js  auditoria.js  personal.js
    usuarios.js  permisos.js
  juridico/
    juridico.js
  mi-cuenta/
    mis-cuotas.js   ← compradorCuotasView
    mis-recibos.js  ← compradorRecibosView
```

**Reglas que se aplican ahora en todo el proyecto:**
- Un archivo por módulo, un único entry point `window.{módulo}View`
- Todos los archivos están en IIFE — ninguna función helper es global accidentalmente
- Solo se expone a `window` lo que se llama desde `onclick` HTML
- Ninguna vista chequea `rol === "nombre"` — solo `AppState.can()`

### 4. Patrón de composición por permisos

Las vistas ahora se renderizan condicionalmente según permisos, no según rol:

```js
// proyectos.js — mismo archivo para todos los roles
window.proyectosView = function(container) {
  const canCreate = AppState.can("proyectos", "crear");  // permiso, no rol

  container.innerHTML = `...
    ${canCreate ? '<button onclick="proyectoForm()">+ Nuevo</button>' : ""}
    ...`;
};
```

**Gerencia** ve la tabla sin el botón. **Admin y auxiliar** ven el botón. Sin duplicar código.

Para layouts radicalmente distintos (como el dashboard del comprador), se usan funciones separadas que **comparten sub-componentes**:

```js
window.dashboardView = function(container) {
  // Comprador: layout propio con su venta, cuotas y alertas de pago
  if (AppState.can("mis_cuotas", "leer")) { compradorDashboardView(container); return; }
  // Resto de roles: widget registry
  dashboardView(container);
};
```

### 5. Dashboard con widget registry

El dashboard operativo ya no usa datos mock. Cada widget declara qué permiso necesita:

```js
const WIDGETS = [
  { resource: "dashboard", action: "ver_operacion",  fetch: () => API.get("/reportes/panel"),       render: renderKpiOperacion },
  { resource: "dashboard", action: "ver_cartera",    fetch: () => API.get("/reportes/cartera-hoy"), render: renderKpiCartera },
  { resource: "dashboard", action: "ver_comisiones", fetch: () => API.get("/reportes/comisiones"),  render: renderKpiComisiones },
  { resource: "dashboard", action: "ver_juridico",   fetch: () => API.get("/reportes/alertas"),     render: renderAlertasJuridicas },
];
```

Los widgets se cargan en paralelo con `Promise.allSettled` — si uno falla, el resto sigue visible.

**Para agregar un widget nuevo:**
1. Insertar el permiso `dashboard:ver_nuevo` en `condor.permisos`
2. Asignarlo a los roles que deben verlo en `condor.rol_permiso`
3. Agregar la entrada al array `WIDGETS` en `dashboard.js`

Sin tocar nada más.

### 6. Capa de servicios en backend

La lógica de negocio salió de los controllers a `src/services/`:

| Servicio | Responsabilidad |
|---|---|
| `consecutivos.service.js` | Genera números PAG-YYYYMM-NNNNN y RC-YYYYMM-NNNNN |
| `auditoria.service.js` | `log({ tabla, id, campo, anterior, nuevo, usuario })` |
| `recibos.service.js` | Crea recibo + recibo_pago con recuperación de huérfanos |
| `cuotas.service.js` | `generarPlanDePago`, `marcarPagadaSiCubre`, `limpiarVentaCreada` |

Los controllers ahora solo orquestan: reciben request, llaman servicios, responden.

### 7. Bug fixes

- **401 en CSS/JS estáticos**: el servidor tenía `app.use(verificarToken)` antes del wildcard `*`, interceptando archivos estáticos en ciertos edge cases. Eliminado.
- **`updatePermisos` borraba TODO**: hacía `DELETE WHERE id_rol = X` eliminando también permisos como `dashboard:ver_*` que se asignan directamente. Ahora solo borra los namespaces que gestiona.
- **Recursión infinita en proyectos**: `proyectosReadView` llamaba a `window.proyectosView` que llamaba a `proyectosReadView`. Solucionado capturando la referencia original antes de sobreescribirla.
- **`esAsesor` no definida en ventas**: variable renombrada a `modoSolicitud` pero quedó referencia vieja en el template HTML.
- **Ruta duplicada `/api/uploads`**: registrada dos veces en `index.js`.

---

## Cómo seguimos trabajando

### Agregar un nuevo módulo completo

1. Crear `public/js/views/{dominio}/nuevo-modulo.js` con el patrón:

```js
(() => {
  window.nuevoModuloView = async function(container) {
    const vc        = container || document.getElementById("viewContainer");
    const canCreate = AppState.can("nuevo_modulo", "crear");
    vc.innerHTML    = UI.loader();

    const data = await API.get("/nuevo-modulo").catch(e => {
      vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
      return null;
    });
    if (!data) return;

    vc.innerHTML = `
      <section class="page-shell">
        ${SGIUI.pageHeader({
          title:   "Nuevo Modulo",
          actions: canCreate ? `<button class="btn btn-primary" onclick="nuevoModuloForm()">+ Nuevo</button>` : "",
        })}
        <!-- tabla / contenido -->
      </section>`;

    SGIUI.hydrate();
  };
})();
```

2. Agregar `<script src="/js/views/{dominio}/nuevo-modulo.js"></script>` en `index.html`
3. Agregar al objeto `VIEWS` en `app.js`: `"nuevo-modulo": { fn: "nuevoModuloView", title: "Nuevo Modulo" }`
4. Agregar al `SIDEBAR_GROUPS` en `app.js`
5. Insertar en DB:
```sql
INSERT INTO condor.permisos (recurso, accion) VALUES
  ('vista', 'nuevo-modulo'),
  ('nuevo_modulo', 'leer'),
  ('nuevo_modulo', 'crear');
-- Asignar a roles:
INSERT INTO condor.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM condor.roles r, condor.permisos p
WHERE r.nombre IN ('admin') AND p.recurso IN ('vista','nuevo_modulo');
```
6. Agregar al `PERMISSION_CATALOG` en `control/permisos.js`

### Agregar una nueva acción dentro de un módulo existente

1. Insertar `recurso:accion` en `condor.permisos` y asignar a roles
2. En la vista: `if (AppState.can("recurso", "accion")) { /* mostrar botón/sección */ }`
3. En el backend: agregar la ruta a `src/config/permissions.js`
4. En el controlador: lógica de negocio → va en un servicio en `src/services/`
5. Agregar la acción al `PERMISSION_CATALOG` en `control/permisos.js`

### Agregar un widget al dashboard

1. Insertar `dashboard:ver_nuevo_widget` en `condor.permisos`
2. Asignar a roles en `condor.rol_permiso`
3. En `dashboard.js`, agregar al array `WIDGETS`:
```js
{
  resource: "dashboard",
  action:   "ver_nuevo_widget",
  fetch:    () => API.get("/mi-endpoint"),
  render:   renderMiWidget,
},
```
4. Implementar la función `renderMiWidget(data)` que devuelve HTML

### Reglas a mantener

- **Nunca** chequear `AppState.getUser().rol` en código de vistas — solo `AppState.can()` y `AppState.hasVista()`
- **Nunca** instanciar un cliente Supabase nuevo — siempre importar desde `src/config/supabase.js`
- **Siempre** poner lógica de negocio en `src/services/`, no inline en controllers
- **Siempre** envolver archivos de vista en IIFE y exponer a `window` solo lo necesario para `onclick`
- Al modificar permisos de un rol, usar el panel de **Permisos** del sistema (o SQL directo en DB) — nunca hardcodear en código

---

## Archivos modificados (resumen)

**Backend**
- `src/index.js` — eliminado `app.use(verificarToken)` global, ruta duplicada de uploads
- `src/config/permissions.js` — rutas de dashboard y vistas consolidadas
- `src/controllers/auth.controller.js` — `miPerfil` devuelve `can[]`, `completarPerfil` acepta `tipo` para admin
- `src/controllers/roles.controller.js` — `updatePermisos` granular `{ vistas, can }`, delete selectivo, audit fix
- `src/controllers/pagos.controller.js` — usa servicios
- `src/controllers/ventas.controller.js` — usa servicios
- `src/controllers/comisionistas.controller.js` — usa consecutivos service
- `src/services/consecutivos.service.js` *(nuevo)*
- `src/services/auditoria.service.js` *(nuevo)*
- `src/services/recibos.service.js` *(nuevo)*
- `src/services/cuotas.service.js` *(nuevo)*

**Frontend core**
- `public/js/state.js` *(nuevo)* — AppState
- `public/js/app.js` — eliminado `ALL_VIEW_KEYS`, `SIDEBAR_ALLOWLIST_BY_ROLE`; AppState.init; view keys consolidados; role-switcher simula permisos completos
- `public/index.html` — scripts reorganizados por dominio, state.js agregado

**Vistas** — Todos los archivos en `public/js/views/`
- Reorganizados en `operacion/`, `finanzas/`, `control/`, `juridico/`, `mi-cuenta/`
- Todos envueltos en IIFE
- Patrón de composición por permisos aplicado
- `mi-cuenta.js` → `mis-cuotas.js` + `mis-recibos.js`
- `alertas.js` → `alertas.js` + `auditoria.js` (separados)
- `roles.js` → `permisos.js` con `PERMISSION_CATALOG` de dos niveles

**Base de datos**
- Admin: permisos completados (`bank-transactions`, `payment-validation`, etc.)
- Vistas consolidadas: `pagos-read/upload/edit` → `pagos`, `lotes-read/edit` → `lotes`, `proyectos-read/edit` → `proyectos`
- Permisos de dashboard: `dashboard:ver_operacion/cartera/comisiones/juridico`
- Gerencia: permisos restaurados (`pagos`, `lotes`, `proyectos`, `juridico`, `roles`, `gastos`, `bank-transactions`, `payment-validation`)
