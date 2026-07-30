# Anexo D · Consultas del backend vs. esquema real de la base de datos

_Generado por `tools/audit/04-db-vs-code.js` el 2026-07-30T00:29:24.758Z._

**Resumen:** P0=0 · P1=0 · P2=8 · INFO=0

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-DB001 | P2 | bd-esquema-inconsistente | RPC que vive en public y no en condor: next_consecutivo_condor() | src/controllers/facturas.controller.js:14 |
| AUD-DB002 | P2 | bd-sin-uso | Objeto de BD que el backend nunca consulta: consecutivos | condor.consecutivos |
| AUD-DB003 | P2 | bd-sin-uso | Objeto de BD que el backend nunca consulta: vw_auditoria_juridica | condor.vw_auditoria_juridica |
| AUD-DB004 | P2 | bd-sin-uso | Objeto de BD que el backend nunca consulta: vw_dir_auditoria | condor.vw_dir_auditoria |
| AUD-DB005 | P2 | bd-sin-uso | Objeto de BD que el backend nunca consulta: vw_dir_recaudo_facturacion_hoy | condor.vw_dir_recaudo_facturacion_hoy |
| AUD-DB006 | P2 | bd-sin-uso | Objeto de BD que el backend nunca consulta: vw_disponibilidad_comercial | condor.vw_disponibilidad_comercial |
| AUD-DB007 | P2 | bd-sin-uso | Objeto de BD que el backend nunca consulta: whatsapp_conversacion | condor.whatsapp_conversacion |
| AUD-DB008 | P2 | bd-sin-uso | Objeto de BD que el backend nunca consulta: whatsapp_mensaje | condor.whatsapp_mensaje |

## Detalle

### AUD-DB001 · P2 · RPC que vive en public y no en condor: next_consecutivo_condor()

- **Ubicación:** `src/controllers/facturas.controller.js:14`
- **Detalle:** Funciona, pero rompe la regla del proyecto de direccionar siempre `condor` explícitamente: esta función es la excepción y no está documentada como tal. Los demás RPC (fn_excedente_pago, actualizar_mora) sí viven en `condor`.
- **Acción propuesta:** Documentar la excepción, o mover la función a `condor` y añadir `.schema('condor')` en los 5 puntos de llamada.

### AUD-DB002 · P2 · Objeto de BD que el backend nunca consulta: consecutivos

- **Ubicación:** `condor.consecutivos`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('consecutivos')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB003 · P2 · Objeto de BD que el backend nunca consulta: vw_auditoria_juridica

- **Ubicación:** `condor.vw_auditoria_juridica`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('vw_auditoria_juridica')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB004 · P2 · Objeto de BD que el backend nunca consulta: vw_dir_auditoria

- **Ubicación:** `condor.vw_dir_auditoria`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('vw_dir_auditoria')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB005 · P2 · Objeto de BD que el backend nunca consulta: vw_dir_recaudo_facturacion_hoy

- **Ubicación:** `condor.vw_dir_recaudo_facturacion_hoy`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('vw_dir_recaudo_facturacion_hoy')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB006 · P2 · Objeto de BD que el backend nunca consulta: vw_disponibilidad_comercial

- **Ubicación:** `condor.vw_disponibilidad_comercial`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('vw_disponibilidad_comercial')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB007 · P2 · Objeto de BD que el backend nunca consulta: whatsapp_conversacion

- **Ubicación:** `condor.whatsapp_conversacion`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('whatsapp_conversacion')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.

### AUD-DB008 · P2 · Objeto de BD que el backend nunca consulta: whatsapp_mensaje

- **Ubicación:** `condor.whatsapp_mensaje`
- **Detalle:** Expuesto en el esquema pero sin ningún `.from('whatsapp_mensaje')` en src/. Puede ser histórico, de respaldo, o usado sólo por vistas SQL/triggers.
- **Acción propuesta:** Confirmar si sigue siendo necesario; documentarlo o retirarlo.
