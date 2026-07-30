# Guía de Despliegue y Operación

## Sistema de Gestión Inmobiliaria SGI El Cóndor

**Versión 1.0 — Entrega final**

Preparado para **El Cóndor S. A. S.**

Elaborado por el equipo de desarrollo del SGI

29 de julio de 2026

---

### Control del documento

| Campo | Valor |
|---|---|
| Código | SGI-DOC-OPS-01 |
| Versión | 1.0 |
| Fecha de emisión | 29 de julio de 2026 |
| Estado | Emitido para entrega |
| Clasificación | **Confidencial.** Describe el procedimiento de despliegue y las credenciales requeridas |
| Elaborado por | Equipo de desarrollo del SGI |
| Revisado por | Scrum Master (J. M. Candela Toro) |
| Documentos relacionados | SGI-DOC-ARQ-01, SGI-DOC-DAT-01 |

---

## Propósito

Este documento es un manual de operación, no una descripción. Está escrito para
ejecutarse: cada sección contiene los pasos concretos, en orden, con la forma de
verificar que funcionaron y qué hacer si no. Su lector es quien despliegue o
mantenga el sistema en producción.

Se asume acceso a la plataforma de despliegue, al panel de la base de datos y al
repositorio. No se asume conocimiento previo del sistema.

---

## Restricción Fundamental: Una Sola Instancia

Antes de cualquier procedimiento hay que enunciar la restricción que condiciona
todo lo demás.

> **El sistema debe ejecutarse con una única instancia. No habilite escalado
> horizontal ni réplicas sin realizar antes los cambios descritos en la sección
> «Antes de escalar».**

La razón no es de capacidad sino de corrección. Dos componentes viven en la memoria
del proceso: el concentrador de eventos en tiempo real y las cuatro tareas
programadas. Con dos instancias, los usuarios conectados a una no recibirían los
avisos originados en la otra, y las tareas de depuración se ejecutarían por
duplicado. El sistema no fallaría de forma visible; se comportaría de manera
inconsistente, que es peor.

---

## Requisitos del Entorno

**Tabla 1**

*Requisitos de la plataforma de ejecución*

| Requisito | Valor | Comentario |
|---|---|---|
| Node.js | 22 o superior | El proyecto usa `fetch` global y `crypto.randomUUID` |
| Instancias | **Exactamente 1** | Restricción de corrección, no de capacidad |
| Variable `NODE_ENV` | `production` | Activa HTTPS forzado, HSTS y los artefactos empaquetados |
| Terminación TLS | En el proxy de la plataforma | La aplicación confía en las cabeceras de protocolo reenviadas |
| Almacenamiento persistente | No requerido | Los archivos residen en el gestor de documentos externo |

*Nota.* La aplicación no requiere volumen persistente porque no escribe archivos
en disco: los comprobantes y avatares se cargan directamente al gestor externo
desde memoria.

---

## Credenciales Requeridas

Las variables se agrupan por servicio. Las dos primeras son de arranque: si faltan,
el proceso termina de forma deliberada en lugar de arrancar mal configurado.

**Tabla 2**

*Variables de entorno por servicio*

| Servicio | Variables | Si falta |
|---|---|---|
| Base de datos | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | **El proceso no arranca** |
| Identidad, credenciales de servidor | `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_CLIENT_ID` | Ningún usuario puede autenticarse |
| Identidad, configuración de cliente | `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID` | La pantalla de acceso no funciona |
| Gestor de documentos | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Falla la carga de comprobantes; el resto opera |
| Correo | `SMTP_USER`, `SMTP_PASS` | No se envía correo; **el fallo es silencioso** |
| Aplicación | `APP_URL`, `PORT`, `NODE_ENV` | Se usan valores por defecto |

*Nota.* En `FIREBASE_PRIVATE_KEY` los saltos de línea se escriben escapados como
`\n`; la aplicación los restituye al inicializar. Es el error de configuración más
frecuente al montar un entorno nuevo.

> **Precaución sobre el correo.** La ausencia de `SMTP_USER` y `SMTP_PASS` no
> impide desplegar, pero los flujos que dependen del correo —recuperación de
> contraseña, segundo factor de autenticación y avisos de requerimiento— dejan de
> funcionar sin mensaje visible en la interfaz. Verifíquelas explícitamente.

---

## Procedimiento de Despliegue

### Paso 1. Verificación previa en local

Antes de desplegar conviene ejecutar la misma verificación que corre la integración
continua. Si algo falla aquí, fallará en producción.

```bash
npm ci                    # instalación estricta desde el archivo de bloqueo
npm test                  # 164 pruebas
npm run build             # genera los artefactos y el contenedor de producción
npm run audit             # auditoría completa; requiere credenciales de base de datos
```

