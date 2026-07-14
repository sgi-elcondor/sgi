# CLAUDE.md — SGI El Cóndor

> Contexto persistente del proyecto para Claude Code. Leer este archivo antes de cualquier tarea.

---

## Reglas para el asistente (prioritarias)

1. **Antes de empezar cualquier cosa**, di brevemente qué vas a hacer y espera aceptación antes de continuar.
2. Si crees que existe una forma mejor de implementar un cambio, **sugiérela primero** antes de aplicarlo.
3. **Schema único**: en Supabase el schema es `condor`. Siempre usar `.schema('condor')` en todas las consultas del backend.
4. **CSS en `rem`**: las medidas se expresan en `rem`, no en `px`. Excepciones aceptadas: bordes (`border: 1px`), sombras y valores que por naturaleza requieren píxeles.
5. **Rol `admin` tiene acceso total** a todas las funcionalidades y vistas (bypass explícito en `permisos.middleware.js`).
6. **Código en inglés**: clases, atributos, variables, funciones y nombres de objetos siempre en inglés. Si encuentras nombres en español al modificar código, pásalos a inglés en todos los archivos implicados.
7. **No agregar comentarios** salvo cuando sean estrictamente necesarios para entender lógica no obvia. Los comentarios también van en inglés.
8. **Para cambios en BD**, describir el ALTER TABLE / nueva tabla / vista antes de ejecutar.
9. **Nunca instanciar** un nuevo cliente Supabase. Importar desde `src/config/supabase.js`.

---

## Proyecto

**SGI El Cóndor** es la plataforma web interna de la inmobiliaria **El Cóndor S.A.S.** Digitaliza y centraliza la operación de venta de lotes y todo su ciclo financiero:

- Catálogo de proyectos urbanísticos y lotes.
- Venta de lotes a uno o varios compradores con porcentajes de participación, posibles permutas y micro-cuotas iniciales.
- Generación automática del plan de pago (cuota inicial + cuotas regulares) y subdivisión por fracciones.
- Facturación, registro de pagos (con baucher cargado en Cloudinary), generación de recibos numerados.
- Validación de pagos contra extractos bancarios cargados en `bank_transaction`.
- Comisiones por venta con causación al cruzar el 30 % del valor total.
- Seguimiento jurídico de ventas en pre-mora / mora / devolución, con observaciones.
- Reportes consolidados (cartera, recaudo histórico, proyección de ingresos, comisiones).
- Portal del comprador para consultar sus ventas, cuotas, facturas, pagos y recibos.
- **Flujo de requerimientos y desembolso**: peticionario → jefe_area → gerencia → tesorero (desembolso con gasto automático) → almacenista (recepción parcial o total) → inventario. Estado en tiempo real vía SSE.
- **Módulo inventario**: libro de movimientos con stock derivado (Σ entradas − Σ salidas por material/unidad/proyecto).
- **Notificaciones in-app** persistentes con campanita y badges en sidebar; fan-out por rol o por lista de usuarios.
- **Auto-registro público**: un visitante puede registrarse (rol `usuario`, requiere verificación de email) para explorar el catálogo; se promociona a `comprador` al concretar una venta (RN-23).
- Gestión de gastos operativos y recepciones de materiales (requerimientos/almacén).
- Trazabilidad obligatoria de cambios críticos en `auditoria`.

Hay dos tipos de URL públicas (sin token): la landing `/` (`public/proyectos.html`) y los endpoints `/api/v1/public/*` + `/api/v1/auth/*` (login server-side, registro, reset). Todo lo demás vive bajo `/api/v1/*` con JWT.

---

## Stack Tecnológico

| Capa             | Tecnología                                                    |
| ---------------- | ------------------------------------------------------------- |
| Runtime          | Node.js + Express 4                                           |
| Base de datos    | Supabase (PostgreSQL) — schema `condor`                       |
| Autenticación    | Firebase Auth (cliente) + Firebase Admin SDK (servidor)       |
| Almacenamiento   | Cloudinary (avatares en `sgi/avatars`, bauchers en `sgi/bauchers`) |
| Correo           | Nodemailer + SMTP de Gmail (recuperación de contraseña)       |
| Frontend         | HTML + CSS + JavaScript vanilla (sin framework)               |
| Build producción | esbuild 0.28 (concat de classic scripts + bundle de módulos ESM + hash) |
| Dev experience   | nodemon + livereload (en `NODE_ENV !== 'production'`)         |
| Tests            | Jest 30 (`testEnvironment: node`)                             |
| Otros            | compression, cors, multer (memoria, baucher 8 MB / avatar 5 MB), streamifier, jsonwebtoken, dotenv |

Scripts npm:
- `npm run dev` — nodemon sobre `src/index.js` (con livereload).
- `npm start` — `node src/index.js`.
- `npm run build` — `node build.mjs` (produce `public/dist/*.min.{js,css}` y `public/index.prod.html`).
- `npm run build:watch` — rebuild en cambios bajo `public/js`, `public/css`, `public/index.html`.
- `npm test` — Jest.

---

## Arquitectura

```
Request HTTP
  │
  ├── HTTPS redirect + HSTS (prod)      → 301 http→https, Strict-Transport-Security
  ├── Baseline security headers          → CSP, X-Frame SAMEORIGIN, nosniff, Referrer-Policy, Permissions-Policy
  ├── CORS closed allowlist              → APP_URL + localhost:PORT (con trust proxy)
  ├── GET /                              → public/proyectos.html (landing pública)
  ├── GET /favicon.ico                   → SVG sin token
  ├── *.html                             → 301 a URL limpia
  ├── /dist/*                            → assets hasheados (Cache-Control: immutable, 1y)
  ├── /api/v1/auth/*                     → SIN verificarToken (login server-side, registro, reset, verify-email)
  │       /vincular                      → solo verificarTokenFirebase (claim por documento)
  │       resto                          → verificarToken
  ├── /api/v1/public/*                   → SIN verificarToken (proyectos, lotes, asesores)
  ├── /api/v1/firebase-config            → SIN verificarToken (devuelve config pública)
  ├── /api/v1/requerimientos/stream      → PREHOOK: mapea ?token= a Authorization (SSE no admite headers)
  ├── /api/v1/*                          → verificarToken + verificarPermiso
  │       (montados globalmente en index.js antes de cada router de recurso)
  └── *                                  → SPA wildcard (index.html o index.prod.html en producción)
```

- **`POST /api/v1/auth/login`** verifica la contraseña **server-side** contra Firebase Identity Toolkit y responde con un `customToken`. El contador `intentos_fallidos` y el bloqueo `bloqueado_hasta` viven en `usuarios` — 5 fallos ⇒ 30 min de bloqueo (RN-24). Google sign-in sigue siendo federado directo desde el cliente (no pasa por este endpoint). Un email desconocido devuelve el mismo mensaje genérico sin tocar contadores (anti-enumeración).
- `verificarToken` valida el ID token de Firebase, busca el usuario en `condor.usuarios` por `firebase_uid` (con fallback por email para auto-vincular), carga su rol y permisos, y cachea el payload en memoria por 60 s (`auth-cache.service`). **Si no encuentra fila por ninguno de los dos**, auto-aprovisiona una nueva con rol `usuario` (default), `activo=true`, `tipo_persona='natural'`, y `nombres`/`apellidos`/`photo_url` derivados del token si están disponibles. Si el rol `usuario` no existe en BD, devuelve 403 con `ROL_DEFAULT_NO_CONFIGURADO`. En caso de race entre dos primeros logins simultáneos, re-lee por `firebase_uid` y usa la fila que ganó.
- **Email verification gate**: si `rol === 'usuario'` y `decoded.email_verified !== true`, devuelve 403 con `EMAIL_NOT_VERIFIED`. Aplica también a identidades cacheadas. Roles internos no se ven afectados.
- `verificarPermiso` consulta `ROUTE_PERMISSIONS` (en `src/config/permissions.js`) usando la clave `MÉTODO /api/v1/ruta` (con los segmentos numéricos `\d+` eliminados). Si no encuentra entrada explícita, sólo exige autenticación. El rol `admin` siempre pasa.
- Las mutaciones que cambian rol, permisos o estado de usuario llaman `authCache.clear()` para que los cambios no esperen al TTL.
- **Crons al boot + interval 24 h**: `actualizarMora()` (mora.service, RPC en BD) y `limpiarAntiguas(60)` de `notificaciones.service` (borra notificaciones **leídas** con `created_at > 60 días`; las no leídas se conservan).
- **SSE hub in-memory (`events.service.js`)**: heartbeat cada 30 s. Sólo válido con 1 réplica (hoy Railway corre así). Escalar a N réplicas exige mover el bus a Redis pub/sub o Supabase Realtime consumido server-side.

---

## Estructura del repositorio

