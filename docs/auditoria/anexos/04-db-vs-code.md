# Anexo D · Consultas del backend vs. esquema real de la base de datos

_Generado por `tools/audit/04-db-vs-code.js` el 2026-07-30T05:45:22.580Z._

**Resumen:** P0=0 · P1=0 · P2=0 · INFO=6

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-DB001 | INFO | bd-esquema-inconsistente | RPC que vive en public y no en condor: next_consecutivo_condor() | src/controllers/facturas.controller.js:14 |
| AUD-DB002 | INFO | bd-sin-uso | Objeto de BD que el backend nunca consulta: consecutivos | condor.consecutivos |
| AUD-DB003 | INFO | bd-sin-uso | Objeto de BD que el backend nunca consulta: vw_auditoria_juridica | condor.vw_auditoria_juridica |
| AUD-DB004 | INFO | bd-sin-uso | Objeto de BD que el backend nunca consulta: vw_dir_auditoria | condor.vw_dir_auditoria |
| AUD-DB005 | INFO | bd-sin-uso | Objeto de BD que el backend nunca consulta: vw_dir_recaudo_facturacion_hoy | condor.vw_dir_recaudo_facturacion_hoy |
| AUD-DB006 | INFO | bd-sin-uso | Objeto de BD que el backend nunca consulta: vw_disponibilidad_comercial | condor.vw_disponibilidad_comercial |

## Detalle

### AUD-DB001 · INFO · RPC que vive en public y no en condor: next_consecutivo_condor()

- **Ubicación:** `src/controllers/facturas.controller.js:14`
- **Detalle:** Funciona, pero rompe la regla del proyecto de direccionar siempre `condor` explícitamente: esta función es la excepción y no está documentada como tal. Los demás RPC (fn_excedente_pago, actualizar_mora) sí viven en `condor`.
- **Aceptado tras verificación** (severidad original P2): Excepción conocida y documentada en CLAUDE.md: la función vive en public y se invoca sin .schema(). Mover la función o añadir el .schema() rompería todas las numeraciones. Se deja como está y se documenta.
- **Acción propuesta:** Documentar la excepción, o mover la función a `condor` y añadir `.schema('condor')` en los 5 puntos de llamada.

### AUD-DB002 · INFO · Objeto de BD que el backend nunca consulta: consecutivos

- **Ubicación:** `condor.consecutivos`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('consecutivos')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Aceptado tras verificación** (severidad original P2): NO ELIMINAR. Es el estado del RPC next_consecutivo_condor (8 filas: prefijo, periodo, ultimo_numero). Ningún .from() la referencia porque sólo la lee y escribe la función en BD. Borrarla rompe TODAS las numeraciones del sistema: recibos RC-, pagos PAG-, micropagos MCOM-, facturas FV- y códigos de venta.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB003 · INFO · Objeto de BD que el backend nunca consulta: vw_auditoria_juridica

- **Ubicación:** `condor.vw_auditoria_juridica`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('vw_auditoria_juridica')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Aceptado tras verificación** (severidad original P2): Vista disponible y no consumida (4.709 filas derivadas). Se conserva: una vista no consume almacenamiento ni puede desincronizarse. Documentada como disponible en el Documento de Datos.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB004 · INFO · Objeto de BD que el backend nunca consulta: vw_dir_auditoria

- **Ubicación:** `condor.vw_dir_auditoria`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('vw_dir_auditoria')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Aceptado tras verificación** (severidad original P2): Vista disponible y no consumida (19.485 filas derivadas). Se conserva por el mismo motivo.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB005 · INFO · Objeto de BD que el backend nunca consulta: vw_dir_recaudo_facturacion_hoy

- **Ubicación:** `condor.vw_dir_recaudo_facturacion_hoy`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('vw_dir_recaudo_facturacion_hoy')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Aceptado tras verificación** (severidad original P2): Vista disponible y no consumida. El backend usa vw_dir_recaudo_facturacion_historico. Se conserva.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB006 · INFO · Objeto de BD que el backend nunca consulta: vw_disponibilidad_comercial

- **Ubicación:** `condor.vw_disponibilidad_comercial`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('vw_disponibilidad_comercial')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Aceptado tras verificación** (severidad original P2): Vista disponible y no consumida (34 lotes). El catálogo público se arma desde lote/proyecto. Se conserva.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.
