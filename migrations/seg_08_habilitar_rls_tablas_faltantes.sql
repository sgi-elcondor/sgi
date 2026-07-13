-- SGI El Condor — SEG-08 Habilitar RLS en tablas que quedaron sin activar
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente: ENABLE ROW LEVEL SECURITY no falla si ya esta activado.
--
-- El backend usa SUPABASE_SERVICE_KEY (service_role), que siempre ignora RLS,
-- asi que esto no cambia el comportamiento de la app. Solo cierra el acceso
-- via la anon/authenticated key de PostgREST, que hoy no se usa en ningun
-- lado del proyecto (no hay anon key en .env.example ni referencias a
-- Supabase en public/). No se agregan politicas: quedan igual que el resto
-- de las tablas del schema (cerradas a anon/authenticated, abiertas solo
-- para el backend).

ALTER TABLE condor.notificacion          ENABLE ROW LEVEL SECURITY;
ALTER TABLE condor.inventario_movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE condor.config_sistema        ENABLE ROW LEVEL SECURITY;

-- Verificacion
SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'condor'
    AND tablename IN ('notificacion', 'inventario_movimiento', 'config_sistema');
