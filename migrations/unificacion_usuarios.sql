-- SGI El Condor — Unificacion de tabla de usuarios
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Orden estricto: cada paso depende del anterior

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
-- STEP 2: Migrate data from comprador to linked usuarios
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
-- STEP 3: Migrate data from comisionista to linked usuarios
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
-- STEP 4: Create usuarios for unlinked compradores
-- (compradores that exist in the comprador table but have no
--  matching row in usuarios with id_comprador set)
-- ================================================================
INSERT INTO condor.usuarios (
  email, id_rol, nombres, apellidos, documento,
  tipo_persona, tipo_documento, rango_pago, telefono, activo, fecha_creacion
)
SELECT
  c.mail,
  (SELECT id_rol FROM condor.roles WHERE nombre = 'comprador' LIMIT 1),
  c.nombres,
  c.apellidos,
  c.documento,
  COALESCE(c.tipo_persona, 'natural'),
  c.tipo_documento,
  c.rango_pago,
  c.telefono,
  (c.estado = 'activo'),
  NOW()
FROM condor.comprador c
WHERE NOT EXISTS (
  SELECT 1 FROM condor.usuarios u WHERE u.id_comprador = c.id_comprador
);

-- ================================================================
-- STEP 5: Create usuarios for unlinked comisionistas
-- ================================================================
INSERT INTO condor.usuarios (
  email, id_rol, nombres, apellidos, documento, tipo_persona, telefono, activo, fecha_creacion
)
SELECT
  c.mail,
  (SELECT id_rol FROM condor.roles WHERE nombre = 'comisionista' LIMIT 1),
  c.nombres,
  c.apellidos,
  c.documento,
  'natural',
  c.telefono,
  TRUE,
  NOW()
FROM condor.comisionista c
WHERE NOT EXISTS (
  SELECT 1 FROM condor.usuarios u WHERE u.id_comisionista = c.id_comisionista
);

-- ================================================================
-- STEP 6: Add id_usuario to venta_comprador and populate it
-- ================================================================
ALTER TABLE condor.venta_comprador
  ADD COLUMN IF NOT EXISTS id_usuario INTEGER;

-- Linked compradores (have a matching usuario with id_comprador set)
UPDATE condor.venta_comprador vc
SET id_usuario = u.id_usuario
FROM condor.usuarios u
WHERE u.id_comprador = vc.id_comprador;

-- Unlinked compradores (matched by documento, created in step 4)
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
WHERE u.id_comisionista = vc.id_comisionista;

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
  AND p.id_comprador IS NOT NULL;

-- ================================================================
-- STEP 9: Drop comprador and comisionista tables
-- CASCADE removes FK constraints in venta_comprador, venta_comisionista,
-- usuarios, pago, and any other dependent tables
-- ================================================================
DROP TABLE IF EXISTS condor.comprador_recibo CASCADE;
DROP TABLE IF EXISTS condor.comprador    CASCADE;
DROP TABLE IF EXISTS condor.comisionista CASCADE;

-- ================================================================
-- STEP 10: Drop orphaned columns from related tables
-- ================================================================
ALTER TABLE condor.venta_comprador   DROP COLUMN IF EXISTS id_comprador;
ALTER TABLE condor.venta_comisionista DROP COLUMN IF EXISTS id_comisionista;
ALTER TABLE condor.pago              DROP COLUMN IF EXISTS id_comprador;
ALTER TABLE condor.usuarios          DROP COLUMN IF EXISTS id_comprador;
ALTER TABLE condor.usuarios          DROP COLUMN IF EXISTS id_comisionista;

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
