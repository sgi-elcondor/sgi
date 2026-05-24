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
  tipo_persona   = COALESCE(c.tipo_persona, 'natural'),
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
  documento    = c.documento,
  tipo_persona = 'natural',
  telefono     = c.telefono
FROM condor.comisionista c
WHERE u.id_comisionista = c.id_comisionista;

-- ================================================================
-- STEP 4: Handle compradores NOT linked via id_comprador
--
-- 4a: If a usuario already exists with the same email, link it
--     (sets id_comprador so STEP 6 can find it)
-- ================================================================
UPDATE condor.usuarios u
SET id_comprador = c.id_comprador
FROM condor.comprador c
WHERE u.email = c.mail
  AND u.id_comprador IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM condor.usuarios u2 WHERE u2.id_comprador = c.id_comprador
  );

-- 4b: Re-populate data now that 4a may have linked more usuarios
UPDATE condor.usuarios u
SET
  nombres        = COALESCE(u.nombres,        c.nombres),
  apellidos      = COALESCE(u.apellidos,      c.apellidos),
  documento      = COALESCE(u.documento,      c.documento),
  tipo_persona   = COALESCE(u.tipo_persona,   c.tipo_persona,   'natural'),
  tipo_documento = COALESCE(u.tipo_documento, c.tipo_documento),
  rango_pago     = COALESCE(u.rango_pago,     c.rango_pago),
  telefono       = COALESCE(u.telefono,       c.telefono)
FROM condor.comprador c
WHERE u.id_comprador = c.id_comprador;

-- 4c: Insert only compradores with NO match by id_comprador AND NO match by email
INSERT INTO condor.usuarios (
  email, id_rol, nombres, apellidos, documento,
  tipo_persona, tipo_documento, rango_pago, telefono, activo, fecha_creacion
)
SELECT
  c.mail,
  (SELECT id_rol FROM condor.roles WHERE nombre = 'comprador' LIMIT 1),
  c.nombres, c.apellidos, c.documento,
  COALESCE(c.tipo_persona, 'natural'),
  c.tipo_documento, c.rango_pago, c.telefono,
  (c.estado = 'activo'),
  NOW()
FROM condor.comprador c
WHERE NOT EXISTS (
    SELECT 1 FROM condor.usuarios u WHERE u.id_comprador = c.id_comprador
  )
  AND (
    c.mail IS NULL
    OR NOT EXISTS (SELECT 1 FROM condor.usuarios u WHERE u.email = c.mail)
  );

-- ================================================================
-- STEP 5: Handle comisionistas NOT linked via id_comisionista
--
-- 5a: Link by email if usuario already exists
-- ================================================================
UPDATE condor.usuarios u
SET id_comisionista = c.id_comisionista
FROM condor.comisionista c
WHERE u.email = c.mail
  AND u.id_comisionista IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM condor.usuarios u2 WHERE u2.id_comisionista = c.id_comisionista
  );

-- 5b: Re-populate data for newly-linked comisionistas
UPDATE condor.usuarios u
SET
  nombres      = COALESCE(u.nombres,    c.nombres),
  apellidos    = COALESCE(u.apellidos,  c.apellidos),
  documento    = COALESCE(u.documento,  c.documento),
  tipo_persona = COALESCE(u.tipo_persona, 'natural'),
  telefono     = COALESCE(u.telefono,   c.telefono)
FROM condor.comisionista c
WHERE u.id_comisionista = c.id_comisionista;

-- 5c: Insert only comisionistas with NO match by id_comisionista AND NO match by email
INSERT INTO condor.usuarios (
  email, id_rol, nombres, apellidos, documento, tipo_persona, telefono, activo, fecha_creacion
)
SELECT
  c.mail,
  (SELECT id_rol FROM condor.roles WHERE nombre = 'comisionista' LIMIT 1),
  c.nombres, c.apellidos, c.documento,
  'natural', c.telefono,
  TRUE, NOW()
FROM condor.comisionista c
WHERE NOT EXISTS (
    SELECT 1 FROM condor.usuarios u WHERE u.id_comisionista = c.id_comisionista
  )
  AND (
    c.mail IS NULL
    OR NOT EXISTS (SELECT 1 FROM condor.usuarios u WHERE u.email = c.mail)
  );

-- ================================================================
-- STEP 6: Add id_usuario to venta_comprador and populate it
-- ================================================================
ALTER TABLE condor.venta_comprador
  ADD COLUMN IF NOT EXISTS id_usuario INTEGER;

-- Primary: match via id_comprador on usuarios
UPDATE condor.venta_comprador vc
SET id_usuario = u.id_usuario
FROM condor.usuarios u
WHERE u.id_comprador = vc.id_comprador
  AND vc.id_usuario IS NULL;

-- Fallback: match via documento (covers freshly-inserted usuarios from 4c)
UPDATE condor.venta_comprador vc
SET id_usuario = u.id_usuario
FROM condor.comprador c
JOIN condor.usuarios u ON u.documento = c.documento
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
JOIN condor.usuarios u ON u.documento = c.documento
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
-- CASCADE removes FK constraints that reference these tables
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
-- ================================================================
SELECT
  (SELECT COUNT(*) FROM condor.usuarios)             AS total_usuarios,
  (SELECT COUNT(*) FROM condor.venta_comprador)      AS filas_venta_comprador,
  (SELECT COUNT(*) FROM condor.venta_comisionista)   AS filas_venta_comisionista,
  (SELECT COUNT(*) FROM condor.venta_comprador   WHERE id_usuario IS NULL) AS vc_sin_usuario,
  (SELECT COUNT(*) FROM condor.venta_comisionista WHERE id_usuario IS NULL) AS vco_sin_usuario;
