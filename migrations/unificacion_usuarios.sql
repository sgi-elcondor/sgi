-- SGI El Condor — Unificacion de tabla de usuarios
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente: seguro de re-ejecutar si fallo a mitad

-- ================================================================
-- STEP 1: Add identity columns to usuarios
-- ================================================================
ALTER TABLE condor.usuarios
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT,
  ADD COLUMN IF NOT EXISTS documento      TEXT,
  ADD COLUMN IF NOT EXISTS nombres        TEXT,
  ADD COLUMN IF NOT EXISTS apellidos      TEXT,
  ADD COLUMN IF NOT EXISTS tipo_persona   TEXT DEFAULT 'natural',
  ADD COLUMN IF NOT EXISTS rango_pago     TEXT,
  ADD COLUMN IF NOT EXISTS telefono       TEXT;

-- ================================================================
-- STEP 2: Populate data for compradores already linked via id_comprador
-- ================================================================
UPDATE condor.usuarios u
SET
  nombres        = c.nombres,
  apellidos      = c.apellidos,
  documento      = c.documento,
  tipo_persona   = COALESCE(c.tipo_persona::TEXT, 'natural'),
  tipo_documento = c.tipo_documento,
  rango_pago     = c.rango_pago,
  telefono       = c.telefono
FROM condor.comprador c
WHERE u.id_comprador = c.id_comprador;

-- ================================================================
-- STEP 3: Populate data for comisionistas already linked via id_comisionista
-- ================================================================
UPDATE condor.usuarios u
SET
  nombres      = c.nombres,
  apellidos    = c.apellidos,
  documento    = c.documento::TEXT,
  tipo_persona = 'natural',
  telefono     = c.telefono
FROM condor.comisionista c
WHERE u.id_comisionista = c.id_comisionista;

-- ================================================================
-- STEP 4: Handle compradores not yet linked to any usuario
--
-- 4a: Insert a new usuario for each unlinked comprador.
--     ON CONFLICT DO NOTHING handles compradores whose email
--     already exists in usuarios (linked or not).
-- ================================================================
INSERT INTO condor.usuarios (
  email, id_rol, nombres, apellidos, documento,
  tipo_persona, tipo_documento, rango_pago, telefono, activo, fecha_creacion
)
SELECT
  c.mail,
  (SELECT id_rol FROM condor.roles WHERE nombre = 'comprador' LIMIT 1),
  c.nombres, c.apellidos, c.documento,
  COALESCE(c.tipo_persona::TEXT, 'natural'),
  c.tipo_documento, c.rango_pago, c.telefono,
  (c.estado = 'activo'), NOW()
FROM condor.comprador c
WHERE NOT EXISTS (
    SELECT 1 FROM condor.usuarios u WHERE u.id_comprador = c.id_comprador
  )
  AND c.mail IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- 4b: Link all unlinked compradores to usuarios via email match
--     (covers both newly inserted rows and pre-existing email matches)
UPDATE condor.usuarios u
SET
  id_comprador   = c.id_comprador,
  nombres        = COALESCE(u.nombres,        c.nombres),
  apellidos      = COALESCE(u.apellidos,      c.apellidos),
  documento      = COALESCE(u.documento,      c.documento),
  tipo_persona   = COALESCE(u.tipo_persona,   c.tipo_persona::TEXT, 'natural'),
  tipo_documento = COALESCE(u.tipo_documento, c.tipo_documento),
  rango_pago     = COALESCE(u.rango_pago,     c.rango_pago),
  telefono       = COALESCE(u.telefono,       c.telefono)
FROM condor.comprador c
WHERE u.email = c.mail
  AND u.id_comprador IS NULL;

-- ================================================================
-- STEP 5: Handle comisionistas not yet linked to any usuario
--
-- 5a: Insert with ON CONFLICT DO NOTHING for email collisions
-- ================================================================
INSERT INTO condor.usuarios (
  email, id_rol, nombres, apellidos, documento, tipo_persona, telefono, activo, fecha_creacion
)
SELECT
  c.mail,
  (SELECT id_rol FROM condor.roles WHERE nombre = 'comisionista' LIMIT 1),
  c.nombres, c.apellidos, c.documento::TEXT,
  'natural', c.telefono, TRUE, NOW()
FROM condor.comisionista c
WHERE NOT EXISTS (
    SELECT 1 FROM condor.usuarios u WHERE u.id_comisionista = c.id_comisionista
  )
  AND c.mail IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- 5b: Link all unlinked comisionistas to usuarios via email match
