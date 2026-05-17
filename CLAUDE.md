# CLAUDE.md — SGI El Cóndor

> Contexto de proyecto para Claude Code. Lee este archivo antes de cualquier tarea.

En supabase el schema en el que estamos trabajando es `condor`

Antes de hacer algun cambio si cres que hay una forma mejor de hacerlo sugieremela.

Al crear estilos CSS estamos usando medidas rem en lugar de px, obiamente hay excepciones como en bordes detallados o cosas que si normalmente requeren de pixeles para funcionar mejor.

El rol admin debe tener permiso a todas las funcioalidades y vistas.

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

## Base de Datos (Supabase / PostgreSQL)

Toma como contexto la base de datos en supabase ya que hace parte del proyecto si no esta conectada con el Model Context Protocol (MCP) explicame como conectarlo.

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

## Instrucciones para Claude Code

1. **Antes de generar código** , revisa el controller y route del módulo relacionado para mantener el patrón existente.
2. **Para cambios en BD** , describe el ALTER TABLE o nueva tabla antes de ejecutar.
3. **Nunca instanciar** un nuevo cliente Supabase; siempre importar desde `src/config/supabase.js`.
4. **Respetar los roles** al agregar endpoints: incluir los middlewares correspondientes.
5. **Auditoría obligatoria** en operaciones: pagos, cambios de estado, devoluciones.
6. **Al crear un módulo nuevo** , seguir exactamente la estructura: `controller` + `route` + `view JS`.
7. Los commits que sugieras deben seguir los tipos definidos (`feat:`, `fix:`, etc.).
