# Anexo · Diccionario de datos

_Generado automáticamente por `tools/audit/gen-data-dictionary.js` a partir del esquema `condor` vigente el 2026-07-31._

Este anexo se genera del esquema real y no se edita a mano: cualquier
divergencia entre el documento y la base de datos se corrige regenerándolo.

El esquema expone **35 tablas** y **12 vistas**. Las columnas marcadas
como obligatorias no admiten valor nulo.

## Operación comercial

### `proyecto`

Clave primaria: `id_proyecto`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_proyecto` | integer | Sí | PK | — |
| `nombre` | character varying | Sí | — | — |
| `ubicacion` | character varying | No | — | — |
| `estado` | condor.estado_proyecto | Sí | — | — |
| `fecha_creacion` | date | Sí | — | — |
| `descripcion` | text | No | — | — |
| `sigla` | character varying | No | — | — |
| `lat` | double precision | No | — | — |
| `lng` | double precision | No | — | — |

### `lote`

Clave primaria: `id_lote`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_lote` | integer | Sí | PK | — |
| `id_proyecto` | integer | Sí | FK → `proyecto.id_proyecto` | — |
| `codigo_lote` | character varying | Sí | — | — |
| `area_m2` | numeric | No | — | — |
| `precio_base` | integer | Sí | — | — |
| `estado` | condor.estado_lote | Sí | — | — |
| `descripcion` | text | No | — | — |
| `manzana` | character varying | Sí | — | — |
| `numero_lote` | character varying | Sí | — | — |
| `dimensiones` | character varying | Sí | — | — |
| `created_at` | timestamp with time zone | No | — | — |
| `geom` | jsonb | No | — | — |
| `foto_url` | text | No | — | — |

### `venta`

Clave primaria: `id_venta`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_venta` | integer | Sí | PK | — |
| `id_lote` | integer | Sí | FK → `lote.id_lote` | — |
| `fecha_venta` | date | Sí | — | — |
| `valor_total` | integer | Sí | — | — |
| `cuota_inicial` | integer | Sí | — | — |
| `estado` | condor.estado_venta | Sí | — | — |
| `observaciones` | text | No | — | — |
| `total_permutas` | numeric | No | — | — |
| `detalle_permutas` | text | No | — | — |
| `escriturado` | boolean | No | — | — |
| `fecha_escritura` | date | No | — | — |
| `codigo_venta` | text | No | — | — |

### `venta_comprador`

**Sin clave primaria declarada.**

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_venta` | integer | Sí | FK → `venta.id_venta` | — |
| `porcentaje` | numeric | Sí | — | — |
| `id_usuario` | integer | No | FK → `usuarios.id_usuario` | — |

### `venta_comisionista`

**Sin clave primaria declarada.**

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_venta` | integer | Sí | FK → `venta.id_venta` | — |
| `estado` | condor.estado_comision | Sí | — | — |
| `fecha_ganada` | date | No | — | — |
| `fecha_pagada` | date | No | — | — |
| `valor_comision` | integer | No | — | — |
| `pagada` | boolean | Sí | — | — |
| `fecha_pagado` | date | No | — | — |
| `causada` | boolean | No | — | — |
| `fecha_causada` | timestamp with time zone | No | — | — |
| `id_usuario` | integer | No | FK → `usuarios.id_usuario` | — |

### `empresa_aliada`

Clave primaria: `id_empresa`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_empresa` | integer | Sí | PK | — |
| `razon_social` | text | Sí | — | — |
| `nit` | text | Sí | — | — |
| `rup` | text | Sí | — | — |
| `codigos_actividad` | text[] | Sí | — | — |
| `tipo` | text | Sí | — | — |
| `contacto_nombre` | text | No | — | — |
| `contacto_email` | text | No | — | — |
| `contacto_telefono` | text | No | — | — |
| `direccion` | text | No | — | — |
| `ciudad` | text | No | — | — |
| `notas` | text | No | — | — |
| `activo` | boolean | Sí | — | — |
| `creado_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `created_at` | timestamp with time zone | Sí | — | — |

## Ciclo financiero

### `cuota`

Clave primaria: `id_cuota`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_cuota` | integer | Sí | PK | — |
| `id_venta` | integer | Sí | FK → `venta.id_venta` | — |
| `numero_cuota` | integer | Sí | — | — |
| `fecha_vencimiento` | date | Sí | — | — |
| `valor_cuota` | integer | Sí | — | — |
| `es_extraordinaria` | boolean | Sí | — | — |
| `estado` | condor.estado_cuota | Sí | — | — |
| `tipo` | text | No | — | — |

