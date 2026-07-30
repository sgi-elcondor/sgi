# Paquete de Entrega — SGI El Cóndor v1.0

Preparado para **El Cóndor S. A. S.** · 29 de julio de 2026

Elaborado por el equipo de desarrollo del SGI: Juan Manuel Candela Toro,
Jabes Esteban Monroy Becerra, Juan David Barco Ruiz y Juan Manuel Díaz Gómez

---

## Qué contiene este paquete

Cinco documentos que se complementan sin repetirse. Cada uno responde una pregunta
distinta, y esa separación es deliberada: un documento que intenta responder todas
se vuelve imposible de mantener.

**Tabla 1**

*Documentos del paquete de entrega*

| Código | Documento | Responde a | Clasificación |
|---|---|---|---|
| SGI-DOC-FUN-01 | [Documento Funcional](01-documento-funcional.md) | ¿Qué hace el sistema y bajo qué reglas? | Uso interno |
| SGI-DOC-ARQ-01 | [Documento Técnico y de Arquitectura](02-documento-tecnico-arquitectura.md) | ¿Cómo está construido y por qué así? | Uso interno |
| SGI-DOC-DAT-01 | [Documento de Datos e Integraciones](03-documento-datos-integraciones.md) | ¿Dónde vive cada dato y de qué depende? | **Confidencial** |
| SGI-DOC-OPS-01 | [Guía de Despliegue y Operación](04-guia-de-despliegue-y-operacion.md) | ¿Cómo se despliega, verifica y opera? | **Confidencial** |
| SGI-DOC-REL-01 | [Notas de Versión 1.0](05-notas-de-version.md) | ¿Qué incluye esta versión y qué cambió? | Uso interno |

*Nota.* Los dos documentos confidenciales describen la estructura de datos y las
credenciales requeridas; su circulación debería limitarse al área de TI.

---

## Por dónde empezar según su rol

**Si recibe el sistema para operarlo.** Comience por las Notas de Versión, que en
diez minutos le dan el alcance y las limitaciones conocidas. Continúe con la Guía de
Despliegue y Operación, que es un manual ejecutable y no una descripción.

**Si va a modificar el código.** Comience por el Documento Técnico y de
Arquitectura, en particular la sección de decisiones de arquitectura: cada una
explica qué se rompe si se revierte. Después consulte el Documento Funcional para
las reglas de negocio que su cambio pueda afectar.

**Si va a auditar o validar la entrega.** El Documento Funcional contiene la matriz
de trazabilidad y los criterios de aceptación; el informe consolidado de auditoría
contiene el estado verificado con su evidencia.

**Si necesita entender los datos.** El Documento de Datos e Integraciones, con su
anexo de diccionario generado desde el esquema vigente.

---

## Anexos verificables

Los anexos no son ilustrativos: se generan desde el sistema real y pueden
regenerarse para comprobar que siguen vigentes. Esa es su utilidad frente a un
documento estático.

**Tabla 2**

*Anexos y comando que los regenera*

| Anexo | Contenido | Regeneración |
|---|---|---|
| [Diccionario de datos](anexos/diccionario-datos.md) | 35 tablas y 12 vistas con tipos y claves | `node tools/audit/gen-data-dictionary.js` |
| [Informe de auditoría](../auditoria/informe-hallazgos.md) | Hallazgos por área con ubicación y acción | `npm run audit` |
| [Matriz de acceso](../auditoria/anexos/matriz-acceso.md) | 14 roles con sus permisos y vistas | `npm run audit` |
| [Verificaciones de consistencia](../auditoria/fase2-verificaciones.md) | Seis comprobaciones manuales con su veredicto | Documento estático |
| [Inventario de rutas](../auditoria/anexos/01-routes-vs-permissions.md) | 151 rutas con su permiso exigido | `npm run audit` |
| [Guiones de esquema](../../migrations/) | Cambios de base de datos con verificación y reversión | Documento estático |

*Nota.* La regeneración de los anexos que dependen de la base de datos exige las
credenciales de conexión. Sin ellas, `npm run audit:offline` produce los cinco
cruces que no la requieren.

---

## Estado verificado de la entrega

**Tabla 3**

*Indicadores al 29 de julio de 2026*

| Indicador | Resultado |
|---|---|
| Hallazgos bloqueantes | **0** |
| Hallazgos de deuda catalogados | 37 |
| Pruebas automatizadas | 164 en verde |
| Construcción de producción | Correcta |
| Vulnerabilidades críticas o altas en producción | **0** |
| Verificación de integración automática | Activa en cada cambio |

*Nota.* La expresión «hallazgos de deuda catalogados» es intencional: no son
incógnitas, sino una lista de trabajo con ubicación en el código y acción
recomendada para cada elemento.

---

## Acciones pendientes del lado del cliente

Ninguna de estas acciones bloquea la puesta en producción, pero conviene resolverlas
en las primeras semanas de operación.

**Tabla 4**

*Acciones recomendadas tras la recepción*

| Acción | Motivo | Prioridad |
|---|---|---|
| Declarar clave primaria en `venta_comprador` y `venta_comisionista` | Impide duplicados que alterarían porcentajes de participación y comisiones. El guion se entrega con su verificación previa | Alta |
| Verificar la restauración de un respaldo sobre entorno de prueba | Un respaldo nunca probado es una suposición | Alta |
| Confirmar la configuración de credenciales de correo | Su ausencia deja sin funcionar recuperación de contraseña y segundo factor, sin aviso visible | Alta |
| Revisar los umbrales de caja menor y compra grande | Los valores por defecto pueden no corresponder a la política actual de la empresa | Media |
| Definir procedimiento de supresión de datos personales | Exige actuar en la base de datos y en el gestor de documentos externo | Media |
| Depurar las columnas heredadas de la tabla de comisiones | Una consulta directa sobre ellas devuelve información obsoleta | Baja |

*Nota.* La primera acción es la única que corrige una garantía ausente en el modelo
de datos; se entrega sin aplicar por criterio de prudencia, ya que añadir una
restricción en producción exige verificar antes la ausencia de duplicados y
coordinar la ventana de aplicación.

---

## Declaración de alcance

Este paquete documenta el sistema tal como se entrega, incluidas sus limitaciones.
Se ha evitado deliberadamente presentar como resuelto lo que no lo está: la épica de
mensajería externa no se implementó, no existen pruebas automatizadas de interfaz, el
sistema opera con una sola instancia por diseño y ocho vulnerabilidades moderadas
heredadas permanecen sin corrección disponible.

Cada una de esas limitaciones aparece en el documento que le corresponde, con su
efecto real y su recomendación. El criterio que guio la redacción es que quien
recibe un sistema debe poder decidir con información completa, y que una omisión
cómoda hoy se convierte en un problema costoso el día que alguien confíe en ella.
