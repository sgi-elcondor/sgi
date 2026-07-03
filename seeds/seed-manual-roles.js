#!/usr/bin/env node
'use strict';
// Pobla las columnas condor.roles.obligaciones, condor.roles.descripcion y
// condor.permisos.descripcion con texto en espanol claro, pensado para usuarios
// no tecnicos (auxiliares contables, abogados, comisionistas, etc.).
// Idempotente: re-ejecutable cuando se quiera refrescar el contenido.
//
// Uso: node seeds/seed-manual-roles.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const supabase = require('../src/config/supabase');
const SCHEMA   = 'condor';

const ROLES = {
  admin: {
    descripcion: 'Administrador del sistema. Tiene acceso completo a todas las funcionalidades, configura roles y permisos, y supervisa la operacion.',
    obligaciones: [
      'Configurar los usuarios del sistema y asignarles el rol correcto.',
      'Mantener actualizada la definicion de permisos por rol.',
      'Supervisar la trazabilidad de las operaciones criticas (pagos, recibos, ventas).',
      'Atender solicitudes tecnicas del equipo (acceso, parametrizacion).',
    ].join('\n'),
  },
  usuario: {
    descripcion: 'Persona registrada en la plataforma que aun no es comprador. Puede explorar el catalogo de proyectos y lotes disponibles.',
    obligaciones: [
      'Mantener su perfil actualizado.',
      'Contactar a un asesor cuando este interesado en comprar un lote.',
    ].join('\n'),
  },
  comprador: {
    descripcion: 'Cliente con una o mas ventas activas en El Condor. Tiene acceso al portal personal para consultar y pagar sus cuotas.',
    obligaciones: [
      'Pagar las cuotas en las fechas pactadas.',
      'Subir el comprobante de pago cuando hace una transferencia bancaria.',
      'Mantener actualizados sus datos de contacto.',
      'Solicitar la emision de factura cuando lo necesite.',
    ].join('\n'),
  },
  asesor: {
    descripcion: 'Comercial de campo. Atiende a clientes interesados en los proyectos y genera solicitudes de venta para que el area financiera las autorice.',
    obligaciones: [
      'Atender a los clientes interesados en los proyectos.',
      'Crear solicitudes de venta con datos correctos del comprador y el lote.',
      'Esperar la autorizacion del area financiera antes de prometer condiciones especiales.',
      'Acompanar al comprador durante los primeros pagos.',
    ].join('\n'),
  },
  asesor_comercial: {
    descripcion: 'Comercial dedicado a la atencion de clientes y la generacion de solicitudes de venta.',
    obligaciones: [
      'Atender a los clientes interesados en los proyectos.',
      'Crear solicitudes de venta con datos correctos del comprador y el lote.',
      'Esperar la autorizacion del area financiera antes de prometer condiciones especiales.',
      'Acompanar al comprador durante los primeros pagos.',
    ].join('\n'),
  },
  auxiliar_contable: {
    descripcion: 'Encargado de la operacion financiera diaria: ventas autorizadas, pagos, facturacion, recibos y conciliacion bancaria.',
    obligaciones: [
      'Revisar y aceptar los pagos cargados por compradores y asesores.',
      'Emitir facturas y recibos con la numeracion correcta.',
      'Registrar las ventas autorizadas y mantener el plan de cuotas balanceado.',
      'Conciliar las transacciones bancarias contra los pagos del sistema.',
      'Realizar el cierre diario de operaciones.',
    ].join('\n'),
  },
  gerencia: {
    descripcion: 'Direccion de la empresa. Acceso de solo lectura a reportes y dashboards consolidados para tomar decisiones estrategicas.',
    obligaciones: [
      'Revisar diariamente los indicadores de cartera, recaudo y comisiones.',
      'Validar la estrategia comercial con base en los reportes.',
      'Aprobar planes especiales que se salgan del flujo estandar.',
    ].join('\n'),
  },
  juridico: {
    descripcion: 'Equipo legal de la empresa. Da seguimiento a la cartera en mora y a los procesos de devolucion.',
    obligaciones: [
      'Revisar las alertas de ventas en pre-mora y mora.',
      'Registrar observaciones juridicas en cada caso.',
      'Coordinar con el area financiera las acciones de cobro.',
      'Llevar el seguimiento de devoluciones y procesos legales.',
    ].join('\n'),
  },
  comisionista: {
    descripcion: 'Comercial externo que recibe comision sobre las ventas referidas. Consulta sus comisiones causadas y pagos parciales.',
    obligaciones: [
      'Generar oportunidades de venta para la empresa.',
      'Mantener actualizada su informacion de contacto.',
      'Revisar el estado de sus comisiones causadas y pagos recibidos.',
    ].join('\n'),
  },
  auditoria: {
    descripcion: 'Equipo de control interno. Supervisa la trazabilidad de las operaciones criticas y verifica el cumplimiento de los procedimientos.',
    obligaciones: [
      'Revisar periodicamente la bitacora de auditoria.',
      'Reportar inconsistencias al area correspondiente.',
      'Verificar que cada cambio sensible quede registrado.',
    ].join('\n'),
  },
};

