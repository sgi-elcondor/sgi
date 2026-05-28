# CLAUDE.md — SGI El Cóndor

> Project context for Claude Code. Read this file before any task.

Antes de empezar a hacer cualquier cosa dime brevemente que vas a hacer y esperame a aceptarlo para que continues.

En Supabase el schema en el que trabajamos es `condor`. Siempre usar `.schema('condor')` en todas las consultas del backend.

Antes de hacer algún cambio, si crees que hay una forma mejor de hacerlo, sugieremela.

Al crear estilos CSS usa medidas `rem` en lugar de `px`. Excepciones aceptadas: bordes (`border: 1px`), sombras, y valores que por naturaleza requieren píxeles.

El rol `admin` debe tener permiso a todas las funcionalidades y vistas.

---

## ¿Cómo escribir código?

Siempre en inglés. Si una clase, atributo, variable o nombre de objeto no está en inglés, busca todos los archivos implicados y pásalo a inglés.

No agregues comentarios a menos que sea estrictamente necesario para entender la lógica de lo que viene a continuación. Los comentarios también van en inglés.

---

## ¿Qué es este proyecto?

**SGI El Cóndor** es una plataforma web para la empresa inmobiliaria **El Cóndor S.A.S.**
Digitaliza y centraliza: ventas de lotes, cuotas, pagos, facturación, recibos, comisiones y reportes ejecutivos.

---

## Stack Tecnológico

| Capa           | Tecnología                      |
| -------------- | ------------------------------- |
| Backend        | Node.js + Express               |
| Base de datos  | Supabase (PostgreSQL)           |
| Autenticación  | Firebase Auth + middleware JWT  |
| Almacenamiento | Cloudinary (fotos de perfil y bauchers de pago) |
| Frontend       | HTML / CSS / JavaScript vanilla |
| Config BD      | `src/config/supabase.js`        |
| Config Auth    | `src/config/firebase.js`        |
| Config Storage | `src/config/cloudinary.js`      |
| Permisos       | `src/config/permissions.js`     |

---

## Arquitectura General

```
src/index.js          ← Entry point del servidor Express
src/config/           ← Clientes de servicios externos
src/middlewares/      ← auth + permisos (se aplican globalmente en index.js)
src/controllers/      ← Lógica de negocio por módulo (uno por entidad)
src/routes/           ← Mapeo de URLs a controllers
src/services/         ← Lógica compartida entre controllers

public/index.html        ← SPA principal (única página)
public/login.html        ← Página de login separada
public/js/app.js         ← Router del frontend (hash-based navigation, VIEWS, tema, helpers)
public/js/api.js         ← Cliente HTTP centralizado (objeto global `API`)
public/js/auth.js        ← Lógica de autenticación Firebase
public/js/state.js       ← Estado global del usuario (vistas, permisos)
public/js/ui.js          ← Utilidades de UI compartidas
public/js/helpers.js     ← Helpers financieros globales (SGIHelpers, _fmtMiles, _parseMiles, _onMoneyInput)
public/js/components/    ← Componentes de UI montables (sidebar, user-menu, onboarding, role-switcher, money-input, avatar-cropper)
public/js/views/         ← Módulos de vista por dominio
public/css/              ← Estilos organizados por capas

tests/                ← Pruebas automatizadas con Jest
seeds/                ← Scripts de seed de datos para desarrollo (ejecutar con node seeds/seed.js)
```

---

## Flujo de una Solicitud HTTP

```
Request
  └── ¿Es /api/v1/auth? → sin autenticación → auth.routes.js
  └── ¿Es /api/v1/*?    → verificarToken → verificarPermiso → route específica
  └── Cualquier otra → sirve public/index.html (SPA wildcard)
```

---

## Patrones de Código — Backend

### Controllers

- Reciben `(req, res)`, llaman al cliente Supabase, responden con `res.status().json()`
- **Siempre** declarar `const SCHEMA = 'condor'` al inicio y usarlo en cada consulta
- Manejar errores con `try/catch`
- Validar datos de negocio antes de tocar la base de datos
- En operaciones que involucren múltiples inserciones, usar rollback manual si algo falla
- Archivo de referencia: `src/controllers/ventas.controller.js`

```js
const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

async function getAll(req, res) {
  try {
    const { data, error } = await supabase.schema(SCHEMA).from('tabla').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
```

### Routes

- Siguen REST estricto: `GET / POST / PUT / PATCH / DELETE`
- Aplican middlewares: primero `auth.middleware`, luego `permisos.middleware` (ya están aplicados globalmente en `index.js` para todas las rutas `/api/v1`)
- Rutas específicas antes que las paramétricas (`/mis-ventas` antes que `/:id`)
- Archivo de referencia: `src/routes/ventas.routes.js`

```js
router.get('/estado-financiero', ctrl.getEstadoFinanciero); // específica primero
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);                           // paramétrica al final
```

