-- SGI El Condor — SEG-04 2FA por email para roles sensibles + revocacion periodica de sesion
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente: seguro de re-ejecutar.

-- ================================================================
-- STEP 1: roles que exigen 2FA en el login
-- ================================================================
ALTER TABLE condor.roles
  ADD COLUMN IF NOT EXISTS requiere_2fa BOOLEAN NOT NULL DEFAULT false;

UPDATE condor.roles SET requiere_2fa = true
  WHERE nombre IN ('admin', 'auxiliar_contable', 'gerencia');

-- ================================================================
-- STEP 2: estado de 2FA y revocacion de sesion por usuario
--   dosfa_configurado_en    -> primera vez que verifico un codigo (AC3)
--   dosfa_intentos_fallidos -> contador de codigos fallidos, separado
--                              del contador de contrasena (intentos_fallidos)
--   dosfa_bloqueado_hasta   -> bloqueo temporal por abuso del OTP
--   sesion_revocada_en      -> ultima vez que se forzo revokeRefreshTokens;
--                              usado para agendar el proximo cierre mensual
-- ================================================================
ALTER TABLE condor.usuarios
  ADD COLUMN IF NOT EXISTS dosfa_configurado_en    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dosfa_intentos_fallidos INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dosfa_bloqueado_hasta   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sesion_revocada_en      TIMESTAMPTZ;

-- ================================================================
-- STEP 3: retos de 2FA (uno por intento de login de un rol sensible)
--   Solo se guarda el hash del codigo, nunca el codigo en claro.
-- ================================================================
CREATE TABLE IF NOT EXISTS condor.login_2fa (
  id_challenge  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario    INT NOT NULL REFERENCES condor.usuarios(id_usuario),
  codigo_hash   TEXT NOT NULL,
  intentos      INT NOT NULL DEFAULT 0,
  reenvios      INT NOT NULL DEFAULT 0,
  expira_en     TIMESTAMPTZ NOT NULL,
  consumido_en  TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_2fa_usuario ON condor.login_2fa (id_usuario);

-- ================================================================
-- STEP 4: verificacion
-- ================================================================
SELECT 'roles con requiere_2fa' AS check, COUNT(*) AS count
  FROM condor.roles WHERE requiere_2fa = true
UNION ALL
SELECT 'columnas usuarios 2fa/sesion', COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = 'condor' AND table_name = 'usuarios'
    AND column_name IN ('dosfa_configurado_en', 'dosfa_intentos_fallidos', 'dosfa_bloqueado_hasta', 'sesion_revocada_en')
UNION ALL
SELECT 'tabla login_2fa existe', COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = 'condor' AND table_name = 'login_2fa';
