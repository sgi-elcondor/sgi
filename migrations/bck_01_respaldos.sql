-- SGI El Condor — BCK-01 Respaldos y restauracion desde el panel de admin
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente donde es razonable (CHECK constraints y ENABLE RLS no fallan si ya existen).

CREATE TABLE IF NOT EXISTS condor.respaldo (
  id_respaldo     bigserial PRIMARY KEY,
  fecha           timestamptz NOT NULL DEFAULT now(),
  tipo            text NOT NULL CHECK (tipo IN ('completo','parcial')),
  alcance         text,
  tamano_bytes    bigint,
  ubicacion       text NOT NULL,
  ubicacion_r2    text,
  checksum_sha256 text,
  estado          text NOT NULL DEFAULT 'completado' CHECK (estado IN ('completado','fallido','purgado')),
  origen          text NOT NULL DEFAULT 'automatico' CHECK (origen IN ('automatico','manual')),
  detalle         text
);

CREATE TABLE IF NOT EXISTS condor.respaldo_restauracion (
  id_restauracion bigserial PRIMARY KEY,
  id_respaldo     bigint REFERENCES condor.respaldo(id_respaldo),
  alcance         text NOT NULL,
  estado          text NOT NULL DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso','completado','fallido')),
  solicitado_por  bigint REFERENCES condor.usuarios(id_usuario),
  solicitado_en   timestamptz NOT NULL DEFAULT now(),
  finalizado_en   timestamptz,
  detalle         text
);

-- El backend usa SUPABASE_SERVICE_KEY (service_role), que siempre ignora RLS,
-- asi que esto no cambia el comportamiento de la app. Solo cierra el acceso
-- via la anon/authenticated key de PostgREST (mismo patron que SEG-08).
ALTER TABLE condor.respaldo               ENABLE ROW LEVEL SECURITY;
ALTER TABLE condor.respaldo_restauracion  ENABLE ROW LEVEL SECURITY;

INSERT INTO condor.config_sistema (clave, valor, tipo, descripcion)
VALUES (
  'modo_mantenimiento',
  'false',
  'json',
  'Bloquea el acceso no-admin mientras dura una restauracion total de respaldo (BCK-01)'
)
ON CONFLICT (clave) DO NOTHING;

-- Verificacion
SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'condor'
    AND tablename IN ('respaldo', 'respaldo_restauracion');

SELECT clave, valor, tipo FROM condor.config_sistema WHERE clave = 'modo_mantenimiento';
