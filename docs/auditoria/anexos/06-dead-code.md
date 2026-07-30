# Anexo G · Código, archivos y dependencias sin uso

_Generado por `tools/audit/06-dead-code.js` el 2026-07-30T01:33:05.803Z._

**Resumen:** P0=0 · P1=0 · P2=0 · INFO=3

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-DC001 | INFO | log-de-depuracion | 1 console.log/debugger en src/index.js | src/index.js:196 |
| AUD-DC002 | INFO | log-de-depuracion | 1 console.log/debugger en src/services/comisiones.service.js | src/services/comisiones.service.js:68 |
| AUD-DC003 | INFO | log-de-depuracion | 1 console.log/debugger en src/services/mora.service.js | src/services/mora.service.js:7 |

## Detalle

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
