# Gestión del Proyecto — SGI El Cóndor

---

## Stakeholders

| Rol | Descripción |
|-----|-------------|
| **Compradores / Clientes** | Consultan estado de compras, cuotas, facturas y recibos desde su portal personal. Suben comprobantes de pago. |
| **Auxiliar Contable** | Usuario operativo principal; registra ventas, valida pagos, emite facturas y recibos, concilia con extractos bancarios. |
| **Asesores Comerciales** | Crean solicitudes de venta pendientes de autorización por el área financiera. |
| **Gerencia** | Accede a reportes consolidados y dashboards directivos (solo lectura). |
| **Jurídico** | Consulta ventas en mora o devolución y registra observaciones jurídicas. |
| **Comisionistas** | Reciben comisiones automáticas causadas al superar el 30 % del valor de la venta. |
| **Administración / Operaciones** | Gestiona estructura de proyectos, lotes, usuarios, roles y permisos. |
| **Auditoría / Control Interno** | Supervisa la trazabilidad de los cambios críticos. |
| **Equipo de TI** | Despliega y mantiene la plataforma. |
| **Entidades Financieras** | Facilitan los canales de pago conciliables desde el extracto bancario. |

---

## Planificación de Sprints

El proyecto se divide en **4 sprints de 3 semanas** cada uno, con una velocidad estimada de **27 story points por sprint**.

| Sprint | Enfoque | Historias | SP | Duración |
|--------|---------|-----------|-----|----------|
| **Sprint 1** | Núcleo del Sistema, Seguridad e Inmobiliario Base | S-10, 63, 67, 69, 73, 78, 95, 96 | 28 | ~3 sem. |
| **Sprint 2** | Obligaciones, Control y Gestión Operativa | S-27, 58, 68, 70, 71, 72, 93, 94 | 27 | ~3 sem. |
| **Sprint 3** | Flujo de Dinero e Interfaz de Pagos | S-82, 85, 86, 88, 89, 90, 91, 92 | 27 | ~3 sem. |
| **Sprint 4** | Facturación, Comisiones, Reportes y Portal del Comprador | S-36, 74, 76, 77, 79, 83, 84, 87 | 26 | ~3 sem. |
| **Total** | | | **108** | **~12 sem.** |

### Descripción de los Sprints

**Sprint 1 — Núcleo del Sistema y Seguridad**
Establece los cimientos técnicos: autenticación, control de acceso por roles, gestión de lotes/ventas y operaciones inmobiliarias base. Prerequisito para todos los módulos siguientes.

**Sprint 2 — Ventas y Gestión Operativa**
Creación y gestión de ventas, generación automática de cuotas, seguimiento comercial y consulta de información por compradores y asesores.

**Sprint 3 — Cuotas, Facturación y Pagos**
Registro transaccional de pagos, marcación automática de cuotas vencidas, emisión de recibos, proceso de devolución y consulta financiera del comprador.

**Sprint 4 — Mora, Comisiones, Devoluciones y Reportes**
Registro de comisiones, reportes ejecutivos consolidados, seguimiento jurídico y trazabilidad automática de cambios críticos.

---

## Definición de READY y DONE

### READY — Historia lista para trabajarse

Una historia entra al sprint cuando cumple **todos** los siguientes criterios:

- [ ] Redactada en formato: *"Como [rol], quiero [acción] para [beneficio]"*
- [ ] Al menos un criterio de aceptación concreto y verificable
- [ ] Estimada en story points mediante Planning Poker u otro método acordado
- [ ] Sin dependencias bloqueantes pendientes
- [ ] Comprendida por todo el equipo (dudas aclaradas con el PO)
- [ ] Acotada para completarse dentro de un sprint (3 semanas)

### DONE — Historia terminada

Una historia se cierra cuando cumple **todos** los siguientes criterios:

- [ ] Funcionalidad implementada y probada manualmente por el desarrollador
- [ ] Revisión de código completada por al menos un integrante distinto al autor
- [ ] Integrada exitosamente a la rama principal sin romper funcionalidades previas
- [ ] Validación en base de datos confirmada en PostgreSQL (si aplica)
- [ ] Interfaz verificada en navegador con render condicional por rol (si aplica)
- [ ] Registro de auditoría verificado para cambios críticos (pagos, devoluciones, estados)
- [ ] Historia movida a **Done** en Jira con fecha de cierre y notas registradas

---

## Análisis de Costo Estimado

| Parámetro | Valor |
|-----------|-------|
| Desarrolladores | 4 (modalidad medio tiempo) |
| Horas semanales por dev | 7 h/semana |
| Costo estimado por hora | $114.023 COP |
| Duración total | 12 semanas (4 sprints) |
| **Costo total estimado** | **$38.311.728 COP** |

> Equivalente a 2 desarrolladores full-time durante ~3 meses.

---

## Tablero del Proyecto (Jira)

El backlog, épicas, historias de usuario, criterios de aceptación y estado del proyecto están disponibles en:

[https://elcondorsgi.atlassian.net](https://elcondorsgi.atlassian.net)