```
src/
├── index.js                       # Entry point Express, mounting, livereload, mora cron
├── config/
│   ├── supabase.js                # Cliente único (SERVICE_KEY); throws si falta env
│   ├── firebase.js                # Firebase Admin con credenciales por env
│   ├── cloudinary.js              # Cloudinary v2
│   └── permissions.js             # ROUTE_PERMISSIONS: { 'METHOD /api/v1/ruta': { recurso, accion } }
├── middlewares/
│   ├── auth.middleware.js         # verificarToken (con email_verified gate) + verificarTokenFirebase
│   ├── permisos.middleware.js     # bypass admin, lookup en ROUTE_PERMISSIONS
│   └── rate-limit.middleware.js   # rateLimit({ windowMs, max, keyGenerator }) — bucket in-memory por IP
├── services/
│   ├── auditoria.service.js       # log({ tabla, id, campo, anterior, nuevo, usuario, motivo })
│   ├── auth-cache.service.js      # TTL 60 s, clear() en cambios de rol/usuario
│   ├── comisiones.service.js      # verificarComision (umbral 30 %)
│   ├── config.service.js          # POL-02/04: get/set/listar de condor.config_sistema con caché 60 s
│   ├── consecutivos.service.js    # next, nextPago, nextMicropago, nextVenta, generarCodigoVenta
│   ├── cuotas.service.js          # sumarMeses, generarPlanDePago, marcarPagadaSiCubre, limpiarVentaCreada
│   ├── email.service.js           # sendPasswordResetEmail, sendCompraConfirmacionEmail,
│   │                              # sendRequerimientoNuevoEmail, sendRequerimientoEstadoEmail
│   ├── events.service.js          # SSE hub in-memory (subscribe, emit, connectedCount) — REQ-07
│   ├── inventario.service.js      # INV-01: registrarEntradas, stockActual, normalizarMaterial
│   ├── mora.service.js            # actualizar_mora (RPC en BD)
│   ├── notificaciones.service.js  # crear(paraIds|paraRoles, excepto, ...), listar,
│   │                              # contarNoLeidas, marcarLeidas, limpiarAntiguas
│   ├── recibos.service.js         # crearParaPago (idempotente, RC-YYYYMM-NNNNN)
│   ├── role-promotion.service.js  # promoverACompradorSiAplica (auto-promoción en primera venta)
│   ├── saldos.service.js          # Lógica canónica de saldo/estado (única fuente)
│   └── usuarios.service.js        # inactivosPorIds / inactivosDeVenta / inactivosDeCuota
├── controllers/                   # auth, ventas, cuotas, pagos, recibos, facturas, comisionistas,
│                                  # compradores, proyectos, lotes, gastos, bank_transactions,
│                                  # juridico, reportes, usuarios, roles, uploads, public,
│                                  # requerimientos, recepciones, notificaciones, config
└── routes/                        # uno por controller (mismo nombre)

public/
├── proyectos.html                 # Landing pública
├── index.html                     # SPA dev (carga loose <script defer>)
├── index.prod.html                # Generado por build.mjs (carga /dist/*)
├── login.html                     # Login con Firebase
├── reset-password.html            # Cambio de contraseña vía Firebase
├── sitemap.xml, robots.txt        # SEO
├── src/img/                       # Logos y favicons
├── css/
│   ├── base/                      # tokens.css, reset.css, global.css
│   ├── components/                # botones, cards, modal, tablas, badges, alerts, toast,
│   │                              # confirm, summary-card, loading-overlay, sgi-select, forms
│   ├── layout/                    # sidebar.css, topbar.css, containers.css
│   ├── views/                     # uno por vista mayor (ventas, lotes, dashboard, etc.)
│   ├── style.css                  # @imports de las anteriores
│   └── responsive.css             # Cargado SIEMPRE último (debe sobreescribir)
└── js/
    ├── api.js                     # window.API: get/post/put/patch/delete, getCached, invalidate
    ├── auth.js                    # Firebase Web SDK (ESM), expone _firebaseAuth / _authReady
    ├── app.js                     # ESM: VIEWS, TOPBAR_SUBTITLES, navigate, theme, hash router
    ├── state.js                   # AppState (can / hasVista / simulate / restore)
    ├── ui.js                      # SGIUI: hydrate, modal, toast, loading
    ├── helpers.js                 # SGIHelpers, SGISearch, _fmtMiles, _parseMiles, _onMoneyInput
    ├── lib-loader.js              # Carga perezosa de Chart.js/jspdf/exceljs/cropper
    ├── lib/qrcode.min.js
    ├── components/                # sidebar, user-menu, onboarding, role-switcher, money-input,
    │                              # avatar-cropper, sgi-select, brand-assets, responsive-tables,
    │                              # export-styles, live-updates (SSE con reconexión + backoff),
    │                              # notificaciones (campanita en topbar + badges en sidebar)
    └── views/
        ├── dashboard.js
        ├── operacion/             # el-proyecto, proyectos, lotes, compradores, ventas,
        │                          # requerimientos, aprobaciones, recepciones
        ├── finanzas/              # cuotas, pagos, comisionistas, facturas, recibos, gastos,
        │                          # transacciones, validacion-pagos, desembolsos
        ├── control/               # reportes, auditoria, personal, usuarios, permisos
        ├── juridico/              # juridico
        └── mi-cuenta/             # mis-cuotas, mis-facturas, mis-recibos

tests/                             # cuotas, recibos, auth-cache, consecutivos, saldos, usuarios
seeds/                             # Master runner: seed.js → 00-clean → 01-base → 02-personas
                                   # → 03-ventas → 04-pagos → 05-extras
                                   # + scripts ad-hoc (diag-, fix-, gen-, cleanup-, reset-)
build.mjs                          # esbuild: concat classic + bundle ESM + hash + index.prod.html
```

---

## Modelo de datos (tablas observadas en código)

| Tabla                  | Rol                                                               |
| ---------------------- | ----------------------------------------------------------------- |
| `roles`                | Roles del sistema. Columnas `descripcion` y `obligaciones` editables (manual MFN-01). |
| `permisos`             | Catálogo `(recurso, accion)`. Columna `descripcion` con texto humano editable para el manual del rol. |
| `proyecto`             | Proyectos urbanísticos. Campo `sigla` propaga prefijos a lotes.   |
| `lote`                 | Inventario. `precio_base` sincronizado al editar `valor_total`.   |
| `venta`                | Encabezado de venta; `codigo_venta` formato `#NNN-SIGLA-LOTE`.    |
| `venta_comprador`      | Many-to-many con `porcentaje` (debe sumar 100 %).                 |
| `venta_comisionista`   | M2M con `valor_comision`, `causada`, `fecha_causada`, `pagada`.   |
| `cuota`                | Plan de pago (tipo `inicial` / `regular`).                        |
| `cuota_fraccion`       | Subdivisiones de una cuota (3.3).                                 |
| `cuota_pago`           | Asignación pago↔cuota con `valor_aplicado`.                       |
| `cuota_factura`        | Factura asociada a cuota o fracción.                              |
| `pago`                 | Estados: `pendiente_revision` / `aceptado` / `rechazado`.         |
| `recibo`               | Inmutable. Numerado `RC-YYYYMM-NNNNN`.                            |
| `recibo_pago`          | M2M (1:1 en práctica) recibo↔pago.                                |
| `factura`              | Estados: `emitida` / `parcialmente_pagada` / `pagada` / `anulada`.|
| `bank_transaction`     | Movimientos bancarios para cruce de pagos.                        |
| `pago_comision`        | Micropagos a comisionistas (numerados `MCOM-YYYYMM-NNNNN`).       |
| `observacion_juridica` | Bitácora del módulo jurídico.                                     |
| `gasto`                | Gastos operativos por proyecto y categoría.                       |
| `requerimiento`        | Solicitudes de materiales/servicios. Consecutivo `REQ-<N>`. Estados: `pendiente_jefe` → `aprobado_jefe` → `pendiente_tesoreria` → `desembolsado` → `recibido_parcial` → `en_inventario` → `entregado`; ramas: `rechazado`, `cancelado`. Campos: `descripcion`, `id_proyecto`, `categoria` (materiales/herramientas/equipos/servicios/otros), `urgencia` (baja/media/alta), `justificacion`, `valor_total`, `id_solicitante`, `aprobado_jefe_por`+`fecha_aprobado_jefe`, `aprobado_final_por`+`fecha_aprobado_final`, **`aprobado_dueno_por`+`fecha_aprobado_dueno`, `aprobado_gerencia_por`+`fecha_aprobado_gerencia`** (POL-02, sólo compras grandes), `desembolsado_por`+`fecha_desembolso`+`valor_desembolsado`+`comprobante_desembolso_url`+`id_gasto`, `entregado_por`+`fecha_entrega`+`entrega_receptor` (INV-02), `motivo_rechazo`. |
| `config_sistema`       | Key-value con tipo para configuración global (POL-02, POL-04). Clave PK, valor TEXT, tipo (`number|text|json`), descripcion, actualizado_por, updated_at. Actualmente contiene `umbral_compra_grande` (COP). |
| `requerimiento_item`   | Detalle por ítem: `descripcion`, `unidad`, `cantidad_solicitada`, `precio_unitario`. |
| `recepcion`            | Entrega registrada por el almacenista.                            |
| `recepcion_item`       | Detalle de la recepción.                                          |
| `inventario_movimiento`| Libro append-only (`tipo: entrada|salida`) — INV-01. Stock = Σ derivada. Se pobla al registrar recepciones. |
| `usuarios`             | Personas. `firebase_uid` enlaza con Firebase Auth. Campos SEG-02: `intentos_fallidos`, `bloqueado_hasta`. |
| `rol_permiso`          | M2M rol↔permiso.                                                  |
| `notificacion`         | Notificaciones in-app por usuario (`titulo, mensaje, vista, referencia, leida, created_at`). Housekeeping: leídas > 60 días se purgan. |
| `auditoria`            | Bitácora de cambios sensibles.                                    |

