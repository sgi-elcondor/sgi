#!/usr/bin/env node
'use strict';
// End-to-end validation of RN-23: user with rol 'usuario' becomes 'comprador'
// the moment a venta is registered against them. Runs against the live Supabase
// configured in .env. Cleans the test venta at the end but leaves the role
// change in place (that is the actual production behaviour).
//
// Usage: node seeds/validate-promotion.js [email] [--keep]
//   email   email of the user to test (default: allexgaming3@gmail.com)
//   --keep  do NOT delete the test venta at the end (for manual inspection)

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabase     = require('../src/config/supabase');
const SCHEMA       = 'condor';
const rolePromotion = require('../src/services/role-promotion.service');
const auditoria    = require('../src/services/auditoria.service');
const consecutivos = require('../src/services/consecutivos.service');
const cuotasSvc    = require('../src/services/cuotas.service');

const EMAIL_TEST = process.argv.find(a => a.includes('@')) || 'allexgaming3@gmail.com';
const KEEP       = process.argv.includes('--keep');

const log  = (...args) => console.log(...args);
const fail = (msg, ventaId) => {
  console.error(`\nX  ${msg}`);
  if (ventaId) cuotasSvc.limpiarVentaCreada(ventaId).catch(() => {});
  process.exit(1);
};

async function findRol(nombre) {
  const { data } = await supabase.schema(SCHEMA).from('roles')
    .select('id_rol, nombre').eq('nombre', nombre).maybeSingle();
  return data;
}

async function findUserByEmail(email) {
  const { data } = await supabase.schema(SCHEMA).from('usuarios')
    .select('id_usuario, email, id_rol, nombres, apellidos, documento, activo, firebase_uid, roles:id_rol(nombre)')
    .eq('email', email).maybeSingle();
  return data;
}

async function findLoteDisponible() {
  const { data: ventas } = await supabase.schema(SCHEMA).from('venta')
    .select('id_lote, estado');
  const ocupados = new Set(
    (ventas || []).filter(v => v.estado !== 'cancelada').map(v => v.id_lote)
  );

  const { data: lotes } = await supabase.schema(SCHEMA).from('lote')
    .select('id_lote, codigo_lote, precio_base, proyecto:id_proyecto(sigla, nombre)')
    .order('id_lote', { ascending: true });

  return (lotes || []).find(l => !ocupados.has(l.id_lote));
}

