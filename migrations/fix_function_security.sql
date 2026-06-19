-- SGI El Condor — Correccion de WARNINGS de funciones (Supabase Database Linter)
-- Ejecutar en el SQL Editor de Supabase.
-- Idempotente: seguro de re-ejecutar.
--
-- Contexto (ver tambien migrations/fix_security_linter.sql):
--   - El backend ejecuta RPC con la SERVICE_ROLE key.
--   - next_consecutivo_condor (public) y actualizar_mora (condor) se llaman
--     por RPC desde el backend; las fn_* restantes son funciones de TRIGGER.
--   - Patron de bloqueo: revocar EXECUTE de PUBLIC/anon/authenticated y
--     otorgarlo explicito a service_role, para no perder acceso del backend.
--
-- Corrige:
--   1. function_search_path_mutable                       -> SET search_path
--   2. anon_security_definer_function_executable          -> REVOKE + GRANT service_role
--   3. authenticated_security_definer_function_executable -> REVOKE + GRANT service_role

-- ================================================================
-- PARTE 1: Fijar search_path en las funciones reportadas
-- ================================================================
-- search_path = condor, public cubre los objetos de la app sin incluir
-- pg_temp (evita el secuestro via objetos temporales). Usa regprocedure
-- para resolver la firma real de cada funcion (no depende de los args).
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname, p.proname) IN (
      ('public', 'next_consecutivo_condor'),
      ('condor', 'fn_aplicar_pago_a_cuota'),
      ('condor', 'actualizar_mora'),
      ('condor', 'fn_bloquear_update_estado_venta'),
      ('condor', 'fn_auditar_cambios')
    )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = condor, public', fn);
  END LOOP;
END $$;

-- ================================================================
-- PARTE 2: Quitar EXECUTE a los roles de la API y dejarlo solo al backend
-- ================================================================
-- Revoca de PUBLIC (de donde anon/authenticated lo heredan) y de los roles
-- de la API; re-otorga explicito a service_role para que el backend siga
-- ejecutando next_consecutivo_condor y actualizar_mora por RPC.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname, p.proname) IN (
      ('public', 'next_consecutivo_condor'),
      ('condor', 'fn_aplicar_pago_a_cuota'),
      ('condor', 'actualizar_mora'),
      ('condor', 'fn_bloquear_update_estado_venta'),
      ('condor', 'fn_auditar_cambios')
    )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- ================================================================
-- VERIFICACION
-- ================================================================
-- 1) proconfig debe contener "search_path=condor, public" en las 5 funciones.
SELECT n.nspname AS schema, p.proname AS funcion, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname, p.proname) IN (
  ('public', 'next_consecutivo_condor'),
  ('condor', 'fn_aplicar_pago_a_cuota'),
  ('condor', 'actualizar_mora'),
  ('condor', 'fn_bloquear_update_estado_venta'),
  ('condor', 'fn_auditar_cambios')
)
ORDER BY 1, 2;

-- 2) anon/authenticated = false ; service_role = true.
SELECT
  n.nspname || '.' || p.proname                                 AS funcion,
  has_function_privilege('anon',          p.oid, 'EXECUTE')     AS anon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')     AS authenticated,
  has_function_privilege('service_role',  p.oid, 'EXECUTE')     AS service_role
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname, p.proname) IN (
  ('public', 'next_consecutivo_condor'),
  ('condor', 'fn_aplicar_pago_a_cuota'),
  ('condor', 'actualizar_mora'),
  ('condor', 'fn_bloquear_update_estado_venta'),
  ('condor', 'fn_auditar_cambios')
)
ORDER BY 1;
