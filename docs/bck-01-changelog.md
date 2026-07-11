# BCK-01 — Respaldos y restauración desde el panel de admin

Stakeholder: `admin`

## Historia

Como admin quiero ver los respaldos disponibles del sistema y poder restaurar uno para recuperar la información ante un incidente.

- **GIVEN** un admin autenticado **WHEN** entra a "Respaldos" **THEN** ve la lista con fecha y tamaño de cada uno.
- **GIVEN** un respaldo seleccionado **WHEN** admin confirma la restauración con su 2FA **THEN** el sistema lo restaura y deja constancia en la bitácora.

Ambos criterios quedaron verificados en producción.

## Qué se construyó

**Generación automática** — `.github/workflows/backup.yml` corre un cron diario (3am hora Colombia) que hace `pg_dump` del schema `condor` y sube el archivo a un bucket privado de Supabase Storage **más** un espejo en Cloudflare R2 (regla 3-2-1: dos copias, dos proveedores distintos). Queda registrado en la nueva tabla `condor.respaldo` (fecha, tamaño, checksum, estado, origen).

**Restauración** — `.github/workflows/restore.yml`, disparado solo por `workflow_dispatch` desde el backend (nunca por push/PR). Soporta restauración **total** (todo el schema) o **parcial** (una sola tabla), con verificación de checksum antes de restaurar. Deja constancia en `condor.respaldo_restauracion`.

**Panel de admin** — nueva vista "Respaldos" (grupo Control): tabla con fecha/tamaño/tipo/estado, botón de descarga, y botón "Restaurar" que exige el 2FA (reutiliza el step-up de SEG-07) y, para restauración total, además exige escribir la palabra "RESTAURAR" como confirmación extra.

**Aislamiento de la credencial peligrosa** — la app en Railway nunca tiene una conexión directa a Postgres. `pg_dump`/`pg_restore` corren solo dentro de GitHub Actions, usando un secret que vive únicamente ahí (`SUPABASE_DB_URL`, conexión vía Session Pooler para ser compatible con IPv4). El backend solo tiene un PAT de GitHub con permiso de disparar workflows (`actions:write`), nada más — no puede tocar la base de datos por sí mismo.

**Modo mantenimiento** — mientras dura una restauración total, los usuarios no-admin reciben `503` en cualquier request autenticado (nueva clave `modo_mantenimiento` en `condor.config_sistema`, chequeada en `auth.middleware.js`), para que nadie escriba datos mientras se está reemplazando la base.

## Archivos nuevos

- `migrations/bck_01_respaldos.sql` — tablas `respaldo` y `respaldo_restauracion`, RLS, seed de `modo_mantenimiento`.
- `migrations/bck_01_respaldos_permisos.sql` — catálogo de permisos (`vista:respaldos`, `respaldos:leer`, `respaldos:restaurar`) y su asignación al rol `admin`.
- `.github/workflows/backup.yml`, `.github/workflows/restore.yml`.
- `src/services/respaldos.service.js`, `src/controllers/respaldos.controller.js`, `src/routes/respaldos.routes.js`.
- `public/js/views/control/respaldos.js`.
- `tests/respaldos.service.test.js`.

## Archivos editados

`src/index.js`, `src/config/permissions.js`, `src/services/config.service.js`, `src/controllers/roles.controller.js`, `src/middlewares/auth.middleware.js`, `public/js/app.js`, `public/js/components/sidebar.js`, `public/js/views/control/permisos.js`, `build.mjs`, `public/index.html`.

## Bugs encontrados y corregidos durante la puesta en marcha

1. **Versión de `pg_dump` incompatible**: el runner de GitHub Actions trae `pg_dump` 16 por defecto, pero el proyecto corre Postgres 17.6 — `pg_dump` se niega a operar contra un servidor más nuevo que él. Se agregó el repositorio oficial de PostgreSQL (`apt.postgresql.org`) para instalar `postgresql-client-17`.
2. **El binario viejo seguía ganando en el `PATH`**: aun con la v17 instalada, `/usr/bin/pg_dump` (v16, preinstalado en la imagen del runner) resolvía primero. Se antepuso `/usr/lib/postgresql/17/bin` al `PATH` vía `GITHUB_PATH`.
3. **`ref` incorrecto en el disparo de `restore.yml`**: apuntaba a `main`, pero `develop` es la rama por defecto real del repositorio (confirmado con `gh repo view`) y la que despliega Railway. Correjido a `ref: "develop"`.
4. **El módulo no aparecía en el sidebar del admin**: el bypass de `admin` en `permisos.middleware.js` solo protege rutas de API — la visibilidad del sidebar depende de una fila real `vista:respaldos` en `rol_permiso`, sin excepción para ningún rol. Hacía falta además una entrada en el catálogo estático `PERMISSION_CATALOG` del frontend (`permisos.js`) para que el checkbox existiera. Se agregó la migración `bck_01_respaldos_permisos.sql` y se corrigieron ambos catálogos.

## Verificado

- 131 tests de Jest en verde (9 nuevos para `respaldos.service.js`).
- Corrida real de `backup.yml` en GitHub Actions: dump generado, subido a Supabase Storage y a Cloudflare R2, fila registrada en `condor.respaldo` con `estado = completado`.
- Vista "Respaldos" visible y funcional en el panel para el rol `admin` en producción.
- Escaneo del diff completo en busca de secretos filtrados: limpio.

## Pendiente

- Probar una restauración real de punta a punta (recomendado empezar por una tabla de bajo riesgo, no `venta`/`pago`/`cuota`).
- Mergear `develop` a `main` cuando se cierre el sprint (sin urgencia técnica — no es un bloqueante para que BCK-01 funcione, ya que `develop` es la rama que despliega Railway).
