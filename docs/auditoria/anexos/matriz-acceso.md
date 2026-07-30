# Anexo F · Matriz de acceso efectiva (rol × vistas × permisos)

_Derivada de condor.rol_permiso el 2026-07-30T05:45:23.266Z._

| Rol | Permisos | Vistas alcanzables |
|---|---|---|
| admin (acceso total) | 95 | dashboard, proyectos, lotes, compradores, ventas, cuotas, pagos, comisionistas, facturas, recibos, reportes, auditoria, respaldos, usuarios, roles, juridico, personal, gastos, recepciones, empresas-aliadas, requerimientos, aprobaciones, desembolsos, bank-transactions, payment-validation, mis-cuotas, mis-facturas, mis-recibos, el-proyecto, mapa-editor |
| dueno | 68 | dashboard, proyectos, lotes, compradores, ventas, cuotas, pagos, comisionistas, facturas, recibos, reportes, auditoria, usuarios, roles, juridico, personal, gastos, recepciones, empresas-aliadas, requerimientos, aprobaciones, desembolsos, bank-transactions, payment-validation, mis-cuotas, mis-facturas, mis-recibos, el-proyecto, mapa-editor |
| gerencia | 65 | proyectos, lotes, compradores, ventas, cuotas, pagos, comisionistas, facturas, recibos, reportes, auditoria, usuarios, roles, juridico, personal, gastos, recepciones, empresas-aliadas, requerimientos, aprobaciones, desembolsos, el-proyecto, mapa-editor |
| auxiliar_contable | 64 | dashboard, proyectos, lotes, compradores, ventas, cuotas, pagos, comisionistas, facturas, recibos, reportes, auditoria, usuarios, juridico, personal, gastos, recepciones, empresas-aliadas, requerimientos, desembolsos, bank-transactions, payment-validation, el-proyecto, mapa-editor |
| juridico | 22 | dashboard, proyectos, lotes, compradores, ventas, cuotas, pagos, reportes, juridico, personal, requerimientos, el-proyecto, mapa-editor |
| comprador | 17 | proyectos, lotes, ventas, pagos, recibos, gastos, recepciones, requerimientos, desembolsos, mis-cuotas, mis-facturas, mis-recibos, el-proyecto, mapa-editor |
| asesor_comercial | 17 | dashboard, proyectos, lotes, compradores, ventas, comisionistas, juridico, personal, requerimientos, el-proyecto, mapa-editor |
| comisionista | 11 | dashboard, proyectos, lotes, ventas, requerimientos, el-proyecto, mapa-editor |
| almacenista | 8 | pagos, gastos, recepciones, requerimientos, aprobaciones, desembolsos |
| topografo | 6 | proyectos, lotes, ventas, requerimientos, el-proyecto, mapa-editor |
| jefe_area | 5 | recepciones, requerimientos, aprobaciones, desembolsos |
| tesorero | 5 | pagos, gastos, recepciones, empresas-aliadas, requerimientos, aprobaciones, desembolsos |
| peticionario | 4 | proyectos, recepciones, requerimientos, aprobaciones, desembolsos, el-proyecto, mapa-editor |
| usuario | 3 | proyectos, lotes, ventas, requerimientos, el-proyecto, mapa-editor |

## Detalle por rol

### admin

- **Vistas:** dashboard, proyectos, lotes, compradores, ventas, cuotas, pagos, comisionistas, facturas, recibos, reportes, auditoria, respaldos, usuarios, roles, juridico, personal, gastos, recepciones, empresas-aliadas, requerimientos, aprobaciones, desembolsos, bank-transactions, payment-validation, mis-cuotas, mis-facturas, mis-recibos, el-proyecto, mapa-editor
- **Permisos (95):** alertas_jur:leer, auditoria_log:leer, bank_transactions:actualizar, bank_transactions:crear, bank_transactions:eliminar, bank_transactions:leer, comisionistas:actualizar, comisionistas:crear, comisionistas:leer, compradores:actualizar, compradores:crear, compradores:leer, cuotas:actualizar, cuotas:crear, cuotas:editar_valores, cuotas:leer, dashboard:ver_cartera, dashboard:ver_comisiones, dashboard:ver_juridico, dashboard:ver_operacion, empresas_aliadas:leer, facturas:actualizar, facturas:crear, facturas:leer, gastos:actualizar, gastos:crear, gastos:leer, inventario:leer, lotes:actualizar, lotes:crear, lotes:leer, mis_cuotas:leer, mis_facturas:leer, mis_pagos:crear, mis_pagos:leer, mis_recibos:leer, observaciones_jur:crear, observaciones_jur:leer, pagos:crear, pagos:leer, proyectos:actualizar, proyectos:crear, proyectos:leer, recibos:crear, recibos:leer, reportes:leer, reportes_dir:leer, requerimientos:aprobar_final, requerimientos:aprobar_jefe, requerimientos:crear, requerimientos:desembolsar, requerimientos:leer, respaldos:leer, respaldos:restaurar, roles:actualizar, roles:leer, uploads:crear, usuarios:actualizar, usuarios:crear, usuarios:leer, validacion_pagos:crear, validacion_pagos:leer, ventas:actualizar, ventas:crear, ventas:editar_financiero, ventas:leer, ventas:solicitar, vista:aprobaciones, vista:auditoria, vista:bank-transactions, vista:comisionistas, vista:compradores, vista:cuotas, vista:dashboard, vista:desembolsos, vista:el-proyecto, vista:facturas, vista:gastos, vista:inventario, vista:juridico, vista:lotes, vista:mis-cuotas, vista:mis-facturas, vista:mis-recibos, vista:pagos, vista:payment-validation, vista:personal, vista:proyectos, vista:recibos, vista:reportes, vista:requerimientos, vista:respaldos, vista:roles, vista:usuarios, vista:ventas