### Vistas SQL leídas por el backend
`v_aux_panel_operaciones_diarias`, `vw_cartera_consolidada`, `vw_alertas_juridicas`, `vw_dir_cartera_resumen_hoy`, `vw_dir_recaudo_facturacion_historico`, `vw_dir_comisiones_resumen`, `vw_cartera_juridica`, `vw_auditoria_basica_operaciones`, `vw_comisiones_causadas`.

### RPC de Supabase invocados
- `next_consecutivo_condor(p_prefijo, p_periodo)` — secuencias centralizadas.
- `actualizar_mora()` — recalcula y persiste estados de mora.

---

## Endpoints REST (lo que está realmente montado en `src/index.js`)

> Prefijo `/api/v1`. Todas las rutas (excepto `/auth/*` y `/public/*`) pasan por `verificarToken` + `verificarPermiso`.

### Públicas (sin token)
- `POST /auth/login` (server-side, SEG-02: verifica contraseña contra Firebase, retorna `customToken` — cuenta intentos autoritativamente).
- `POST /auth/registrar` (auto-registro USR-01: crea cuenta Firebase + fila `usuarios` con rol `usuario`, envía verify-email).
- `POST /auth/reenviar-verificacion`, `POST /auth/reset-password-email`.
- `POST /auth/vincular` (verificarTokenFirebase — claim por documento).
- `GET /public/proyectos`, `GET /public/lotes`, `GET /public/asesores` (Cache-Control: 60 s).
- `GET /firebase-config` (config pública del cliente Firebase).

### Auth (token requerido)
- `GET /auth/perfil`, `GET /auth/mi-rol`, `PUT /auth/perfil`, `PUT /auth/avatar`, `POST /auth/completar-perfil`, `POST /auth/usuarios`.
- `GET /auth/mi-rol` devuelve el **manual** del rol del usuario (descripcion, obligaciones y lista humana de acciones permitidas). El rol `admin` devuelve `acceso_total: true` (no usa `rol_permiso`).

### Proyectos / Lotes / Compradores / Ventas
- `proyectos`: `GET / · GET /:id · POST / · PUT /:id`. Cambiar `sigla` propaga al `codigo_lote` (auditado).
- `lotes`: `GET / · GET /disponibles · GET /:id · POST / · PUT /:id`. Si el lote tiene venta activa y cambia `precio_base`, devuelve 409 con `requiere_plan: true`.
- `compradores`: `GET / · GET / ?elegibles=true · GET /buscar-usuario · GET /:id · POST / · PUT /:id`. Al crear, intenta `admin.auth().createUser` + `generatePasswordResetLink` (no fatal). El flag `?elegibles=true` (usado por el formulario de venta) además incluye usuarios activos no protegidos (`usuario`, sin rol, etc.) con `is_comprador: false` para que un primer comprador sea seleccionable antes de la promoción RN-23.
- `ventas`: `GET /estado-financiero · GET /reportes/financiero · GET /mis-ventas · GET / · GET /:id · POST / · POST /solicitud · PATCH /:id/financiero · PATCH /:id/cancelar · DELETE /:id`. El borrado físico sólo es posible sin pagos aceptados ni recibos; el rol `juridico` sólo ve `pre_mora` y `en_mora`.

### Cuotas
- `GET /pendientes · GET /vencidas · GET /mis-cuotas/:idCuota/documentos · GET /venta/:idVenta · PATCH /venta/:idVenta/valores · PUT /venta/:idVenta/plan · GET /:id/fracciones · POST /:id/fracciones · DELETE /:id/fracciones · POST / · PATCH /:id/valores`.
- `PATCH /:id/valores` rechaza cambios de `valor_cuota` aislados (deben pasar por el rebalanceo del plan).

### Pagos
- `GET /mis-pagos · GET /mis-pagos/:id · POST /comprador · GET / · POST / · GET /contrast · PATCH /accept-batch · PATCH /reject-batch · GET /:id`.
- Los pagos nacen siempre `pendiente_revision`; la asignación a cuotas y la emisión de recibo ocurren sólo en `accept-batch`.

### Facturas
- `GET /mis-facturas · GET /cuotas-sin-factura · GET /solicitudes · POST /generar-pendientes · POST /solicitar · PATCH /solicitudes/:id · GET / · POST / · PATCH /:id/anular`.

### Recibos
- `GET /mis-recibos · POST /generar-pendientes · GET /`. No existen recibos virtuales: sólo respaldan pagos aceptados.

### Comisionistas
- `GET /comisiones · GET /:id/comisiones · POST /ventas/:ventaId/micropago · PATCH /ventas/:ventaId/pagada · GET / · POST / · PUT /:id`.

### Reportes
- `GET /panel · GET /cartera · GET /cartera-hoy · GET /alertas · GET /recaudo · GET /comisiones · GET /comisiones-gerencia · GET /juridico · GET /auditoria · GET /proyeccion-ingresos · POST /mora-sync`.

### Usuarios / Roles
- `usuarios`: `GET / · GET /roles · POST / · PUT /:id · PATCH /:id/desactivar · PATCH /:id/desbloquear`. `desbloquear` resetea `intentos_fallidos=0` y `bloqueado_hasta=null` (SEG-02).
- `roles`: `GET / · GET /:id/permisos · PUT /:id/permisos · PATCH /:id/manual`. Cualquier escritura llama `authCache.clear()`. `PATCH /:id/manual` actualiza `descripcion` + `obligaciones` del rol (texto plano editable por admin desde la vista "Permisos", auditado).

### Requerimientos (flujo REQ-01 → REQ-07)
- `GET /mis-requerimientos` (peticionario ve los propios).
- `POST /` — crea en estado `pendiente_jefe`. Body: `{ descripcion, id_proyecto?, categoria, urgencia, justificacion, items: [{ descripcion, unidad?, cantidad, precio_unitario }] }`. Notifica a `jefe_area` por email + in-app.
- `PATCH /:id/cancelar` — sólo el solicitante, sólo mientras esté `pendiente_jefe`.
- `GET /aprobaciones` — inbox de aprobadores: jefes ven `pendiente_jefe`, gerencia ve `aprobado_jefe`.
- `GET /historial` — historial completo para aprobadores.
- `PATCH /:id/aprobar-jefe` (REQ-02: `pendiente_jefe → aprobado_jefe`), `PATCH /:id/aprobar-final` (REQ-03, **sólo compras chicas**: `aprobado_jefe → pendiente_tesoreria`), `PATCH /:id/aprobar-dueno` (POL-02, compras grandes: firma del dueño), `PATCH /:id/aprobar-gerencia` (POL-02, compras grandes: co-firma de gerencia; anti-colusión — id_usuario debe ser distinto al que firmó como dueño), `PATCH /:id/rechazar` (nivel inferido por estado actual).
- `GET /desembolsos` — inbox de tesorería.
- `PATCH /:id/desembolsar` (REQ-04): valida comprobante, crea `gasto` auto (best-effort), pasa a `desembolsado`, notifica almacenistas + solicitante.
- `GET /contadores` — pendientes por rol para badges del sidebar.
- `GET /stream` — SSE tiempo real (REQ-07). El token va por `?token=` porque `EventSource` no envía Authorization.
- `GET /autorizacion?numero=REQ-N` (INV-02) — autorización de entrega pre-cargada para el almacenista (sólo `en_inventario`).
- `PATCH /:id/entregar` (INV-02) — Body: `{ receptor? }`. `en_inventario → entregado`; registra salidas de stock (best-effort), setea `fecha_entrega`/`entregado_por`/`entrega_receptor` y notifica al solicitante. Permiso: `recepciones:crear`.
- `GET /:id/trazabilidad` (INV-04) — línea de tiempo completa del material: cada paso con fecha, responsable y documento (comprobantes de desembolso/recepción). Refleja firma única o doble firma (POL-02) según el monto; rechazos/cancelaciones toman responsable y motivo de `auditoria`. Roles elevados (aprobadores, tesorero, almacenista con `recepciones:leer`, `auditoria`, `gerencia`, `dueno`, `admin`) ven cualquier requerimiento; el solicitante sólo los suyos. La UI la muestra en el modal compartido `SGIReq.abrirTrazabilidad(id)` desde las vistas requerimientos, aprobaciones, desembolsos y recepciones.

