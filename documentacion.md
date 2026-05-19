# Documentación del Proyecto — SGI El Cóndor

**SGI El Cóndor** es una plataforma web para la empresa inmobiliaria El Cóndor S.A.S. que centraliza y digitaliza todo el proceso comercial: desde la venta de lotes hasta el seguimiento de cuotas, pagos, recibos, comisiones y reportes ejecutivos.

---

## Arquitectura General

El proyecto sigue una arquitectura cliente-servidor clásica:

- **Backend**: Un servidor Node.js con Express que expone una API REST. Maneja la lógica de negocio, la autenticación y la comunicación con la base de datos.
- **Frontend**: Una Single Page Application (SPA) construida en HTML, CSS y JavaScript puro, sin frameworks. Toda la aplicación vive en una sola página (`index.html`) y navega entre vistas usando el hash de la URL (`#ventas`, `#pagos`, etc.).
- **Base de datos**: Supabase (PostgreSQL en la nube), usando el schema `condor` para todas las tablas del sistema.
- **Autenticación**: Firebase Auth maneja el login del usuario. El backend verifica los tokens JWT que Firebase emite.
- **Almacenamiento de archivos**: Cloudinary almacena las fotos de perfil de los usuarios.

---

## Archivos Raíz

| Archivo            | Qué hace                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| `package.json`     | Declara las dependencias del proyecto y los scripts de arranque (`npm run dev`, `npm start`) |
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

Es el archivo que arranca el servidor. Define el orden en que se aplican los middlewares y registra todas las rutas de la API.

Lo más importante de entender aquí:
- Las rutas que empiezan con `/api/auth` son **públicas**: no requieren que el usuario esté autenticado.
- El resto de rutas `/api/*` pasan primero por dos filtros obligatorios: verificación del token de sesión (`verificarToken`) y luego validación de permisos (`verificarPermiso`).
- Si la URL no coincide con ninguna ruta de la API, el servidor devuelve `index.html` — así funciona la SPA.
- En modo desarrollo, el servidor tiene live-reload activado para recargar el navegador automáticamente cuando se editan archivos del frontend.

---

### Configuración: `src/config/`

#### `supabase.js`
Crea y exporta el cliente de Supabase que usa toda la aplicación. Lee las credenciales del archivo `.env`. Es el único lugar donde se instancia el cliente — todos los demás archivos lo importan desde aquí.

#### `firebase.js`
Inicializa Firebase Admin SDK con las credenciales del servidor. Se usa en el middleware de autenticación para verificar los tokens que envía el navegador.

#### `cloudinary.js`
Configura la conexión con Cloudinary para subir y gestionar las fotos de perfil de los usuarios.

#### `permissions.js`
Es uno de los archivos más importantes del sistema. Contiene un mapa que define qué permiso se necesita para acceder a cada ruta de la API. Cada entrada relaciona un método HTTP + una ruta con un recurso y una acción. Por ejemplo: `POST /api/ventas` requiere el permiso `ventas:crear`.

Cuando se agrega una ruta nueva, **siempre** hay que registrarla aquí.

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
Se ejecuta justo después de `auth.middleware`. Revisa si el usuario tiene el permiso necesario para la ruta que está intentando acceder, consultando el mapa de `permissions.js`.

El rol `admin` tiene acceso total y no necesita tener permisos explícitos — pasa siempre.

---

### Controllers: `src/controllers/`

Cada controller maneja la lógica de negocio de un módulo. Reciben la solicitud HTTP, validan los datos, consultan la base de datos y devuelven la respuesta. A continuación se describe el propósito de cada uno:

#### `auth.controller.js`
Gestiona todo lo relacionado con sesiones y perfiles de usuario:
- Obtener y actualizar el perfil del usuario autenticado
- Completar el perfil al primer inicio de sesión (onboarding para compradores y comisionistas)
- Exponer la configuración de Firebase al frontend

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
Registro y consulta de pagos:
- Registrar un pago aplicado a una o más cuotas
- Consultar el historial de pagos de una venta
- Registrar pagos extraordinarios (abonos al capital)
- Cada pago genera automáticamente un recibo

#### `facturas.controller.js`
Emisión y consulta de facturas:
- Crear facturas asociadas a ventas
- Listar y filtrar facturas por período o estado

#### `recibos.controller.js`
Consulta de recibos de pago:
- Listar recibos emitidos
- Descargar o visualizar un recibo específico
- Los recibos se crean automáticamente al registrar un pago (via `recibos.service.js`)

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
- Se usa principalmente para las fotos de perfil

---

### Routes: `src/routes/`

Hay un archivo de rutas por cada controller. Su único trabajo es mapear las URLs a las funciones del controller correspondiente. El patrón es siempre: rutas específicas primero, paramétricas al final.

