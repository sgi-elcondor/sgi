'use strict';
// Resets financial data (pagos, facturas, recibos, fracciones) for a single buyer.
// Keeps: venta, cuotas, venta_comprador, lote assignment.
// Resets cuota.estado and venta.estado to their initial values.
// Usage: node seeds/reset-pagos-comprador.js allexgaming3@gmail.com
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { supabase, SCHEMA } = require('./lib/batch');

const email = process.argv[2];
if (!email) { console.error('Usage: node seeds/reset-pagos-comprador.js <email>'); process.exit(1); }

async function run() {
  console.log(`\n→ Resetting payments for: ${email}\n`);

  const { data: usuario, error: eu } = await supabase.schema(SCHEMA)
    .from('usuarios')
    .select('id_comprador')
    .eq('email', email)
    .single();

  if (eu || !usuario?.id_comprador) {
    console.error('Comprador not found for email:', email);
    process.exit(1);
  }
  const { id_comprador } = usuario;
  console.log(`  ✓ id_comprador: ${id_comprador}`);

  const { data: vcRows } = await supabase.schema(SCHEMA)
    .from('venta_comprador')
    .select('id_venta')
    .eq('id_comprador', id_comprador);

  const ventaIds = (vcRows || []).map(r => r.id_venta);
  if (!ventaIds.length) {
    console.log('  No ventas found — nothing to reset.');
    return;
  }
  console.log(`  ✓ ventas: ${ventaIds.join(', ')}`);

  const { data: cuotaRows } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_cuota')
    .in('id_venta', ventaIds);
  const cuotaIds = (cuotaRows || []).map(r => r.id_cuota);
  console.log(`  ✓ cuotas: ${cuotaIds.length}`);

  const { data: pagoRows } = await supabase.schema(SCHEMA)
    .from('pago')
    .select('id_pago')
    .or(`id_venta.in.(${ventaIds.join(',')}),id_comprador.eq.${id_comprador}`);
  const pagoIds = (pagoRows || []).map(r => r.id_pago);
  console.log(`  ✓ pagos: ${pagoIds.length}`);

  let reciboIds = [];
  if (pagoIds.length) {
    const { data: rpRows } = await supabase.schema(SCHEMA)
      .from('recibo_pago')
      .select('id_recibo')
      .in('id_pago', pagoIds);
    reciboIds = (rpRows || []).map(r => r.id_recibo);
  }
  console.log(`  ✓ recibos: ${reciboIds.length}`);

  let facturaIds = [];
  if (cuotaIds.length) {
    const { data: cfRows } = await supabase.schema(SCHEMA)
      .from('cuota_factura')
      .select('id_factura')
      .in('id_cuota', cuotaIds);
    facturaIds = (cfRows || []).map(r => r.id_factura);
  }
  console.log(`  ✓ facturas: ${facturaIds.length}`);

  const steps = [
    async () => {
      if (!pagoIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('auditoria').delete().in('id_registro', pagoIds.map(String));
      log('auditoria (pagos)', error);
    },
    async () => {
      if (!cuotaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('cuota_factura').delete().in('id_cuota', cuotaIds);
      log('cuota_factura', error);
    },
    async () => {
      if (!reciboIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('comprador_recibo').delete().in('id_recibo', reciboIds);
      log('comprador_recibo', error);
    },
    async () => {
      if (!reciboIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('recibo_pago').delete().in('id_recibo', reciboIds);
      log('recibo_pago', error);
    },
    async () => {
      if (!reciboIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('recibo').delete().in('id_recibo', reciboIds);
      log('recibo', error);
    },
    async () => {
      if (!facturaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('factura').delete().in('id_factura', facturaIds);
      log('factura', error);
    },
    async () => {
      if (!pagoIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('cuota_pago').delete().in('id_pago', pagoIds);
      log('cuota_pago (by pago)', error);
    },
    async () => {
      if (!cuotaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('cuota_pago').delete().in('id_cuota', cuotaIds);
      log('cuota_pago (by cuota)', error);
    },
    async () => {
      if (!pagoIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('bank_transaction').update({ id_pago: null }).in('id_pago', pagoIds);
      log('bank_transaction (unlink)', error);
    },
    async () => {
      if (!pagoIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('pago').delete().in('id_pago', pagoIds);
      log('pago', error);
    },
    async () => {
      if (!cuotaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('cuota_fraccion').delete().in('id_cuota', cuotaIds);
      log('cuota_fraccion', error);
    },
    async () => {
      if (!cuotaIds.length) return;
      const hoy = new Date().toISOString().split('T')[0];
      const { data: cuotas } = await supabase.schema(SCHEMA)
        .from('cuota')
        .select('id_cuota, fecha_vencimiento')
        .in('id_cuota', cuotaIds);
      for (const c of (cuotas || [])) {
        const estado = c.fecha_vencimiento <= hoy ? 'activa' : 'pendiente';
        await supabase.schema(SCHEMA).from('cuota').update({ estado }).eq('id_cuota', c.id_cuota);
      }
      log('cuota.estado reset', null);
    },
    async () => {
      if (!ventaIds.length) return;
      // Temporarily cancel so lote trigger fires and resets lote.estado, then restore to activa
      await supabase.schema(SCHEMA).from('venta').update({ estado: 'cancelada' }).in('id_venta', ventaIds);
      const { error } = await supabase.schema(SCHEMA).from('venta').update({ estado: 'activa' }).in('id_venta', ventaIds);
      log('venta.estado reset → activa (lote freed via cancel trigger)', error);
    },
  ];

  for (const step of steps) await step();

  console.log('\n✓ Done. Venta, cuotas, and lot assignment preserved. Payments reset.\n');
}

function log(label, error) {
  if (error) console.warn(`  ⚠  ${label}: ${error.message}`);
  else       console.log(`  ✓ ${label}`);
}

run().catch(err => { console.error(err); process.exit(1); });