### Recepciones (flujo INV-01)
- `GET /pendientes` — requerimientos `desembolsado`/`recibido_parcial`.
- `GET /historial` — con entregas resumidas.
- `GET /:idRequerimiento` — detalle + historial de recepciones.
- `POST /` — Body: `{ id_requerimiento, fecha?, observaciones?, comprobante_url?, items: [{ id_item, cantidad }] }`. Valida `cantidad ≤ pendiente` por ítem. Recalcula `requerimiento.estado` (`recibido_parcial` vs `en_inventario`). Llama `inventario.registrarEntradas()` (best-effort). Notifica al solicitante por email + in-app.

### Notificaciones (in-app)
- `GET /notificaciones` — últimas 30 del caller.
- `GET /notificaciones/no-leidas` — count sin leer (para badge de campanita).
- `PATCH /notificaciones/marcar-leidas` — Body: `{ ids? }` (si falta, marca todas).

### Config (POL-02 / POL-04)
- `GET /config` — lista todas las claves con valor tipado (para admin).
- `GET /config/:clave` — devuelve `{ clave, valor }` tipado. Admin/dueño.
- `PATCH /config/:clave` — Body: `{ valor }`. Sólo claves whitelisted en `config.controller.EDITABLE_KEYS` (hoy sólo `umbral_compra_grande`). Auditado.

### Otros
- `uploads`: `POST /baucher` (8 MB, JPG/PNG/WEBP/GIF/PDF), `POST /avatar` (5 MB, JPG/PNG/WEBP, redimensionado a 400×400 WebP).
- `bank-transactions`: `GET / · POST /batch · PUT /:id · DELETE /:id`. No se puede borrar una transacción ya vinculada a un pago.
- `juridico`: `GET /cartera · GET /:id_venta/observaciones · POST /observaciones`.
- `gastos`: `GET /resumen · GET / · POST / · PUT /:id`. Categorías: `vehiculos`, `nomina`, `servicios`, `otros`. Los desembolsos de tesorería crean automáticamente gastos categoría `servicios` u `otros`.

---

## Reglas de negocio (RN-*)

Detectadas en código (principalmente en `saldos.service`, `pagos.controller`, `ventas.controller`, `cuotas.controller`, `facturas.controller`):

| RN     | Regla                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| RN-01  | Un pago requiere una **factura activa** (`emitida` o `parcialmente_pagada`) para la cuota/fracción.        |
| RN-02  | El **recibo existe sólo cuando el pago fue `aceptado`**. No hay recibos virtuales ni con id negativo.      |
| RN-03  | Como máximo **una factura activa** por cuota o fracción.                                                   |
| RN-04 / 14 / 15 / 16 | El estado contable de una cuota (`pagada`, `vigente`, `pre_mora`, `en_mora`) es **derivado**, nunca almacenado como verdad. |
| RN-05  | Los recibos son inmutables. Una venta con recibos no se borra: se **cancela**.                             |
| RN-06  | No se emite factura para una cuota cuyo comprador esté **inactivo**.                                       |
| RN-07 / 08 | Todo pago nace en `pendiente_revision`. La asignación a cuotas y la emisión del recibo ocurren **únicamente al aceptarlo** (`accept-batch`). |
| RN-10  | **Saldo = `valor − Σ recibos respaldados`**. Es la única fórmula de saldo válida en todo el sistema (`saldos.service`). |
| RN-12  | Una cuota totalmente pagada **antes de su vencimiento** se considera `pagada_anticipada`.                  |
| RN-15  | `> 90 días` vencida ⇒ `en_mora`; `1..90 días` ⇒ `pre_mora` (constante `MORA_DIAS=90`).                     |
| RN-17  | El valor de un lote vendido **no se puede cambiar de forma aislada**: debe pasar por el reajuste del plan de cuotas. |
| RN-19  | Aux y comprador ven **exactamente la misma realidad** (saldos, recibos, estado). Una sola fuente.          |
| RN-21  | Todo recibo sigue la numeración `RC-YYYYMM-NNNNN`.                                                         |
| RN-22  | Una cuota con un pago en `pendiente_revision` no puede recibir otro.                                       |
| RN-23  | Al **registrar una venta directa** (`POST /ventas`), cada comprador asociado cuyo rol actual no esté en `PROTECTED_ROLES` y no sea ya `comprador`, se promociona automáticamente a `comprador`, se audita el cambio, se invalida `auth-cache` y se le envía un email de confirmación con el detalle de la venta. **No aplica** a `POST /ventas/solicitud` (estado `pendiente_autorizacion`). |
| RN-24  | **Login server-side con bloqueo autoritativo**. `POST /auth/login` verifica la password contra Firebase Identity Toolkit desde el backend. 5 fallos con **credenciales inválidas contra cuenta conocida** ⇒ `bloqueado_hasta = now + 30 min` (constantes `MAX_INTENTOS = 5`, `BLOQUEO_MINUTOS = 30`). Login exitoso resetea contador. Google sign-in no pasa por aquí. Sesiones activas NO se cierran al bloquear. Emails desconocidos devuelven error genérico sin tocar contadores. Admin desbloquea vía `PATCH /usuarios/:id/desbloquear`. |
| RN-25  | Un usuario con rol `usuario` (auto-registro) debe tener `email_verified === true` en Firebase para pasar `verificarToken`. Devuelve 403 `EMAIL_NOT_VERIFIED`. Cache respeta este gate. |
| RN-26  | **Flujo de requerimientos secuencial no saltable**. Cada transición valida el estado actual con `.eq('estado', esperado)` en el UPDATE, así una race no puede saltar pasos. Rechazo permite salir en cualquier estado con permiso apto (`aprobar_jefe` en `pendiente_jefe`, `aprobar_final` en `aprobado_jefe`). Sólo el solicitante cancela y sólo en `pendiente_jefe`. |
| RN-27  | Una recepción no puede exceder la cantidad pendiente por ítem. Si todos los ítems quedan cubiertos ⇒ `en_inventario`; si no ⇒ `recibido_parcial`. Cada recepción append `entrada` en `inventario_movimiento` (best-effort). El stock jamás se almacena — se deriva. |
| RN-28  | **Notificaciones fire-and-forget**. `notificaciones.service.crear()` nunca throwa: si falla la BD, se loguea y se retorna 0. Ninguna operación de negocio se aborta por fallo de notificación. Igual filosofía para SSE `events.emit()`. Emails son `Promise.allSettled` para no encadenar fallos. |
| RN-29  | **POL-02: doble firma en compras grandes de requerimientos**. Cuando `requerimiento.valor_total ≥ umbral_compra_grande` (leído de `condor.config_sistema` por `config.service`, fallback 5.000.000 COP), la transición `aprobado_jefe → pendiente_tesoreria` requiere **dos firmas de personas distintas**: dueño (endpoint `/aprobar-dueno`, permiso `requerimientos:aprobar_dueno`) y gerencia (endpoint `/aprobar-gerencia`, permiso `requerimientos:aprobar_gerencia`). Anti-colusión: `aprobado_dueno_por !== aprobado_gerencia_por` enforced en cada endpoint. Compras chicas mantienen firma única vía `/aprobar-final`. El `estado` NO cambia hasta que ambas firmas están puestas — el requerimiento se queda en `aprobado_jefe` mientras espera; la transición se ejecuta atómicamente cuando la segunda firma se guarda (mismo UPDATE que registra la firma también setea `estado = pendiente_tesoreria` y `aprobado_final_por` = último firmante). Umbral editable por admin desde la vista `Permisos` (card "Configuración del sistema") sin redespliegue. |
| §3.3   | Las fracciones de una cuota se cubren **greedy en orden** con el acumulado de recibos.                     |
| §4.3   | Restructurar una cuota anula sus facturas `emitida`; bloquea si alguna está `parcialmente_pagada`.         |
| §8.4   | Editar valores de cuotas mantiene la invariante **Σ cuotas = valor financiado** (`valor_total − permutas`). |
| §13    | Los estados son derivados; no hay estados huérfanos (ej. lote `vendido` sin venta activa → se muestra `disponible`). |