### `cuota_fraccion`

Clave primaria: `id_fraccion`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_fraccion` | integer | Sí | PK | — |
| `id_cuota` | integer | Sí | FK → `cuota.id_cuota` | — |
| `numero_fraccion` | smallint | Sí | — | — |
| `valor_fraccion` | numeric | Sí | — | — |
| `fecha_propuesta` | date | No | — | — |
| `notas` | text | No | — | — |
| `created_at` | timestamp with time zone | No | — | — |

### `factura`

Clave primaria: `id_factura`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_factura` | integer | Sí | PK | — |
| `numero_factura` | character varying | Sí | — | — |
| `fecha_emision` | date | Sí | — | — |
| `valor_facturado` | integer | Sí | — | — |
| `estado` | condor.estado_factura | Sí | — | — |
| `observaciones` | text | No | — | — |

### `cuota_factura`

Clave primaria: `id_cuota` + `id_factura`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_cuota` | integer | Sí | PK, FK → `cuota.id_cuota` | — |
| `id_factura` | integer | Sí | PK, FK → `factura.id_factura` | — |
| `id_fraccion` | integer | No | FK → `cuota_fraccion.id_fraccion` | — |

### `solicitud_factura`

Clave primaria: `id_solicitud`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_solicitud` | integer | Sí | PK | — |
| `id_cuota` | integer | Sí | FK → `cuota.id_cuota` | — |
| `id_usuario` | integer | Sí | FK → `usuarios.id_usuario` | — |
| `estado` | text | Sí | — | — |
| `nota` | text | No | — | — |
| `created_at` | timestamp with time zone | Sí | — | — |
| `resolved_at` | timestamp with time zone | No | — | — |

### `pago`

Clave primaria: `id_pago`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_pago` | integer | Sí | PK | — |
| `fecha_pago` | date | Sí | — | — |
| `valor_pago` | integer | Sí | — | — |
| `metodo_pago` | condor.metodo_pago | Sí | — | — |
| `referencia` | character varying | No | — | — |
| `tipo_excedente` | condor.tipo_excedente_enum | Sí | — | — |
| `estado` | text | Sí | — | — |
| `url_baucher` | text | No | — | — |
| `numero_cuenta_origen` | text | No | — | — |
| `tipo_pago` | text | Sí | — | — |
| `id_venta` | integer | No | FK → `venta.id_venta` | — |
| `id_cuota_propuesta` | integer | No | FK → `cuota.id_cuota` | — |
| `numero_pago` | character varying | No | — | — |
| `id_usuario` | integer | No | FK → `usuarios.id_usuario` | — |

### `cuota_pago`

Clave primaria: `id_cuota` + `id_pago`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_cuota` | integer | Sí | PK, FK → `cuota.id_cuota` | — |
| `id_pago` | integer | Sí | PK, FK → `pago.id_pago` | — |
| `valor_aplicado` | integer | Sí | — | — |

### `recibo`

Clave primaria: `id_recibo`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_recibo` | integer | Sí | PK | — |
| `numero_recibo` | character varying | Sí | — | — |
| `fecha_emision` | date | Sí | — | — |
| `emitido_por` | character varying | No | — | — |
| `observaciones` | text | No | — | — |

### `recibo_pago`

Clave primaria: `id_recibo` + `id_pago`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_recibo` | integer | Sí | PK, FK → `recibo.id_recibo` | — |
| `id_pago` | integer | Sí | PK, FK → `pago.id_pago` | — |

### `bank_transaction`