### dueno

- **Vistas:** dashboard, proyectos, lotes, compradores, ventas, cuotas, pagos, comisionistas, facturas, recibos, reportes, auditoria, usuarios, roles, juridico, personal, gastos, recepciones, empresas-aliadas, requerimientos, aprobaciones, desembolsos, bank-transactions, payment-validation, mis-cuotas, mis-facturas, mis-recibos, el-proyecto, mapa-editor
- **Permisos (68):** alertas_jur:leer, auditoria_log:leer, bank_transactions:leer, comisionistas:leer, compradores:leer, config:actualizar, config:leer, cuotas:leer, dashboard:ver_cartera, dashboard:ver_comisiones, dashboard:ver_juridico, dashboard:ver_operacion, empresas_aliadas:actualizar, empresas_aliadas:crear, empresas_aliadas:leer, facturas:leer, gastos:leer, lotes:leer, mi_cuenta:leer, mis_cuotas:leer, mis_facturas:leer, mis_pagos:leer, mis_recibos:leer, mis_ventas:leer, observaciones_jur:leer, pagos:leer, proyectos:leer, recepciones:leer, recibos:leer, reportes:leer, reportes_dir:leer, requerimientos:aprobar_dueno, requerimientos:aprobar_final, requerimientos:crear, requerimientos:leer, roles:leer, uploads:crear, usuarios:leer, validacion_pagos:leer, ventas:leer, vista:aprobaciones, vista:auditoria, vista:bank-transactions, vista:comisionistas, vista:compradores, vista:cuotas, vista:dashboard, vista:desembolsos, vista:el-proyecto, vista:empresas-aliadas, vista:facturas, vista:gastos, vista:juridico, vista:lotes, vista:mis-cuotas, vista:mis-facturas, vista:mis-recibos, vista:pagos, vista:payment-validation, vista:personal, vista:proyectos, vista:recepciones, vista:recibos, vista:reportes, vista:requerimientos, vista:roles, vista:usuarios, vista:ventas

### gerencia

- **Vistas:** proyectos, lotes, compradores, ventas, cuotas, pagos, comisionistas, facturas, recibos, reportes, auditoria, usuarios, roles, juridico, personal, gastos, recepciones, empresas-aliadas, requerimientos, aprobaciones, desembolsos, el-proyecto, mapa-editor
- **Permisos (65):** alertas_jur:leer, auditoria_log:leer, comisionistas:actualizar, comisionistas:crear, comisionistas:leer, compradores:actualizar, compradores:crear, compradores:leer, config:leer, cuotas:actualizar, cuotas:crear, cuotas:editar_valores, cuotas:leer, empresas_aliadas:actualizar, empresas_aliadas:crear, empresas_aliadas:leer, facturas:actualizar, facturas:crear, facturas:leer, gastos:actualizar, gastos:crear, gastos:leer, inventario:leer, lotes:actualizar, lotes:crear, lotes:leer, proyectos:actualizar, proyectos:crear, proyectos:leer, recibos:crear, recibos:leer, reportes:leer, reportes:mora_sync, reportes_dir:leer, requerimientos:aprobar_final, requerimientos:aprobar_gerencia, requerimientos:leer, roles:leer, uploads:crear, usuarios:actualizar, usuarios:crear, usuarios:leer, ventas:actualizar, ventas:crear, ventas:editar_financiero, ventas:leer, ventas:solicitar, vista:aprobaciones, vista:auditoria, vista:comisionistas, vista:compradores, vista:cuotas, vista:dashboard, vista:empresas-aliadas, vista:facturas, vista:gastos, vista:inventario, vista:lotes, vista:personal, vista:proyectos, vista:recibos, vista:reportes, vista:roles, vista:usuarios, vista:ventas

### auxiliar_contable

