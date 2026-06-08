# Documentación del Proyecto — SGI El Cóndor

**SGI El Cóndor** es una plataforma web para la empresa inmobiliaria El Cóndor S.A.S. que centraliza y digitaliza todo el proceso comercial: desde la venta de lotes hasta el seguimiento de cuotas, pagos, recibos, comisiones y reportes ejecutivos.

---

## Arquitectura General

El proyecto sigue una arquitectura cliente-servidor clásica:

- **Backend**: Un servidor Node.js con Express que expone una API REST versionada (`/api/v1/`). Maneja la lógica de negocio, la autenticación y la comunicación con la base de datos.
- **Frontend**: Una Single Page Application (SPA) construida en HTML, CSS y JavaScript puro, sin frameworks. Toda la aplicación vive en una sola página (`index.html`) y navega entre vistas usando el hash de la URL (`#ventas`, `#pagos`, etc.).
- **Base de datos**: Supabase (PostgreSQL en la nube), usando el schema `condor` para todas las tablas del sistema.
- **Autenticación**: Firebase Auth maneja el login del usuario. El backend verifica los tokens JWT que Firebase emite.
- **Almacenamiento de archivos**: Cloudinary almacena las fotos de perfil de los usuarios.

---

## Archivos Raíz

| Archivo            | Qué hace                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| `package.json`     | Declara las dependencias del proyecto y los scripts de arranque (`npm run dev`, `npm start`, `npm test`) |
| `nodemon.json`     | Configuración del servidor en modo desarrollo (recarga automática)       |
| `.env`             | Variables de entorno con credenciales de Supabase, Firebase y Cloudinary. Nunca se sube al repositorio |
| `.gitignore`       | Archivos y carpetas excluidos del repositorio (node_modules, .env, etc.) |
| `CLAUDE.md`        | Instrucciones y contexto del proyecto para Claude Code                   |
| `documentacion.md` | Este archivo — documentación general del proyecto                        |
| `requerimientos.md`| Historias de usuario y requerimientos funcionales del sistema            |
| `git-workflow.md`  | Guía del flujo de trabajo con Git para el equipo                         |

---

## Backend — `/src`

### Punto de entrada: `src/index.js`

Es el archivo que arranca el servidor. Define el orden en que se aplican los middlewares y registra todas las rutas de la API bajo el prefijo `/api/v1/`.

Lo más importante de entender aquí:
- Las rutas que empiezan con `/api/v1/auth` y `/api/v1/firebase-config` son **públicas**: no requieren que el usuario esté autenticado.
- El resto de rutas `/api/v1/*` pasan primero por dos filtros obligatorios: verificación del token de sesión (`verificarToken`) y luego validación de permisos (`verificarPermiso`).
- Si la URL no coincide con ninguna ruta de la API, el servidor devuelve `index.html` — así funciona la SPA.

---

### Configuración: `src/config/`

#### `supabase.js`
Crea y exporta el cliente de Supabase que usa toda la aplicación. Lee las credenciales del archivo `.env`. Es el único lugar donde se instancia el cliente — todos los demás archivos lo importan desde aquí.

#### `firebase.js`
Inicializa Firebase Admin SDK con las credenciales del servidor. Se usa en el middleware de autenticación para verificar los tokens que envía el navegador.

#### `cloudinary.js`
Configura la conexión con Cloudinary para subir y gestionar las fotos de perfil de los usuarios.

#### `permissions.js`
Es uno de los archivos más importantes del sistema. Contiene un mapa que define qué permiso se necesita para acceder a cada ruta de la API. Cada entrada relaciona un método HTTP + una ruta con un recurso y una acción. Por ejemplo: `POST /api/v1/ventas` requiere el permiso `ventas:crear`.

Cuando se agrega una ruta nueva, **siempre** hay que registrarla aquí con el prefijo `/api/v1/`.

---

### Middlewares: `src/middlewares/`

#### `auth.middleware.js`
Se ejecuta en cada solicitud protegida antes de llegar al controller. Su trabajo es:
1. Leer el token JWT del header `Authorization`
2. Verificarlo con Firebase Admin
3. Buscar al usuario en la base de datos (o crearlo si es la primera vez que inicia sesión)
4. Cargar el rol y los permisos del usuario
5. Agregar toda esa información al objeto `req.usuario` para que los controllers la usen

Si el token es inválido o el usuario está inactivo, responde con `401 Unauthorized` y la solicitud no llega al controller.