Clave primaria: `id_transaction`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_transaction` | integer | Sí | PK | — |
| `bank` | character varying | Sí | — | — |
| `transaction_date` | date | Sí | — | — |
| `description` | text | Sí | — | — |
| `reference` | character varying | No | — | — |
| `amount` | numeric | No | — | — |
| `id_pago` | integer | No | FK → `pago.id_pago` | — |
| `created_at` | timestamp with time zone | Sí | — | — |
| `updated_at` | timestamp with time zone | Sí | — | — |

### `pago_comision`

Clave primaria: `id_pago_comision`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_pago_comision` | integer | Sí | PK | — |
| `id_venta` | integer | Sí | FK → `venta.id_venta` | — |
| `valor` | numeric | Sí | — | — |
| `fecha` | date | Sí | — | — |
| `nota` | text | No | — | — |
| `registrado_por` | text | No | — | — |
| `created_at` | timestamp with time zone | No | — | — |
| `numero_pago` | text | No | — | — |
| `id_recibo` | integer | No | FK → `recibo.id_recibo` | — |

### `gasto`

Clave primaria: `id_gasto`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_gasto` | bigint | Sí | PK | — |
| `id_proyecto` | bigint | Sí | FK → `proyecto.id_proyecto` | — |
| `fecha` | date | Sí | — | — |
| `descripcion` | text | Sí | — | — |
| `valor` | numeric | Sí | — | — |
| `categoria` | text | Sí | — | — |
| `detalle_recurso` | text | No | — | — |
| `comprobante_url` | text | No | — | — |
| `created_at` | timestamp with time zone | Sí | — | — |
| `medio_pago` | text | Sí | — | — |
| `cuenta_origen` | text | No | — | — |
| `responsable_entrega` | text | No | — | — |
| `responsable_recibe` | text | No | — | — |
| `id_empresa` | integer | No | FK → `empresa_aliada.id_empresa` | — |

## Requerimientos e inventario

### `requerimiento`

Clave primaria: `id_requerimiento`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_requerimiento` | integer | Sí | PK | — |
| `numero` | text | Sí | — | — |
| `descripcion` | text | No | — | — |
| `id_proyecto` | integer | No | FK → `proyecto.id_proyecto` | — |
| `fecha_solicitud` | date | No | — | — |
| `fecha_desembolso` | date | No | — | — |
| `estado` | condor.estado_requerimiento | Sí | — | — |
| `valor_total` | numeric | No | — | — |
| `observaciones` | text | No | — | — |
| `created_at` | timestamp with time zone | Sí | — | — |
| `id_solicitante` | integer | No | FK → `usuarios.id_usuario` | — |
| `categoria` | text | No | — | — |
| `urgencia` | text | No | — | — |
| `justificacion` | text | No | — | — |
| `aprobado_jefe_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `fecha_aprobado_jefe` | date | No | — | — |
| `aprobado_final_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `fecha_aprobado_final` | date | No | — | — |
| `motivo_rechazo` | text | No | — | — |
| `desembolsado_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `valor_desembolsado` | numeric | No | — | — |
| `comprobante_desembolso_url` | text | No | — | — |
| `id_gasto` | integer | No | FK → `gasto.id_gasto` | — |
| `fecha_entrega` | date | No | — | — |
| `entregado_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `entrega_receptor` | text | No | — | — |
| `aprobado_dueno_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `fecha_aprobado_dueno` | date | No | — | — |
| `aprobado_gerencia_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `fecha_aprobado_gerencia` | date | No | — | — |
| `entregado_a` | text | No | — | — |
| `entrega_observaciones` | text | No | — | — |
| `acta_entrega_url` | text | No | — | — |
| `id_empresa` | integer | No | FK → `empresa_aliada.id_empresa` | — |

### `requerimiento_item`

Clave primaria: `id_item`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_item` | integer | Sí | PK | — |
| `id_requerimiento` | integer | Sí | FK → `requerimiento.id_requerimiento` | — |
| `descripcion` | text | Sí | — | — |
| `unidad` | text | Sí | — | — |
| `cantidad_solicitada` | numeric | Sí | — | — |
| `precio_unitario` | numeric | No | — | — |

### `recepcion`

Clave primaria: `id_recepcion`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_recepcion` | integer | Sí | PK | — |
| `id_requerimiento` | integer | Sí | FK → `requerimiento.id_requerimiento` | — |
| `fecha` | date | Sí | — | — |
| `observaciones` | text | No | — | — |
| `comprobante_url` | text | No | — | — |
| `id_almacenista` | integer | No | FK → `usuarios.id_usuario` | — |
| `created_at` | timestamp with time zone | Sí | — | — |