const PERMISOS = {
  // Usuarios y roles
  'usuarios:leer':                  'Ver la lista de usuarios del sistema.',
  'usuarios:crear':                 'Registrar nuevos usuarios.',
  'usuarios:actualizar':            'Modificar datos o activar/desactivar usuarios.',
  'roles:leer':                     'Ver los roles del sistema.',
  'roles:actualizar':               'Modificar los permisos y el manual de cada rol.',

  // Catalogo
  'proyectos:leer':                 'Consultar la lista de proyectos.',
  'proyectos:crear':                'Crear nuevos proyectos.',
  'proyectos:actualizar':           'Modificar la informacion de un proyecto.',
  'lotes:leer':                     'Consultar el inventario de lotes.',
  'lotes:crear':                    'Registrar nuevos lotes en el inventario.',
  'lotes:actualizar':               'Editar los datos de un lote.',

  // Personas
  'compradores:leer':               'Ver la lista de compradores.',
  'compradores:crear':              'Registrar nuevos compradores.',
  'compradores:actualizar':         'Editar los datos de un comprador.',
  'comisionistas:leer':             'Ver la lista de comisionistas y sus comisiones.',
  'comisionistas:crear':            'Registrar nuevos comisionistas.',
  'comisionistas:actualizar':       'Editar datos y registrar pagos parciales a comisionistas.',

  // Ventas y plan
  'ventas:leer':                    'Ver el listado de ventas.',
  'ventas:crear':                   'Registrar nuevas ventas.',
  'ventas:actualizar':              'Modificar informacion general de una venta.',
  'ventas:solicitar':               'Crear solicitudes de venta pendientes de autorizacion.',
  'ventas:editar_financiero':       'Editar el componente financiero de una venta (valor total, cuota inicial).',
  'cuotas:leer':                    'Ver las cuotas de las ventas.',
  'cuotas:crear':                   'Crear cuotas manualmente.',
  'cuotas:actualizar':              'Modificar fechas de vencimiento u otros campos de una cuota.',
  'cuotas:editar_valores':          'Ajustar los valores del plan de cuotas y configurar fracciones.',

  // Pagos, facturas, recibos
  'pagos:leer':                     'Consultar el historial de pagos.',
  'pagos:crear':                    'Registrar nuevos pagos.',
  'facturas:leer':                  'Consultar las facturas emitidas.',
  'facturas:crear':                 'Emitir nuevas facturas, anularlas y procesar solicitudes.',
  'facturas:actualizar':            'Modificar los datos de una factura.',
  'recibos:leer':                   'Consultar recibos.',
  'recibos:crear':                  'Generar recibos para pagos aceptados.',

  // Banco / validacion
  'bank_transactions:leer':         'Consultar las transacciones bancarias.',
  'bank_transactions:crear':        'Cargar transacciones bancarias para conciliar.',
  'bank_transactions:actualizar':   'Editar las transacciones bancarias.',
  'bank_transactions:eliminar':     'Eliminar transacciones bancarias que no esten vinculadas a pagos.',
  'validacion_pagos:leer':          'Ver el panel de validacion de pagos.',
  'validacion_pagos:crear':         'Aceptar o rechazar pagos que estan en revision.',

  // Gastos y recepciones
  'gastos:leer':                    'Consultar los gastos operativos.',
  'gastos:crear':                   'Registrar gastos operativos.',
  'gastos:actualizar':              'Editar gastos operativos.',
  'recepciones:leer':               'Ver las recepciones de materiales pendientes.',
  'recepciones:crear':              'Registrar recepciones de materiales en almacen.',

  // Reportes y dashboard
  'reportes:leer':                  'Acceder a los reportes consolidados.',
  'reportes_dir:leer':              'Acceder a los reportes directivos.',
  'alertas_jur:leer':               'Ver las alertas juridicas y la cartera en mora.',
  'observaciones_jur:leer':         'Consultar observaciones juridicas.',
  'observaciones_jur:crear':        'Registrar observaciones juridicas de una venta.',
  'dashboard:ver_operacion':        'Ver el panel de operaciones diarias.',
  'dashboard:ver_cartera':          'Ver el resumen de cartera de hoy en el panel.',
  'dashboard:ver_comisiones':       'Ver el resumen de comisiones en el panel.',
  'dashboard:ver_juridico':         'Ver las alertas juridicas en el panel.',

  // Portal del comprador
  'mi_cuenta:leer':                 'Acceder al portal personal Mi Cuenta.',
  'mis_ventas:leer':                'Consultar mis ventas.',
  'mis_pagos:leer':                 'Consultar mis pagos.',
  'mis_pagos:crear':                'Cargar comprobantes de pago desde el portal.',
  'mis_facturas:leer':              'Consultar mis facturas.',
  'mis_facturas:crear':             'Solicitar la emision de una factura.',
  'mis_recibos:leer':               'Consultar mis recibos.',
  'mis_cuotas:leer':                'Consultar mis cuotas.',

  // Uploads
  'uploads:crear':                  'Subir archivos (comprobantes, fotos de perfil).',

  // Vistas (lado UI)
  'vista:dashboard':                'Ver el panel de control.',
  'vista:proyectos':                'Ver el modulo de proyectos.',
  'vista:lotes':                    'Ver el inventario de lotes.',
  'vista:compradores':              'Ver el modulo de compradores.',
  'vista:ventas':                   'Ver el modulo de ventas.',
  'vista:cuotas':                   'Ver el modulo de cuotas.',
  'vista:pagos':                    'Ver el modulo de pagos.',
  'vista:comisionistas':            'Ver el modulo de comisionistas.',
  'vista:facturas':                 'Ver el modulo de facturas.',
  'vista:recibos':                  'Ver el modulo de recibos.',
  'vista:reportes':                 'Ver el modulo de reportes.',
  'vista:alertas':                  'Ver las alertas juridicas.',
  'vista:auditoria':                'Ver la bitacora de auditoria.',
  'vista:usuarios':                 'Ver la administracion de usuarios.',
  'vista:roles':                    'Ver la administracion de roles y permisos.',
  'vista:juridico':                 'Ver el seguimiento juridico.',
  'vista:personal':                 'Ver la distribucion de personal por rol.',
  'vista:gastos':                   'Ver el modulo de gastos operativos.',
  'vista:recepciones':              'Ver el modulo de recepciones de materiales.',
  'vista:bank-transactions':        'Ver el modulo de transacciones bancarias.',
  'vista:payment-validation':       'Ver el modulo de validacion de pagos.',
  'vista:el-proyecto':              'Ver el catalogo publico del proyecto.',
  'vista:mis-cuotas':               'Ver Mis Cuotas (portal del comprador).',
  'vista:mis-facturas':             'Ver Mis Facturas (portal del comprador).',
  'vista:mis-recibos':              'Ver Mis Pagos (portal del comprador).',
};

