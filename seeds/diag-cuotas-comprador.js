'use strict';
// Diagnoses the current payment state for a comprador.
// Usage: node seeds/diag-cuotas-comprador.js allexgaming3@gmail.com
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { supabase, SCHEMA } = require('./lib/batch');

const email = process.argv[2];
if (!email) { console.error('Usage: node seeds/diag-cuotas-comprador.js <email>'); process.exit(1); }

async function run() {
  const { data: usuario } = await supabase.schema(SCHEMA)
    .from('usuarios').select('id_comprador').eq('email', email).single();
  const id_comprador = usuario?.id_comprador;
  if (!id_comprador) { console.error('Comprador not found'); process.exit(1); }

  const { data: vcRows } = await supabase.schema(SCHEMA)
    .from('venta_comprador').select('id_venta').eq('id_comprador', id_comprador);
  const ventaIds = (vcRows || []).map(r => r.id_venta);
  if (!ventaIds.length) { console.log('No ventas found.'); return; }

  for (const id_venta of ventaIds) {
    console.log(`\n═══ Venta ${id_venta} ════════════════════════════════`);

    const { data: cuotas } = await supabase.schema(SCHEMA)
      .from('cuota')
      .select('id_cuota, numero_cuota, valor_cuota, estado, fecha_vencimiento')
      .eq('id_venta', id_venta)
      .order('numero_cuota');

    const cuotaIds = (cuotas || []).map(c => c.id_cuota);

    const { data: cpRows } = await supabase.schema(SCHEMA)
      .from('cuota_pago')
      .select('id_cuota, id_pago, valor_aplicado, pago:id_pago(estado, valor_pago, numero_pago)')
      .in('id_cuota', cuotaIds);

    const { data: fracRows } = await supabase.schema(SCHEMA)
      .from('cuota_fraccion')
      .select('id_cuota, id_fraccion, numero_fraccion, valor_fraccion, fecha_propuesta')
      .in('id_cuota', cuotaIds);

    const cpByCuota = {};
    for (const cp of (cpRows || [])) {
      if (!cpByCuota[cp.id_cuota]) cpByCuota[cp.id_cuota] = [];
      cpByCuota[cp.id_cuota].push(cp);
    }
    const fracByCuota = {};
    for (const f of (fracRows || [])) {
      if (!fracByCuota[f.id_cuota]) fracByCuota[f.id_cuota] = [];
      fracByCuota[f.id_cuota].push(f);
    }

    for (const c of (cuotas || [])) {
      const cps  = cpByCuota[c.id_cuota] || [];
      const fracs = fracByCuota[c.id_cuota] || [];
      const totalAcep = cps
        .filter(cp => cp.pago?.estado === 'aceptado')
        .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);
      const totalPend = cps
        .filter(cp => cp.pago?.estado === 'pendiente_revision')
        .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);

      const hasFracs = fracs.length > 0;
      const label = hasFracs ? ` [${fracs.length} fracciones: ${fracs.map(f => `$${Number(f.valor_fraccion).toLocaleString('es-CO')}`).join(', ')}]` : '';
      console.log(`\n  Cuota #${c.numero_cuota} (id=${c.id_cuota}) — estado: ${c.estado}`);
      console.log(`    valor_cuota: $${Number(c.valor_cuota).toLocaleString('es-CO')}${label}`);
      console.log(`    total aceptado: $${totalAcep.toLocaleString('es-CO')} / pendiente: $${totalPend.toLocaleString('es-CO')}`);
      if (cps.length) {
        console.log(`    cuota_pago records (${cps.length}):`);
        for (const cp of cps) {
          console.log(`      pago #${cp.id_pago} (${cp.pago?.numero_pago || 'sin-num'}, ${cp.pago?.estado}) → $${Number(cp.valor_aplicado).toLocaleString('es-CO')}`);
        }
      }
      if (totalAcep >= Number(c.valor_cuota) && c.estado !== 'pagada') {
        console.log(`    ⚠  DATA MISMATCH: total aceptado >= valor_cuota but estado != 'pagada'`);
      }
      if (totalAcep < Number(c.valor_cuota) && c.estado === 'pagada') {
        console.log(`    ⚠  DATA MISMATCH: estado='pagada' but total aceptado < valor_cuota (${totalAcep} < ${c.valor_cuota})`);
      }
    }
  }

  console.log('\n');
}

run().catch(err => { console.error(err); process.exit(1); });