async function main() {
  log('\n=====================================================');
  log('  Validacion E2E - Auto-promocion a comprador (RN-23)');
  log('=====================================================\n');
  log(`  email de prueba: ${EMAIL_TEST}`);
  log(`  cleanup venta:   ${KEEP ? 'NO (--keep)' : 'si'}\n`);

  const rolUsuario   = await findRol('usuario');
  const rolComprador = await findRol('comprador');
  if (!rolUsuario)   fail(`Rol 'usuario' no existe en condor.roles. Crealo antes.`);
  if (!rolComprador) fail(`Rol 'comprador' no existe en condor.roles.`);
  log(`  ok  Roles requeridos OK: usuario (id=${rolUsuario.id_rol}), comprador (id=${rolComprador.id_rol})\n`);

  log(`PASO 1 - Localizar usuario ${EMAIL_TEST}`);
  let user = await findUserByEmail(EMAIL_TEST);
  if (!user) {
    log(`  i  No existe en BD. Lo creo simulando un primer login (auth.middleware hace lo mismo).`);
    const { error } = await supabase.schema(SCHEMA).from('usuarios').insert([{
      email:        EMAIL_TEST,
      id_rol:       rolUsuario.id_rol,
      activo:       true,
      tipo_persona: 'natural',
      nombres:      'Usuario',
      apellidos:    'Validacion',
    }]);
    if (error) fail(`No pude crear usuario: ${error.message}`);
    user = await findUserByEmail(EMAIL_TEST);
  }
  log(`  ok  id=${user.id_usuario}  rol actual: ${user.roles?.nombre || 'NULL'}\n`);

  log(`PASO 2 - Resetear rol del usuario a 'usuario' (escenario inicial)`);
  if (user.roles?.nombre !== 'usuario') {
    const { error } = await supabase.schema(SCHEMA).from('usuarios')
      .update({ id_rol: rolUsuario.id_rol })
      .eq('id_usuario', user.id_usuario);
    if (error) fail(`No pude resetear rol: ${error.message}`);
    user = await findUserByEmail(EMAIL_TEST);
    log(`  ok  rol seteado a: ${user.roles?.nombre}\n`);
  } else {
    log(`  ok  ya tenia rol 'usuario'\n`);
  }

  log(`PASO 3 - Buscar un lote disponible`);
  const lote = await findLoteDisponible();
  if (!lote) fail(`No hay lotes disponibles para usar en la venta de prueba.`);
  log(`  ok  lote id=${lote.id_lote}  codigo=${lote.codigo_lote}  proyecto=${lote.proyecto?.nombre}  precio=${lote.precio_base}\n`);

  log(`PASO 4 - Crear la venta (mismo camino que ventas.controller.crearVenta)`);
  let codigoVenta = null;
  try {
    codigoVenta = await consecutivos.generarCodigoVenta({
      sigla:       lote.proyecto?.sigla,
      codigo_lote: lote.codigo_lote,
    });
  } catch (_) {}

  const VALOR_TOTAL   = Number(lote.precio_base) || 1_000_000;
  const NUMERO_CUOTAS = 6;
  const today         = new Date().toISOString().slice(0, 10);
  const nextMonth     = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const { data: venta, error: eVenta } = await supabase.schema(SCHEMA).from('venta')
    .insert([{
      id_lote:       lote.id_lote,
      codigo_venta:  codigoVenta,
      valor_total:   VALOR_TOTAL,
      cuota_inicial: 0,
      estado:        'activa',
      fecha_venta:   today,
      observaciones: '[VALIDATION] venta de prueba RN-23',
    }])
    .select().single();
  if (eVenta) fail(`Insert de venta fallo: ${eVenta.message}`);
  log(`  ok  venta id=${venta.id_venta}  codigo=${venta.codigo_venta || '(sin codigo)'}  estado=${venta.estado}`);

  const { error: eVC } = await supabase.schema(SCHEMA).from('venta_comprador')
    .insert([{ id_venta: venta.id_venta, id_usuario: user.id_usuario, porcentaje: 100 }]);
  if (eVC) fail(`Insert venta_comprador fallo: ${eVC.message}`, venta.id_venta);
  log(`  ok  venta_comprador insertado (porcentaje=100)`);

  try {
    const generadas = await cuotasSvc.generarPlanDePago(venta.id_venta, {
      cuota_inicial:               0,
      valor_total:                 VALOR_TOTAL,
      numero_cuotas_inicial:       0,
      fecha_primera_cuota_inicial: null,
      numero_cuotas:               NUMERO_CUOTAS,
      fecha_primera_cuota:         nextMonth,
      microcuotas:                 null,
      totalPermutas:               0,
    });
    log(`  ok  plan generado: ${generadas} cuotas\n`);
  } catch (err) {
    fail(`generarPlanDePago fallo: ${err.message}`, venta.id_venta);
  }

  log(`PASO 5 - Disparar promoverACompradorSiAplica`);
  const result = await rolePromotion.promoverACompradorSiAplica(user.id_usuario);
  log(`  resultado: ${JSON.stringify({
    promoted:    result.promoted,
    reason:      result.reason || null,
    prevRolName: result.prevRolName || null,
    newRolName:  result.newRolName || null,
  })}`);
  if (!result.promoted) fail(`Promocion NO se ejecuto (reason=${result.reason}).`, venta.id_venta);
  log(`  ok  Promocion ejecutada\n`);

  await auditoria.log({
    tabla:    'usuarios',
    id:       user.id_usuario,
    campo:    'id_rol',
    anterior: result.prevRolName || 'sin_rol',
    nuevo:    result.newRolName,
    usuario:  'script_validacion',
    motivo:   `promocion_automatica_primera_venta:${venta.id_venta}`,
  });

  log(`PASO 6 - Verificar estado final del usuario en BD`);
  const final = await findUserByEmail(EMAIL_TEST);
  log(`  rol actual: ${final.roles?.nombre}`);
  if (final.roles?.nombre !== 'comprador') {
    fail(`El rol NO quedo en 'comprador'. Validacion fallida.`, venta.id_venta);
  }
  log(`  ok  Rol = 'comprador'\n`);

  log(`PASO 7 - Verificar audit log`);
  const { data: audits } = await supabase.schema(SCHEMA).from('auditoria')
    .select('campo, valor_anterior, valor_nuevo, motivo, fecha_cambio')
    .eq('tabla_afectada', 'usuarios')
    .eq('id_registro', user.id_usuario)
    .ilike('motivo', '%primera_venta%')
    .order('fecha_cambio', { ascending: false })
    .limit(3);
  if (audits && audits.length) {
    for (const a of audits) {
      log(`  ok  audit: ${a.valor_anterior || 'NULL'} -> ${a.valor_nuevo}  motivo=${a.motivo}  fecha=${a.fecha_cambio}`);
    }
  } else {
    log(`  !   sin entradas de auditoria con motivo primera_venta (posible si el motivo cambio)`);
  }

  if (!KEEP) {
    log(`\nPASO 8 - Limpieza de la venta de prueba`);
    await cuotasSvc.limpiarVentaCreada(venta.id_venta);
    log(`  ok  venta_id=${venta.id_venta} eliminada junto con cuotas y venta_comprador`);
    log(`  i   El rol del usuario permanece como 'comprador' (comportamiento real en produccion).`);
  } else {
    log(`\nPASO 8 - Venta de prueba conservada (flag --keep): venta_id=${venta.id_venta}`);
  }

  log('\n=====================================================');
  log('  RESULTADO: VALIDACION PASS');
  log('=====================================================\n');
}

main().catch(err => {
  console.error('\n!!! Error inesperado:', err);
  process.exit(1);
});