async function actualizarRoles() {
  let ok = 0, miss = 0;
  for (const [nombre, data] of Object.entries(ROLES)) {
    const { data: rows, error } = await supabase.schema(SCHEMA)
      .from('roles')
      .update({ descripcion: data.descripcion, obligaciones: data.obligaciones })
      .eq('nombre', nombre)
      .select('id_rol');
    if (error) {
      console.error(`  !  rol "${nombre}": ${error.message}`);
      continue;
    }
    if (rows && rows.length) {
      console.log(`  ok rol ${nombre.padEnd(20)} actualizado`);
      ok++;
    } else {
      console.log(`  -  rol ${nombre.padEnd(20)} no existe en BD, omitido`);
      miss++;
    }
  }
  console.log(`\n  Roles: ${ok} actualizados, ${miss} omitidos\n`);
}

async function actualizarPermisos() {
  let ok = 0, miss = 0;
  for (const [key, desc] of Object.entries(PERMISOS)) {
    const [recurso, accion] = key.split(':');
    const { data: rows, error } = await supabase.schema(SCHEMA)
      .from('permisos')
      .update({ descripcion: desc })
      .eq('recurso', recurso)
      .eq('accion', accion)
      .select('id_permiso');
    if (error) {
      console.error(`  !  permiso ${key}: ${error.message}`);
      continue;
    }
    if (rows && rows.length) {
      ok++;
    } else {
      miss++;
    }
  }
  console.log(`  Permisos: ${ok} actualizados, ${miss} no existen en BD (es normal si tu instalacion no los tiene)\n`);
}

async function main() {
  console.log('\n=====================================================');
  console.log('  Seed - Manual de roles y descripciones de permisos');
  console.log('=====================================================\n');

  console.log('PASO 1 - Actualizar descripcion y obligaciones de roles');
  await actualizarRoles();

  console.log('PASO 2 - Actualizar descripcion humana de permisos');
  await actualizarPermisos();

  console.log('Listo.\n');
}

main().catch(err => {
  console.error('\n!!! Error:', err);
  process.exit(1);
});
