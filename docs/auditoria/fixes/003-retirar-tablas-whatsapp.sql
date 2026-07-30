-- AUD-DB (Anexo D) — Retirar de la superficie expuesta las tablas de WhatsApp.
--
-- Hallazgo: `condor.whatsapp_conversacion` y `condor.whatsapp_mensaje` existen en
-- el esquema y NINGÚN código del backend las consulta. Pertenecen a la épica ALR
-- (alertas), que no llegó a implementarse.
--
-- OJO, dato relevante antes de ejecutar: `whatsapp_mensaje` NO está vacía.
--   whatsapp_conversacion ...  0 filas
--   whatsapp_mensaje ........ 12 filas
-- Su esquema es elaborado (template_name, estado, wa_message_id, intentos,
-- motivo_fallo, escalado, enviado_at/entregado_at/leido_at, id_venta,
-- id_requerimiento), es decir hubo una implementación parcial real.
--
-- Por eso NO se hace DROP. Se mueven a `condor_backup`, un esquema que PostgREST
-- no expone: desaparecen de la API y del alcance de la auditoría, no se pierde
-- ni una fila, y volver atrás es una línea. Si más adelante se retoma ALR, las
-- tablas y sus datos siguen ahí.

CREATE SCHEMA IF NOT EXISTS condor_backup;

ALTER TABLE IF EXISTS condor.whatsapp_mensaje      SET SCHEMA condor_backup;
ALTER TABLE IF EXISTS condor.whatsapp_conversacion SET SCHEMA condor_backup;

-- Verificación: ambas deben aparecer con schemaname = 'condor_backup'.
-- SELECT schemaname, tablename
--   FROM pg_tables
--  WHERE tablename LIKE 'whatsapp%'
--  ORDER BY tablename;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- ALTER TABLE IF EXISTS condor_backup.whatsapp_conversacion SET SCHEMA condor;
-- ALTER TABLE IF EXISTS condor_backup.whatsapp_mensaje      SET SCHEMA condor;

-- ── Alternativa destructiva (sólo si se confirma que los 12 registros no
-- ── interesan; irreversible) ────────────────────────────────────────────────
-- DROP TABLE IF EXISTS condor.whatsapp_mensaje;
-- DROP TABLE IF EXISTS condor.whatsapp_conversacion;
