# Notas de Versión 1.0

## Sistema de Gestión Inmobiliaria SGI El Cóndor

Preparado para **El Cóndor S. A. S.**

29 de julio de 2026

---

### Control del documento

| Campo | Valor |
|---|---|
| Código | SGI-DOC-REL-01 |
| Versión del producto | 1.0 |
| Fecha de emisión | 29 de julio de 2026 |
| Estado | Emitido para entrega |
| Clasificación | Uso interno de El Cóndor S. A. S. |

---

## Alcance de la versión

Esta versión constituye la primera entrega completa del sistema. Cubre el ciclo
comercial y financiero de la venta de lotes de principio a fin, el portal de
autoconsulta del comprador, el flujo interno de requerimientos y abastecimiento, y
la administración de accesos.

**Tabla 1**

*Módulos incluidos en la versión 1.0*

| Módulo | Contenido |
|---|---|
| Operación comercial | Proyectos, lotes con geometría cartográfica, ventas con múltiples compradores y permutas |
| Plan de pago | Generación automática de cuotas iniciales, micro-cuotas y cuotas regulares |
| Facturación | Emisión, anulación y solicitud de facturas por cuota o fracción |
| Pagos | Registro en oficina, carga por el comprador, conciliación bancaria y aceptación por lote |
| Recibos | Emisión inmutable con numeración consecutiva |
| Comisiones | Causación automática al 30 % y liquidación mediante micropagos |
| Jurídico | Cartera en pre-mora y mora con bitácora de observaciones |
| Portal del comprador | Ventas, cuotas, facturas, pagos y recibos propios |
| Requerimientos | Flujo de siete estados con aprobación según monto, desembolso y gasto automático |
| Inventario | Recepciones parciales o totales, existencias derivadas y entrega con autorización |
| Empresas aliadas | Catálogo de proveedores con validación tributaria e historial comercial |
| Políticas de compra | Umbrales de caja menor y compra grande configurables sin redespliegue |
| Reportes | Cartera, recaudo histórico, proyección de ingresos, comisiones y auditoría |
| Seguridad de acceso | Bloqueo por intentos, segundo factor, reautenticación y caducidad de sesiones |
| Administración | Usuarios, roles, permisos por vista y manual de rol consultable |
| Respaldos | Respaldo diario con retención de 30 días, restauración y alertas ante fallo |

*Nota.* El sistema expone 30 vistas de usuario y 151 puntos de acceso a su interfaz
de programación, con 14 roles diferenciados.

---

## Cambios del ciclo de cierre

El ciclo previo a la entrega no añadió funcionalidad: se dedicó a verificar la
coherencia del sistema y a cerrar lo que la verificación encontró. Se documenta
aquí porque varios de esos cambios corrigen comportamientos que el usuario final
percibía.

### Correcciones con efecto visible

**Dos acciones eran inaccesibles para todos los roles salvo el administrador.**
Eliminar fracciones de una cuota y forzar la resincronización de mora exigían
permisos que no existían como registro en la base de datos, de modo que el control
de acceso los denegaba siempre. Ahora están otorgados a los roles que
operativamente los necesitan.

**El refresco en tiempo real no alcanzaba a dos vistas afectadas.** Un desembolso
de tesorería crea un gasto y vincula una empresa aliada, pero quien tuviera abiertas
las vistas de Gastos o Empresas Aliadas seguía viendo datos anteriores hasta
recargar manualmente. Ambas se incorporaron al refresco automático.

**El refresco automático podía borrar un formulario en curso.** Al ampliar su
alcance se detectó que un aviso entrante re-dibujaba la vista completa, de modo que
un usuario que estuviera llenando un formulario perdía lo escrito. Ahora el
refresco espera a que el formulario se cierre en lugar de descartarse, así que no
se pierde ni el dato entrante ni el trabajo del usuario.

**Un perfil comercial podía leer la bitácora de auditoría.** El rol de asesor
comercial tenía otorgada la lectura del registro de cambios sensibles, que contiene
movimientos de dinero y cambios de rol de todos los usuarios. Se retiró; el rol no
perdió ninguna capacidad comercial.