### `recepcion_item`

Clave primaria: `id_recepcion_item`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_recepcion_item` | integer | Sí | PK | — |
| `id_recepcion` | integer | Sí | FK → `recepcion.id_recepcion` | — |
| `id_item` | integer | Sí | FK → `requerimiento_item.id_item` | — |
| `cantidad` | numeric | Sí | — | — |

### `inventario_movimiento`

Clave primaria: `id_movimiento`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_movimiento` | integer | Sí | PK | — |
| `tipo` | text | Sí | — | — |
| `material` | text | Sí | — | — |
| `descripcion` | text | Sí | — | — |
| `categoria` | text | No | — | — |
| `unidad` | text | No | — | — |
| `cantidad` | numeric | Sí | — | — |
| `id_proyecto` | integer | No | FK → `proyecto.id_proyecto` | — |
| `id_requerimiento` | integer | No | FK → `requerimiento.id_requerimiento` | — |
| `id_recepcion` | integer | No | FK → `recepcion.id_recepcion` | — |
| `creado_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `created_at` | timestamp with time zone | Sí | — | — |

## Identidad y autorización

### `usuarios`

Clave primaria: `id_usuario`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_usuario` | integer | Sí | PK | — |
| `firebase_uid` | character varying | No | — | — |
| `email` | character varying | Sí | — | — |
| `id_rol` | integer | Sí | FK → `roles.id_rol` | — |
| `activo` | boolean | Sí | — | — |
| `fecha_creacion` | timestamp without time zone | Sí | — | — |
| `photo_url` | text | No | — | — |
| `tipo_documento` | text | No | — | — |
| `documento` | text | No | — | — |
| `nombres` | text | No | — | — |
| `apellidos` | text | No | — | — |
| `tipo_persona` | text | No | — | — |
| `telefono` | text | No | — | — |
| `intentos_fallidos` | integer | Sí | — | — |
| `bloqueado_hasta` | timestamp with time zone | No | — | — |
| `dosfa_configurado_en` | timestamp with time zone | No | — | — |
| `dosfa_intentos_fallidos` | integer | Sí | — | — |
| `dosfa_bloqueado_hasta` | timestamp with time zone | No | — | — |
| `sesion_revocada_en` | timestamp with time zone | No | — | — |
| `ultima_ip_login` | text | No | — | — |
| `ultimo_login_en` | timestamp with time zone | No | — | — |

### `roles`

Clave primaria: `id_rol`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_rol` | integer | Sí | PK | — |
| `nombre` | character varying | Sí | — | — |
| `descripcion` | text | No | — | — |
| `obligaciones` | text | No | — | — |
| `requiere_2fa` | boolean | Sí | — | — |

### `permisos`

Clave primaria: `id_permiso`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_permiso` | integer | Sí | PK | — |
| `recurso` | character varying | Sí | — | — |
| `accion` | character varying | Sí | — | — |
| `descripcion` | text | No | — | — |

### `rol_permiso`

Clave primaria: `id_rol` + `id_permiso`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_rol` | integer | Sí | PK, FK → `roles.id_rol` | — |
| `id_permiso` | integer | Sí | PK, FK → `permisos.id_permiso` | — |

### `login_2fa`

Clave primaria: `id_challenge`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_challenge` | uuid | Sí | PK | — |
| `id_usuario` | integer | Sí | FK → `usuarios.id_usuario` | — |
| `codigo_hash` | text | Sí | — | — |
| `intentos` | integer | Sí | — | — |
| `reenvios` | integer | Sí | — | — |
| `expira_en` | timestamp with time zone | Sí | — | — |
| `consumido_en` | timestamp with time zone | No | — | — |
| `creado_en` | timestamp with time zone | Sí | — | — |

## Gobierno y operación del sistema

