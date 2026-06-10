-- SGI El Condor — Recrear vistas eliminadas por DROP TABLE comprador CASCADE
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente: usa CREATE OR REPLACE VIEW

-- ================================================================
-- 1. Panel diario — KPIs para auxiliar contable y dashboard
--    Campos: ventas_activas, recaudo_mes, cuotas_vencidas, cuotas_en_mora
-- ================================================================
CREATE OR REPLACE VIEW condor.v_aux_panel_operaciones_diarias AS
SELECT
  (
    SELECT COUNT(*)::INTEGER
    FROM condor.venta
    WHERE estado = 'activa'
  ) AS ventas_activas,
  (
    -- RN-10/RN-19: only receipt-backed accepted payments are realized income.
    SELECT COALESCE(SUM(p.valor_pago), 0)
    FROM condor.pago p
    WHERE p.estado = 'aceptado'
      AND DATE_TRUNC('month', p.fecha_pago::date) = DATE_TRUNC('month', CURRENT_DATE)
      AND EXISTS (SELECT 1 FROM condor.recibo_pago rp WHERE rp.id_pago = p.id_pago)
  ) AS recaudo_mes,
  (
    -- RN-16: overdue cuota = past due AND not fully covered by receipts (derived, not stored estado).
    SELECT COUNT(*)::INTEGER
    FROM condor.cuota c
    WHERE c.fecha_vencimiento < CURRENT_DATE
      AND c.valor_cuota > COALESCE((
        SELECT SUM(cp.valor_aplicado)
        FROM condor.cuota_pago cp
        JOIN condor.pago p ON p.id_pago = cp.id_pago
        WHERE cp.id_cuota = c.id_cuota
          AND p.estado = 'aceptado'
          AND EXISTS (SELECT 1 FROM condor.recibo_pago rp WHERE rp.id_pago = p.id_pago)
      ), 0)
  ) AS cuotas_vencidas,
  (
    SELECT COUNT(*)::INTEGER
    FROM condor.venta
    WHERE estado = 'en_mora'
  ) AS cuotas_en_mora;

-- ================================================================
-- 2. Cartera consolidada — resumen de ventas activas con saldo
--    (fetched en reportes pero valores calculados en frontend
--     desde otras fuentes; se mantiene por compatibilidad)
-- ================================================================
CREATE OR REPLACE VIEW condor.vw_cartera_consolidada AS
SELECT
  v.id_venta,
  v.estado,
  v.valor_total,
  pr.nombre AS proyecto,
  l.codigo_lote,
  (
    SELECT TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellidos, '')))
    FROM condor.venta_comprador vc
    JOIN condor.usuarios u ON u.id_usuario = vc.id_usuario
    WHERE vc.id_venta = v.id_venta
    ORDER BY vc.porcentaje DESC NULLS LAST
    LIMIT 1
  ) AS comprador,
  -- RN-10: saldo = total cuota value minus receipt-backed accepted payments (single source).
  COALESCE((
    SELECT SUM(c.valor_cuota)
    FROM condor.cuota c
    WHERE c.id_venta = v.id_venta
  ), 0)
  - COALESCE((
    SELECT SUM(cp.valor_aplicado)
    FROM condor.cuota_pago cp
    JOIN condor.cuota c2 ON c2.id_cuota = cp.id_cuota
    JOIN condor.pago p   ON p.id_pago  = cp.id_pago
    WHERE c2.id_venta = v.id_venta
      AND p.estado = 'aceptado'
      AND EXISTS (SELECT 1 FROM condor.recibo_pago rp WHERE rp.id_pago = p.id_pago)
  ), 0) AS saldo_pendiente
FROM condor.venta v
JOIN condor.lote l        ON l.id_lote     = v.id_lote
JOIN condor.proyecto pr   ON pr.id_proyecto = l.id_proyecto
WHERE v.estado NOT IN ('cancelada');

-- ================================================================
-- 3. Cartera juridica — ventas en mora/pre-mora/devolucion
--    Campos: id_venta, proyecto, codigo_lote, comprador,
--            estado, dias_mora, valor_total, saldo
-- ================================================================
CREATE OR REPLACE VIEW condor.vw_cartera_juridica AS
SELECT
  v.id_venta,
  v.estado,
  v.valor_total,
  pr.nombre AS proyecto,
  l.codigo_lote,
  (
    SELECT TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellidos, '')))
    FROM condor.venta_comprador vc
    JOIN condor.usuarios u ON u.id_usuario = vc.id_usuario
    WHERE vc.id_venta = v.id_venta
    ORDER BY vc.porcentaje DESC NULLS LAST
    LIMIT 1
  ) AS comprador,
  (
    SELECT (CURRENT_DATE - MIN(c.fecha_vencimiento))::INTEGER
    FROM condor.cuota c
    WHERE c.id_venta       = v.id_venta
      AND c.estado         NOT IN ('pagada')
      AND c.fecha_vencimiento < CURRENT_DATE
  ) AS dias_mora,
  -- RN-10: saldo = total cuota value minus receipt-backed accepted payments (single source).
  COALESCE((
    SELECT SUM(c.valor_cuota)
    FROM condor.cuota c
    WHERE c.id_venta = v.id_venta
  ), 0)
  - COALESCE((
    SELECT SUM(cp.valor_aplicado)
    FROM condor.cuota_pago cp
    JOIN condor.cuota c2 ON c2.id_cuota = cp.id_cuota
    JOIN condor.pago p   ON p.id_pago  = cp.id_pago
    WHERE c2.id_venta = v.id_venta
      AND p.estado = 'aceptado'
      AND EXISTS (SELECT 1 FROM condor.recibo_pago rp WHERE rp.id_pago = p.id_pago)
  ), 0) AS saldo
FROM condor.venta v
JOIN condor.lote l        ON l.id_lote     = v.id_lote
JOIN condor.proyecto pr   ON pr.id_proyecto = l.id_proyecto
WHERE v.estado IN ('en_mora', 'pre_mora');

-- ================================================================
-- 4. Auditoria basica de operaciones
--    Campos: tabla_afectada, operacion, id_registro, campo,
--            valor_anterior, valor_nuevo, usuario, fecha_cambio
-- ================================================================
CREATE OR REPLACE VIEW condor.vw_auditoria_basica_operaciones AS
SELECT
  id_auditoria,
  tabla_afectada,
  CASE WHEN valor_anterior IS NULL THEN 'insert' ELSE 'update' END AS operacion,
  id_registro,
  campo,
  valor_anterior,
  valor_nuevo,
  usuario_db  AS usuario,
  fecha_cambio,
  motivo
FROM condor.auditoria
ORDER BY fecha_cambio DESC;

-- ================================================================
-- Verificacion: las 4 vistas deben aparecer
-- ================================================================
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'condor'
  AND table_name IN (
    'v_aux_panel_operaciones_diarias',
    'vw_cartera_consolidada',
    'vw_cartera_juridica',
    'vw_auditoria_basica_operaciones'
  )
ORDER BY table_name;