La auditoría debe terminar con la puerta de entrega abierta. Si reporta un hallazgo
bloqueante, resuélvalo antes de continuar: los hallazgos de ese nivel corresponden a
rutas sin autorización, referencias a columnas inexistentes o vulnerabilidades
graves en dependencias.

Para ejecutarla sin acceso a la base de datos, use `npm run audit:offline`, que
omite los dos cruces que la requieren.

### Paso 2. Migraciones de base de datos

Los cambios de esquema viven en el directorio `migrations/`, con la convención de
nombre `<épica>_<descripción>.sql`, y se aplican manualmente desde el editor SQL del
panel de la base de datos. El directorio contiene diecinueve guiones que cubren la
evolución del esquema desde la unificación inicial de usuarios hasta las
correcciones de esta entrega.

**Importante:** el proyecto **no usa una herramienta de migraciones**. El directorio
es una convención de organización, no un mecanismo que registre qué se aplicó, en
qué orden ni si ya se ejecutó. En consecuencia, el registro de aplicaciones es
manual y constituye la única traza disponible; conviene anotar fecha y responsable
de cada ejecución. La sección de mejoras recomendadas propone subsanarlo.

**Tabla 3**

*Guiones de esquema añadidos en esta entrega*

| Guion | Efecto | Estado |
|---|---|---|
| `migrations/aud_01_permisos_faltantes.sql` | Crea `cuotas:eliminar` y `reportes:mora_sync` y sus concesiones | Aplicado |
| `migrations/aud_02_privilegio_asesor_auditoria.sql` | Retira `auditoria_log:leer` al rol comercial | Aplicado |
| `migrations/aud_03_retirar_tablas_whatsapp.sql` | Traslada las tablas de mensajería no implementada a `condor_backup` | Aplicado |

*Nota.* Los tres son idempotentes y contienen su propia reversión comentada, de modo
que volver a ejecutarlos no produce efecto. En un entorno nuevo deben aplicarse
después de los guiones de las épicas que los preceden.

> **Al montar un entorno desde cero,** aplique todo el contenido de `migrations/`
> respetando el orden de dependencia: primero la unificación de usuarios y la
> recreación de vistas, luego los guiones por épica, y al final los tres de
> auditoría. El nombre de archivo no codifica el orden, por lo que este paso exige
> revisar el encabezado de cada guion.

### Paso 3. Configuración de la plataforma

Cargue las variables de la Tabla 2, fije `NODE_ENV=production` y confirme que el
número de instancias es **uno**.

### Paso 4. Construcción y arranque

```bash
npm ci --omit=dev         # dependencias de producción
npm run build             # imprescindible: genera public/index.prod.html
npm start
```

El paso de construcción no es opcional en producción. Sin él, el servidor no
encuentra el contenedor con artefactos empaquetados y recurre al de desarrollo:
la aplicación funcionaría, pero servida como decenas de archivos sin minificar ni
posibilidad de caché, con una degradación notable del tiempo de carga.

---

## Verificación Posterior al Despliegue

Ejecute estas comprobaciones en orden. Están ordenadas de menor a mayor
dependencia, de modo que la primera que falle señala la capa del problema.

**Tabla 4**

*Lista de verificación posterior al despliegue*

| # | Comprobación | Resultado esperado | Si falla |
|---|---|---|---|
| 1 | Abrir la raíz del dominio | Se muestra el catálogo público de proyectos | El proceso no arrancó; revise los registros |
| 2 | `GET /api/v1/public/proyectos` | Responde JSON con los proyectos | Falla la conexión a la base de datos |
| 3 | `GET /api/v1/firebase-config` | Devuelve la configuración pública | Faltan variables de identidad de cliente |
| 4 | Petición HTTP simple al dominio | Redirección 301 a HTTPS | `NODE_ENV` no es `production` |
| 5 | Cabeceras de respuesta | Incluyen política de seguridad de contenido y transporte estricto | Revise la cadena de intermediarios |
| 6 | Iniciar sesión con una cuenta interna | Ingreso correcto y vista según el rol | Revise las credenciales de servidor de identidad |
| 7 | Abrir una vista con datos, por ejemplo Ventas | Muestra registros | Problema de permisos o de esquema |
| 8 | Abrir la vista Requerimientos | Aparece el indicador «En vivo» activo | El canal de eventos no se estableció |
| 9 | Cargar un comprobante de prueba | La carga concluye y devuelve dirección | Revise credenciales del gestor de documentos |
| 10 | Solicitar recuperación de contraseña | Llega el correo | Revise credenciales de correo |
| 11 | Registros del proceso al arrancar | Aparece la línea del recálculo de mora | La tarea programada falló; revise el mensaje |

*Nota.* La comprobación 8 verifica indirectamente que la instancia es única y que
el canal de eventos opera: si el indicador no se activa, el cliente degradó a
consulta periódica y los avisos llegarán con retraso de hasta treinta segundos.