### `auditoria`

Clave primaria: `id_auditoria`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_auditoria` | integer | Sí | PK | — |
| `tabla_afectada` | text | Sí | — | — |
| `id_registro` | bigint | Sí | — | — |
| `campo` | text | Sí | — | — |
| `valor_anterior` | text | No | — | — |
| `valor_nuevo` | text | No | — | — |
| `usuario_db` | text | Sí | — | — |
| `fecha_cambio` | timestamp without time zone | Sí | — | — |
| `motivo` | text | No | — | — |

### `notificacion`

Clave primaria: `id_notificacion`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_notificacion` | integer | Sí | PK | — |
| `id_usuario` | integer | Sí | FK → `usuarios.id_usuario` | — |
| `titulo` | text | Sí | — | — |
| `mensaje` | text | No | — | — |
| `vista` | text | No | — | — |
| `referencia` | text | No | — | — |
| `leida` | boolean | Sí | — | — |
| `created_at` | timestamp with time zone | Sí | — | — |

### `config_sistema`

Clave primaria: `clave`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `clave` | text | Sí | PK | — |
| `valor` | text | Sí | — | — |
| `tipo` | text | Sí | — | — |
| `descripcion` | text | No | — | — |
| `actualizado_por` | integer | No | FK → `usuarios.id_usuario` | — |
| `updated_at` | timestamp with time zone | Sí | — | — |

### `consecutivos`

Clave primaria: `prefijo` + `periodo`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `prefijo` | text | Sí | PK | — |
| `periodo` | text | Sí | PK | — |
| `ultimo_numero` | integer | Sí | — | — |

### `observacion_juridica`

Clave primaria: `id_observacion`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_observacion` | integer | Sí | PK | — |
| `id_venta` | integer | Sí | FK → `venta.id_venta` | — |
| `descripcion` | text | Sí | — | — |
| `estado_proceso` | character varying | No | — | — |
| `usuario_db` | character varying | No | — | — |
| `fecha_registro` | timestamp with time zone | No | — | — |

### `respaldo`

Clave primaria: `id_respaldo`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_respaldo` | bigint | Sí | PK | — |
| `fecha` | timestamp with time zone | Sí | — | — |
| `tipo` | text | Sí | — | — |
| `alcance` | text | No | — | — |
| `tamano_bytes` | bigint | No | — | — |
| `ubicacion` | text | Sí | — | — |
| `ubicacion_r2` | text | No | — | — |
| `checksum_sha256` | text | No | — | — |
| `estado` | text | Sí | — | — |
| `origen` | text | Sí | — | — |
| `detalle` | text | No | — | — |

### `respaldo_restauracion`

Clave primaria: `id_restauracion`.

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_restauracion` | bigint | Sí | PK | — |
| `id_respaldo` | bigint | No | FK → `respaldo.id_respaldo` | — |
| `alcance` | text | Sí | — | — |
| `estado` | text | Sí | — | — |
| `solicitado_por` | bigint | No | FK → `usuarios.id_usuario` | — |
| `solicitado_en` | timestamp with time zone | Sí | — | — |
| `finalizado_en` | timestamp with time zone | No | — | — |
| `detalle` | text | No | — | — |

## Vistas

Las vistas no almacenan datos: derivan su contenido de las tablas en cada
consulta. Por eso no declaran clave primaria ni restricciones.

### `v_aux_panel_operaciones_diarias`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `ventas_activas` | integer | No | — | — |
| `recaudo_mes` | bigint | No | — | — |
| `cuotas_vencidas` | integer | No | — | — |
| `cuotas_en_mora` | integer | No | — | — |

### `vw_alertas_juridicas`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `tipo_alerta` | text | No | — | — |
| `id_venta` | integer | No | — | — |
| `id_lote` | integer | No | — | — |
| `descripcion` | text | No | — | — |
| `fecha_detectada` | timestamp with time zone | No | — | — |
| `nivel_riesgo` | text | No | — | — |

### `vw_auditoria_basica_operaciones`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_auditoria` | integer | No | PK | — |
| `tabla_afectada` | text | No | — | — |
| `operacion` | text | No | — | — |
| `id_registro` | bigint | No | — | — |
| `campo` | text | No | — | — |
| `valor_anterior` | text | No | — | — |
| `valor_nuevo` | text | No | — | — |
| `usuario` | text | No | — | — |
| `fecha_cambio` | timestamp without time zone | No | — | — |
| `motivo` | text | No | — | — |

