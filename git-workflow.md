# Guía Git — Flujo de Trabajo del Equipo

---

## Estructura de Ramas

```
main        <- Producción estable (solo merge al cerrar Sprint)
  └── develop          <- Integración de todo el equipo
        ├── feature/nombre-del-story      <- Historia de usuario
        ├── feature/nombre-del-cambio     <- Cambio técnico / mejora
        └── hotfix/descripcion-corta      <- Cambio pequeño y rápido
```

### Tipos de rama


| Prefijo    | Cuándo usarlo                                         |
| ---------- | ------------------------------------------------------ |
| `feature/` | Historia de usuario o cambio técnico relevante        |
| `hotfix/`  | Cambio pequeño y rápido (ícono, texto, color, etc.) |

---

## Flujo Completo — Historia de Usuario

### 1. Antes de arrancar (siempre)

Si se esta usando claude code, que lea primero "claude.md"



```bash
git checkout develop
git pull origin develop
```

> **Regla de oro:** Nunca crees una rama sin hacer `pull develop` primero.

---

### 2. Crear la rama del Story

```bash
git checkout -b feature/nombre-del-story
```

El nombre debe reflejar la historia:

```
feature/modulo-propietarios
feature/busqueda-inmuebles-por-zona
feature/registro-venta-lote
```

---

### 3. Durante el desarrollo — commits frecuentes

```bash
git add .
git commit -m "tipo: descripción corta en imperativo"
```

**Tipos de commit:**


| Tipo        | Uso                                  |
| ----------- | ------------------------------------ |
| `feat:`     | Nueva funcionalidad                  |
| `fix:`      | Corrección de bug                   |
| `refactor:` | Reorganización sin cambio funcional |
| `docs:`     | Documentación                       |
| `test:`     | Pruebas                              |

**Ejemplos reales:**

```bash
git commit -m "feat: crear modelo Propietario con validaciones"
git commit -m "feat: agregar endpoint GET /propietarios"
git commit -m "fix: corregir respuesta 404 en propietario inexistente"
git commit -m "refactor: separar lógica de negocio en servicio"
```

---

### 4. Al terminar el Story — sincronizar y subir

```bash
git pull origin develop
```

> Si hay conflictos, resuélvelos aquí antes de subir.

```bash
git push origin feature/nombre-del-story
```

---

### 5. Crear el Pull Request en GitHub

1. Ir al repositorio en GitHub.
2. Clic en **"Compare & pull request"** o ir a **Pull Requests → New Pull Request**.
3. Configurar:

   - **Base:** `develop`
   - **Compare:** `feature/nombre-del-story`
4. Definir el **título** del PR:

   ```
   [STORY] Nombre descriptivo de la historia
   ```

   Ejemplo: `[STORY] Módulo de registro de propietarios`
5. Escribir la **descripción** del PR (obligatoria). Debe ser simple pero detallada en cuanto a los cambios realizados. Incluir qué historia satisface, qué se implementó o modificó y los archivos involucrados.

   ```
   Historia: Como administrador quiero registrar propietarios
   para asociarlos a los lotes del proyecto.

   Cambios realizados:
   - Se creó el modelo Propietario con campos nombre, documento y contacto
   - Se agregó endpoint GET /propietarios con paginación
   - Se agregó endpoint POST /propietarios con validaciones
   - Se manejó error 404 para propietario inexistente

   Archivos:
   - models/propietario.js       <- nuevo
   - routes/propietarios.js      <- nuevo
   - tests/test_propietarios.js  <- nuevo
   ```
6. Asignar un **Reviewer** del equipo y avisarle.
7. Clic en **"Create Pull Request"**.

---

## Flujo — Cambio Técnico (no es historia)

Para cambios propios del backend, diseño o funcionalidad que no corresponden a una historia del sprint. Por ejemplo: cambio de conexión a Supabase, integración de librería PDF, ajuste de arquitectura, configuración de variables de entorno.

### 1. Sincronizar y crear la rama

```bash
git checkout develop
git pull origin develop
git checkout -b feature/descripcion-tecnica-del-cambio
```

Ejemplos de nombres:

```
feature/migracion-conexion-supabase
feature/integracion-libreria-pdf-reportes
feature/configuracion-variables-entorno
feature/refactor-estructura-carpetas-backend
```

---

### 2. Commits durante el cambio

