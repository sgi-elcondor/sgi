# Reglas de negocio — SGI El Cóndor

> Documentación interna. Fuente de verdad para reglas de negocio, invariantes y
> consecutivos del sistema. El código fuente en `src/services/saldos.service.js`,
> `src/controllers/pagos.controller.js` y `src/services/cuotas.service.js` es la
> implementación autoritativa.

---

## Reglas de negocio (RN-*)

| RN         | Regla                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| RN-01      | Un pago requiere una factura activa (`emitida` o `parcialmente_pagada`) para la cuota/fracción.              |
| RN-02      | El recibo existe solo cuando el pago fue `aceptado`. No hay recibos virtuales.                               |
| RN-03      | Como máximo una factura activa por cuota o fracción.                                                         |
| RN-04/14/15/16 | El estado contable de una cuota (`pagada`, `vigente`, `pre_mora`, `en_mora`) es **derivado**, nunca almacenado. |
| RN-05      | Los recibos son inmutables. Una venta con recibos no se borra: se cancela.                                   |
| RN-06      | No se emite factura para una cuota cuyo comprador esté inactivo.                                             |
| RN-07/08   | Todo pago nace en `pendiente_revision`. La asignación a cuotas y la emisión del recibo ocurren únicamente al aceptarlo (`accept-batch`). |
| RN-10      | **Saldo = `valor − Σ recibos respaldados`**. Es la única fórmula válida en todo el sistema (`saldos.service`). |
| RN-12      | Una cuota totalmente pagada antes de su vencimiento se considera `pagada_anticipada`.                        |
| RN-15      | `> 90 días` vencida ⇒ `en_mora`; `1–90 días` ⇒ `pre_mora` (constante `MORA_DIAS = 90`).                    |
| RN-17      | El valor de un lote vendido no se puede cambiar de forma aislada: debe pasar por el reajuste del plan de cuotas. |
| RN-19      | Aux y comprador ven exactamente la misma realidad (saldos, recibos, estado). Una sola fuente.               |
| RN-21      | Todo recibo sigue la numeración `RC-YYYYMM-NNNNN`.                                                           |
| RN-22      | Una cuota con un pago en `pendiente_revision` no puede recibir otro.                                         |
| RN-23      | Al registrar una venta directa (`POST /ventas`), cada comprador no protegido y no `comprador` se promociona automáticamente a `comprador`, se audita el cambio, se invalida `auth-cache` y se le envía un email. No aplica a `POST /ventas/solicitud`. |
| §3.3       | Las fracciones de una cuota se cubren greedy en orden con el acumulado de recibos.                          |
| §4.3       | Restructurar una cuota anula sus facturas `emitida`; bloquea si alguna está `parcialmente_pagada`.          |
| §8.4       | Editar valores de cuotas mantiene la invariante **Σ cuotas = valor financiado** (`valor_total − permutas`). |
| §13        | Los estados son derivados; no hay estados huérfanos (ej. lote `vendido` sin venta activa → se muestra `disponible`). |

---

## Otras invariantes

- **Comisión causada** al alcanzar el **30 %** del valor de la venta (`UMBRAL_COMISION = 0.30` en `comisiones.service`). Las permutas cuentan como pago para ese umbral y para `total_pagado`.
- Los **porcentajes de los compradores** de una venta deben sumar **100 %**.
- Las **permutas totales** no pueden igualar o superar el valor total.
- Identidad híbrida: la primera vez que entra un usuario nuevo, se intenta mapear por `firebase_uid`, después por email. Si no hay match, devuelve `CUENTA_NO_VINCULADA`.

---

## Consecutivos y numeraciones

| Tipo        | Formato                  | Generado por                                    |
| ----------- | ------------------------ | ----------------------------------------------- |
| Pago        | `PAG-YYYYMM-NNNNN`       | `consecutivos.service.nextPago`                 |
| Recibo      | `RC-YYYYMM-NNNNN`        | `consecutivos.service` (mismo correlativo)      |
| Micropago   | `MCOM-YYYYMM-NNNNN`      | `consecutivos.service.nextMicropago`            |
| Factura     | `FV-YYYYMM-SIGLA-NNNNN`  | `consecutivos.service.next`                     |
| Venta       | `#NNN-SIGLA-LOTE`        | `consecutivos.service.generarCodigoVenta`       |

Siempre generar números desde `consecutivos.service` vía RPC `next_consecutivo_condor`. Nunca calcularlos manualmente.

---

## Flujos críticos (resumen)

### Crear venta

1. Validar campos (lote, valor, porcentajes, permutas, cuotas, fechas).
2. Verificar que ningún comprador esté inactivo.
3. Verificar que el lote no tenga venta activa.
4. Generar `codigo_venta`.
5. INSERT en `venta` → `venta_comprador` → `venta_comisionista` (opcional).
6. `generarPlanDePago` — inserta cuotas iniciales y regulares.
7. Cualquier error dispara `limpiarVentaCreada(idVenta)` (rollback manual).
8. Auto-promoción a `comprador` (RN-23) si la venta no es `pendiente_autorizacion`.

### Aceptar pagos (`accept-batch`)

1. Marcar `pago.estado = 'aceptado'`.
2. `aplicarPagoACuotas` — asignación greedy, inserta `cuota_pago`.
3. `recibos.service.crearParaPago` — genera el recibo `RC-YYYYMM-NNNNN`.
4. Refrescar estado de facturas tocadas.
5. `comisiones.verificarComision` — si se alcanza el 30 %, marca `venta_comisionista` como `causada`.
6. Auditoría de la aceptación.

### Emitir/anular factura

- `_emitirFactura` valida: comprador activo, no existe factura activa, saldo > 0. Numera `FV-YYYYMM-SIGLA-NNNNN`.
- Al reestructurar una cuota, `anularFacturasActivas` anula `emitida` y bloquea si hay `parcialmente_pagada` (§4.3).

---

## Áreas sensibles

- **Flujo de aceptación de pagos** — cualquier reorden afecta saldos, recibos y comisiones simultáneamente.
- **Edición de planes de cuotas** — rompe la invariante Σ cuotas = valor financiado si no se valida (§8.4 / RN-17).
- **Cambio de sigla de proyecto** — reescribe `codigo_lote` en cadena y deja auditoría por cada lote.
- **Anulación de facturas** — una `parcialmente_pagada` no puede anularse automáticamente.
- **Vinculación de cuenta** — único punto seguro para asociar `firebase_uid`; usa UPDATE atómico.
- **`auditoria`** — obligatoria al cambiar estado, valor, vínculo o pertenencia de un objeto crítico.

---

## Dependencias críticas (no modificar sin análisis)

1. `src/config/supabase.js` — cliente único con `SERVICE_KEY`.
2. `src/middlewares/auth.middleware.js` + `auth-cache.service.js` — invariante de identidad.
3. `src/services/saldos.service.js` — única fuente de saldos/estados (RN-10/14/15/16/19).
4. `src/services/consecutivos.service.js` + RPC `next_consecutivo_condor` — numeraciones inmutables.
5. `src/services/recibos.service.js` — idempotencia y reutilización de huérfanos (RN-05).
6. `aplicarPagoACuotas` en `pagos.controller.js` — coexiste con un trigger en BD; no quitar la compensación de `estadoOrig`.
7. `ROUTE_PERMISSIONS` + `VISTA_API_MAP` — toda nueva ruta debe registrarse en ambos.
