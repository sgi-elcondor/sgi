-- SGI El Condor — POL-02 Doble firma en compras grandes de requerimientos
-- Ejecutar en el SQL Editor de Supabase (schema: condor)
-- Idempotente: seguro de re-ejecutar. Usa WHERE NOT EXISTS en lugar de ON CONFLICT
-- para no depender de nombres de constraint especificos.

-- ================================================================
-- STEP 1: Nuevo rol `dueno` (ASCII interno, "Dueno" con enie en la descripcion)
-- ================================================================
INSERT INTO condor.roles (nombre, descripcion, obligaciones)
SELECT
  'dueno',
  E'Dueno del negocio. Aprueba las compras grandes de requerimientos junto con gerencia y define el umbral que las clasifica como grandes.',
  E'Revisar y firmar la aprobacion de compras que superen el umbral configurado.\nCoordinar con gerencia la aprobacion conjunta de compras grandes.\nAjustar el umbral de compra grande desde Permisos cuando el negocio lo requiera.'
WHERE NOT EXISTS (SELECT 1 FROM condor.roles WHERE nombre = 'dueno');

-- ================================================================
-- STEP 2: Nuevos permisos
--   requerimientos:aprobar_dueno    -> firma del dueno para compras grandes
--   requerimientos:aprobar_gerencia -> co-firma de gerencia para compras grandes
--   config:leer / config:actualizar -> lectura/escritura de configuracion global
-- ================================================================
INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'requerimientos', 'aprobar_dueno', 'Firmar la aprobacion del dueno en compras grandes de requerimientos.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'requerimientos' AND accion = 'aprobar_dueno');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'requerimientos', 'aprobar_gerencia', 'Co-firmar como gerencia la aprobacion de compras grandes de requerimientos.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'requerimientos' AND accion = 'aprobar_gerencia');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'config', 'leer', 'Ver la configuracion global del sistema (umbrales, politicas).'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'config' AND accion = 'leer');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'config', 'actualizar', 'Modificar la configuracion global del sistema.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'config' AND accion = 'actualizar');

-- Vistas del flujo de requerimientos (si no existen aun en el catalogo).
-- El resto (dashboard, proyectos, lotes, ...) se asume ya sembradas por instalaciones previas.
INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'vista', 'aprobaciones', 'Ver el modulo de aprobaciones de requerimientos.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'vista' AND accion = 'aprobaciones');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'vista', 'requerimientos', 'Ver el modulo de requerimientos.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'vista' AND accion = 'requerimientos');

INSERT INTO condor.permisos (recurso, accion, descripcion)
SELECT 'vista', 'desembolsos', 'Ver el modulo de desembolsos.'
WHERE NOT EXISTS (SELECT 1 FROM condor.permisos WHERE recurso = 'vista' AND accion = 'desembolsos');

-- ================================================================
-- STEP 3: Ampliar `requerimiento` con firmas de dueno + gerencia
--   Se conserva aprobado_final_por / fecha_aprobado_final (compras chicas: firma unica).
--   Las nuevas columnas se llenan solo en compras grandes (dual sign).
-- ================================================================
ALTER TABLE condor.requerimiento
  ADD COLUMN IF NOT EXISTS aprobado_dueno_por    INT REFERENCES condor.usuarios(id_usuario),
  ADD COLUMN IF NOT EXISTS fecha_aprobado_dueno  DATE,
  ADD COLUMN IF NOT EXISTS aprobado_gerencia_por INT REFERENCES condor.usuarios(id_usuario),
  ADD COLUMN IF NOT EXISTS fecha_aprobado_gerencia DATE;