### Endurecimiento de seguridad

Se cerraron todas las vulnerabilidades de severidad crítica y alta en las
dependencias que llegan a producción.

**Tabla 2**

*Vulnerabilidades en dependencias de producción*

| Severidad | Antes | Después |
|---|---|---|
| Crítica | 1 | **0** |
| Alta | 7 | **0** |
| Moderada | 12 | 8 |

*Nota.* Las ocho moderadas restantes son transitivas de la biblioteca de
autenticación y no admiten corrección por parte del proyecto hasta que su
proveedor publique una versión nueva. Se declaran como riesgo residual aceptado.

### Depuración

Se retiraron diez entradas de configuración de permisos que ninguna ruta podía
producir, una vista inexistente declarada en el mapa de la interfaz, una
dependencia de producción que ningún archivo importaba y una dependencia no
declarada que habría roto el sembrado de datos en una instalación limpia. Los cinco
guiones de mantenimiento puntual que convivían con el sembrado reproducible se
movieron a un directorio propio, con advertencia expresa de que escriben sin pasar
por las validaciones de negocio.

### Verificación y documentación

Se incorporaron pruebas para los dos servicios críticos que carecían de ellas —el
de comisiones, con doce casos sobre el umbral del 30 %, y el de auditoría, con cinco
sobre la forma del registro—, elevando la suite de 147 a 164 pruebas. Se añadió
verificación automática de integración en cada cambio, que antes no existía. Y se
construyó una auditoría automatizada de siete cruces que actúa como puerta de
entrega y queda disponible para los ciclos siguientes.

Se corrigieron además cinco afirmaciones incorrectas de la documentación interna,
entre ellas un rol que se documentaba como existente sin estarlo y un contrato de
programación descrito de forma que no correspondía a la implementación.

---

## Limitaciones conocidas

Se declaran de forma expresa para que la operación las conozca antes de encontrarlas.

**Tabla 3**

*Limitaciones de la versión 1.0*

| Limitación | Consecuencia práctica |
|---|---|
| El sistema opera con una sola instancia | No habilitar escalado horizontal sin los cambios descritos en la guía de operación |
| Los avisos por correo son de mejor esfuerzo | Un fallo del proveedor de correo no interrumpe la operación, pero tampoco avisa |
| No hay pruebas automatizadas de interfaz | La verificación por rol depende de una revisión manual |
| No hay punto de comprobación de salud | La supervisión se apoya en los registros del proceso |
| No hay herramienta de migraciones | Los cambios de esquema se aplican y registran manualmente |
| La mensajería externa no está implementada | Sus tablas se conservan fuera del esquema activo por si se retoma |
| Dos tablas de relación sin clave primaria | Garantía ausente; el guion de corrección se entrega listo para aplicar |

*Nota.* Ninguna de estas limitaciones impide la puesta en producción. Las tres
primeras filas describen decisiones conscientes; las cuatro restantes, mejoras
recomendadas con su tratamiento documentado.

---

## Requisitos de despliegue

Esta versión requiere ejecutar la construcción de producción antes de arrancar y
tener aplicados los tres guiones de esquema entregados. El procedimiento completo,
con su lista de verificación posterior y su plan de reversión, se encuentra en la
Guía de Despliegue y Operación (SGI-DOC-OPS-01).

---

## Estado de verificación al momento de la entrega

**Tabla 4**

*Indicadores de verificación*

| Indicador | Resultado |
|---|---|
| Hallazgos bloqueantes de auditoría | 0 |
| Hallazgos de deuda documentados | 37 |
| Pruebas automatizadas | 164, todas en verde |
| Construcción de producción | Correcta |
| Vulnerabilidades críticas o altas en producción | 0 |

*Nota.* El detalle por área se encuentra en el informe consolidado de auditoría.
Los hallazgos de deuda quedan catalogados con su ubicación y acción recomendada, de
modo que constituyen una lista de trabajo y no una incógnita.
