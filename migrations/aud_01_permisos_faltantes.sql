-- AUD-PD001 / AUD-PD002 — Permisos exigidos por rutas que no existían como fila.
--
-- Síntoma: DELETE /api/v1/cuotas/:id/fracciones y POST /api/v1/reportes/mora-sync
-- exigen permisos que no estaban en condor.permisos, así que verificarPermiso
-- respondía 403 a todo rol distinto de `admin` (que hace bypass). Además
-- VISTA_API_MAP intentaba conceder `cuotas:eliminar` al activar la vista Cuotas
-- y la concesión se perdía en silencio.
--
-- Aplicado el 2026-07-29 vía PostgREST (idempotente).

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'cuotas', 'eliminar', 'Eliminar fracciones de una cuota'
WHERE NOT EXISTS (
  SELECT 1 FROM condor.permisos WHERE recurso = 'cuotas' AND accion = 'eliminar'
);

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'reportes', 'mora_sync', 'Forzar la resincronizacion del estado de mora'
WHERE NOT EXISTS (
  SELECT 1 FROM condor.permisos WHERE recurso = 'reportes' AND accion = 'mora_sync'
);

-- Concesiones: sólo los roles que hoy operan esas acciones.
INSERT INTO condor.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM condor.roles r
CROSS JOIN condor.permisos p
WHERE p.recurso = 'cuotas' AND p.accion = 'eliminar'
  AND r.nombre IN ('auxiliar_contable')
  AND NOT EXISTS (
    SELECT 1 FROM condor.rol_permiso rp
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );

INSERT INTO condor.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM condor.roles r
CROSS JOIN condor.permisos p
WHERE p.recurso = 'reportes' AND p.accion = 'mora_sync'
  AND r.nombre IN ('auxiliar_contable', 'gerencia')
  AND NOT EXISTS (
    SELECT 1 FROM condor.rol_permiso rp
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DELETE FROM condor.rol_permiso
--  WHERE id_permiso IN (SELECT id_permiso FROM condor.permisos
--                       WHERE (recurso, accion) IN (('cuotas','eliminar'), ('reportes','mora_sync')));
-- DELETE FROM condor.permisos
--  WHERE (recurso, accion) IN (('cuotas','eliminar'), ('reportes','mora_sync'));
