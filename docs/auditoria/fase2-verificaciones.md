# Fase 2 · Verificaciones manuales de desincronización entre vistas

Los siete anexos automáticos cruzan estructuras (rutas, permisos, vistas, esquema).
Hay una clase de defecto que ningún cruce estático detecta: **la misma verdad
calculada dos veces**, o mostrada distinto en dos pantallas. Esta fase la revisa a
mano, y deja constancia tanto de lo que falló como de lo que se comprobó y está bien
— porque en una entrega vale igual saber qué se verificó que qué se corrigió.

Método: para cada riesgo se indica qué se revisó, con qué evidencia y el veredicto.
Cuando el veredicto dependía de un comportamiento observable, se ejecutó en lugar de
razonarse.

---

## V-01 · ¿El frontend recalcula el saldo por su cuenta? (RN-10)

**Riesgo.** RN-10 fija una única fórmula de saldo (`valor − Σ recibos respaldados`),
implementada en `saldos.service`. Si una vista la recalcula, aux y comprador pueden
ver cifras distintas de la misma venta.

**Revisado.** Búsqueda de asignaciones a `saldo`/`saldo_pendiente` y de restas sobre
`valor_total` en todo `public/js`. Cinco coincidencias: tres en
`views/operacion/ventas.js` y dos en `views/finanzas/gastos.js`.

