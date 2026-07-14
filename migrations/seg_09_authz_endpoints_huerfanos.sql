-- SGI El Condor — SEG-09 Cierre de endpoints sin autorizacion explicita
-- Ejecutar en el SQL Editor de Supabase (schema: condor). Idempotente.
--
-- La auditoria de sincronizacion encontro rutas montadas sin entrada en
-- ROUTE_PERMISSIONS (cualquier usuario autenticado podia consumirlas):
-- estado financiero de ventas, cartera/recaudo, bitacora de auditoria,
-- generacion de facturas pendientes y lectura/edicion de config por clave.
-- El codigo ya las registra; esta migracion crea el permiso nuevo y concede
-- los permisos que los roles legitimos necesitan para no perder acceso.

-- ================================================================
-- STEP 1: Permiso nuevo auditoria_log:leer (bitacora de operaciones)
-- ================================================================
insert into condor.permisos (recurso, accion, descripcion)
select 'auditoria_log', 'leer', 'Consultar la bitacora de auditoria de operaciones (vista Auditoria y widget de ultimos movimientos).'
where not exists (select 1 from condor.permisos where recurso = 'auditoria_log' and accion = 'leer');

-- ================================================================
-- STEP 2: Conceder auditoria_log:leer a quien ya usa esa informacion:
--   roles con la vista Auditoria y roles con el widget de operacion
--   del dashboard (dashboard:ver_operacion).
-- ================================================================
insert into condor.rol_permiso (id_rol, id_permiso)
select distinct rp.id_rol, p_new.id_permiso
from condor.rol_permiso rp
join condor.permisos p_old on p_old.id_permiso = rp.id_permiso
 and (
   (p_old.recurso = 'vista' and p_old.accion = 'auditoria') or
   (p_old.recurso = 'dashboard' and p_old.accion = 'ver_operacion')
 )
join condor.permisos p_new on p_new.recurso = 'auditoria_log' and p_new.accion = 'leer'
where not exists (
  select 1 from condor.rol_permiso x
  where x.id_rol = rp.id_rol and x.id_permiso = p_new.id_permiso
);

-- ================================================================
-- STEP 3: El formulario de ventas consume lotes, compradores y
--   comisionistas; los roles que crean/solicitan ventas deben poder
--   leerlos (sincroniza con el nuevo VISTA_API_MAP de 'ventas').
-- ================================================================
insert into condor.rol_permiso (id_rol, id_permiso)
select distinct rp.id_rol, p_new.id_permiso
from condor.rol_permiso rp
join condor.permisos p_old on p_old.id_permiso = rp.id_permiso
 and p_old.recurso = 'ventas' and p_old.accion in ('crear', 'solicitar')
join condor.permisos p_new on p_new.accion = 'leer'
 and p_new.recurso in ('lotes', 'compradores', 'comisionistas')
where not exists (
  select 1 from condor.rol_permiso x
  where x.id_rol = rp.id_rol and x.id_permiso = p_new.id_permiso
);

-- Verificacion
select r.nombre, p.recurso || ':' || p.accion as permiso
from condor.rol_permiso rp
join condor.roles r    on r.id_rol = rp.id_rol
join condor.permisos p on p.id_permiso = rp.id_permiso
where p.recurso = 'auditoria_log'
order by r.nombre;