### Permissions

- Cada nueva ruta debe registrarse en `src/config/permissions.js`
- Formato: `'METHOD /api/v1/ruta': { recurso: 'nombre', accion: 'leer|crear|editar|eliminar' }`
- El rol `admin` tiene bypass total; los demás roles necesitan entrada explícita

### Services

Usar los servicios existentes en lugar de replicar lógica:

| Servicio                          | Cuándo usarlo                                              |
| --------------------------------- | ---------------------------------------------------------- |
| `auditoria.service.js` → `log()` | En cualquier operación de pago, cambio de estado o devolución |
| `cuotas.service.js` → `generarPlanDePago()` | Al crear una venta nueva                       |
| `cuotas.service.js` → `limpiarVentaCreada()` | En el catch de la creación de venta (rollback) |
| `consecutivos.service.js` → `nextPago()` | Al registrar un pago nuevo                       |
| `recibos.service.js` → `crearParaPago()` | Al emitir un recibo asociado a un pago           |
| `mora.service.js` → `actualizarMora()` | Marca ventas `en_mora` si tienen cuotas vencidas >90 días; revierte si se ponen al día |
| `comisiones.service.js` → `verificarComision()` | Después de registrar un pago: marca comisión como `causada` si se alcanzó el 30% del valor total |

### Consecutivos

Los números de documentos siguen el patrón `PREFIJO-YYYYMM-00001`:
- Pagos: `PAG-202506-00001`
- Recibos: `RC-202506-00001`
- Micropagos: `MCOM-202506-00001`

Siempre generarlos desde `consecutivos.service.js`, nunca calcularlos manualmente.

---

## Patrones de Código — Frontend

### Navegación (SPA)

El frontend es una SPA de una sola página (`public/index.html`). La navegación es hash-based:
- `window.location.hash = '#ventas'` → carga la vista de ventas
- Usar `navigate('nombre-vista')` para cambiar de vista desde código
- Cada vista debe registrarse en el objeto `VIEWS` en `public/js/app.js`

### API Client

Usar **siempre** el objeto global `API` para llamadas al backend. La única excepción son los uploads de archivos (multipart/form-data), que usan `fetch()` directo porque `API` solo maneja JSON.

```js
// Correcto — llamadas JSON
const data = await API.get('/ventas');
await API.post('/pagos', { id_cuota, valor });
await API.patch('/ventas/123/financiero', { estado });

// Correcto — upload de archivo (única excepción válida para fetch directo)
const res = await fetch('/api/v1/uploads/baucher', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

// Incorrecto — fetch directo para llamadas JSON
fetch('/api/v1/ventas', { headers: { Authorization: ... } });
```

`API` maneja automáticamente: token JWT, refresco de token en 401, y redirección a login.

### Globals expuestos por app.js

`app.js` expone las siguientes funciones al scope global al final del módulo, para que los archivos de script regulares puedan usarlas:

```js
window.navigate     = navigate;
window.applyTheme   = applyTheme;
window.humanizeRole = humanizeRole;
window.setActiveNav = setActiveNav;
window.setViewTitle = setViewTitle;
```

`helpers.js` expone utilidades de formato financiero usadas en múltiples vistas:

```js
window.SGIHelpers      // { fmtMiles, parseMiles, applyMoneyInput, smartConvert }
window._fmtMiles       // alias de compatibilidad (ventas.js)
window._parseMiles     // alias de compatibilidad (ventas.js)
window._onMoneyInput   // alias de compatibilidad (ventas.js)
```

`smartConvert` acepta shorthands: `0.30` → 30% del valor referencia; `5` → 5 millones; número con separadores de miles → sin conversión.

### Estado Global

- `window.currentUser` → perfil del usuario autenticado (email, rol, vistas, id_comprador, etc.)
- `AppState` → gestiona las vistas y permisos del usuario en el frontend
- `AppState.hasVista('nombre-vista')` → verifica si el usuario tiene acceso a una vista

### Vistas

Cada módulo tiene su vista en `public/js/views/`. Al crear un módulo nuevo:
1. Crear el archivo en la subcarpeta correspondiente (`operacion/`, `finanzas/`, `control/`, `juridico/`, `mi-cuenta/`)
2. Registrar la función en el objeto `VIEWS` de `app.js`
3. Agregar el ítem al grupo correcto de `SIDEBAR_GROUPS` en `sidebar.js`
4. Agregar el subtítulo en `TOPBAR_SUBTITLES` en `app.js`

---

## CSS — Arquitectura de Estilos

