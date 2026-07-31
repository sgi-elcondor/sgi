-- Revisión de privilegios (auditoría de entrega) — retirar la lectura de la
-- bitácora de auditoría al rol asesor_comercial.
--
-- Hallazgo: `auditoria_log:leer` estaba otorgado a admin, dueno, gerencia,
-- auxiliar_contable y asesor_comercial. Los cuatro primeros encajan con el
-- perfil de supervisión; un asesor comercial no tiene por qué leer la bitácora
-- de cambios sensibles del sistema (contiene movimientos de dinero, cambios de
-- rol y de permisos de todos los usuarios). Se interpreta como un otorgamiento
-- accidental desde la vista Permisos.
--
-- Efecto: el asesor deja de ver la vista Auditoría y GET /api/v1/reportes/auditoria
-- le responde 403. No afecta ninguna otra funcionalidad de su rol.

DELETE FROM condor.rol_permiso
WHERE id_rol = (SELECT id_rol FROM condor.roles WHERE nombre = 'asesor_comercial')
  AND id_permiso = (
    SELECT id_permiso FROM condor.permisos
    WHERE recurso = 'auditoria_log' AND accion = 'leer'
  );

-- Verificación: debe devolver admin, dueno, gerencia, auxiliar_contable.
-- SELECT r.nombre
--   FROM condor.rol_permiso rp
--   JOIN condor.roles r    ON r.id_rol = rp.id_rol
--   JOIN condor.permisos p ON p.id_permiso = rp.id_permiso
--  WHERE p.recurso = 'auditoria_log' AND p.accion = 'leer'
--  ORDER BY r.nombre;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- INSERT INTO condor.rol_permiso (id_rol, id_permiso)
-- SELECT (SELECT id_rol FROM condor.roles WHERE nombre = 'asesor_comercial'),
--        (SELECT id_permiso FROM condor.permisos
--          WHERE recurso = 'auditoria_log' AND accion = 'leer');
