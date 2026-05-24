'use strict';
// Deletes all venta/cuota/pago/factura/recibo data for a single buyer and frees their lots.
// Does NOT delete the comprador or usuario records.
// Usage: node seeds/reset-comprador.js allexgaming3@gmail.com
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { supabase, SCHEMA } = require('./lib/batch');

const email = process.argv[2];
if (!email) { console.error('Usage: node seeds/reset-comprador.js <email>'); process.exit(1); }

async function run() {
  console.log(`\n→ Resetting data for: ${email}\n`);

  // 1. Find comprador
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

  // 2. Find ventas (via venta_comprador, or orphan ventas with no link)
  const { data: vcRows } = await supabase.schema(SCHEMA)
    .from('venta_comprador')
    .select('id_venta')
    .eq('id_comprador', id_comprador);

  let ventaIds = (vcRows || []).map(r => r.id_venta);

  if (!ventaIds.length) {
    // venta_comprador may have been partially deleted — scan for orphan ventas
    const { data: allVentas } = await supabase.schema(SCHEMA).from('venta').select('id_venta, id_lote');
    const { data: allVc } = await supabase.schema(SCHEMA).from('venta_comprador').select('id_venta');
    const linked = new Set((allVc || []).map(r => r.id_venta));
    const orphans = (allVentas || []).filter(v => !linked.has(v.id_venta));
    if (orphans.length) {
      console.log(`  ⚠ No venta_comprador found — using ${orphans.length} orphan venta(s): ${orphans.map(v => v.id_venta).join(', ')}`);
      ventaIds = orphans.map(v => v.id_venta);
    } else {
      console.log('  No ventas found — nothing to delete.');
      return;
    }
  }

  console.log(`  ✓ ventas: ${ventaIds.join(', ')}`);

  // 3. Collect lote ids before deleting
  const { data: ventaRows } = await supabase.schema(SCHEMA)
    .from('venta')
    .select('id_lote')
    .in('id_venta', ventaIds);
  const loteIds = (ventaRows || []).map(r => r.id_lote).filter(Boolean);

  // 4. Collect cuota ids
  const { data: cuotaRows } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_cuota')
    .in('id_venta', ventaIds);
  const cuotaIds = (cuotaRows || []).map(r => r.id_cuota);

  // 5. Collect pago ids
  const { data: pagoRows } = await supabase.schema(SCHEMA)
    .from('pago')
    .select('id_pago')
    .in('id_venta', ventaIds);
  const pagoIds = (pagoRows || []).map(r => r.id_pago);

  // 6. Collect recibo ids (via recibo_pago)
  let reciboIds = [];
  if (pagoIds.length) {
    const { data: rpRows } = await supabase.schema(SCHEMA)
      .from('recibo_pago')
      .select('id_recibo')
      .in('id_pago', pagoIds);
    reciboIds = (rpRows || []).map(r => r.id_recibo);
  }

  // 7. Collect factura ids (via cuota_factura — factura has no id_venta column)
  let facturaIds = [];
  if (cuotaIds.length) {
    const { data: cfRows } = await supabase.schema(SCHEMA)
      .from('cuota_factura')
      .select('id_factura')
      .in('id_cuota', cuotaIds);
    facturaIds = (cfRows || []).map(r => r.id_factura);
  }

  // Delete in reverse dependency order
  const steps = [
    async () => {
      if (!ventaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('auditoria').delete().in('id_registro', ventaIds.map(String));
      log('auditoria (by venta)', error);
    },
    async () => {
      if (!pagoIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('auditoria').delete().in('id_registro', pagoIds.map(String));
      log('auditoria (by pago)', error);
    },
    async () => {
      if (!ventaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('observacion_juridica').delete().in('id_venta', ventaIds);
      log('observacion_juridica', error);
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
      const { error } = await supabase.schema(SCHEMA).from('pago').delete().in('id_pago', pagoIds);
      log('pago', error);
    },
    async () => {
      if (!cuotaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('cuota').delete().in('id_cuota', cuotaIds);
      log('cuota', error);
    },
    async () => {
      if (!ventaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('venta_comisionista').delete().in('id_venta', ventaIds);
      log('venta_comisionista', error);
    },
    async () => {
      if (!ventaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('venta_comprador').delete().in('id_venta', ventaIds);
      log('venta_comprador', error);
    },
    async () => {
      if (!ventaIds.length) return;
      const { error } = await supabase.schema(SCHEMA).from('venta').delete().in('id_venta', ventaIds);
      log('venta', error);
    },
    // Note: lote.estado has a system-only constraint — availability is derived from active ventas,
    // so no update needed; once the venta is deleted the lot is automatically free.
  ];

  for (const step of steps) await step();

  console.log('\n✓ Done. The buyer has no ventas and their lots are now available.\n');
}

function log(label, error) {
  if (error) console.warn(`  ⚠  ${label}: ${error.message}`);
  else       console.log(`  ✓ ${label}`);
}

run().catch(err => { console.error(err); process.exit(1); });