Otras invariantes:

- **Comisión causada** al alcanzar **30 %** del valor de la venta (constante `UMBRAL_COMISION = 0.30` en `comisiones.service`). Las **permutas cuentan** como pago para ese umbral y para `total_pagado`.
- Los **porcentajes de los compradores** de una venta deben **sumar 100 %**.
- Las **permutas totales** no pueden igualar o superar el valor total.
- Identidad híbrida: la primera vez que entra un usuario nuevo, se intenta mapear por `firebase_uid`, después por email. Si no hay match, devuelve `CUENTA_NO_VINCULADA` y debe ir por `POST /auth/vincular` con su documento (UPDATE atómico guardado por `firebase_uid IS NULL`).

### Consecutivos / numeraciones

- Pagos: `PAG-YYYYMM-NNNNN` (RPC `next_consecutivo_condor('PAG', YYYYMM)`).
- Recibos: `RC-YYYYMM-NNNNN` (mismo correlativo del pago).
- Micropagos a comisión: `MCOM-YYYYMM-NNNNN`.
- Facturas: `FV-YYYYMM-SIGLA-NNNNN`.
- Ventas: `#NNN-SIGLA-LOTE` (secuencia global continua, prefijo `VEN`, periodo `000000`; inmutable una vez almacenada).
- Requerimientos: `REQ-<N>` (secuencia global, `consecutivos.next('REQ')`).

**Siempre** generar números desde `consecutivos.service`. Nunca calcularlos manualmente.

---

## Flujos principales

### A. Crear venta (`POST /ventas` o `POST /ventas/solicitud`)
1. `validarCamposVenta` — lote, valor total, porcentajes que sumen 100, permutas no negativas y no totales, número de cuotas, fechas válidas, micro-cuotas balanceadas con la cuota inicial.
2. Verificar que ningún comprador esté inactivo (`usuariosSvc.inactivosPorIds`).
3. Verificar que el lote no tenga una venta activa o pendiente (sólo `cancelada` libera).
4. Generar `codigo_venta` con `consecutivos.generarCodigoVenta` (no fatal si falla).
5. INSERT en `venta` → INSERT en `venta_comprador` → INSERT opcional en `venta_comisionista`.
6. `generarPlanDePago` — inserta filas en `cuota` (iniciales + regulares).
7. Cualquier error intermedio dispara `limpiarVentaCreada(idVenta)` (rollback manual de cuota, venta_comisionista, venta_comprador, venta).
8. **Auto-promoción a `comprador` (RN-23)** — sólo si `estadoVenta !== 'pendiente_autorizacion'`. Para cada `id_usuario` en `compradores`, `rolePromotion.promoverACompradorSiAplica` cambia el rol (si no está protegido y no es ya `comprador`), audita el cambio, llama `authCache.clear()` y dispara `emailService.sendCompraConfirmacionEmail` con `codigo_venta`, proyecto, lote, valor total, cuota inicial y total de cuotas. Todo el paso es **best-effort**: cualquier fallo se loguea pero no invalida la venta.

### B. Aux registra un pago en oficina (`POST /pagos`)
1. Sólo se selecciona una cuota propuesta y la(s) que se aplican.
2. Validar que la cuota no esté pagada, que haya factura activa, que el valor no supere su saldo, que no haya otro pago en revisión (RN-22) y que el comprador no esté inactivo.
3. Insertar `pago` en estado `pendiente_revision` (no hay `cuota_pago` ni `recibo` aún) y dejar bitácora en `auditoria`.

### C. Comprador sube comprobante (`POST /pagos/comprador`)
- Como B pero exige `metodo_pago ∈ {transferencia, efectivo, cheque, permuta}` y baucher subido si es transferencia. Atado a `id_usuario = req.usuario.id_usuario`.

### D. Cruce con extracto bancario (`GET /pagos/contrast`)
- Sólo aplica a `metodo_pago = transferencia`. Cada pago candidato se compara con cada `bank_transaction` libre y se le asigna un score (monto, referencia, cercanía temporal). Se conserva el mejor match significativo. El resto va a revisión manual.

### E. Aceptar lote de pagos (`PATCH /pagos/accept-batch`)
1. Marcar `pago.estado = 'aceptado'`.
2. `aplicarPagoACuotas` — asignación greedy a las cuotas no pagadas, empezando por la propuesta. Inserta filas en `cuota_pago`. (Hay un trigger en BD que puede marcar la cuota como `pagada` aún en pagos parciales; el controller restaura el estado original si no procede.)
3. `recibos.service.crearParaPago` — genera el recibo (`RC-YYYYMM-NNNNN`) si no existe; reutiliza huérfanos por número.
4. Refrescar el estado de las facturas tocadas (`saldos.getEstadosFacturasDeCuota`).
5. `comisiones.verificarComision` — si el acumulado pagado (incluyendo permutas) alcanza el 30 %, marca todas las `venta_comisionista` pendientes como `causada` (con auditoría).
6. Auditoría de la aceptación.

### F. Emisión / anulación de factura
- `_emitirFactura` valida: comprador activo, no existe factura activa, saldo > 0, `valorAcordado` ≤ saldo si se pasa. Numera con `FV-YYYYMM-SIGLA-NNNNN`. Inserta `factura` y enlace en `cuota_factura`.
- Al reestructurar una cuota, `anularFacturasActivas` anula `emitida` y bloquea si hay `parcialmente_pagada` (RN-03 / §4.3).

### G. Cancelar / eliminar venta
- `DELETE /ventas/:id` — sólo `auxiliar_contable` y `admin`. Bloquea si hay pagos aceptados o recibos. Borra hijos en orden FK-safe y libera el lote (`estado='disponible'`).
- `PATCH /ventas/:id/cancelar` — soft delete. Exige motivo ≥ 5 caracteres; deja todo trazable.

### H. Job de mora
- Al boot y cada 24 h: `actualizarMora()` invoca el RPC `actualizar_mora` en BD.

### I. Recepción de materiales
- `POST /recepciones` valida cantidades pendientes por ítem, inserta `recepcion` + `recepcion_item`, recalcula `requerimiento.estado` (`recibido_parcial` o `en_inventario`) y audita el cambio.

### J. Login y autorización
- **Login password**: el cliente envía `email`/`password` a `POST /api/v1/auth/login`. El backend verifica con Firebase Identity Toolkit (`signInWithPassword`) y responde con `customToken`. El cliente hace `signInWithCustomToken(customToken)` para abrir una sesión Firebase normal (con refresh de token propio del SDK). Contadores de intentos y bloqueo (RN-24) viven en `usuarios`, no en el cliente.
- **Login Google**: `signInWithPopup(GoogleAuthProvider)` en cliente — NO pasa por `/auth/login`. Federado, no afecta contadores.
- **Auto-registro (USR-01)**: `POST /auth/registrar` crea cuenta Firebase, envía email de verificación y crea la fila `usuarios` (rol `usuario`). Hasta verificar email, `verificarToken` devuelve 403 `EMAIL_NOT_VERIFIED` (frontend muestra pantalla `mostrarVerificarCorreo` que polla cada 4 s con `_recargarUsuario`).
- El frontend guarda el ID token en `localStorage.fb_token` y refresca automáticamente al rotar.
- El backend valida el token, resuelve la identidad y permisos, y guarda 60 s en `auth-cache`.

### K. Flujo de requerimientos (REQ-01 → REQ-07)
1. **Crear (REQ-01)**: peticionario hace `POST /requerimientos` con items. Nace en `pendiente_jefe`, se emite consecutivo `REQ-<N>`. Notifica a `jefe_area` por email + in-app + SSE.
2. **Aprobación jefe (REQ-02)**: `PATCH /:id/aprobar-jefe` (guardado por `.eq('estado', 'pendiente_jefe')`) → `aprobado_jefe`. Notifica a `gerencia`.
3. **Aprobación final (REQ-03)**: `PATCH /:id/aprobar-final` → `pendiente_tesoreria`. Notifica a `tesorero`.
4. **Rechazo**: `PATCH /:id/rechazar` con `motivo` (≥ 5 chars). Nivel inferido del estado; permiso validado dentro del controller. Notifica al solicitante.
5. **Desembolso (REQ-04)**: `PATCH /:id/desembolsar` con `comprobante_url` obligatorio y `valor` opcional (default `valor_total`). Crea `gasto` auto (best-effort; si `id_proyecto` falta, se devuelve `gasto_warning`), UPDATE guardado por estado. Notifica almacenistas + solicitante.
6. **Recepción (INV-01)**: almacenista hace `POST /recepciones` con lista de `{ id_item, cantidad }`. Cada cantidad ≤ `pendiente`. Inserta cabecera + detalle; recalcula estado (`recibido_parcial` o `en_inventario`); llama `inventario.registrarEntradas` (best-effort, tabla `inventario_movimiento`). Notifica al solicitante.
7. **Tiempo real (REQ-07)**: cada transición llama `events.emit({ tipo: 'requerimiento', numero, estado, ... })`. Clientes suscritos a `GET /requerimientos/stream` (SSE) reciben la señal y refetchean sus endpoints (los datos siguen validando permisos server-side en el refetch).
8. **Entrega (INV-02)**: almacenista consulta la autorización (`GET /autorizacion?numero=`) y hace `PATCH /:id/entregar` → `entregado`. Registra salidas en `inventario_movimiento` (best-effort) y notifica al solicitante.
9. **Trazabilidad (INV-04)**: `GET /:id/trazabilidad` reconstruye toda la cadena (paso, fecha, responsable, documento). Los responsables de cada paso salen de la fila; los de rechazo/cancelación, de `auditoria`.

