-- SGI El Condor — BCK-01 Catalogo de permisos + asignacion al rol admin
-- Ejecutar en el SQL Editor de Supabase (schema: condor), despues de bck_01_respaldos.sql
-- Idempotente: usa WHERE NOT EXISTS en vez de ON CONFLICT.
--
-- El middleware de rutas (permisos.middleware.js) ya deja pasar a `admin` sin
-- estas filas (bypass total). Pero el SIDEBAR del frontend depende de que el
-- usuario tenga la fila `vista:respaldos` en rol_permiso (GET /auth/perfil la
-- deriva de ahi, sin excepcion para admin) — sin esto, el modulo no aparece
-- en el menu aunque el backend ya lo deje entrar.

-- Catalogo de permisos
INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'vista', 'respaldos', 'Ver el modulo de Respaldos.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'vista' AND accion = 'respaldos');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'respaldos', 'leer', 'Ver la lista de respaldos disponibles y descargarlos.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'respaldos' AND accion = 'leer');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'respaldos', 'restaurar', 'Restaurar un respaldo (parcial o total) con confirmacion de 2FA.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'respaldos' AND accion = 'restaurar');

-- Asignar al rol admin (unico rol con acceso a este modulo, segun BCK-01)
INSERT INTO condor.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM condor.roles r
CROSS JOIN condor.permisos p
WHERE r.nombre = 'admin'
  AND (p.recurso || ':' || p.accion) IN ('vista:respaldos', 'respaldos:leer', 'respaldos:restaurar')
  AND NOT EXISTS (
    SELECT 1 FROM condor.rol_permiso rp
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );

-- Verificacion — deberian salir 3 filas
SELECT r.nombre AS rol, p.recurso || ':' || p.accion AS permiso
  FROM condor.rol_permiso rp
  JOIN condor.roles r      ON r.id_rol = rp.id_rol
  JOIN condor.permisos p   ON p.id_permiso = rp.id_permiso
  WHERE r.nombre = 'admin'
    AND (p.recurso = 'respaldos' OR (p.recurso = 'vista' AND p.accion = 'respaldos'));
