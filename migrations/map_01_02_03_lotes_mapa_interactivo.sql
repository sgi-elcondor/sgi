-- SGI El Condor — MAP-01/02/03 Visualizacion de lotes sobre mapa interactivo
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente: seguro de re-ejecutar. Usa IF NOT EXISTS / WHERE NOT EXISTS en lugar de
-- ON CONFLICT para no depender de nombres de constraint especificos.

-- ================================================================
-- STEP 1: Geometria y foto de referencia por lote (MAP-01/02)
--   geom guarda solo el contorno visual/geografico (GeoJSON Polygon:
--   {type:'Polygon', coordinates:[[[lng,lat], ...]]}). No reemplaza area_m2,
--   que sigue siendo el valor legal cargado manualmente por el admin.
-- ================================================================
ALTER TABLE condor.lote
  ADD COLUMN IF NOT EXISTS geom     jsonb,
  ADD COLUMN IF NOT EXISTS foto_url text;

-- ================================================================
-- STEP 2: Coordenada de referencia por proyecto (centro por defecto del mapa,
--   util antes de que haya lotes geolocalizados)
-- ================================================================
ALTER TABLE condor.proyecto
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- ================================================================
-- STEP 3: Nuevo rol `topografo` (MAP-02)
-- ================================================================
INSERT INTO condor.roles (nombre, descripcion, obligaciones)
SELECT
  'topografo',
  'Geolocaliza y dibuja el contorno de los lotes sobre el mapa interactivo.',
  E'Dibujar el contorno de cada lote sin ubicacion en el editor de mapa.\nAjustar el contorno de un lote cuando cambie su levantamiento.\nAjustar la coordenada de referencia (centro del mapa) de cada proyecto.'
WHERE NOT EXISTS (SELECT 1 FROM condor.roles WHERE nombre = 'topografo');

-- ================================================================
-- STEP 4: Nuevos permisos
--   lotes:editar_geometria    -> dibujar/ajustar el contorno de un lote (MAP-02)
--   proyectos:editar_ubicacion -> ajustar la coordenada de referencia de un proyecto
--   vista:mapa-editor          -> ver el modulo del editor de mapa en el sidebar
-- ================================================================
INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'lotes', 'editar_geometria', 'Dibujar o ajustar el contorno geografico de un lote en el mapa.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'lotes' AND accion = 'editar_geometria');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'proyectos', 'editar_ubicacion', 'Ajustar la coordenada de referencia (centro del mapa) de un proyecto.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'proyectos' AND accion = 'editar_ubicacion');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'vista', 'mapa-editor', 'Ver el editor de mapa para dibujar y ajustar el contorno de los lotes.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'vista' AND accion = 'mapa-editor');

-- ================================================================
-- STEP 5: rol_permiso — otorgar a `topografo` lo minimo necesario
--   (lectura de catalogo + las dos acciones de geolocalizacion + la vista nueva)
--   `admin` no necesita entradas — bypass en middleware.
-- ================================================================
INSERT INTO condor.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM condor.roles r
CROSS JOIN condor.permisos p
WHERE r.nombre = 'topografo'
  AND (p.recurso || ':' || p.accion) IN (
    'vista:el-proyecto', 'vista:mapa-editor',
    'proyectos:leer', 'proyectos:editar_ubicacion',
    'lotes:leer', 'lotes:editar_geometria'
  )
  AND NOT EXISTS (
    SELECT 1 FROM condor.rol_permiso rp
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );

-- ================================================================
-- Verificacion
-- ================================================================
SELECT 'Rol topografo' AS check, COUNT(*) AS count FROM condor.roles WHERE nombre = 'topografo'
UNION ALL SELECT 'Columnas lote (geom, foto_url)', COUNT(*) FROM information_schema.columns
  WHERE table_schema = 'condor' AND table_name = 'lote' AND column_name IN ('geom', 'foto_url')
UNION ALL SELECT 'Columnas proyecto (lat, lng)', COUNT(*) FROM information_schema.columns
  WHERE table_schema = 'condor' AND table_name = 'proyecto' AND column_name IN ('lat', 'lng')
UNION ALL SELECT 'Permisos MAP-01/02/03', COUNT(*) FROM condor.permisos
  WHERE (recurso = 'lotes' AND accion = 'editar_geometria')
     OR (recurso = 'proyectos' AND accion = 'editar_ubicacion')
     OR (recurso = 'vista' AND accion = 'mapa-editor')
UNION ALL SELECT 'rol_permiso topografo (esperado 6)', COUNT(*) FROM condor.rol_permiso rp
  JOIN condor.roles r ON r.id_rol = rp.id_rol WHERE r.nombre = 'topografo';
