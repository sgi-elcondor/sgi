# tools/dev — utilidades de mantenimiento puntual

> **No forman parte del producto.** No se ejecutan en el despliegue, no las invoca
> `seeds/seed.js` y ningún módulo las importa.

Vivían dentro de `seeds/`, donde parecían parte del sembrado reproducible del
entorno. Se movieron aquí en la auditoría de entrega para dejar `seeds/` con
exactamente lo que compone el runner (`00-clean` → `01-base` → `02-personas` →
`03-ventas` → `04-pagos` → `05-extras`).

| Script | Para qué sirve |
|---|---|
| `backfill_codigo_venta.js` | Rellena `venta.codigo_venta` en filas históricas que quedaron sin él. |
| `diag-cuotas-comprador.js` | Diagnóstico: imprime el plan de cuotas y su estado derivado para un comprador. |
| `gen-bank-tx-comprador.js` | Genera movimientos en `bank_transaction` para probar el cruce de pagos. |
| `reset-comprador.js` | Borra las ventas y derivados de un comprador para repetir una prueba. |
| `reset-pagos-comprador.js` | Borra sólo los pagos y recibos de un comprador. |

## Antes de ejecutar cualquiera de estos

Escriben y borran directamente contra la base de datos con la `SERVICE_KEY`, sin
pasar por las validaciones de negocio de los controllers: no respetan la
inmutabilidad de recibos (RN-05), ni la trazabilidad obligatoria en `auditoria`,
ni el bloqueo de borrado de ventas con pagos aceptados.

- Comprueba a qué proyecto de Supabase apunta tu `.env`.
- **Nunca los corras contra producción** sin respaldo previo y revisión del script
  línea por línea.
- `reset-*` son destructivos por diseño y no piden confirmación.