#### `permisos.middleware.js`
Se ejecuta justo después de `auth.middleware`. Revisa si el usuario tiene el permiso necesario para la ruta que está intentando acceder, consultando el mapa de `permissions.js`. Usa `req.originalUrl` para comparar contra las claves del mapa.

El rol `admin` tiene acceso total y no necesita tener permisos explícitos — pasa siempre.

---

### Controllers: `src/controllers/`

Cada controller maneja la lógica de negocio de un módulo. Reciben la solicitud HTTP, validan los datos, consultan la base de datos y devuelven la respuesta. A continuación se describe el propósito de cada uno:

#### `auth.controller.js`
Gestiona todo lo relacionado con sesiones y perfiles de usuario:
- Obtener y actualizar el perfil del usuario autenticado
- Completar el perfil al primer inicio de sesión (onboarding para compradores y comisionistas)
- Exponer la configuración de Firebase al frontend vía `/api/v1/firebase-config`

#### `usuarios.controller.js`
Administración de usuarios por parte del equipo interno:
- Listar, crear, editar y desactivar usuarios
- Asignar roles
- Gestión del personal activo en el sistema

#### `roles.controller.js`
Gestión del sistema de roles y permisos:
- Listar todos los roles existentes
- Consultar qué vistas y acciones tiene habilitadas un rol
- Actualizar los permisos de un rol

#### `proyectos.controller.js`
Gestión de los proyectos inmobiliarios (urbanizaciones, conjuntos):
- Crear, editar y listar proyectos
- Cada lote pertenece a un proyecto

#### `lotes.controller.js`
Gestión del inventario de lotes:
- Crear, editar y consultar lotes
- Cambiar el estado de un lote (disponible, vendido, entregado)
- Un lote pertenece a un proyecto y puede tener una venta asociada

#### `compradores.controller.js`
Gestión de las personas que compran lotes:
- Crear y editar perfiles de compradores
- Listar compradores con sus ventas activas
- Un comprador puede estar en varias ventas (con distintos porcentajes de participación)

#### `ventas.controller.js`
Es el controller más complejo del sistema. Maneja el proceso comercial completo:
- Crear una venta nueva con su plan de pago automático (cuotas iniciales + cuotas regulares)
- Asociar compradores y comisionistas a una venta
- Actualizar datos financieros de una venta con auditoría
- Consultar el estado financiero consolidado de todas las ventas
- Crear solicitudes de venta (para asesores que necesitan aprobación)

#### `cuotas.controller.js`
Gestión de las cuotas del plan de pago:
- Listar cuotas por venta
- Consultar cuotas vencidas o próximas a vencer
- Las cuotas se generan automáticamente al crear una venta (via `cuotas.service.js`)

#### `pagos.controller.js`
Registro, validación y consulta de pagos. Según el manual de reglas (v2.0), **todo pago nace en estado `En Revisión`**, sin importar si lo registra el comprador o el auxiliar; ninguno nace aceptado:
- Registrar un pago contra una cuota que ya tiene una factura activa (RN-01)
- Consultar el historial de pagos de una venta
- Contrastar pagos con transacciones bancarias y aceptarlos o rechazarlos por lotes
- El recibo y la aplicación del pago a la cuota ocurren **solo al aceptar** el pago (RN-02/RN-07)

#### `facturas.controller.js`
Emisión y consulta de facturas. **Solo el auxiliar contable emite facturas** (RN-06); el comprador nunca:
- Emitir la única factura activa de una cuota o fracción, por su saldo real (RN-03/RN-10)
- Emisión proactiva de facturas vencidas y próximas a vencer
- Gestionar las **solicitudes de pago** del comprador (intención de pagar una cuota futura): el comprador las crea y el auxiliar las atiende emitiendo la factura
- Anular una factura emitida con motivo documentado (RN-18/RN-20)

#### `recibos.controller.js`
Consulta de recibos de pago. El recibo es el único documento con poder liberatorio:
- Listar recibos emitidos — la misma fuente para el auxiliar y el comprador (RN-19)
- Los recibos se crean **automáticamente al aceptar un pago** (via `recibos.service.js`), con numeración única `RC-YYYYMM-NNNNN` (RN-02/RN-21). No existen recibos provisionales ni con ID negativo

#### `comisionistas.controller.js`
Seguimiento de comisiones:
- Listar comisionistas con sus ventas y comisiones asociadas
- Calcular totales de comisiones por período

