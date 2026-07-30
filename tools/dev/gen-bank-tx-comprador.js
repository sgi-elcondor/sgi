'use strict';
// Generates an unlinked bank_transaction matching a comprador's pending comprobante.
// The transaction can then be matched via the contraste tool by the auxiliar.
// Usage: node seeds/gen-bank-tx-comprador.js allexgaming3@gmail.com
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { supabase, SCHEMA } = require('./lib/batch');

const email = process.argv[2];
if (!email) { console.error('Usage: node seeds/gen-bank-tx-comprador.js <email>'); process.exit(1); }

const BANKS = ['bancolombia', 'davivienda', 'bogota', 'bbva', 'occidente'];

async function run() {
  console.log(`\n→ Generating bank transaction for comprador: ${email}\n`);

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

  const { data: pagos, error: ep } = await supabase.schema(SCHEMA)
    .from('pago')
    .select('id_pago, numero_pago, valor_pago, fecha_pago, metodo_pago, referencia, estado, id_venta, id_cuota_propuesta')
    .eq('id_comprador', id_comprador)
    .eq('estado', 'pendiente_revision')
    .eq('metodo_pago', 'transferencia')
    .order('fecha_pago', { ascending: false });

  if (ep) { console.error('Error fetching pagos:', ep.message); process.exit(1); }
  if (!pagos?.length) {
    console.log('  No pending comprobantes (pendiente_revision + transferencia) found for this comprador.');
    console.log('  The comprador must first submit a comprobante from the "Mis Facturas" or "Mis Cuotas" view.\n');
    process.exit(0);
  }

  console.log(`  ✓ Found ${pagos.length} pending comprobante(s)\n`);

  const inserted = [];
  for (const pago of pagos) {
    const bank = BANKS[Math.floor(Math.random() * BANKS.length)];
    const ref  = pago.referencia || `TRF${Math.floor(Math.random() * 90000000) + 10000000}`;

    const { data: tx, error: et } = await supabase.schema(SCHEMA)
      .from('bank_transaction')
      .insert([{
        bank,
        transaction_date: pago.fecha_pago,
        description:      `TRANSF RECIBIDA ${ref}`,
        reference:        ref,
        amount:           Number(pago.valor_pago),
        id_pago:          null,
      }])
      .select()
      .single();

    if (et) {
      console.warn(`  ⚠  Could not insert bank_transaction for pago ${pago.id_pago}: ${et.message}`);
      continue;
    }

    inserted.push({ tx, pago });
    console.log(`  ✓ bank_transaction #${tx.id_transaction}`);
    console.log(`    banco:   ${bank}`);
    console.log(`    fecha:   ${tx.transaction_date}`);
    console.log(`    monto:   $${Number(tx.amount).toLocaleString('es-CO')}`);
    console.log(`    ref:     ${tx.reference}`);
    console.log(`    pago:    #${pago.id_pago} (${pago.numero_pago}) — ${pago.estado}`);
    console.log('');
  }

  if (inserted.length) {
    console.log('✓ Done. Go to Contraste > match the transaction to the comprobante > Aceptar.\n');
  }
}

run().catch(err => { console.error(err); process.exit(1); });