### `vw_auditoria_juridica`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `tabla_afectada` | text | No | — | — |
| `id_registro` | bigint | No | — | — |
| `tipo_operacion` | text | No | — | — |
| `campo_modificado` | text | No | — | — |
| `valor_anterior` | text | No | — | — |
| `valor_nuevo` | text | No | — | — |
| `usuario` | text | No | — | — |
| `fecha_evento` | timestamp without time zone | No | — | — |

### `vw_cartera_consolidada`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_venta` | integer | No | PK | — |
| `estado` | condor.estado_venta | No | — | — |
| `valor_total` | integer | No | — | — |
| `proyecto` | character varying | No | — | — |
| `codigo_lote` | character varying | No | — | — |
| `comprador` | text | No | — | — |
| `saldo_pendiente` | bigint | No | — | — |

### `vw_cartera_juridica`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_venta` | integer | No | PK | — |
| `estado` | condor.estado_venta | No | — | — |
| `valor_total` | integer | No | — | — |
| `proyecto` | character varying | No | — | — |
| `codigo_lote` | character varying | No | — | — |
| `comprador` | text | No | — | — |
| `dias_mora` | integer | No | — | — |
| `saldo` | bigint | No | — | — |

### `vw_dir_auditoria`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_auditoria` | integer | No | PK | — |
| `tabla_afectada` | text | No | — | — |
| `id_registro` | bigint | No | — | — |
| `campo` | text | No | — | — |
| `valor_anterior` | text | No | — | — |
| `valor_nuevo` | text | No | — | — |
| `operacion` | text | No | — | — |
| `usuario` | text | No | — | — |

### `vw_dir_cartera_resumen_hoy`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `fecha_corte` | date | No | — | — |
| `capital_financiado_total` | bigint | No | — | — |
| `capital_pagado_total` | numeric | No | — | — |
| `capital_pendiente_total` | numeric | No | — | — |
| `capital_en_mora` | numeric | No | — | — |
| `ratio_mora` | numeric | No | — | — |

### `vw_dir_comisiones_resumen`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `fecha_corte` | date | No | — | — |
| `comisiones_causadas` | bigint | No | — | — |
| `comisiones_pagadas` | bigint | No | — | — |
| `comisiones_pendientes` | bigint | No | — | — |

### `vw_dir_recaudo_facturacion_historico`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `periodo` | date | No | — | — |
| `total_facturado` | bigint | No | — | — |
| `total_recaudado` | bigint | No | — | — |
| `diferencia` | bigint | No | — | — |
| `indice_cumplimiento` | numeric | No | — | — |

### `vw_dir_recaudo_facturacion_hoy`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `fecha_corte` | date | No | — | — |
| `total_facturado` | bigint | No | — | — |
| `total_recaudado` | bigint | No | — | — |
| `diferencia` | bigint | No | — | — |
| `indice_cumplimiento` | numeric | No | — | — |

### `vw_disponibilidad_comercial`

| Columna | Tipo | Obligatoria | Clave | Notas |
|---|---|---|---|---|
| `id_proyecto` | integer | No | PK | — |
| `proyecto` | character varying | No | — | — |
| `id_lote` | integer | No | PK | — |
| `manzana` | character varying | No | — | — |
| `numero_lote` | character varying | No | — | — |
| `area_m2` | numeric | No | — | — |
| `precio_lista` | integer | No | — | — |
| `disponible` | boolean | No | — | — |

## Funciones almacenadas

| Función | Esquema | Invocación desde el código |
|---|---|---|
| `fn_excedente_pago()` | `condor` | Con `.schema('condor')` explícito |
| `actualizar_mora()` | `condor` | Con `.schema('condor')` explícito |
| `next_consecutivo_condor()` | `public` | **Sin** `.schema()`: única excepción del proyecto |