**Veredicto: correcto, con un problema de nombre.** En
[ventas.js:227](../../public/js/views/operacion/ventas.js#L227) la expresión
`Math.max(0, vt - ci - tp)` **no es el saldo contable**: es el *valor a financiar*
(total − cuota inicial − permutas), usado para el resumen del plan de pago. El
importe pagado sí proviene del backend (`c.valor_pagado`, ya derivado por
`saldos.service`), de modo que RN-10 se respeta.

**Acción pendiente (P2).** La variable se llama `saldo` y eso invita a confundirla
con el saldo de RN-10. Renombrarla a `valorAFinanciar` en las tres ocurrencias.

---

## V-02 · ¿El refresco en tiempo real llega a todas las vistas afectadas?

**Riesgo.** Una transición de requerimiento toca más de un módulo. Si sólo se
refresca el módulo de origen, otro usuario ve datos viejos sin saberlo.

**Revisado.** `components/live-updates.js` completo, y el gate de permisos en ambos
extremos (`MODULE_PERMS` en el cliente, `STREAM_PERMS` en
`requerimientos.controller.js`).

**Veredicto: funciona, con un hueco de alcance.**

- El mecanismo real **no usa CustomEvents**: mantiene el mapa `LIVE_VIEWS` e invoca
  `window[<vista>View]()` con debounce de 400 ms. CLAUDE.md documentaba un contrato
  `addEventListener('sgi:requerimiento')` inexistente — corregido.
- `LIVE_VIEWS` cubre `requerimientos`, `aprobaciones`, `desembolsos` y
  `recepciones`. **No cubre `gastos` ni `empresas-aliadas`**, y un desembolso crea un
  gasto y vincula una empresa: quien tenga esas vistas abiertas ve datos viejos hasta
  recargar a mano.
- Degradación verificada: si SSE falla 6 veces, pasa a polling cada 30 s.

**Acción pendiente (P2).** Añadir `gastos` y `empresas-aliadas` a `LIVE_VIEWS`.

---

## V-03 · ¿Los roles del flujo POL-02 reciben los eventos en vivo?

**Riesgo.** POL-02 añadió los permisos `requerimientos:aprobar_dueno` y
`aprobar_gerencia`. Si el gate del stream no se actualizó, `dueno` y `gerencia`
—precisamente quienes firman las compras grandes— no recibirían avisos.

**Revisado.** Los dos gates contra la matriz de acceso real de los 6 roles del flujo.

**Veredicto: sin impacto hoy, inconsistencia latente.** El backend (`STREAM_PERMS`)
sí incluye los dos permisos nuevos; el cliente (`MODULE_PERMS`) no. No hay fallo
porque los 6 roles del flujo tienen `requerimientos:leer`, que sí está en ambas
listas. Pero un rol futuro con **sólo** `aprobar_dueno` sería admitido por el backend
y nunca abriría la conexión.

**Acción pendiente (P2).** Alinear `MODULE_PERMS` con `STREAM_PERMS`.

---

## V-04 · ¿El manual de rol (MFN-01) sale vacío?

**Riesgo.** El Anexo D reportó que `permisos.descripcion` nunca se selecciona,
siendo la columna que alimenta el texto humano del manual del rol.

**Veredicto: falso positivo del auditor.** Sí se selecciona, en
[auth.controller.js:231](../../src/controllers/auth.controller.js#L231), mediante el
embed `permisos:id_permiso(recurso, accion, descripcion)`. El script no resolvía
embeds cuyo destino se expresa como columna de FK.

**Corregido en la herramienta.** El Anexo D ahora resuelve embeds leyendo las FK que
el propio esquema declara (`<fk table=… column=…/>`). Efecto: 24 embeds sin resolver
→ 0, y la lista de columnas muertas se depuró de 3 tablas a 2 columnas reales.

---

## V-05 · ¿El formato monetario coincide entre vistas?

**Riesgo.** Cada vista define su propio formateador. Si difieren, el mismo importe se
ve distinto en dos pantallas.

**Revisado.** Los 49 usos directos de `toLocaleString`/`Intl.NumberFormat` en 29
archivos. Casi todos usan `es-CO` + `currency: COP` + `maximumFractionDigits: 0`.
Una excepción: `views/finanzas/validacion-pagos.js:5` usa `minimumFractionDigits: 0`.

**Veredicto: consistente.** Se ejecutaron ambos formateadores sobre el mismo importe
con decimales (`1234567.89`): las dos configuraciones producen `$ 1.234.568`, porque
COP tiene 0 decimales por defecto en CLDR. No hay diferencia visible para el usuario.

**Acción pendiente (P2).** Deuda de duplicación, no de comportamiento: ~15
formateadores locales replican la misma configuración y hoy coinciden por
coincidencia. `SGIUI` ya expone uno ([ui.js:23](../../public/js/ui.js#L23)).
Unificar reduce el riesgo de que un cambio futuro divida las vistas.

---

## V-06 · ¿La caché del cliente puede servir datos obsoletos?

**Riesgo.** `API.getCached` guarda respuestas 60 s con stale-while-revalidate. La
invalidación automática cubre sólo el **mismo recurso top-level**: una mutación que
afecte a otro recurso dejaría la caché de éste desactualizada (por ejemplo, un
desembolso que crea un gasto).

**Revisado.** La implementación en [api.js:104-153](../../public/js/api.js#L104) y
los 6 puntos que usan `getCached`.

**Veredicto: correctamente acotado.** Sólo se cachean tres catálogos estables:
`/proyectos`, `/roles` y `/empresas-aliadas?activas=1`. Cada uno se muta
exclusivamente a través de sus propios endpoints (`POST/PUT /proyectos`,
`PATCH /proyectos/:id/ubicacion`, `PUT /roles/:id/permisos`,
`PATCH /roles/:id/manual`, `POST/PUT /empresas-aliadas`), todos cubiertos por la
invalidación por prefijo — que además contempla la variante con query string. **No
existe hoy un camino de lectura obsoleta.**

**Nota para el futuro.** La garantía depende de esa coincidencia. Si algún día se
cachea un recurso derivado (cartera, stock, contadores), habrá que invalidar
explícitamente desde las mutaciones que lo afecten.

---

## Resumen

| ID | Riesgo | Veredicto |
|---|---|---|
| V-01 | Saldo recalculado en frontend | Correcto; renombrar variable engañosa (P2) |
| V-02 | Alcance del refresco en vivo | Funciona; falta `gastos` y `empresas-aliadas` (P2) |
| V-03 | Gate SSE vs permisos POL-02 | Sin impacto; inconsistencia latente (P2) |
| V-04 | Manual de rol vacío | Falso positivo; herramienta corregida |
| V-05 | Formato monetario divergente | Consistente (verificado ejecutando) |
| V-06 | Lecturas obsoletas por caché | Correctamente acotado |

Ningún hallazgo de esta fase es P0 ni P1. Las cuatro acciones pendientes son deuda
de mantenibilidad y alcance, no defectos de datos.
