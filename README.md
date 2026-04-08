# SGI El Cóndor — Sistema de Gestión Inmobiliaria

> Aplicativo web para la automatización y centralización de operaciones financieras e inmobiliarias de **El Cóndor S.A.S.**

---

## Descripción del Proyecto

**SGI El Cóndor** es una plataforma web desarrollada para la empresa inmobiliaria El Cóndor S.A.S., con el objetivo de digitalizar y centralizar la gestión de:

- Ventas de lotes y proyectos inmobiliarios
- Generación automática de cuotas y planes de pago
- Registro y seguimiento de pagos
- Facturación y emisión de recibos
- Control de mora, devoluciones y comisiones
- Reportes ejecutivos consolidados

La plataforma garantiza trazabilidad completa, acceso diferenciado por roles y automatización de las tareas del auxiliar contable.

---

## Stakeholders

| Rol | Descripción |
|-----|-------------|
| **Compradores / Clientes** | Consultan estado de compras, cuotas y recibos desde su portal personal |
| **Auxiliar Contable** | Usuario operativo principal; registra ventas, pagos y facturación |
| **Asesores Comerciales** | Crean procesos de venta pendientes de autorización |
| **Jefe / Gerencia** | Accede a reportes globales (solo lectura) |
| **Abogado / Área Jurídica** | Consulta ventas en mora o devolución para gestión legal |
| **Comisionistas** | Reciben comisiones automáticas al superar el 30% del valor del lote pagado |
| **Administración / Operaciones** | Gestiona estructura de proyectos y lotes |
| **Auditoría / Control Interno** | Supervisa trazabilidad de cambios críticos |
| **Equipo de TI** | Despliega y mantiene la plataforma |
| **Entidades Financieras** | Facilitan los canales de pago |

---

## Tecnologías

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Vue.js](https://img.shields.io/badge/Vue.js-4FC08D?style=flat&logo=vue.js&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-777BB4?style=flat&logo=php&logoColor=white)
![.NET](https://img.shields.io/badge/.NET-512BD4?style=flat&logo=dotnet&logoColor=white)

**Herramientas de desarrollo:** VSCode · IntelliJ · DBeaver · Jira · Git

---

## Equipo de Desarrollo

| Nombre | Rol | Especialidad |
|--------|-----|--------------|
| **Juan Manuel Candela Toro** | Scrum Master | Full-stack · Gestión de Jira (backlog, sprints, criterios) |
| **Jabes Esteban Monroy Becerra** | Product Owner | Bases de datos PostgreSQL · Contacto con el cliente |
| **Juan David Barco Ruiz** | Developer | Frontend · Desarrollo web |
| **Juan Manuel Díaz Gómez** | Developer | Frontend · Administración del código fuente |

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
- [ ] Redactada en formato estándar: *"Como [rol], quiero [acción] para [beneficio]"*
- [ ] Al menos un criterio de aceptación concreto y verificable definido
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

🔗 [https://elcondorsgi.atlassian.net](https://elcondorsgi.atlassian.net)

---

## Licencia

Este proyecto fue desarrollado como parte de un proyecto académico en la **Universidad Nacional de Colombia** para la empresa El Cóndor S.A.S. Todos los derechos reservados.