#### `reportes.controller.js`
Reportes ejecutivos y estadísticas consolidadas:
- Estado financiero global (ventas, pagos, saldos)
- Reportes por proyecto, período o vendedor

#### `bank_transactions.controller.js`
Registro de movimientos bancarios:
- Registrar transacciones bancarias recibidas
- Contraste de pagos con transacciones (módulo de validación de pagos)

#### `juridico.controller.js`
Seguimiento jurídico de ventas problemáticas:
- Listar ventas en mora, pre-mora o en proceso de devolución
- Registrar observaciones jurídicas sobre una venta
- Gestión de alertas legales

#### `gastos.controller.js`
Registro de gastos operativos:
- Crear y listar gastos asociados a proyectos
- Control del flujo de egresos de la empresa

#### `uploads.controller.js`
Gestión de archivos subidos:
- Recibe imágenes via `multer`, las sube a Cloudinary
- Devuelve la URL pública del archivo subido
- Se usa principalmente para las fotos de perfil y comprobantes de pago

---

### Routes: `src/routes/`

Hay un archivo de rutas por cada controller. Su único trabajo es mapear las URLs a las funciones del controller correspondiente. El patrón es siempre: rutas específicas primero, paramétricas al final.

Los middlewares de autenticación y permisos **no** se definen aquí — ya están aplicados globalmente en `index.js` para todas las rutas `/api/v1`.

---

### Services: `src/services/`

Los servicios contienen lógica de negocio reutilizable que varios controllers pueden necesitar. No reciben `req/res` — son funciones puras que trabajan directamente con la base de datos.

#### `auditoria.service.js`
Expone la función `log()` que registra cambios en la tabla `auditoria`. Se llama en cualquier operación sensible: pagos, cambios de estado, devoluciones. Guarda el valor anterior y el nuevo, el usuario que hizo el cambio y el motivo.

#### `cuotas.service.js`
Contiene toda la lógica relacionada con el plan de pagos de una venta:
- `generarPlanDePago()` — crea todas las cuotas (iniciales y regulares) al crear una venta nueva
- `marcarPagadaSiCubre()` — cambia el estado de una cuota a "pagada" si el pago la cubre completamente
- `limpiarVentaCreada()` — elimina todas las cuotas y relaciones de una venta si la creación falló a mitad del proceso (rollback manual)
- `sumarMeses()` — suma N meses a una fecha de forma segura (ajusta al último día del mes si es necesario)

#### `consecutivos.service.js`
Genera los números únicos de documentos del sistema con el formato `PREFIJO-YYYYMM-00001`. Llama a una función de base de datos (`next_consecutivo_condor`) que garantiza que los números no se repitan aunque haya solicitudes simultáneas.
- `nextPago()` — genera el número de pago y el número de recibo asociado en un mismo paso
- `nextMicropago()` — genera el número de micropago de cuota inicial

#### `recibos.service.js`
Maneja la creación de recibos asociados a pagos. Si el recibo ya existe (por un fallo anterior que dejó datos a medias), lo reutiliza en lugar de crear uno duplicado. Esto garantiza idempotencia en el proceso de emisión de recibos.

#### `saldos.service.js`
Es la **fuente única de verdad del saldo** de todo el sistema (RN-10 / Principio de Fuente Única). Ningún otro módulo recalcula el saldo por su cuenta: todos consumen este servicio.
- `getSaldoCuota()` / `getSaldoFraccion()` — saldo pendiente = valor − suma de recibos aceptados vinculados. Los pagos en revisión nunca cuentan
- `clasificarMora()` — deriva el estado contable (`vigente` / `pre_mora` / `en_mora`) a partir de los días vencidos
- `getEstadoCuota()` / `getEstadoFactura()` — derivan el estado (no se almacena): la cuota pasa a `pagada` solo con el 100% de recibos; la factura a `parcialmente_pagada` / `pagada` según los recibos que la cubren

---

## Frontend — `/public`

### Páginas HTML

#### `index.html`
La aplicación principal. Es la única página real de la SPA — todo el contenido se carga dinámicamente dentro de ella. Contiene el layout base (sidebar, topbar, área de contenido) y carga todos los scripts JS del sistema. Los estilos se cargan a través de `style.css` (agregador) y `responsive.css` (siempre al final).

#### `login.html`
Página de inicio de sesión, completamente separada de la SPA. Permite autenticarse con correo y contraseña, o con Google. Una vez autenticado, redirige a `index.html`.