### L. Inventario (INV-01)
- **Ledger append-only**: `inventario_movimiento` guarda `tipo=entrada|salida`, `material` (normalizado NFD lowercase), `descripcion`, `categoria`, `unidad`, `cantidad`, `id_proyecto`, `id_requerimiento`, `id_recepcion`, `creado_por`.
- **Stock derivado**: `inventarioService.stockActual({ idProyecto })` agrupa por `(material, unidad, id_proyecto)` y calcula `Σ entradas − Σ salidas` con última entrada/salida. Misma filosofía que RN-10 (saldo derivado).
- Las salidas se registran en la entrega al peticionario (INV-02): `entregar` llama `inventario.registrarSalidas` con las cantidades recibidas (best-effort).

### M. Notificaciones in-app + SSE
- **`notificacion` table** por usuario. `notificaciones.crear({ paraIds?, paraRoles?, excepto?, titulo, mensaje?, vista?, referencia? })` deduplica ids y hace fan-out. **Fire-and-forget**: si falla, loguea y retorna 0 — nunca aborta la operación de negocio (RN-28).
- **Housekeeping**: `limpiarAntiguas(60)` cada 24 h borra sólo `leida=true AND created_at > 60 días`. No leídas se conservan.
- **Frontend `SGINotif`** (`components/notificaciones.js`): campanita en topbar, badge con `contarNoLeidas`, dropdown con últimas 30, click marca leídas.
- **Frontend `SGILive`** (`components/live-updates.js`): abre `EventSource('/api/v1/requerimientos/stream?token=<fb_token>')` con reconexión + backoff. Notifica al resto del código vía CustomEvent que las vistas escuchan para refetchear.

---

## Integraciones externas

| Servicio        | Uso                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Supabase        | Persistencia única (PostgreSQL `condor`). Cliente `SERVICE_KEY`, **nunca** desde el browser.   |
| Firebase Auth   | Login (email/password + Google). Token JWT firmado verificado por `firebase-admin`.            |
| Cloudinary      | Imágenes y PDFs. Folders `sgi/avatars` (transformación a 400×400 WebP) y `sgi/bauchers`.       |
| Gmail SMTP      | Email transaccional de recuperación de contraseña (`SMTP_USER`/`SMTP_PASS`).                   |
| CDN Lucide      | Iconos (pin `0.487.0`).                                                                        |
| Google Fonts    | Montserrat + Playfair Display.                                                                 |

---

## Variables de entorno requeridas

`src/index.js`, `src/config/*`, `src/services/email.service.js` usan:

- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` *(throws si faltan).*
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID` *(expuestas vía `/api/v1/firebase-config`).*
- `FIREBASE_PRIVATE_KEY_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_CLIENT_ID` *(credenciales del Admin SDK; `\\n` se reemplazan por saltos reales).*
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `SMTP_USER`, `SMTP_PASS` *(Gmail App Password).*
- `APP_URL` *(opcional; usado por `sendCompraConfirmacionEmail` para construir el link al portal del comprador. Default: `https://sgi.somoselcondor.com`).*
- `PORT` (default 3000), `NODE_ENV` (`production` activa el index hasheado y desactiva livereload).

> **No existe `.env.example`** en el repo; el `.env` real está fuera de `git` (verificado).

---

## Convenciones

### Backend

- **Cada controller** declara `const SCHEMA = 'condor'` al inicio y usa `.schema(SCHEMA)` en todas las consultas.
- **Errores**: `try/catch`, `res.status().json({ error })`. Rollback manual ante inserciones multi-tabla (ver `crearVenta`).
- **Rutas específicas antes que paramétricas** (`/mis-ventas` antes que `/:id`). Verificable en cada `*.routes.js`.
- **Toda nueva ruta** se registra en `src/config/permissions.js` con el prefijo `/api/v1/` y la forma `'MÉTODO /api/v1/ruta': { recurso, accion }`. Si la ruta no aparece, basta con estar autenticado.
- **Auditoría obligatoria** en pagos, cambios de estado, devoluciones, cambios de plan, anulación de facturas, cambios de permisos, vinculación de cuenta, edición de lote/proyecto que afecte códigos o precios. Usar `auditoria.service.log` siempre que sea posible; o `insert` directo en `condor.auditoria` para entradas masivas.
- **Permutas cuentan como pago** para el cálculo del 30 % y del `total_pagado` (no se reduce `valor_total` ni se descuenta cuotas: ver `comisiones.service` y `ventas.controller`).
- **Servicios antes de duplicar**: usar `consecutivos`, `cuotas`, `recibos`, `saldos`, `comisiones`, `auditoria`, `usuarios`, `auth-cache`. Crear un service nuevo cuando una pieza se repita en ≥ 2 controllers.
- **`saldos.service` es la única fuente** de saldos y estados derivados. Las vistas y controllers deben llamarlo en vez de recalcular.
- **Verificación de comprador inactivo** antes de cualquier emisión/pago/factura (`usuarios.service`).
- **Cache de identidad** se limpia con `authCache.clear()` en cambios de rol, permisos o `activo`.

### Frontend

- **Navegación**: hash (`#vista`). Cambiar de vista con `navigate('clave')`. Registrar la vista en `VIEWS` (en `public/js/app.js`) y darle subtítulo en `TOPBAR_SUBTITLES`.
- **Sidebar**: agregar el ítem al grupo correspondiente en `SIDEBAR_GROUPS` (`public/js/components/sidebar.js`).
- **Permisos en UI**: `AppState.hasVista('clave')` para visibilidad, `AppState.can('recurso','accion')` para botones/acciones.
- **API**: usar `window.API.get/post/put/patch/delete` (y `getCached` para catálogos). La cache se invalida automáticamente al hacer mutaciones sobre el mismo recurso top-level. **Excepción única**: subidas de archivos (`/uploads/baucher`, `/uploads/avatar`) usan `fetch` directo porque `API` sólo maneja JSON.
- **Helpers financieros**: usar `SGIHelpers.fmtMiles / parseMiles / applyMoneyInput / smartConvert`. Los alias `_fmtMiles`, `_parseMiles`, `_onMoneyInput` siguen disponibles para `ventas.js`.
- **Búsqueda**: `SGISearch.matches(q, ...campos)` es acento-insensible y multicampo.
- **Tema**: `applyTheme('light'|'dark'|'system')`. Estado en `localStorage.sgi_theme`.
- **Iconos**: `<i data-lucide="nombre">` y `window.SGIUI.hydrate()` para refrescar tras inyectar HTML.
- **Globales expuestos**: `navigate`, `applyTheme`, `humanizeRole`, `setActiveNav`, `setViewTitle`, `currentUser`, `currentViewKey`, `_firebaseAuth`, `_authReady`, `SGIUI`, `SGISearch`, `SGIHelpers`, `SGILive` (SSE), `SGINotif` (campanita).
- **Tiempo real**: para reaccionar a cambios en requerimientos, escuchar `document.addEventListener('sgi:requerimiento', e => {...})`. `SGILive.init()` se llama una sola vez desde `iniciarApp` en `app.js`.

### CSS

- Variables en `public/css/base/tokens.css`. Tema controlado por `data-theme` en `<html>`.
- **Medidas en `rem`**. Excepciones: bordes, sombras y cuando el px es semántico.
- Componentes nuevos → `public/css/components/`. Estilos por vista → `public/css/views/`.
- `responsive.css` siempre se carga **último**.

### Build / despliegue

- En dev se sirve `public/index.html` (carga loose `<script defer>` con livereload).
- En `NODE_ENV=production` y si existe `public/index.prod.html`, el servidor lo sirve y `/dist/*` se entrega con `immutable, maxAge: 1y`.
- `build.mjs` ordena los classic scripts en `CLASSIC = [...]`. **Cualquier script nuevo debe agregarse a esa lista** y referenciarse en `index.html` entre los marcadores `<!-- build:js -->`.

