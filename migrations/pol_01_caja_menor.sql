-- SGI El Condor — POL-01 Caja menor con flujo simplificado
-- Ejecutar en el SQL Editor de Supabase (schema: condor). Idempotente.
--
-- Requerimientos con valor_total ESTRICTAMENTE MENOR a umbral_caja_menor
-- saltan la aprobacion final: aprobar-jefe los pasa directo a
-- pendiente_tesoreria. El umbral vive en config_sistema (editable por admin
-- desde la vista Permisos, card "Configuracion del sistema"). Si un admin lo
-- configura por encima de umbral_compra_grande, la regla de compra grande
-- gana (la doble firma nunca se salta).

insert into condor.config_sistema (clave, valor, tipo, descripcion)
select
  'umbral_caja_menor',
  '500000',
  'number',
  'Monto (COP) por debajo del cual una compra de requerimientos es caja menor: solo necesita la aprobacion del jefe de area y pasa directo a tesoreria (POL-01).'
where not exists (
  select 1 from condor.config_sistema where clave = 'umbral_caja_menor'
);