---

### JavaScript Principal: `public/js/`

#### `api.js`
Es el cliente HTTP centralizado de toda la aplicación. Expone el objeto global `API` con métodos `get()`, `post()`, `put()`, `patch()` y `delete()`. Todas las vistas deben usar `API` para comunicarse con el backend.

La única excepción son los uploads de archivos (comprobantes, fotos de perfil), que usan `fetch()` directo porque manejan multipart/form-data en lugar de JSON.

`API` maneja automáticamente:
- Agregar el token de sesión a cada solicitud
- Refrescar el token si el servidor responde con `401` (sesión expirada)
- Redirigir al login si la sesión no se puede recuperar

#### `app.js`
Es el corazón del frontend. Actúa como el router de la SPA y orquesta toda la navegación. Define:
- El mapa `VIEWS` con todas las vistas disponibles y su función de renderizado
- Los subtítulos de la barra superior para cada vista (`TOPBAR_SUBTITLES`)
- La función `navigate('nombre-vista')` que cambia la vista activa
- El sistema de temas claro/oscuro/sistema (`applyTheme`, `initTheme`)
- La función `iniciarApp()` que arranca toda la aplicación tras confirmar la sesión Firebase

Al final del módulo expone las funciones clave al scope global (`window.navigate`, `window.applyTheme`, `window.humanizeRole`, `window.setActiveNav`, `window.setViewTitle`) para que los archivos de script regulares puedan usarlas.

#### `sidebar.js`
Maneja todo lo relacionado con la barra de navegación lateral:
- `SIDEBAR_GROUPS` — define los grupos de navegación con sus ítems, iconos y etiquetas
- `renderSidebar(vistas)` — construye el HTML del sidebar filtrando según las vistas permitidas del usuario
- `initSidebarToggle()` — lógica del botón para colapsar/expandir el sidebar
- `applySidebarState(collapsed)` — aplica el estado colapsado (persistido en localStorage)
- `initNavTooltips()` — muestra tooltips en los ítems cuando el sidebar está colapsado
- Drawer móvil — lógica de apertura y cierre del sidebar en pantallas pequeñas

Al agregar una vista nueva, el ítem del menú debe registrarse en `SIDEBAR_GROUPS` de este archivo.

#### `user-menu.js`
Maneja el menú desplegable del usuario en la barra superior:
- `initUserMenu(perfil)` — inicializa el avatar, nombre, rol y las opciones del menú
- Selector de tema claro/oscuro/sistema
- Acceso rápido a "Editar perfil" y "Cambiar contraseña"
- `renderEditProfileView(perfil)` — vista de edición de perfil personal
- `renderChangePasswordView()` — vista de cambio de contraseña

#### `onboarding.js`
Gestiona el flujo de bienvenida para usuarios que inician sesión por primera vez:
- `mostrarOnboarding(perfil, firebaseUser)` — muestra el modal de bienvenida según el rol del usuario (comprador o comisionista), solicitando datos adicionales necesarios para completar el perfil
- `mostrarPromptFoto()` — invita al usuario a subir su foto de perfil tras completar el onboarding

#### `role-switcher.js`
Permite al administrador ver la aplicación como si fuera otro rol, para verificar que los permisos estén configurados correctamente:
- `initRoleViewSwitcher(perfil)` — inicializa el selector de rol en la interfaz del admin
- `applyAdminView()` — restaura la vista normal del admin
- `applyRoleView(idRol, rolNombre)` — cambia la vista para simular un rol específico
- `showLinkProfileModal(tipo, onSuccess, onCancel)` — modal para vincular el admin a un perfil de comprador o comisionista al simular esos roles

#### `auth.js`
Gestiona el ciclo de vida de la autenticación con Firebase en el frontend: escucha cambios de sesión, expone el estado del usuario autenticado (`window._firebaseAuth`, `window._authReady`) y provee funciones de login, logout y recuperación de contraseña.

También es responsable de obtener la configuración de Firebase desde el backend (`/api/v1/firebase-config`) antes de inicializar el SDK, lo que permite mantener las claves fuera del código fuente del frontend.

#### `state.js`
Gestiona el estado global del usuario en el frontend a través del objeto `AppState`. Guarda qué vistas tiene habilitadas el usuario y qué acciones puede realizar. El sidebar se filtra según este estado — si un usuario no tiene acceso a una vista, no aparece en el menú.

