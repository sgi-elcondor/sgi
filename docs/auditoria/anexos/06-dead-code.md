# Anexo G · Código, archivos y dependencias sin uso

_Generado por `tools/audit/06-dead-code.js` el 2026-07-30T00:50:26.539Z._

**Resumen:** P0=0 · P1=0 · P2=1 · INFO=3

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-DC004 | P2 | script-ad-hoc | 5 scripts de mantenimiento puntual en seeds/ | seeds/backfill_codigo_venta.js<br>seeds/diag-cuotas-comprador.js<br>seeds/gen-bank-tx-comprador.js<br>seeds/reset-comprador.js<br>seeds/reset-pagos-comprador.js |
| AUD-DC001 | INFO | log-de-depuracion | 1 console.log/debugger en src/index.js | src/index.js:196 |
| AUD-DC002 | INFO | log-de-depuracion | 1 console.log/debugger en src/services/comisiones.service.js | src/services/comisiones.service.js:68 |
| AUD-DC003 | INFO | log-de-depuracion | 1 console.log/debugger en src/services/mora.service.js | src/services/mora.service.js:7 |

## Detalle

### AUD-DC004 · P2 · 5 scripts de mantenimiento puntual en seeds/

- **Ubicación:** `seeds/backfill_codigo_venta.js`, `seeds/diag-cuotas-comprador.js`, `seeds/gen-bank-tx-comprador.js`, `seeds/reset-comprador.js`, `seeds/reset-pagos-comprador.js`
- **Detalle:** Utilidades de diagnóstico/corrección contra datos de desarrollo. No forman parte del producto y ejecutarlas contra producción es peligroso.
- **Acción propuesta:** Mover a `tools/dev/` (fuera del runner de seeds) o eliminar antes de la entrega.

### AUD-DC001 · INFO · 1 console.log/debugger en src/index.js

- **Ubicación:** `src/index.js:196`
- **Detalle:** Salida de depuración que llega a producción (ruido en logs del servidor o en la consola del navegador del usuario).
- **Aceptado tras verificación** (severidad original P2): Log de arranque del servidor (puerto de escucha). Observabilidad legítima, no depuración.
- **Acción propuesta:** Eliminar, o degradar a console.error/warn si es diagnóstico real.

### AUD-DC002 · INFO · 1 console.log/debugger en src/services/comisiones.service.js

- **Ubicación:** `src/services/comisiones.service.js:68`
- **Detalle:** Salida de depuración que llega a producción (ruido en logs del servidor o en la consola del navegador del usuario).
- **Aceptado tras verificación** (severidad original P2): Registra el evento de negocio 'comisión causada' con venta y monto acumulado. Es rastro operativo deseado en producción.
- **Acción propuesta:** Eliminar, o degradar a console.error/warn si es diagnóstico real.

### AUD-DC003 · INFO · 1 console.log/debugger en src/services/mora.service.js

- **Ubicación:** `src/services/mora.service.js:7`
- **Detalle:** Salida de depuración que llega a producción (ruido en logs del servidor o en la consola del navegador del usuario).
- **Aceptado tras verificación** (severidad original P2): Registra el resultado del cron actualizar_mora en cada corrida. Necesario para diagnosticar el job.
- **Acción propuesta:** Eliminar, o degradar a console.error/warn si es diagnóstico real.
