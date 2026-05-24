-- SGI El Condor — Backup pre-unificacion de usuarios
-- Ejecutar ANTES de unificacion_usuarios.sql
-- Crea copias exactas de cada tabla afectada con sufijo _bak
-- Para restaurar: DROP TABLE condor.X; ALTER TABLE condor.X_bak RENAME TO X;

-- ================================================================
-- Tablas que se eliminan
-- ================================================================
DROP TABLE IF EXISTS condor.comprador_bak;
CREATE TABLE condor.comprador_bak AS
  SELECT * FROM condor.comprador;

DROP TABLE IF EXISTS condor.comisionista_bak;
CREATE TABLE condor.comisionista_bak AS
  SELECT * FROM condor.comisionista;

-- ================================================================
-- Tablas que se modifican (columnas nuevas + drop de columnas)
-- ================================================================
DROP TABLE IF EXISTS condor.usuarios_bak;
CREATE TABLE condor.usuarios_bak AS
  SELECT * FROM condor.usuarios;

DROP TABLE IF EXISTS condor.venta_comprador_bak;
CREATE TABLE condor.venta_comprador_bak AS
  SELECT * FROM condor.venta_comprador;

DROP TABLE IF EXISTS condor.venta_comisionista_bak;
CREATE TABLE condor.venta_comisionista_bak AS
  SELECT * FROM condor.venta_comisionista;

DROP TABLE IF EXISTS condor.pago_bak;
CREATE TABLE condor.pago_bak AS
  SELECT * FROM condor.pago;

-- comprador_recibo existe solo si fue creada en el schema
DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'condor' AND table_name = 'comprador_recibo'
  ) THEN
    EXECUTE 'DROP TABLE IF EXISTS condor.comprador_recibo_bak';
    EXECUTE 'CREATE TABLE condor.comprador_recibo_bak AS SELECT * FROM condor.comprador_recibo';
  END IF;
END $$;

-- ================================================================
-- Verificacion: muestra conteo de filas en cada backup
-- ================================================================
SELECT 'comprador_bak'       AS tabla, COUNT(*) AS filas FROM condor.comprador_bak
UNION ALL
SELECT 'comisionista_bak',             COUNT(*)           FROM condor.comisionista_bak
UNION ALL
SELECT 'usuarios_bak',                 COUNT(*)           FROM condor.usuarios_bak
UNION ALL
SELECT 'venta_comprador_bak',          COUNT(*)           FROM condor.venta_comprador_bak
UNION ALL
SELECT 'venta_comisionista_bak',       COUNT(*)           FROM condor.venta_comisionista_bak
UNION ALL
SELECT 'pago_bak',                     COUNT(*)           FROM condor.pago_bak;
