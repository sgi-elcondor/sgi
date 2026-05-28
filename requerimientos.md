# Requerimientos — Generales

> Se deben terminar de especificar adecuadamente las vistas y roles
> Añadir al admin la opcion de cambiar de vista

> Apuntes de reunión con auxiliar contable — Proyecto El Cóndor

3 de mayo del 2026 1:00 pm

---

## 1. Control de Facturación

### Manejo General

* Cada proyecto se maneja en un solo Excel.
* El control de facturación va enlazado al cierre de caja.
  > Jabes empieza la implementacion
* Falta agregar el campo **"manzana"** en la tabla.
  > Separar manzana de codigo de lote

### Cuotas y Financiación

* ~~Se manejan cuotas después de haber dado la cuota inicial.~~
* Cada cuota tiene un porcentaje variable según el cliente (ejemplo: 15%).

  > Se debe poder ingresar valores en (0,1) para poder tomar porcentajes del valor de referencia (si no hay valor de referencia como el precio total hay que notificar al usuario) se aplica este porcentaje al valor de referencia y cuando el usuario cambie de input o de click afuera del mismo que se remplace el porcentaje por el valor correspondiente.
  > El valor de referencia sera por ejemplo; El precio total para la cuota inicial o
  > La cuota inicial para las micro-cuotas, y asi susesivamente.
  >
  > Tambien debe ser posible ajustar el porcentaje de cada cuota regular aunque por defecto dependera del numero de cuotas que se establezca.
  > Barco se encarga
  > Si es un valor entre (1, 1000) se agregan ceros de millon por UX
* ~~Cada cuota debe tener  fecha inicial .~~
* El saldo a diferir varía según la negociación del cliente.
  > Que se puedan editar los porcentajes de cuotas
* ~~Estructura del plan: `Valor inicial → Número de cuotas sobre el valor restante`.~~
* ~~También existe  **diferido de la cuota inicial** .~~
* ~~⚠️ Generar **alertas** cuando el cliente deba pagar la próxima cuota.~~
  > Corregirlo para que funcione bien.

  > Se pueden crear notificaciones pero eso agrega un costo de desarrollo y otro monetario mensual para soportar mensajes de texto.
* Se debe contemplar el manejo de  **clientes en mora** .
* ⚠️ Generar **alertas** para clientes en mora.
* ### Consideraciones de Fechas


  * Hay clientes que pagan del  **1 al 15** .
  * Otros clientes pagan del  **15 al 30** .

  ### Mora

  * La mora inicia a partir de los **3 meses** de atraso.

### Escrituras

* Si el cliente paga el  **30%** , se le da escritura.
 > El auxiliar contable debe ser notificado de esto 
### Permutas

* Se reciben bienes o activos como parte de pago.

### Abonos y Pagos Adelantados

* Se manejan abonos (cuotas extraordinarias).

  > Estos deben restarse desde las ultimas cuotas (ir abonando la ultima, penultima y asi cada que se abone una por una pero para el cliente esto sera solo un valor diferido, el no vera sus ultimas cuotas "pagadas" vera un pago al monto total que tambien resta del total porsupuesto).
  >
* Algunos clientes apartan con un valor parcial (ejemplo: $1.000.000) y completan el resto posteriormente.

  > Se debe poder recibir parte de una cuota.
  > 
* Algunos clientes adelantan cuotas iniciales, que pueden aplicar:

  * Al monto total.
    > A la ultima cuota como dijimos anteriormente.
    >
  * A la próxima cuota.

### Retenciones y Comisiones

* Falta implementar el manejo de  **retenciones** .
* La gerencia debe poder consultar el total de **comisiones** a pagar.
* Esta información debe quedar guardada en el sistema.

## 3. Cierre de Caja

### Bancos y Movimientos

* Se descargan historiales de movimientos y extractos bancarios.
* Los datos se ingresan copiando y pegando extractos bancarios.
* Se insertan los ingresos del banco en el cierre de caja, incluyendo deducibles de gastos.

### Verificación y Fraude

* ⚠️ Manejo de  **fraude** : contrastar información para hacer verificaciones.
* Guardar imágenes de **vouchers** de cada transacción enviada por el cliente.
* Proceso de verificación  **manual** .
* Flujo: el cliente envía el voucher → pasa por el banco → se contrasta con la lista de transacciones → se confirma el pago.

### Información que Sube el Cliente

* Voucher (imagen).
* Fecha.
* Monto.
* Lote al que pertenece (se hereda de los datos del cliente).

### Gastos

* Incorporar registro de gastos con:
  * Factura.
  * Descripción.
* Registrar todos los gastos, incluyendo  **saldos negativos** .

#### Recurso 1 — Minucioso (detallado por recurso)

Ejemplo:

* Gastos por vehículo:
  * Volqueta X: combustible, otros.
  * Camioneta X: gastos específicos.

#### Recurso 2 — General

Ejemplo:

* Gastos generales de vehículos (agrupados).

### Validaciones

* Manejo de validación con **Siigo** mediante el archivo DC1 (Excel).

### Retiros y Movimientos

* Si se retira dinero (ejemplo: $1.000.000):
  * Mandarlo al banco, **o**
  * Tomarlo como gasto.

### Manejo de Pendientes

Debe registrarse:

* Quién realizó el movimiento.
* Estado del comprobante:
  1. No ha firmado el comprobante.
  2. No ha enviado el comprobante.

### Presupuestos y Roles

* Establecer sitios de presupuestos.
* Rol de resúmenes.

### Caja

* Debe existir una **caja** para llevar registros.
* Las **permutas** también se almacenan en caja (se consideran activos).

---

## 5. Reportes

* Posibilidad de trasladar dinero de una cuenta a  **caja menor** .
  * Ejemplo: de $30.000.000, se toman $15.000.000 por lo que se debe.

---

## 6. Informes

### Tipos de Informe

#### Recurso 1 — Minucioso

* Información detallada por ítem.

#### Recurso 2 — General

* Información resumida.

### Manejo Financiero

* Registro de egresos e ingresos.
* Ingresos  **mes a mes** .
* Tabla de permutas.
* Manejo de recursos por proyecto.

### Proyectos

* Se pueden abrir  **nuevos proyectos** .
* Se puede hacer  **inyección de capital** .
* Un proyecto consolidado puede **prestarle** a un proyecto en etapa inicial.
* Cada proyecto maneja  **cuentas bancarias independientes** .

---

## 7. Dashboard (Auxiliar Contable)

### Cuotas

* Mostrar cuotas que **vencen** y cuotas  **próximas a vencer** .
* Permitir hacer clic para ver el detalle de cada cuota.

### Indicadores Clave (KPIs)

* Comisiones pendientes.
* Resumen de cartera.
* Proyección de ingresos mensuales.
* Cartera en mora con  **rol jurídico** .

---

## 8. Página Web / Histórico

* Visualización de **ganancias anuales** (integración con página web anterior).