#### `ui.js`
Funciones de interfaz de usuario reutilizables: mostrar notificaciones toast, abrir y cerrar modales, formatear fechas y montos, etc. Disponible globalmente como `window.SGIUI` o `window.SGI`.

#### `components/avatar-cropper.js`
Componente para recortar y subir fotos de perfil. Abre un editor donde el usuario puede seleccionar un área de la imagen antes de subirla a Cloudinary. Usa `fetch()` directo (no el objeto `API`) porque envía los datos como multipart/form-data.

---

### Vistas: `public/js/views/`

Cada archivo de vista es responsable de renderizar una sección de la aplicación y manejar sus interacciones. Se organizan en carpetas por dominio:

#### `dashboard.js`
Panel de control principal. Muestra un resumen del estado de las ventas, cuotas vencidas, pagos recientes y métricas clave del negocio.

#### `operacion/`
Módulos del proceso comercial:
- `proyectos.js` — listado y gestión de proyectos inmobiliarios
- `lotes.js` — inventario de lotes, cambio de estado, filtros por proyecto
- `compradores.js` — directorio de compradores con búsqueda y detalle
- `ventas.js` — seguimiento del proceso de venta: creación, estados, historial de cuotas y pagos

#### `finanzas/`
Módulos del área financiera:
- `cuotas.js` — listado de cuotas con filtros por estado y vencimiento
- `pagos.js` — registro y consulta de pagos, incluyendo pagos extraordinarios
- `facturas.js` — emisión y consulta de facturas
- `recibos.js` — consulta de recibos de pago emitidos
- `comisionistas.js` — seguimiento de comisiones por venta y por período
- `transacciones.js` — registro de movimientos bancarios
- `validacion-pagos.js` — contraste entre pagos registrados y transacciones bancarias para aprobación
- `gastos.js` — registro y control de gastos operativos por proyecto

#### `control/`
Módulos de administración y control interno:
- `reportes.js` — indicadores ejecutivos y reportes consolidados
- `auditoria.js` — trazabilidad de cambios críticos en el sistema
- `personal.js` — distribución del personal activo por rol
- `usuarios.js` — gestión de accesos: crear, editar y desactivar usuarios, asignar roles
- `permisos.js` — configuración visual de qué puede ver y hacer cada rol del sistema

#### `juridico/`
- `juridico.js` — seguimiento jurídico de ventas problemáticas: mora, pre-mora, devoluciones, observaciones legales

#### `mi-cuenta/`
Vistas personales para compradores y comisionistas:
- `mis-cuotas.js` — consulta del plan de pagos propio y pago de cuotas pendientes
- `mis-recibos.js` — recibos de pago emitidos a nombre del usuario autenticado

---

### CSS: `public/css/`

Los estilos están organizados en capas para mantener el orden a medida que el proyecto crece. El archivo `style.css` actúa como agregador que importa todos los demás. El archivo `responsive.css` se carga directamente en `index.html` al final, después de `style.css`, para garantizar que las reglas responsivas siempre tengan mayor prioridad.

#### `base/`
- `tokens.css` — define todas las variables CSS del sistema: colores, tipografía, espaciados, bordes, sombras, y las variantes de tema claro y oscuro. Es la única fuente de verdad para los valores de diseño.
- `reset.css` — elimina los estilos por defecto del navegador para empezar desde una base consistente
- `global.css` — estilos base del documento: tipografía, scrollbars, selección de texto

#### `components/`
Estilos de componentes reutilizables que aparecen en varias partes de la aplicación:
- `buttons.css` — botones primarios, secundarios, de peligro, tamaños
- `forms.css` — inputs, selects, labels, estados de validación
- `tables.css` — tablas de datos con encabezados fijos, filas alternadas, responsividad
- `modal.css` — ventanas modales con overlay y animaciones de entrada/salida
- `cards.css` — tarjetas de contenido con sombra y bordes
- `badges.css` — etiquetas de estado (pendiente, pagado, vencido, etc.)
- `alerts.css` — mensajes de alerta informativa, de éxito o de error
- `toast.css` — notificaciones temporales que aparecen en la esquina

#### `layout/`
Estructura del layout principal de la aplicación:
- `sidebar.css` — barra de navegación lateral con grupos, íconos, estado colapsado y versión móvil
- `topbar.css` — barra superior con título de vista, fecha y menú de usuario
- `containers.css` — contenedores, grid y secciones de contenido principal

