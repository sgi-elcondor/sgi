# CLAUDE.md — SGI El Cóndor

> Contexto de proyecto para Claude Code. Lee este archivo antes de cualquier tarea.

Antes de hacer algun cambio si cres que hay una forma mejor de hacerlo sugieremela.

Al crear estilos CSS estamos usando medidas rem en lugar de px.

## ¿Como escribir codigo?

Siempre en ingles, si una clase, atributo o objeto no esta en ingles, busca todos los archivos implicados y pasalo a ingles.

No agregues comentarios a no ser que sea extrictamente necesario para entender la logia de lo que va a continuacion, estos tambien en ingles o pasalos a ingles si vas a modificar comentarios existentes.

## ¿Qué es este proyecto?

**SGI El Cóndor** es una plataforma web para la empresa inmobiliaria **El Cóndor S.A.S.**
Digitaliza y centraliza: ventas de lotes, cuotas, pagos, facturación, recibos, comisiones y reportes ejecutivos.

---

## Stack Tecnológico

| Capa           | Tecnología                     |
| -------------- | ------------------------------- |
| Backend        | Node.js + Express               |
| Base de datos  | Supabase (PostgreSQL)           |
| Autenticación | Firebase + middleware propio    |
| Frontend       | HTML / CSS / JavaScript vanilla |
| Config BD      | `src/config/supabase.js`      |
| Config Auth    | `src/config/firebase.js`      |
| Permisos       | `src/config/permissions.js`   |

---

## Estructura del Proyecto

```
sgi/
├── public/
│   ├── index.html
│   ├── login.html
│   ├── css/style.css
│   └── js/
│       ├── api.js          ← cliente HTTP del frontend
│       ├── app.js          ← entrada principal frontend
│       ├── auth.js         ← lógica de autenticación frontend
│       ├── ui.js           ← utilidades de interfaz
│       └── views/          ← un archivo JS por módulo (UI)
│           ├── proyectos.js
│           ├── lotes.js
│           ├── ventas.js
│           ├── compradores.js
│           ├── cuotas.js
│           ├── pagos.js
│           ├── facturas.js
│           ├── recibos.js
│           ├── comisionistas.js
│           ├── reportes.js
│           ├── dashboard.js
│           └── usuarios.js
└── src/
    ├── index.js            ← entrada del servidor Express
    ├── config/
    │   ├── supabase.js     ← cliente Supabase
    │   ├── firebase.js     ← cliente Firebase
    │   └── permissions.js  ← mapa de permisos por rol
    ├── middlewares/
    │   ├── auth.middleware.js      ← valida token Firebase
    │   └── permisos.middleware.js  ← valida rol y permisos
    ├── controllers/        ← lógica de negocio, uno por módulo
    └── routes/             ← endpoints REST, uno por módulo
```

---

## Módulos del Sistema

| Módulo       | Controller                      | Route                       |
| ------------- | ------------------------------- | --------------------------- |
| Proyectos     | `proyectos.controller.js`     | `proyectos.routes.js`     |
| Lotes         | `lotes.controller.js`         | `lotes.routes.js`         |
| Ventas        | `ventas.controller.js`        | `ventas.routes.js`        |
| Compradores   | `compradores.controller.js`   | `compradores.routes.js`   |
| Cuotas        | `cuotas.controller.js`        | `cuotas.routes.js`        |
| Pagos         | `pagos.controller.js`         | `pagos.routes.js`         |
| Facturas      | `facturas.controller.js`      | `facturas.routes.js`      |
| Recibos       | `recibos.controller.js`       | `recibos.routes.js`       |
| Comisionistas | `comisionistas.controller.js` | `comisionistas.routes.js` |
| Reportes      | `reportes.controller.js`      | `reportes.routes.js`      |
| Usuarios      | `usuarios.controller.js`      | `usuarios.routes.js`      |
| Auth          | `auth.controller.js`          | `auth.routes.js`          |

---

## Patrones de Código

### Controllers

* Reciben `(req, res)`
* Llaman directamente al cliente Supabase
* Manejan errores con `try/catch` y responden con `res.status().json()`
* Archivo de referencia: `src/controllers/ventas.controller.js`

### Routes