- **Vistas:** dashboard, proyectos, lotes, compradores, ventas, cuotas, pagos, comisionistas, facturas, recibos, reportes, auditoria, usuarios, juridico, personal, gastos, recepciones, empresas-aliadas, requerimientos, desembolsos, bank-transactions, payment-validation, el-proyecto, mapa-editor
- **Permisos (64):** alertas_jur:leer, auditoria_log:leer, bank_transactions:actualizar, bank_transactions:crear, bank_transactions:eliminar, bank_transactions:leer, comisionistas:actualizar, comisionistas:crear, comisionistas:leer, compradores:actualizar, compradores:crear, compradores:leer, cuotas:actualizar, cuotas:crear, cuotas:editar_valores, cuotas:eliminar, cuotas:leer, dashboard:ver_operacion, empresas_aliadas:leer, facturas:actualizar, facturas:crear, facturas:leer, gastos:actualizar, gastos:crear, gastos:leer, lotes:actualizar, lotes:crear, lotes:leer, pagos:crear, pagos:leer, proyectos:actualizar, proyectos:crear, proyectos:leer, recibos:crear, recibos:leer, reportes:leer, reportes:mora_sync, reportes_dir:leer, uploads:avatar, uploads:crear, usuarios:leer, validacion_pagos:crear, validacion_pagos:leer, ventas:actualizar, ventas:crear, ventas:editar_financiero, ventas:leer, ventas:solicitar, vista:auditoria, vista:bank-transactions, vista:comisionistas, vista:compradores, vista:cuotas, vista:dashboard, vista:facturas, vista:gastos, vista:lotes, vista:pagos, vista:payment-validation, vista:personal, vista:proyectos, vista:recibos, vista:reportes, vista:ventas

### juridico

- **Vistas:** dashboard, proyectos, lotes, compradores, ventas, cuotas, pagos, reportes, juridico, personal, requerimientos, el-proyecto, mapa-editor
- **Permisos (22):** alertas_jur:leer, compradores:leer, cuotas:leer, dashboard:ver_juridico, lotes:actualizar, lotes:leer, mi_cuenta:leer, notificaciones_jur:generar, notificaciones_jur:leer, notificaciones_jur:reenviar, observaciones_jur:crear, observaciones_jur:leer, pagos:leer, proyectos:actualizar, proyectos:leer, uploads:avatar, ventas:leer, vista:dashboard, vista:juridico, vista:lotes, vista:proyectos, vista:ventas

### comprador

- **Vistas:** proyectos, lotes, ventas, pagos, recibos, gastos, recepciones, requerimientos, desembolsos, mis-cuotas, mis-facturas, mis-recibos, el-proyecto, mapa-editor
- **Permisos (17):** lotes:leer, mis_cuotas:leer, mis_facturas:crear, mis_facturas:leer, mis_pagos:crear, mis_pagos:leer, mis_recibos:leer, mis_ventas:leer, proyectos:leer, recibos:crear, recibos:leer, uploads:crear, vista:dashboard, vista:el-proyecto, vista:mis-cuotas, vista:mis-facturas, vista:mis-recibos

### asesor_comercial

- **Vistas:** dashboard, proyectos, lotes, compradores, ventas, comisionistas, juridico, personal, requerimientos, el-proyecto, mapa-editor
- **Permisos (17):** comisionistas:leer, compradores:actualizar, compradores:crear, compradores:leer, dashboard:ver_operacion, lotes:leer, mi_cuenta:leer, proyectos:leer, uploads:avatar, ventas:crear, ventas:leer, ventas:solicitar, vista:compradores, vista:dashboard, vista:lotes, vista:proyectos, vista:ventas

### comisionista

- **Vistas:** dashboard, proyectos, lotes, ventas, requerimientos, el-proyecto, mapa-editor
- **Permisos (11):** lotes:actualizar, lotes:crear, lotes:leer, mi_cuenta:leer, proyectos:actualizar, proyectos:crear, proyectos:leer, uploads:avatar, vista:dashboard, vista:lotes, vista:proyectos

### almacenista

- **Vistas:** pagos, gastos, recepciones, requerimientos, aprobaciones, desembolsos
- **Permisos (8):** inventario:leer, recepciones:crear, recepciones:leer, requerimientos:entregar, requerimientos:leer, uploads:crear, vista:inventario, vista:recepciones

### topografo

- **Vistas:** proyectos, lotes, ventas, requerimientos, el-proyecto, mapa-editor
- **Permisos (6):** lotes:editar_geometria, lotes:leer, proyectos:editar_ubicacion, proyectos:leer, vista:el-proyecto, vista:mapa-editor

### jefe_area

- **Vistas:** recepciones, requerimientos, aprobaciones, desembolsos
- **Permisos (5):** inventario:leer, requerimientos:aprobar_jefe, requerimientos:leer, vista:aprobaciones, vista:inventario

### tesorero

- **Vistas:** pagos, gastos, recepciones, empresas-aliadas, requerimientos, aprobaciones, desembolsos
- **Permisos (5):** empresas_aliadas:leer, requerimientos:desembolsar, requerimientos:leer, uploads:crear, vista:desembolsos

### peticionario

- **Vistas:** proyectos, recepciones, requerimientos, aprobaciones, desembolsos, el-proyecto, mapa-editor
- **Permisos (4):** proyectos:leer, requerimientos:crear, requerimientos:leer, vista:requerimientos

### usuario

- **Vistas:** proyectos, lotes, ventas, requerimientos, el-proyecto, mapa-editor
- **Permisos (3):** lotes:leer, proyectos:leer, vista:el-proyecto