### Convenciones de nombres

- Archivos backend: `modulo.tipo.js` en snake_case (`ventas.controller.js`).
- Tablas: snake_case singular (`venta`, `cuota`) o compuesto para M2M (`venta_comprador`).
- Variables y funciones: camelCase.
- Clases CSS: kebab-case.
- Commits convencionales: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `style:`.

### Flujo Git

```
main          ← merge al cerrar Sprint
  └── develop ← integración continua
        ├── feature/<historia>
        ├── feature/<descripcion-tecnica>
        └── hotfix/<corto>
```

---

## Roles del sistema

Catálogo definido en `condor.roles`. El backend identifica además `asesor_comercial` (alias de `asesor` para el endpoint público) y `auditoria`.

| Rol                   | Acceso principal                                                       |
| --------------------- | ---------------------------------------------------------------------- |
| `admin`               | Bypass total (no necesita entradas en `rol_permiso`).                  |
| `usuario`             | **Rol por defecto** auto-asignado en el primer login/registro Firebase. Requiere email verificado (RN-25). Catálogo público. Se promociona a `comprador` al concretar venta (RN-23). |
| `auxiliar_contable`   | Operación completa: ventas, pagos, recibos, facturas, ajustes.         |
| `asesor` / `asesor_comercial` | Crea ventas como `pendiente_autorizacion`.                     |
| `gerencia`            | Reportes consolidados + **aprobación final de requerimientos** (REQ-03) en compras chicas + **co-firma de compras grandes** (POL-02, permiso `requerimientos:aprobar_gerencia`). |
| `dueno`               | Dueño del negocio (POL-02). Perfil **supervisor**: lectura amplia de todo lo que involucra dinero (cartera, gastos, banco, comisiones), operación (proyectos, lotes, ventas, compradores), auditoría, personal, jurídico, reportes directivos y portal comprador. Escritura estratégica mínima: firma compras chicas (`aprobar_final`) y grandes (`aprobar_dueno`), crea sus propios requerimientos, ajusta el `umbral_compra_grande` desde Permisos (`config:actualizar`), sube archivos. **No opera el día a día** (no crea ventas, no acepta pagos, no registra gastos/desembolsos/recepciones, no edita usuarios ni permisos). |
| `juridico`            | Sólo `ventas` en `pre_mora` o `en_mora`; observaciones jurídicas.      |
| `comisionista`        | Sus propias comisiones y micropagos.                                   |
| `comprador`           | `mis-ventas`, `mis-cuotas`, `mis-facturas`, `mis-pagos`, `mis-recibos`.|
| `auditoria`           | Supervisa trazabilidad (vistas y reportes auditados).                  |
| `peticionario`        | Crea requerimientos de materiales/servicios (REQ-01). Ve `mis-requerimientos`. |
| `jefe_area`           | Aprobación de primer nivel (REQ-02): `pendiente_jefe → aprobado_jefe`. |
| `tesorero`            | Desembolso (REQ-04): registra el pago, sube comprobante y crea `gasto` automático. |
| `almacenista`         | Recibe entregas (INV-01), registra recepciones parciales o totales, actualiza stock derivado. |

> Los permisos están centralizados en `src/config/permissions.js` y se materializan en BD vía `permisos` + `rol_permiso`.

---

## Dependencias críticas (no modificar sin análisis)

1. **`src/config/supabase.js`** — cliente único con `SERVICE_KEY`. Reinstanciar implica perder consistencia y filtrar la key.
2. **`src/middlewares/auth.middleware.js`** + **`auth-cache.service.js`** — invariante de identidad + gate `EMAIL_NOT_VERIFIED`. Cambios deben preservar `authCache.clear()` en mutaciones de rol/usuario y **respetar el gate también en el path cacheado**.
3. **`src/controllers/auth.controller.js → login`** — verificación server-side de contraseña. Modificaciones deben preservar: (a) contador solo se incrementa con `credencialInvalida && row conocida` (anti-DoS/enumeración), (b) `bloqueado_hasta` se chequea ANTES de llamar a Firebase, (c) éxito resetea el contador. Nunca devolver texto distinto para email inexistente vs contraseña errada.
4. **`src/services/saldos.service.js`** — única fuente de saldos/estados (RN-10/14/15/16/19). Cualquier modificación se refleja en aux, comprador, juridico, reportes, gerencia.
5. **`src/services/consecutivos.service.js`** + RPC `next_consecutivo_condor` — numeraciones inmutables. Modificar formato rompe trazabilidad histórica.
6. **`src/services/recibos.service.js`** — idempotencia y reutilización de huérfanos. RN-05 prohíbe regenerar recibos.
7. **`src/services/events.service.js`** — SSE hub in-memory. Válido con 1 réplica. Si el proceso crashea, los listeners se caen y reconectan solos; si escalamos a N, hay que reemplazar por bus compartido (comentario en la cabecera del archivo).
8. **`src/services/notificaciones.service.js`** — nunca throwa. Todo caller es fire-and-forget con `.catch(() => {})`. Si se añaden validaciones fuertes, propagarlas explícitamente sin romper el contrato "best-effort" (RN-28).
9. **`src/services/inventario.service.js`** — stock derivado por normalización de `material` (NFD + lowercase + trim). Cambiar la normalización descuadra grupos históricos.
10. **`src/controllers/requerimientos.controller.js`** — cada transición usa `.eq('estado', anterior)` en el UPDATE para bloquear races (RN-26). Quitar ese guard permite saltos ilegales. Los notif+email son best-effort y NO abortan la transición. **POL-02**: los endpoints `aprobar-dueno` y `aprobar-gerencia` también incluyen `.is('aprobado_<X>_por', null)` en el UPDATE para bloquear dobles firmas del mismo tipo, y validan `id_usuario !== aprobado_<opuesto>_por` para anti-colusión (RN-29). No quitar ninguna de esas dos validaciones sin sustituto.
11. **`src/services/config.service.js`** — caché in-memory 60 s. `set()` invalida la clave inmediatamente. `get()` fallback a `DEFAULTS` para que la app funcione antes de correr la migración POL-02. Si añades una clave nueva, añadela también al `DEFAULTS` (para fresh installs) y al `EDITABLE_KEYS` de `config.controller.js` (para permitir edición vía API). Sin whitelist en `EDITABLE_KEYS`, la clave es de sólo lectura desde el API.
12. **`src/controllers/pagos.controller.js` → `aplicarPagoACuotas`** — coexiste con un trigger en BD que puede marcar cuotas como `pagada` aun en parciales; el controller compensa explícitamente (`estadoOrig`). No quitar esa compensación sin saber el estado del trigger.
13. **`ROUTE_PERMISSIONS`** y `VISTA_API_MAP` (en `roles.controller.js`) — el primero gobierna el backend; el segundo la UI granular. Toda nueva ruta debe entrar en `ROUTE_PERMISSIONS` y, si va a vista, también en `VISTA_API_MAP`.
14. **`build.mjs` + lista `CLASSIC`** — el orden de los scripts vanilla importa. Romper el orden rompe la SPA en producción.
15. **`public/js/api.js`** — gestión de token y refresh. Reemplazar implica revisar todas las vistas.
16. **`public/js/state.js`** — única fuente de permisos en UI. Su API (`hasVista`, `can`, `simulate`, `restore`) la usa el role-switcher para previsualizar roles.
17. **`public/js/components/live-updates.js`** — el ID token se pasa por `?token=` en el URL de EventSource (no admite headers). Si `fb_token` rota, el componente debe reabrir la conexión con el token nuevo.

---

## Áreas sensibles (requieren especial cuidado)