### Evidencia de validación de esta lista

La lista no se redactó de memoria: se ejecutó contra la construcción de producción
antes de emitir este documento, el 30 de julio de 2026, arrancando el proceso con
`NODE_ENV=production` y simulando la terminación TLS del proxy mediante la cabecera
`X-Forwarded-Proto`.

**Tabla 5**

*Resultado de la validación de las comprobaciones automatizables*

| Comprobación | Resultado obtenido |
|---|---|
| Petición sin cabecera de protocolo reenviado | 301 hacia `https://`, como exige el punto 4 |
| Raíz del dominio con proxy TLS simulado | 200, sirviendo el contenedor con artefactos empaquetados |
| `GET /api/v1/public/proyectos` | 200 con carga útil de datos |
| `GET /api/v1/firebase-config` | 200 con la configuración pública |
| `GET /api/v1/ventas` sin credenciales | **401**, como corresponde a una ruta protegida |
| Cabeceras de seguridad | Las seis presentes: política de contenido, transporte estricto, antimarco, antisniff, referente y permisos |
| Registro de arranque | Aparece el resultado del recálculo de mora |

*Nota.* Las comprobaciones 6, 7, 9 y 10 de la Tabla 4 requieren credenciales de
usuario y servicios externos, por lo que se verifican manualmente en el entorno de
destino. La quinta fila de esta tabla es la más relevante desde el punto de vista de
seguridad: confirma que la cadena de autorización rechaza el acceso sin credenciales
y no depende de que el cliente oculte la vista.

---

## Reversión

### Reversión de la aplicación

La aplicación no guarda estado en el proceso, de modo que revertir consiste en
volver a desplegar la versión anterior desde la plataforma. No requiere pasos
adicionales ni pérdida de datos.

### Reversión de la base de datos

Cada guion de esquema incluye su reversión comentada al final. Antes de aplicarla,
considere que revertir un permiso o una restricción es seguro, pero revertir un
traslado de tablas o una eliminación de columnas puede tener efectos sobre datos ya
generados.

Si la reversión implica restaurar datos, use el procedimiento de restauración
descrito más abajo y no una reversión manual: un respaldo restaurado es un estado
consistente conocido, mientras que una secuencia de deshacer manual rara vez lo es.

### Criterio de decisión

**Tabla 5**

*Cuándo revertir y cuándo corregir hacia adelante*

| Situación | Acción recomendada |
|---|---|
| La aplicación no arranca | Revertir el despliegue de inmediato |
| Un módulo falla y el resto opera | Corregir hacia adelante; no revertir |
| Se detecta un cálculo financiero incorrecto | Revertir de inmediato y verificar los datos afectados |
| Un permiso quedó mal configurado | Corregir en la pantalla de permisos; no requiere despliegue |
| Pérdida o corrupción de datos | Restaurar desde respaldo; no intente reparar en caliente |

*Nota.* La tercera fila es la única que justifica una reversión urgente ante un
fallo parcial: un error de cálculo sobre dinero puede propagarse a documentos
emitidos, y cada minuto de operación amplía el alcance de la corrección posterior.

---

## Operación Continua

### Tareas programadas internas

Cuatro tareas se ejecutan dentro del proceso de la aplicación, la primera también
al arrancar y todas cada veinticuatro horas.

**Tabla 6**

*Tareas programadas y su propósito*

| Tarea | Frecuencia | Propósito | Rastro |
|---|---|---|---|
| Recálculo de mora | Al arranque y cada 24 h | Actualiza el estado de la cartera vencida | Registro con el resultado |
| Depuración de notificaciones | Cada 24 h | Elimina las leídas con más de 60 días | Registro en caso de error |
| Depuración de desafíos de segundo factor | Cada 24 h | Elimina los vencidos o consumidos | Registro en caso de error |
| Caducidad de sesiones | Cada 24 h | Fuerza reautenticación periódica | Registro en caso de error |

*Nota.* Al alojarse en el proceso de la aplicación, estas tareas se reinician con
cada despliegue. El recálculo de mora se ejecuta también al arrancar precisamente
para que un despliegue no retrase la actualización de la cartera.

### Respaldos

Un proceso programado externo al servidor realiza el respaldo diario a las 08:00
UTC —03:00 en hora de Colombia—, con volcado del esquema en formato propio de
PostgreSQL. La retención es de treinta días, con purga automática de los más
antiguos, y cada operación queda registrada en el catálogo de respaldos consultable
desde la aplicación.

Si un respaldo o una restauración falla, los administradores reciben un aviso
interno. Este comportamiento es deliberado: un respaldo que falla en silencio
equivale a no tener respaldo.

La restauración se ejecuta mediante un proceso de activación manual, no automática.
Requiere las mismas credenciales del respaldo.