UPDATE condor.usuarios u
SET
  id_comisionista = c.id_comisionista,
  nombres         = COALESCE(u.nombres,    c.nombres),
  apellidos       = COALESCE(u.apellidos,  c.apellidos),
  documento       = COALESCE(u.documento,  c.documento::TEXT),
  tipo_persona    = COALESCE(u.tipo_persona, 'natural'),
  telefono        = COALESCE(u.telefono,   c.telefono)
FROM condor.comisionista c
WHERE u.email = c.mail
  AND u.id_comisionista IS NULL;

-- ================================================================
-- STEP 6: Add id_usuario to venta_comprador and populate it
-- ================================================================
ALTER TABLE condor.venta_comprador
  ADD COLUMN IF NOT EXISTS id_usuario INTEGER;

UPDATE condor.venta_comprador vc
SET id_usuario = u.id_usuario
FROM condor.usuarios u
WHERE u.id_comprador = vc.id_comprador
  AND vc.id_usuario IS NULL;

-- Fallback: match via documento (for compradores with NULL mail)
UPDATE condor.venta_comprador vc
SET id_usuario = u.id_usuario
FROM condor.comprador c
JOIN condor.usuarios u ON u.documento = c.documento::TEXT
WHERE vc.id_comprador = c.id_comprador
  AND vc.id_usuario IS NULL;

-- ================================================================
-- STEP 7: Add id_usuario to venta_comisionista and populate it
-- ================================================================
ALTER TABLE condor.venta_comisionista
  ADD COLUMN IF NOT EXISTS id_usuario INTEGER;

UPDATE condor.venta_comisionista vc
SET id_usuario = u.id_usuario
FROM condor.usuarios u
WHERE u.id_comisionista = vc.id_comisionista
  AND vc.id_usuario IS NULL;

UPDATE condor.venta_comisionista vc
SET id_usuario = u.id_usuario
FROM condor.comisionista c
JOIN condor.usuarios u ON u.documento = c.documento::TEXT
WHERE vc.id_comisionista = c.id_comisionista
  AND vc.id_usuario IS NULL;

-- ================================================================
-- STEP 8: Add id_usuario to pago and populate it
-- ================================================================
ALTER TABLE condor.pago
  ADD COLUMN IF NOT EXISTS id_usuario INTEGER;

UPDATE condor.pago p
SET id_usuario = u.id_usuario
FROM condor.usuarios u
WHERE u.id_comprador = p.id_comprador
  AND p.id_comprador IS NOT NULL
  AND p.id_usuario IS NULL;

-- ================================================================
-- STEP 9: Drop comprador and comisionista tables
-- CASCADE removes FK constraints referencing these tables
-- ================================================================
DROP TABLE IF EXISTS condor.comprador_recibo CASCADE;
DROP TABLE IF EXISTS condor.comprador         CASCADE;
DROP TABLE IF EXISTS condor.comisionista      CASCADE;

-- ================================================================
-- STEP 10: Drop orphaned columns from related tables
-- ================================================================
ALTER TABLE condor.venta_comprador    DROP COLUMN IF EXISTS id_comprador;
ALTER TABLE condor.venta_comisionista DROP COLUMN IF EXISTS id_comisionista;
ALTER TABLE condor.pago               DROP COLUMN IF EXISTS id_comprador;
ALTER TABLE condor.usuarios           DROP COLUMN IF EXISTS id_comprador;
ALTER TABLE condor.usuarios           DROP COLUMN IF EXISTS id_comisionista;

-- ================================================================
-- STEP 11: Add FK constraints for the new id_usuario columns
-- ================================================================
ALTER TABLE condor.venta_comprador
  ADD CONSTRAINT venta_comprador_id_usuario_fkey
  FOREIGN KEY (id_usuario) REFERENCES condor.usuarios(id_usuario);

ALTER TABLE condor.venta_comisionista
  ADD CONSTRAINT venta_comisionista_id_usuario_fkey
  FOREIGN KEY (id_usuario) REFERENCES condor.usuarios(id_usuario);

ALTER TABLE condor.pago
  ADD CONSTRAINT pago_id_usuario_fkey
  FOREIGN KEY (id_usuario) REFERENCES condor.usuarios(id_usuario);

-- ================================================================
-- Verificacion final
-- vc_sin_usuario y vco_sin_usuario deben ser 0
-- ================================================================
SELECT
  (SELECT COUNT(*) FROM condor.usuarios)                                       AS total_usuarios,
  (SELECT COUNT(*) FROM condor.venta_comprador)                                AS filas_venta_comprador,
  (SELECT COUNT(*) FROM condor.venta_comisionista)                             AS filas_venta_comisionista,
  (SELECT COUNT(*) FROM condor.venta_comprador    WHERE id_usuario IS NULL)    AS vc_sin_usuario,
  (SELECT COUNT(*) FROM condor.venta_comisionista WHERE id_usuario IS NULL)    AS vco_sin_usuario;
