# Anexo H · Vulnerabilidades en dependencias de producción

_Generado por `tools/audit/07-dependencies.js` el 2026-07-30T05:45:25.924Z._

**Resumen:** P0=0 · P1=0 · P2=8 · INFO=0

| ID | Sev | Categoría | Hallazgo | Ubicación |
|---|---|---|---|---|
| AUD-DEP001 | P2 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: @google-cloud/firestore | package.json<br>node_modules/@google-cloud/firestore |
| AUD-DEP002 | P2 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: @google-cloud/storage | package.json<br>node_modules/@google-cloud/storage |
| AUD-DEP003 | P2 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: firebase-admin | package.json<br>node_modules/firebase-admin |
| AUD-DEP004 | P2 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: gaxios | package.json<br>node_modules/gaxios |
| AUD-DEP005 | P2 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: google-gax | package.json<br>node_modules/google-gax |
| AUD-DEP006 | P2 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: retry-request | package.json<br>node_modules/retry-request |
| AUD-DEP007 | P2 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: teeny-request | package.json<br>node_modules/teeny-request |
| AUD-DEP008 | P2 | vulnerabilidad-dependencia | MODERATE en dependencia de producción: uuid | package.json<br>node_modules/uuid |

## Detalle

### AUD-DEP001 · P2 · MODERATE en dependencia de producción: @google-cloud/firestore

- **Ubicación:** `package.json`, `node_modules/@google-cloud/firestore`
- **Detalle:** google-gax. Rango vulnerable: 7.5.0-pre.0 || 7.6.0 - 7.11.6. Requiere subir a firebase-admin@14.2.0 (**cambio de versión mayor**): validar el flujo que lo usa antes de subirlo.
- **Acción propuesta:** Planificar la actualización con prueba del flujo afectado.

### AUD-DEP002 · P2 · MODERATE en dependencia de producción: @google-cloud/storage

- **Ubicación:** `package.json`, `node_modules/@google-cloud/storage`
- **Detalle:** retry-request · teeny-request. Rango vulnerable: 2.2.0 - 2.5.0 || >=5.19.0. Requiere subir a firebase-admin@14.2.0 (**cambio de versión mayor**): validar el flujo que lo usa antes de subirlo.
- **Acción propuesta:** Planificar la actualización con prueba del flujo afectado.

### AUD-DEP003 · P2 · MODERATE en dependencia de producción: firebase-admin

- **Ubicación:** `package.json`, `node_modules/firebase-admin`
- **Detalle:** @google-cloud/firestore · @google-cloud/storage. Rango vulnerable: 7.0.0 - 8.2.0 || >=11.0.0. Requiere subir a firebase-admin@14.2.0 (**cambio de versión mayor**): validar el flujo que lo usa antes de subirlo.
- **Acción propuesta:** Planificar la actualización con prueba del flujo afectado.

### AUD-DEP004 · P2 · MODERATE en dependencia de producción: gaxios

- **Ubicación:** `package.json`, `node_modules/gaxios`
- **Detalle:** uuid. Rango vulnerable: 6.4.0 - 6.7.1. Hay corrección sin cambio de versión mayor: `npm audit fix`.
- **Acción propuesta:** Ejecutar `npm audit fix`, correr `npm test` y `npm run build`, y re-auditar.

### AUD-DEP005 · P2 · MODERATE en dependencia de producción: google-gax

- **Ubicación:** `package.json`, `node_modules/google-gax`
- **Detalle:** retry-request · uuid. Rango vulnerable: 4.0.5-experimental - 4.6.1. Requiere subir a firebase-admin@14.2.0 (**cambio de versión mayor**): validar el flujo que lo usa antes de subirlo.
- **Acción propuesta:** Planificar la actualización con prueba del flujo afectado.

### AUD-DEP006 · P2 · MODERATE en dependencia de producción: retry-request

- **Ubicación:** `package.json`, `node_modules/retry-request`
- **Detalle:** teeny-request. Rango vulnerable: 7.0.0 - 7.0.2. Requiere subir a firebase-admin@14.2.0 (**cambio de versión mayor**): validar el flujo que lo usa antes de subirlo.
- **Acción propuesta:** Planificar la actualización con prueba del flujo afectado.

### AUD-DEP007 · P2 · MODERATE en dependencia de producción: teeny-request

- **Ubicación:** `package.json`, `node_modules/teeny-request`
- **Detalle:** uuid. Rango vulnerable: 3.9.1 - 9.0.0. Requiere subir a firebase-admin@14.2.0 (**cambio de versión mayor**): validar el flujo que lo usa antes de subirlo.
- **Acción propuesta:** Planificar la actualización con prueba del flujo afectado.

### AUD-DEP008 · P2 · MODERATE en dependencia de producción: uuid

- **Ubicación:** `package.json`, `node_modules/uuid`
- **Detalle:** uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided. Rango vulnerable: <11.1.1. Requiere subir a firebase-admin@14.2.0 (**cambio de versión mayor**): validar el flujo que lo usa antes de subirlo.
- **Acción propuesta:** Planificar la actualización con prueba del flujo afectado.