* Siguen REST estricto: `GET / POST / PUT / DELETE`
* Aplican middlewares: primero `auth.middleware`, luego `permisos.middleware`
* Archivo de referencia: `src/routes/ventas.routes.js`

### Convenciones generales

* Nombres de archivos: `modulo.tipo.js` en snake_case
* Tablas en Supabase: snake_case, plural (ej: `lotes`, `ventas`, `cuotas`)
* Variables y funciones: camelCase
* Siempre validar rol antes de operaciones de escritura

---

## Roles del Sistema

| Rol                   | Permisos principales                           |
| --------------------- | ---------------------------------------------- |
| `comprador`         | Consulta sus cuotas, pagos y recibos           |
| `asesor`            | Crea ventas pendientes de autorización        |
| `auxiliar_contable` | Operaciones completas: ventas, pagos, facturas |
| `jefe`              | Solo lectura en reportes globales              |
| `abogado`           | Consulta ventas en mora o devolución          |
| `comisionista`      | Visualiza sus comisiones                       |
| `admin`             | Gestiona proyectos, lotes y estructura         |
| `auditoria`         | Supervisa trazabilidad de cambios críticos    |

> Los permisos están centralizados en `src/config/permissions.js`

---

## Reglas de Negocio Clave

* Las comisiones se generan automáticamente cuando el comprador supera el **30% del valor del lote** pagado.
* Las cuotas se generan automáticamente al crear una venta.
* Las cuotas vencidas se marcan automáticamente.
* Todo cambio crítico (pagos, devoluciones, cambios de estado) debe registrarse en auditoría.
* Las ventas creadas por asesores quedan en estado **pendiente** hasta ser autorizadas.

---

## Base de Datos (Supabase / PostgreSQL)

* Conexión centralizada en `src/config/supabase.js`
* Usar siempre el cliente importado desde ese archivo, nunca instanciar uno nuevo
* Para migraciones o cambios de esquema, describir el cambio primero y esperar confirmación
* Preferir operaciones atómicas para pagos y actualizaciones de estado

---

## Flujo de Git del Equipo

```
main ← solo al cerrar Sprint (PR revisado por todo el equipo)
  └── develop ← integración continua del equipo
        ├── feature/nombre-historia    ← historia de usuario
        ├── feature/descripcion-tecnica ← cambio técnico
        └── hotfix/descripcion-corta   ← fix rápido
```

### Tipos de commit

| Prefijo       | Uso                                  |
| ------------- | ------------------------------------ |
| `feat:`     | Nueva funcionalidad                  |
| `fix:`      | Corrección de bug                   |
| `refactor:` | Reorganización sin cambio funcional |
| `docs:`     | Documentación                       |
| `test:`     | Pruebas                              |

### Tipos de PR

| Prefijo        | Tipo                                 |
| -------------- | ------------------------------------ |
| `[STORY]`    | Historia de usuario                  |
| `[TÉCNICO]` | Cambio de backend/infra sin historia |
| `[HOTFIX]`   | Cambio pequeño y rápido            |

> **Regla de oro:** Nunca hacer push directo a `develop` ni a `main`. Siempre por PR con revisión.

---

## Equipo

| Nombre                       | Rol                           |
| ---------------------------- | ----------------------------- |
| Juan Manuel Candela Toro     | Scrum Master / Full-stack     |
| Jabes Esteban Monroy Becerra | Product Owner / Base de datos |
| Juan David Barco Ruiz        | Developer / Frontend          |
| Juan Manuel Díaz Gómez     | Developer / Frontend          |

---

## Instrucciones para Claude Code

1. **Antes de generar código** , revisa el controller y route del módulo relacionado para mantener el patrón existente.
2. **Para cambios en BD** , describe el ALTER TABLE o nueva tabla antes de ejecutar.
3. **Nunca instanciar** un nuevo cliente Supabase; siempre importar desde `src/config/supabase.js`.
4. **Respetar los roles** al agregar endpoints: incluir los middlewares correspondientes.
5. **Auditoría obligatoria** en operaciones: pagos, cambios de estado, devoluciones.
6. **Al crear un módulo nuevo** , seguir exactamente la estructura: `controller` + `route` + `view JS`.
7. Los commits que sugieras deben seguir los tipos definidos (`feat:`, `fix:`, etc.).
