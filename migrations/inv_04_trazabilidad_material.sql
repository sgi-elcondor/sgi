-- SGI El Condor — INV-04 Trazabilidad completa de un material
-- Ejecutar en el SQL Editor de Supabase (schema: condor). Idempotente.
--
-- La cadena (solicitud → aprobaciones → desembolso → recepciones → entrega)
-- ya persiste fecha/responsable en cada paso. Esta migración solo asegura
-- piezas que INV-02 (entrega) creó a mano sin dejar migración, y el permiso
-- de lectura que la trazabilidad exige desde la vista de recepciones.

-- ================================================================
-- STEP 1: Columnas del paso de entrega (INV-02) — por si faltan
-- ================================================================
alter table condor.requerimiento
  add column if not exists fecha_entrega    date,
  add column if not exists entregado_por    int references condor.usuarios(id_usuario),
  add column if not exists entrega_receptor text;

-- Valor de enum 'entregado' (no-op si ya existe)
alter type condor.estado_requerimiento add value if not exists 'entregado';

-- ================================================================
-- STEP 2: requerimientos:leer para los roles que consultan recepciones
--   GET /requerimientos/:id/trazabilidad se gatea con requerimientos:leer;
--   el almacenista abre la trazabilidad desde la vista Recepciones.
-- ================================================================
insert into condor.rol_permiso (id_rol, id_permiso)
select rp.id_rol, p_new.id_permiso
from condor.rol_permiso rp
join condor.permisos p_old on p_old.id_permiso = rp.id_permiso
 and p_old.recurso = 'recepciones' and p_old.accion = 'leer'
join condor.permisos p_new on p_new.recurso = 'requerimientos' and p_new.accion = 'leer'
where not exists (
  select 1 from condor.rol_permiso x
  where x.id_rol = rp.id_rol and x.id_permiso = p_new.id_permiso
);
