-- SGI El Condor — ALI-01/ALI-02 Empresas aliadas (proveedores, socios)
-- Ejecutar en el SQL Editor de Supabase (schema: condor). Idempotente.
--
-- ALI-01: catalogo de empresas aliadas con razon social, NIT (con digito de
--         verificacion DIAN validado en backend), RUP, codigos de actividad
--         (UNSPSC/CIIU) y datos de contacto.
-- ALI-02: vinculo opcional de gastos y requerimientos (en el desembolso) a
--         una empresa, para centralizar el historial comercial por proveedor.

-- ================================================================
-- STEP 1: Tabla empresa_aliada
-- ================================================================
create table if not exists condor.empresa_aliada (
  id_empresa        serial primary key,
  razon_social      text not null,
  nit               text not null unique,
  rup               text not null,
  codigos_actividad text[] not null default '{}',
  tipo              text not null default 'proveedor'
                    check (tipo in ('proveedor', 'socio', 'contratista', 'otro')),
  contacto_nombre   text,
  contacto_email    text,
  contacto_telefono text,
  direccion         text,
  ciudad            text,
  notas             text,
  activo            boolean not null default true,
  creado_por        int references condor.usuarios(id_usuario),
  created_at        timestamptz not null default now()
);

alter table condor.empresa_aliada enable row level security;

-- ================================================================
-- STEP 2: Vinculos ALI-02 (gasto y requerimiento → empresa)
-- ================================================================
alter table condor.gasto
  add column if not exists id_empresa int references condor.empresa_aliada(id_empresa);

alter table condor.requerimiento
  add column if not exists id_empresa int references condor.empresa_aliada(id_empresa);

create index if not exists idx_gasto_id_empresa         on condor.gasto(id_empresa);
create index if not exists idx_requerimiento_id_empresa on condor.requerimiento(id_empresa);

-- ================================================================
-- STEP 3: Permisos nuevos
-- ================================================================
insert into condor.permisos (recurso, accion, descripcion)
select 'empresas_aliadas', 'leer', 'Consultar el catalogo de empresas aliadas y su historial comercial.'
where not exists (select 1 from condor.permisos where recurso = 'empresas_aliadas' and accion = 'leer');

insert into condor.permisos (recurso, accion, descripcion)
select 'empresas_aliadas', 'crear', 'Registrar empresas aliadas (razon social, NIT, RUP, codigos de actividad, contacto).'
where not exists (select 1 from condor.permisos where recurso = 'empresas_aliadas' and accion = 'crear');

insert into condor.permisos (recurso, accion, descripcion)
select 'empresas_aliadas', 'actualizar', 'Editar o desactivar empresas aliadas.'
where not exists (select 1 from condor.permisos where recurso = 'empresas_aliadas' and accion = 'actualizar');

insert into condor.permisos (recurso, accion, descripcion)
select 'vista', 'empresas-aliadas', 'Ver el modulo de empresas aliadas.'
where not exists (select 1 from condor.permisos where recurso = 'vista' and accion = 'empresas-aliadas');

-- ================================================================
-- STEP 4: Grants
--   gerencia y dueno (stakeholders ALI-01): vista + CRUD completo.
--   Roles que crean gastos o desembolsan (ALI-02): leer, para el
--   autocompletado al vincular. admin no necesita filas (bypass).
-- ================================================================
insert into condor.rol_permiso (id_rol, id_permiso)
select r.id_rol, p.id_permiso
from condor.roles r
cross join condor.permisos p
where r.nombre in ('gerencia', 'dueno')
  and (
    (p.recurso = 'empresas_aliadas' and p.accion in ('leer', 'crear', 'actualizar'))
    or (p.recurso = 'vista' and p.accion = 'empresas-aliadas')
  )
  and not exists (
    select 1 from condor.rol_permiso x
    where x.id_rol = r.id_rol and x.id_permiso = p.id_permiso
  );

insert into condor.rol_permiso (id_rol, id_permiso)
select distinct rp.id_rol, p_new.id_permiso
from condor.rol_permiso rp
join condor.permisos p_old on p_old.id_permiso = rp.id_permiso
 and (
   (p_old.recurso = 'gastos' and p_old.accion = 'crear') or
   (p_old.recurso = 'requerimientos' and p_old.accion = 'desembolsar')
 )
join condor.permisos p_new on p_new.recurso = 'empresas_aliadas' and p_new.accion = 'leer'
where not exists (
  select 1 from condor.rol_permiso x
  where x.id_rol = rp.id_rol and x.id_permiso = p_new.id_permiso
);

-- Verificacion
select r.nombre, p.recurso, p.accion
from condor.rol_permiso rp
join condor.roles r    on r.id_rol = rp.id_rol
join condor.permisos p on p.id_permiso = rp.id_permiso
where p.recurso = 'empresas_aliadas' or (p.recurso = 'vista' and p.accion = 'empresas-aliadas')
order by r.nombre, p.accion;