**Recomendación de operación:** verifique trimestralmente que una restauración
funciona, restaurando sobre un entorno de prueba. Un respaldo nunca probado es una
suposición.

### Supervisión

El sistema no expone métricas ni un punto de comprobación de salud dedicado, de modo
que la supervisión disponible son los registros del proceso y el catálogo de
respaldos. Conviene vigilar tres señales: mensajes de error del recálculo de mora,
fallos registrados en el catálogo de respaldos y reinicios inesperados del proceso.

La ausencia de un punto de comprobación de salud se recoge en las mejoras
recomendadas.

---

## Gestión de Usuarios y Permisos en Operación

Buena parte de los incidentes de un sistema con control de acceso granular no son
defectos, sino configuración. Estos son los tres casos frecuentes y su resolución.

**Un usuario no ve una vista que debería ver.** Verifique en la pantalla de
Permisos que su rol tenga la vista activada. Al activarla, el sistema concede
también los permisos de interfaz de programación asociados. Los cambios de rol o
permiso pueden tardar hasta sesenta segundos en surtir efecto por la caché de
identidad, salvo que la operación la invalide explícitamente, como ocurre en las
mutaciones desde esa misma pantalla.

**Un usuario recibe un error de permiso al ejecutar una acción.** El mensaje indica
el permiso exigido. Otórguelo al rol si corresponde. Si el permiso no aparece
disponible, puede tratarse de una acción autorizada dentro del código para roles
específicos y no configurable desde la interfaz; el Documento Técnico enumera esos
casos.

**Una cuenta quedó bloqueada por intentos fallidos.** El bloqueo dura treinta
minutos y se libera solo. Para liberarlo de inmediato, un administrador puede
desbloquear la cuenta desde la pantalla de Usuarios, lo que reinicia el contador.

---

## Antes de Escalar

Si el volumen llegara a exigir más de una instancia, deben realizarse estos tres
cambios **antes** de habilitarla. Se enuncian como precondiciones porque su omisión
no produce un fallo visible, sino un comportamiento inconsistente.

Primero, **sustituir el concentrador de eventos en memoria** por un canal
compartido entre instancias. Sin este cambio, un usuario conectado a la instancia A
no recibe los avisos originados en la instancia B.

Segundo, **externalizar las tareas programadas** o coordinarlas mediante un bloqueo
compartido. Sin este cambio, cada instancia ejecutaría las cuatro depuraciones
diarias, con purgas duplicadas y recálculos de mora simultáneos.

Tercero, **verificar el comportamiento de la caché de identidad** bajo varias
instancias. La caché es local a cada proceso, de modo que la invalidación tras un
cambio de permisos solo alcanza a la instancia que atendió la petición; las demás
mantendrían el permiso anterior hasta que expire su propia entrada.

---

## Mejoras Recomendadas

**Tabla 7**

*Mejoras de operación recomendadas, en orden de utilidad*

| Mejora | Problema que resuelve | Esfuerzo |
|---|---|---|
| Punto de comprobación de salud | Permite supervisión automática y verificación de despliegue sin intervención | Bajo |
| Herramienta de migraciones de esquema | Sustituye el registro manual por una traza verificable de qué se aplicó | Medio |
| Pruebas de extremo a extremo de los flujos de dinero | Detecta regresiones que hoy solo aparecen en la verificación manual | Alto |
| Registro estructurado con nivel de severidad | Facilita filtrar señales relevantes entre los registros del proceso | Bajo |
| Verificación periódica de restauración | Convierte el respaldo en una garantía comprobada | Bajo |

*Nota.* Elaboración propia. Las dos primeras son las de mejor relación entre
esfuerzo y beneficio operativo inmediato.

---

## Contactos y Responsabilidades

**Tabla 8**

*Responsabilidades del equipo de desarrollo*

| Ámbito | Responsable |
|---|---|
| Tablero, sprints y criterios de aceptación | Juan Manuel Candela Toro (Scrum Master) |
| Base de datos y relación con el cliente | Jabes Esteban Monroy Becerra (Product Owner) |
| Interfaz y desarrollo web | Juan David Barco Ruiz |
| Interfaz y administración del código fuente | Juan Manuel Díaz Gómez |

*Nota.* Adaptado de la composición del equipo del proyecto.

---

## Referencias

American Psychological Association. (2020). *Publication manual of the American
Psychological Association* (7th ed.). https://doi.org/10.1037/0000165-000

Humble, J., & Farley, D. (2010). *Continuous delivery: Reliable software releases
through build, test, and deployment automation*. Addison-Wesley.

Kim, G., Humble, J., Debois, P., & Willis, J. (2016). *The DevOps handbook: How to
create world-class agility, reliability, and security in technology
organizations*. IT Revolution Press.

Nygard, M. T. (2018). *Release it! Design and deploy production-ready software*
(2nd ed.). Pragmatic Bookshelf.