-- ================================================================
-- STEP 4: Tabla `config_sistema` (key-value con tipo)
-- ================================================================
CREATE TABLE IF NOT EXISTS condor.config_sistema (
  clave           TEXT PRIMARY KEY,
  valor           TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'number',   -- number | text | json
  descripcion     TEXT,
  actualizado_por INT REFERENCES condor.usuarios(id_usuario),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- STEP 5: Valor inicial del umbral de compra grande (COP 5.000.000)
-- ================================================================
INSERT INTO condor.config_sistema (clave, valor, tipo, descripcion)
SELECT
  'umbral_compra_grande',
  '5000000',
  'number',
  'Monto (COP) a partir del cual las compras de requerimientos requieren doble firma (dueno + gerencia).'
WHERE NOT EXISTS (SELECT 1 FROM condor.config_sistema WHERE clave = 'umbral_compra_grande');

-- ================================================================
-- STEP 6: rol_permiso — asignar permisos a los roles
--
--   `dueno` (nuevo rol): perfil "supervisor del negocio"
--     LECTURA amplia (catalogo, cartera, gastos, banco, reportes, auditoria,
--     juridico, personal, portal comprador). ESCRITURA estrategica minima:
--     crear/firmar requerimientos, ajustar umbral de compra grande, subir
--     archivos. NO opera el dia a dia (no crea ventas, no acepta pagos, no
--     registra gastos ni desembolsos, no edita usuarios).
--
--   `gerencia` recibe (adicionales, mantiene los que ya tenia):
--     - requerimientos:aprobar_gerencia (co-firma en compras grandes)
--     - config:leer (ver el umbral, sin editar)
--
--   `admin` no necesita entradas — bypass en middleware.
-- ================================================================
INSERT INTO condor.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM condor.roles r
CROSS JOIN condor.permisos p
WHERE r.nombre = 'dueno'
  AND (p.recurso || ':' || p.accion) IN (
    -- ── Vistas: pantallas visibles en el sidebar ──
    'vista:dashboard',
    'vista:proyectos', 'vista:lotes', 'vista:compradores', 'vista:ventas', 'vista:el-proyecto',
    'vista:requerimientos', 'vista:aprobaciones', 'vista:desembolsos', 'vista:recepciones',
    'vista:cuotas', 'vista:pagos', 'vista:comisionistas', 'vista:facturas', 'vista:recibos',
    'vista:gastos', 'vista:bank-transactions', 'vista:payment-validation',
    'vista:reportes', 'vista:alertas', 'vista:auditoria', 'vista:personal', 'vista:usuarios', 'vista:roles',
    'vista:juridico',
    'vista:mis-cuotas', 'vista:mis-facturas', 'vista:mis-recibos',

    -- ── Dashboard: todos los widgets (operacion, cartera, comisiones, juridico) ──
    'dashboard:ver_operacion', 'dashboard:ver_cartera', 'dashboard:ver_comisiones', 'dashboard:ver_juridico',

    -- ── Lectura de operacion ──
    'proyectos:leer', 'lotes:leer', 'compradores:leer', 'ventas:leer',

    -- ── Lectura de finanzas (todo lo que involucra dinero) ──
    'cuotas:leer', 'pagos:leer', 'comisionistas:leer',
    'facturas:leer', 'recibos:leer', 'gastos:leer',
    'bank_transactions:leer', 'validacion_pagos:leer',

    -- ── Lectura de control ──
    'reportes:leer', 'reportes_dir:leer',
    'alertas_jur:leer', 'observaciones_jur:leer',
    'usuarios:leer', 'roles:leer',

    -- ── Portal comprador (por si el dueno tiene compras personales) ──
    'mi_cuenta:leer',
    'mis_ventas:leer', 'mis_pagos:leer', 'mis_facturas:leer', 'mis_recibos:leer', 'mis_cuotas:leer',

    -- ── Requerimientos: crear (pedir cosas) + firmar (POL-02) ──
    'requerimientos:leer', 'requerimientos:crear',
    'requerimientos:aprobar_final', 'requerimientos:aprobar_dueno',
    'recepciones:leer',

    -- ── Adjuntar archivos (comprobantes cuando sea necesario) ──
    'uploads:crear',

    -- ── Configuracion global (ajustar umbral de compra grande) ──
    'config:leer', 'config:actualizar'
  )
  AND NOT EXISTS (
    SELECT 1 FROM condor.rol_permiso rp
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );

INSERT INTO condor.rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM condor.roles r
CROSS JOIN condor.permisos p
WHERE r.nombre = 'gerencia'
  AND (
    (p.recurso = 'requerimientos' AND p.accion = 'aprobar_gerencia')
    OR (p.recurso = 'config' AND p.accion = 'leer')
  )
  AND NOT EXISTS (
    SELECT 1 FROM condor.rol_permiso rp
    WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
  );

-- ================================================================
-- Verificacion
-- ================================================================
SELECT 'Rol dueno' AS check, COUNT(*) AS count FROM condor.roles WHERE nombre = 'dueno'
UNION ALL SELECT 'Permisos POL-02', COUNT(*) FROM condor.permisos
  WHERE (recurso = 'requerimientos' AND accion IN ('aprobar_dueno', 'aprobar_gerencia'))
     OR (recurso = 'config' AND accion IN ('leer', 'actualizar'))
UNION ALL SELECT 'Columnas requerimiento', COUNT(*) FROM information_schema.columns
  WHERE table_schema = 'condor' AND table_name = 'requerimiento'
    AND column_name IN ('aprobado_dueno_por', 'fecha_aprobado_dueno', 'aprobado_gerencia_por', 'fecha_aprobado_gerencia')
UNION ALL SELECT 'config_sistema rows', COUNT(*) FROM condor.config_sistema
UNION ALL SELECT 'rol_permiso dueno (esperado ~55)', COUNT(*) FROM condor.rol_permiso rp
  JOIN condor.roles r ON r.id_rol = rp.id_rol WHERE r.nombre = 'dueno'
UNION ALL SELECT 'rol_permiso gerencia (nuevos)', COUNT(*) FROM condor.rol_permiso rp
  JOIN condor.roles r    ON r.id_rol      = rp.id_rol
  JOIN condor.permisos p ON p.id_permiso  = rp.id_permiso
  WHERE r.nombre = 'gerencia'
    AND ((p.recurso = 'requerimientos' AND p.accion = 'aprobar_gerencia')
      OR (p.recurso = 'config' AND p.accion = 'leer'));