Los middlewares de autenticación y permisos **no** se definen aquí — ya están aplicados globalmente en `index.js` para todas las rutas `/api`.

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
- `nextPago()` — genera el número de pago y el número de recibo asociado
- `nextMicropago()` — genera el número de micropago de cuota inicial

#### `recibos.service.js`
Maneja la creación de recibos asociados a pagos. Si el recibo ya existe (por un fallo anterior que dejó datos a medias), lo reutiliza en lugar de crear uno duplicado.

---

## Frontend — `/public`

### Páginas HTML

#### `index.html`
La aplicación principal. Es la única página real de la SPA — todo el contenido se carga dinámicamente dentro de ella. Contiene el layout base (sidebar, topbar, área de contenido) y carga todos los scripts JS del sistema.

#### `login.html`
Página de inicio de sesión, completamente separada de la SPA. Permite autenticarse con correo y contraseña, o con Google. Una vez autenticado, redirige a `index.html`.

---

### JavaScript Principal: `public/js/`

#### `api.js`
Es el cliente HTTP centralizado de toda la aplicación. Expone el objeto global `API` con métodos `get()`, `post()`, `put()`, `patch()` y `delete()`. Todas las vistas deben usar `API` para comunicarse con el backend — nunca `fetch()` directamente.

Maneja automáticamente:
- Agregar el token de sesión a cada solicitud
- Refrescar el token si el servidor responde con `401` (sesión expirada)
- Redirigir al login si la sesión no se puede recuperar

> Nota: también existe `window.api` (en minúscula), que es un cliente demo que usa `localStorage` para datos de prueba. No debe usarse en producción.

#### `app.js`
Es el corazón del frontend. Actúa como el router de la SPA y orquesta toda la navegación. Define:
- El mapa `VIEWS` con todas las vistas disponibles y su función de renderizado
- Los grupos del sidebar (`SIDEBAR_GROUPS`) con iconos y etiquetas
- Los subtítulos de la barra superior para cada vista
- La función `navigate('nombre-vista')` que cambia la vista activa
- El menú de usuario (avatar, tema, cerrar sesión, editar perfil)
- El onboarding modal para compradores y comisionistas que inician sesión por primera vez
- El selector de rol para que el admin pueda ver la aplicación como si fuera otro rol

#### `auth.js`
Gestiona el ciclo de vida de la autenticación con Firebase en el frontend: escucha cambios de sesión, expone el estado del usuario autenticado y provee la función `esperarAuthListo()` que `app.js` usa para arrancar la aplicación solo cuando Firebase confirmó el estado de sesión.

#### `state.js`
Gestiona el estado global del usuario en el frontend a través del objeto `AppState`. Guarda qué vistas tiene habilitadas el usuario y qué acciones puede realizar. El sidebar se filtra según este estado — si un usuario no tiene acceso a una vista, no aparece en el menú.

#### `ui.js`
Funciones de interfaz de usuario reutilizables: mostrar notificaciones toast, abrir y cerrar modales, formatear fechas y montos, etc. Disponible globalmente como `window.SGIUI` o `window.SGI`.

#### `components/avatar-cropper.js`
Componente para recortar y subir fotos de perfil. Abre un editor donde el usuario puede seleccionar un área de la imagen antes de subirla a Cloudinary.

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
- `alertas.js` — alertas jurídicas de ventas en mora o riesgo legal
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

Los estilos están organizados en capas para mantener el orden a medida que el proyecto crece:

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

El rol `admin` tiene acceso a todo sin restricciones. Adicionalmente, el admin tiene un selector especial en la interfaz que le permite ver la aplicación como si fuera otro rol — útil para verificar que los permisos estén configurados correctamente.

---

## Flujo de una Venta (ejemplo de proceso completo)

1. Un **asesor** crea una solicitud de venta con el lote, el comprador y las condiciones
2. Un **auxiliar contable** aprueba y formaliza la venta — en este momento se genera automáticamente el plan de pago con todas las cuotas
3. Cada mes, el comprador paga sus cuotas — el auxiliar registra el pago en el sistema
4. Al registrar el pago, se genera automáticamente el recibo con número único
5. El sistema actualiza el estado de las cuotas pagadas
6. Si el comprador se atrasa, el módulo jurídico lo detecta y genera alertas

---

## Variables de Entorno (`.env`)

El archivo `.env` nunca debe subirse al repositorio. Contiene:

- **Supabase**: URL del proyecto y clave de servicio para el backend
- **Firebase Admin**: credenciales del service account para verificar tokens en el servidor
- **Firebase Client**: claves públicas que el servidor expone al frontend via `/api/firebase-config`
- **Cloudinary**: credenciales para subir imágenes
- **PORT**: puerto del servidor (por defecto 3000)