- **Flujo de aceptación de pagos** (`acceptBatch` + `aplicarPagoACuotas` + `crearParaPago` + `verificarComision` + `refrescarFacturasDeCuota`). Cualquier reorden afecta saldos, recibos y comisiones a la vez.
- **Edición de planes de cuotas** (`PUT /cuotas/venta/:id/plan` y `PATCH /cuotas/venta/:id/valores`). Rompe la invariante `Σ cuotas = valor financiado` si no se valida (§8.4 / RN-17).
- **Cambio de sigla de proyecto** (`proyectos.controller.update` → `rewriteCodigoSigla`). Reescribe `codigo_lote` en cadena y deja auditoría por cada lote afectado.
- **Edición de precio de lote vendido** (`lotes.controller.update`). Rechaza con `requiere_plan: true`; cambiar la lógica permite descuadrar el plan.
- **Anulación / restructura de facturas** (`anularFacturasActivas`, `_emitirFactura`). Una factura `parcialmente_pagada` no puede anularse automáticamente.
- **Vinculación de cuenta** (`auth.controller.vincularCuenta`). Único punto seguro para asociar `firebase_uid` a un usuario pre-registrado por documento; usa UPDATE atómico guardado.
- **Subida de archivos** (`uploads.controller`). Validar siempre `mimetype` y tamaño antes de invocar Cloudinary.
- **Borrado de transacciones bancarias** ligadas a pagos: explícitamente bloqueado.
- **Transiciones de requerimientos** (`aprobarJefe`, `aprobarFinal`, `aprobarDueno`, `aprobarGerencia`, `rechazar`, `desembolsar`, recepciones). Cualquiera de ellas debe: (1) validar estado con `.eq('estado', anterior)` en el UPDATE, (2) auditar, (3) emitir SSE via `events.emit`, (4) notificar in-app + email best-effort. Perder el guardado del estado permite races; perder la auditoría rompe la trazabilidad; perder la emisión SSE hace que las vistas de otros usuarios queden desincronizadas. **POL-02 (RN-29)**: `aprobarDueno` y `aprobarGerencia` deben mantener `.is('aprobado_<X>_por', null)` (bloqueo de doble firma del mismo tipo) y la validación anti-colusión (id_usuario del firmante ≠ id_usuario del co-firmante ya registrado). Sin estas dos guardas, dos races paralelas o un mismo usuario pueden completar la doble firma solos.
- **Login flow (`auth.controller.login`)**: cambios en el orden de validaciones (bloqueo → firebase → incremento contador → set bloqueado) pueden reintroducir la vulnerabilidad histórica de DoS por lockout externo o enumeración de emails.
- **`auditoria`**: siempre que se cambie estado, valor, vínculo o pertenencia de un objeto crítico.

---

## Estrategia de testing

- Framework: **Jest 30**, `testEnvironment: node`. Patrón: `jest.mock('../src/config/supabase')` + cadenas chainables manuales.
- Tests existentes (puramente unitarios, sin DB):
  - `tests/cuotas.service.test.js` — `sumarMeses`, `generarPlanDePago`, `marcarPagadaSiCubre`, `limpiarVentaCreada`.
  - `tests/consecutivos.service.test.js` — `next`, `nextPago`, `nextMicropago`.
  - `tests/recibos.service.test.js` — `crearParaPago` (idempotencia, recibos huérfanos, consecutivos).
  - `tests/saldos.service.test.js` — `_sumRecibosAceptados`, `_saldo`, `_clasificarEstado`, `_estadoFactura`, `_coberturaFracciones`.
  - `tests/auth-cache.service.test.js` — TTL, `invalidate`, `clear`.
  - `tests/usuarios.service.test.js` — `inactivosPorIds`, `inactivosDeVenta`, `inactivosDeCuota`.
- **Regla**: al añadir un service nuevo, crear su archivo de test correspondiente en `tests/`.
- No hay tests E2E ni de UI. Verificaciones manuales se hacen ejecutando `npm run dev` + sesión en navegador.

---

## Seeds y scripts auxiliares

`seeds/seed.js` es el runner maestro y corre, en orden:

```
00-clean → 01-base (proyectos+lotes) → 02-personas → 03-ventas+cuotas
         → 04-pagos+recibos → 05-extras
```

Los `seeds/lib/*.js` (`batch`, `dates`, `names`, `rng`) son utilidades compartidas.

Hay scripts ad-hoc no tracked-by-default (`diag-*`, `fix-*`, `gen-*`, `cleanup_*`, `reset-*`, `backfill_codigo_venta`) usados para mantenimiento puntual contra datos de desarrollo. **No correrlos contra producción sin auditoría previa.**

---

## Instrucciones para futuros cambios

Antes de modificar código:

1. **Analiza el impacto** — usa `grep` sobre el símbolo y revisa controllers, services, vistas y tests que dependan de él.
2. **Preserva los contratos** — endpoint, payload, número de consecutivo, formato de código de venta, semántica de estados. Cualquier cambio aquí rompe consumidores que no ves.
3. **Mantén la compatibilidad** — los alias `_fmtMiles`, `_parseMiles`, `_onMoneyInput` siguen vivos para `ventas.js`. Antes de eliminar APIs públicas (en `window` o exports), verifica usos en todas las vistas y seeds.
4. **Evita refactors innecesarios** — un fix puntual no necesita una limpieza arquitectónica adjunta. Si encuentras algo que mejorar, propónlo aparte.
5. **Respeta la arquitectura** — controller → service → supabase. No metas lógica de negocio en routes; no consultes BD desde vistas; no inventes un nuevo cliente Supabase.
6. **Respeta las convenciones detectadas** — schema explícito, auditoría, consecutivos centralizados, validación previa al INSERT, rollback en multi-tabla, búsqueda con `SGISearch`, formato de dinero con `SGIHelpers`.

Al crear un módulo nuevo, agrega:

- `src/controllers/<modulo>.controller.js` (con `const SCHEMA='condor'`).
- `src/routes/<modulo>.routes.js` (rutas específicas antes que paramétricas).
- Línea `app.use('/api/v1/<modulo>', require('./routes/<modulo>.routes'))` en `src/index.js`.
- Entradas en `src/config/permissions.js`.
- Si toca BD nueva: especifica el `ALTER TABLE` / `CREATE TABLE` / `CREATE VIEW` y espera confirmación.
- Vista frontend en `public/js/views/<grupo>/<modulo>.js` (con función global `<modulo>View`).
- Entrada en `VIEWS` y `TOPBAR_SUBTITLES` de `public/js/app.js`.
- Entrada en `SIDEBAR_GROUPS` (`public/js/components/sidebar.js`).
- Entrada en `VISTA_API_MAP` de `src/controllers/roles.controller.js` para que el rol pueda activarla desde "Permisos".
- Línea en `CLASSIC` (`build.mjs`) y `<script defer>` en `public/index.html`.
- CSS específico (si aplica) en `public/css/views/<modulo>.css`.
- Si la vista debe reaccionar a cambios remotos: escucha `document.addEventListener('sgi:<tipo>', ...)` sobre eventos emitidos por `SGILive` (el backend los origina en `events.emit`).
- Si hay notificaciones para el usuario final del módulo: usa `notif.crear({ paraRoles, excepto: req.usuario.id_usuario, titulo, mensaje, vista, referencia }).catch(() => {})` — nunca `await` sin catch: es best-effort.

Al modificar un service crítico (saldos, consecutivos, recibos, comisiones, cuotas, mora):

- Actualiza o agrega su test en `tests/`.
- Reproduce mentalmente el efecto sobre vistas que ya consumen al service (al menos: aux, comprador, juridico, reportes).
- Documenta la RN afectada en el cuerpo de este archivo si cambia el contrato.

---

## Notas y observaciones (verificables en código)

- En el snapshot actual de `develop` existen archivos no tracked (`seeds/check-estado-lote.js`, `seeds/diag-lote-allexgaming3.js`, `seeds/cleanup_user_allexgaming3.js`, `seeds/fix-*.js`, `seeds/gen-bank-tx-*.js`, `historias-usuario-jira.csv`, `tareas-tecnicas-equipo.md`, etc.). Son utilidades operativas y planning interno; NO van a producción y NO deben commitearse sin auditoría.
- **Planning de sprint activo**: el CSV `historias-usuario-jira.csv` lista las épicas SEG, USR, JUR, REQ, INV, POL, MAP, ALR, ALI, MFN. El markdown `tareas-tecnicas-equipo.md` lista TECH-01..TECH-12. Antes de arrancar una feature nueva, **revisa esos dos archivos** para conocer el criterio de aceptación oficial y las tareas técnicas que la soportan.
- El sistema mezcla controllers nuevos (en inglés) con controllers heredados (en español). La directiva vigente es **migrar a inglés** cuando se toque código.
- `public/index.html` y `public/index.prod.html` deben mantenerse sincronizados — el segundo se regenera con `npm run build`.
- El frontend depende de que `lucide` cargue antes de `SGIUI.hydrate()` para renderizar iconos. Los componentes nuevos deben llamar a `window.SGIUI?.hydrate()` tras inyectar HTML con `data-lucide`.
- **Deployment**: Railway con 1 réplica. Antes de habilitar autoscaling, migrar `events.service.js` a un bus compartido (Redis/Supabase Realtime) — el hub SSE actual es in-memory.
- **PRs recientes destacables (jun–jul 2026)**: #90 (USR-02 el-proyecto cards), #91 (SEG-03 auditoría UX), #92 (SEG-02 bloqueo login v1), #93 (headers/CSP hardening), #94 (auto-registro USR-01), #95 (REQ-01 crear), #96 (REQ-02/03 aprobación), #97 (REQ-04 desembolso + inventario tabs), #98 (login hardening server-side), #99 (REQ-07 tiempo real SSE), #100 (INV-01 stock).