```
public/css/
├── base/
│   ├── tokens.css      ← Variables CSS (colores, espaciados, tipografía, tema claro/oscuro)
│   ├── reset.css       ← Reset de estilos del navegador
│   └── global.css      ← Estilos base del documento
├── components/         ← Componentes reutilizables (botones, modales, tablas, badges, etc.)
├── layout/             ← Estructura principal (sidebar, topbar, containers)
├── views/              ← Estilos específicos de cada vista
└── responsive.css      ← Media queries globales — siempre cargado último en index.html
```

- Los colores y medidas globales se definen en `tokens.css` como variables CSS (`--color-primary`, `--spacing-md`, etc.)
- Los estilos de componentes nuevos van en `components/`, los específicos de vista en `views/`
- El sistema de tema (claro/oscuro/sistema) se maneja con el atributo `data-theme` en el `<html>`
- `responsive.css` se carga directamente en `index.html` después de `style.css` para garantizar que siempre sobreescribe al resto

---

## Pruebas Automatizadas

El proyecto usa **Jest** para pruebas unitarias de los servicios del backend. Los tests están en la carpeta `tests/` en la raíz del proyecto.

```
tests/
├── cuotas.service.test.js       ← sumarMeses, generarPlanDePago, marcarPagadaSiCubre, limpiarVentaCreada
├── consecutivos.service.test.js ← next, nextPago, nextMicropago
└── recibos.service.test.js      ← crearParaPago (idempotencia, consecutivo, recibo huérfano)
```

Para correr los tests: `npm test`

Al agregar un service nuevo, agregar también su archivo de test correspondiente en `tests/`.

---

## Convenciones Generales

- Nombres de archivos backend: `modulo.tipo.js` en snake_case (ej: `ventas.controller.js`)
- Tablas en Supabase: snake_case, plural (ej: `lotes`, `ventas`, `cuotas`)
- Variables y funciones: camelCase
- Clases CSS: kebab-case
- Siempre validar rol antes de operaciones de escritura
- Auditoría obligatoria en: pagos, cambios de estado, devoluciones

---

## Roles del Sistema

| Rol                   | Permisos principales                            |
| --------------------- | ----------------------------------------------- |
| `comprador`           | Consulta sus cuotas, pagos y recibos            |
| `asesor`              | Crea ventas pendientes de autorización          |
| `auxiliar_contable`   | Operaciones completas: ventas, pagos, facturas  |
| `gerencia`            | Solo lectura en reportes globales               |
| `juridico`            | Consulta ventas en mora o devolución            |
| `comisionista`        | Visualiza sus comisiones                        |
| `admin`               | Acceso total a todas las funcionalidades        |
| `auditoria`           | Supervisa trazabilidad de cambios críticos      |

> Los permisos están centralizados en `src/config/permissions.js`

---

## Base de Datos (Supabase / PostgreSQL)

- Schema: `condor`
- Conexión centralizada en `src/config/supabase.js`
- **Nunca** instanciar un nuevo cliente Supabase; siempre importar desde ese archivo
- Preferir operaciones atómicas para pagos y actualizaciones de estado
- Para migraciones o cambios de esquema, describir el cambio primero y esperar confirmación
- Tablas de relación: `venta_comprador`, `venta_comisionista`, `recibo_pago`, `rol_permiso`

---

## Flujo de Git del Equipo

```
main ← solo al cerrar Sprint (PR revisado por todo el equipo)
  └── develop ← integración continua del equipo
        ├── feature/nombre-historia      ← historia de usuario
        ├── feature/descripcion-tecnica  ← cambio técnico
        └── hotfix/descripcion-corta     ← fix rápido
```

Los commits deben seguir los tipos convencionales: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `style:`

---

## Instrucciones para Claude Code

1. **Antes de generar código**, revisar el controller y route del módulo relacionado para mantener el patrón existente.
2. **Para cambios en BD**, describir el ALTER TABLE o nueva tabla antes de ejecutar.
3. **Nunca instanciar** un nuevo cliente Supabase; siempre importar desde `src/config/supabase.js`.
4. **Siempre usar** `const SCHEMA = 'condor'` al inicio de cada controller y `.schema(SCHEMA)` en cada consulta.
5. **Respetar los roles** al agregar endpoints: registrar la ruta en `permissions.js` con el prefijo `/api/v1/`.
6. **Auditoría obligatoria** en operaciones: pagos, cambios de estado, devoluciones (usar `auditoria.service.js`).
7. **Al crear un módulo nuevo**, seguir la estructura completa: `controller` + `route` + registrar en `permissions.js` + vista frontend + entrada en `VIEWS` y `TOPBAR_SUBTITLES` de `app.js` + entrada en `SIDEBAR_GROUPS` de `sidebar.js`.
8. **Rutas específicas siempre antes que paramétricas** en los routers.
9. **Usar los services** existentes en lugar de replicar lógica de consecutivos, cuotas o recibos.
10. **Al agregar un service nuevo**, crear también su archivo de test en `tests/`.
11. Los commits sugeridos deben seguir los tipos convencionales definidos.
