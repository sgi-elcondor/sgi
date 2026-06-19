-- SGI El Condor — Correccion de hallazgos del Supabase Database Linter
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente: seguro de re-ejecutar.
--
-- Contexto:
--   - El backend se conecta con la SERVICE_ROLE key, que hace BYPASS de RLS.
--     Por eso habilitar RLS sin politicas no rompe el backend.
--   - El frontend NO usa supabase-js: solo consume la API Express.
--     Por eso ningun cliente legitimo depende de la anon key contra `condor`.
--   - Habilitar RLS sin politicas = "deny by default": bloquea anon/authenticated
--     y deja operando unicamente al service_role (el backend).
--
-- Corrige:
--   1. rls_disabled_in_public  -> ENABLE ROW LEVEL SECURITY en tablas de `condor`
--   2. security_definer_view   -> security_invoker = on en las vistas de `condor`
--   3. Saca las tablas de respaldo *_bak fuera de PostgREST (schema no expuesto)

-- ================================================================
-- PARTE 1: Mover tablas de respaldo *_bak a un schema NO expuesto
-- ================================================================
-- `condor_backup` no se agrega a "Exposed schemas", por lo que queda
-- fuera de PostgREST: deja de ser accesible via API y sale del linter,
-- conservando los datos por si se necesita restaurar.
CREATE SCHEMA IF NOT EXISTS condor_backup;

-- Blindaje: revocar cualquier acceso de los roles de la API a este schema.
REVOKE ALL ON SCHEMA condor_backup FROM anon, authenticated;

ALTER TABLE IF EXISTS condor.usuarios_bak           SET SCHEMA condor_backup;
ALTER TABLE IF EXISTS condor.comprador_bak          SET SCHEMA condor_backup;
ALTER TABLE IF EXISTS condor.comisionista_bak       SET SCHEMA condor_backup;
ALTER TABLE IF EXISTS condor.venta_comprador_bak    SET SCHEMA condor_backup;
ALTER TABLE IF EXISTS condor.venta_comisionista_bak SET SCHEMA condor_backup;
ALTER TABLE IF EXISTS condor.pago_bak               SET SCHEMA condor_backup;
ALTER TABLE IF EXISTS condor.comprador_recibo_bak   SET SCHEMA condor_backup;

-- ================================================================
-- PARTE 2: Habilitar RLS en las tablas reales de `condor`
-- ================================================================
-- Sin politicas asociadas => deny-by-default para anon/authenticated.
-- El service_role (backend) sigue accediendo sin restriccion.

-- Operacion / negocio
ALTER TABLE IF EXISTS condor.proyecto            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.lote                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.venta               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.venta_comprador     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.venta_comisionista  ENABLE ROW LEVEL SECURITY;

-- Cartera / cuotas
ALTER TABLE IF EXISTS condor.cuota               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.cuota_fraccion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.cuota_pago          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.cuota_factura       ENABLE ROW LEVEL SECURITY;

-- Facturacion / pagos / recibos
ALTER TABLE IF EXISTS condor.factura             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.pago                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.recibo              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.recibo_pago         ENABLE ROW LEVEL SECURITY;

-- Recepciones / requerimientos
ALTER TABLE IF EXISTS condor.recepcion           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.recepcion_item      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.requerimiento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.requerimiento_item  ENABLE ROW LEVEL SECURITY;

-- Identidad / seguridad / auditoria
ALTER TABLE IF EXISTS condor.usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.permisos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.rol_permiso         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS condor.auditoria           ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PARTE 3: Convertir las vistas a SECURITY INVOKER
-- ================================================================
-- Las vistas pasan a respetar permisos/RLS del rol que consulta.
-- El service_role (backend) las sigue viendo completas; anon/authenticated
-- quedan bloqueados por el RLS deny-by-default de las tablas base.
-- Requiere PostgreSQL 15+ (Supabase ya lo cumple).
ALTER VIEW IF EXISTS condor.v_aux_panel_operaciones_diarias    SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_cartera_consolidada             SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_cartera_juridica                SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_auditoria_basica_operaciones    SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_alertas_juridicas               SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_auditoria_juridica              SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_disponibilidad_comercial        SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_dir_cartera_resumen_hoy         SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_dir_recaudo_facturacion_hoy     SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_dir_recaudo_facturacion_historico SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_dir_auditoria                   SET (security_invoker = on);
ALTER VIEW IF EXISTS condor.vw_dir_comisiones_resumen          SET (security_invoker = on);

-- ================================================================
-- VERIFICACION
-- ================================================================
-- 1) No deben quedar tablas con RLS deshabilitado en `condor`.
SELECT relname AS tabla_sin_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'condor'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false
ORDER BY relname;

-- 2) Todas las vistas de `condor` deben tener security_invoker = on.
SELECT c.relname AS vista,
       (c.reloptions @> ARRAY['security_invoker=true']
        OR c.reloptions @> ARRAY['security_invoker=on']) AS es_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'condor'
  AND c.relkind = 'v'
ORDER BY c.relname;

-- 3) Las *_bak ya no deben existir en `condor` (deben estar en condor_backup).
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name LIKE '%\_bak'
ORDER BY table_schema, table_name;