```bash
git commit -m "refactor: migrar cliente de base de datos a Supabase v2"
git commit -m "feat: agregar generación de PDF con librería reportlab"
git commit -m "docs: actualizar README con instrucciones de entorno"
```

---

### 3. Sincronizar, subir y crear el PR

```bash
git pull origin develop
git push origin feature/descripcion-tecnica-del-cambio
```

**Título del PR::**

```
[TÉCNICO] Título claro y descriptivo del cambio
```

Ejemplos:

```
[TÉCNICO] Migración de conexión a Supabase v2
[TÉCNICO] Integración de librería para generación de reportes PDF
[TÉCNICO] Refactor estructura de carpetas del backend
```

**Descripción del PR:** Explicar por qué se hizo el cambio, qué se modificó exactamente, archivos afectados y cualquier impacto o riesgo que el equipo deba tener en cuenta.

```
Se reemplazó el cliente anterior por el SDK oficial de Supabase
para centralizar y estandarizar la conexión a la base de datos.

Cambios realizados:
- Se centralizó la conexión en config/database.js
- Se actualizaron todas las queries al nuevo formato
- Se agregaron las nuevas variables de entorno requeridas

Archivos:
- config/database.js  <- refactorizado
- services/lotes.js   <- actualizado
- .env.example        <- actualizado

Impacto: requiere actualizar variables de entorno en producción.
```

---

## Flujo — Hotfix (cambio rápido y pequeño)

Para cambios mínimos: cambiar un ícono, corregir un texto, ajustar un color, corregir un typo en la UI, etc.

### 1. Crear la rama hotfix

```bash
git checkout develop
git pull origin develop
git checkout -b hotfix/descripcion-muy-corta
```

Ejemplos:

```
hotfix/cambiar-icono-menu-lateral
hotfix/corregir-typo-formulario-lotes
hotfix/ajustar-color-boton-guardar
```

---

### 2. Commit y subida

```bash
git add .
git commit -m "fix: cambiar ícono de menú lateral por HomeIcon"
git push origin hotfix/descripcion-muy-corta
```

---

### 3. PR corto en GitHub

**Título:**

```
[HOTFIX] Descripción del detalle corregido
```

Ejemplo: `[HOTFIX] Cambiar ícono del menú lateral`

**Descripción mínima:**

```
Se reemplazó el ícono MenuIcon por HomeIcon en la barra lateral.

Archivos:
- components/Sidebar.js
```

---

## Cierre de Sprint

Una vez validado que `develop` está estable, entre todos se hace el merge a `main`.

```bash
git checkout main
git pull origin main
```

Luego en GitHub: abrir un **PR de `develop` → `main`**, revisarlo entre todo el equipo y hacer merge.

---

## Resumen de Tipos de PR


| Prefijo      | Tipo                                                     |
| ------------ | -------------------------------------------------------- |
| `[STORY]`    | Historia de usuario                                      |
| `[TÉCNICO]` | Cambio de backend, infra o diseño sin historia asociada |
| `[HOTFIX]`   | Cambio pequeño y rápido                                |

---

## Reglas que nunca se rompen

```bash
git push origin main     # JAMÁS
git push origin develop  # JAMÁS directo, siempre por PR
```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.

# Promt

```
-- COLUMNAS
SELECT 'COLUMNA' AS tipo, table_name, column_name AS detalle, data_type AS info
FROM information_schema.columns
WHERE table_schema = 'condor'

UNION ALL

-- LLAVES PRIMARIAS
SELECT 'PK', tc.table_name, kcu.column_name, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'condor' AND tc.constraint_type = 'PRIMARY KEY'

UNION ALL

-- LLAVES FORÁNEAS
SELECT 'FK', tc.table_name, kcu.column_name, ccu.table_name || '.' || ccu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'condor' AND tc.constraint_type = 'FOREIGN KEY'

UNION ALL

-- VISTAS
SELECT 'VISTA', table_name, '-', LEFT(view_definition, 100)
FROM information_schema.views
WHERE table_schema = 'condor'

UNION ALL

-- FUNCIONES
SELECT 'FUNCIÓN', routine_name, routine_type, data_type
FROM information_schema.routines
WHERE routine_schema = 'condor'

ORDER BY tipo, table_name;
```

```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.




# Promt


```

```

```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.

# Promt

```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.




# Promt

``
```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.

# Promt

```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.




# Promt


```

```

```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.

# Promt

```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.
```

> Siempre: `pull develop` → trabajar → `push feature` → PR → revisión → merge.