#### `views/`
Estilos específicos de cada módulo que no aplican en otros contextos:
- `dashboard.css`, `ventas.css`, `lotes.css`, `comprador.css`, `reportes.css`, `login.css`, `profile.css`, `bank_transactions.css`

#### `responsive.css`
Media queries globales que adaptan el layout a tablets, móviles y pantallas pequeñas. Se carga siempre al final en `index.html` para que sus reglas sobreescriban cualquier estilo de los módulos.

---

## Pruebas Automatizadas — `/tests`

El proyecto usa **Jest** para pruebas unitarias de los servicios del backend. Los tests están en la carpeta `tests/` en la raíz y se corren con `npm test`.

Cada archivo de test mockea el cliente Supabase (`src/config/supabase`) para probar la lógica del servicio de forma aislada, sin necesitar una conexión real a la base de datos.

| Archivo                          | Qué prueba                                                                 |
| -------------------------------- | -------------------------------------------------------------------------- |
| `cuotas.service.test.js`         | `sumarMeses`, `generarPlanDePago`, `marcarPagadaSiCubre`, `limpiarVentaCreada` |
| `consecutivos.service.test.js`   | `next`, `nextPago`, `nextMicropago` — formato, padding, llamada RPC y errores |
| `recibos.service.test.js`        | `crearParaPago` — idempotencia, generación de consecutivo, reutilización de recibo huérfano |

Al agregar un service nuevo, se debe agregar también su archivo de test correspondiente.

---

## Sistema de Autenticación y Permisos

### Cómo funciona el login

1. El usuario va a `login.html` e ingresa sus credenciales
2. Firebase Auth verifica las credenciales y devuelve un token JWT
3. El token se guarda en `localStorage` bajo la clave `fb_token`
4. El frontend redirige a `index.html` y arranca la aplicación
5. En cada solicitud al backend, `api.js` incluye el token en el header `Authorization`

### Cómo funciona la autorización

Cada usuario tiene un rol (`comprador`, `asesor`, `auxiliar_contable`, etc.). Ese rol tiene permisos específicos registrados en la tabla `rol_permiso`. Los permisos siguen el formato `recurso:accion` (por ejemplo: `ventas:crear`, `pagos:leer`).

Cuando el middleware de permisos recibe una solicitud, busca en `permissions.js` qué permiso requiere esa ruta específica, y verifica si el usuario lo tiene. Si no lo tiene, devuelve `403 Forbidden`.

En el frontend, el sidebar y las vistas disponibles se filtran automáticamente según las vistas que el usuario tiene permitidas — así un comprador solo ve "Mis Cuotas" y "Mis Recibos", mientras que un auxiliar contable ve todos los módulos financieros.

### El admin y el simulador de roles

El rol `admin` tiene acceso a todo sin restricciones. Adicionalmente, el admin tiene un selector especial en la interfaz (gestionado por `role-switcher.js`) que le permite ver la aplicación como si fuera otro rol — útil para verificar que los permisos estén configurados correctamente.

---

## Flujo de una Venta (ejemplo de proceso completo)

La cadena documental es estricta: **Cuota → Factura → Pago → Recibo**. Ningún documento existe sin su predecesor.

1. Un **asesor** crea una solicitud de venta con el lote, el comprador y las condiciones
2. Un **auxiliar contable** aprueba y formaliza la venta — en este momento se genera automáticamente el plan de pago con todas las cuotas
3. El **auxiliar** emite la factura de la cuota (automáticamente al acercarse el vencimiento, o atendiendo una solicitud del comprador para una cuota futura). El comprador nunca emite facturas
4. El **comprador** registra su pago contra esa factura (o el auxiliar lo registra en oficina) — el pago queda **En Revisión**, no genera ingreso todavía
5. El **auxiliar** valida el pago contra el banco o el dinero recibido y lo **acepta**; solo entonces se genera el recibo con número único y la cuota/factura pasa a `pagada` o `parcialmente_pagada`
6. Si el comprador se atrasa, el módulo jurídico lo detecta y genera alertas

---

## Variables de Entorno (`.env`)

El archivo `.env` nunca debe subirse al repositorio. Contiene:

- **Supabase**: URL del proyecto y clave de servicio para el backend
- **Firebase Admin**: credenciales del service account para verificar tokens en el servidor
- **Firebase Client**: claves públicas que el servidor expone al frontend via `/api/v1/firebase-config`
- **Cloudinary**: credenciales para subir imágenes
- **PORT**: puerto del servidor (por defecto 3000)
