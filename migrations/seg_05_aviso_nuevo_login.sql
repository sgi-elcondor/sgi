-- SGI El Condor — SEG-05 Aviso por correo de "nuevo inicio de sesion"
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente: seguro de re-ejecutar.

ALTER TABLE condor.usuarios
  ADD COLUMN IF NOT EXISTS ultima_ip_login TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_login_en TIMESTAMPTZ;

-- Verificacion
SELECT COUNT(*) AS columnas_nuevas
  FROM information_schema.columns
  WHERE table_schema = 'condor' AND table_name = 'usuarios'
    AND column_name IN ('ultima_ip_login', 'ultimo_login_en');
