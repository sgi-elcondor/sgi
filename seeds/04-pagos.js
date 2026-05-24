'use strict';
// Pagos + cuota_pago + recibos + facturas
// Simula comportamiento realista según estado de venta y perfil de comprador
const { insert, supabase, SCHEMA } = require('./lib/batch');
const { pick, randInt, maybe, randAmount } = require('./lib/rng');
const { addMonths, toISO, randPayDate } = require('./lib/dates');

const TODAY = new Date('2026-05-13');

function isPast(dateStr) {
  return new Date(dateStr + 'T12:00:00') < TODAY;
}

// How many cuotas to pay based on venta state
function cuotasToPay(cuotas, estado) {
  const total = cuotas.length;
  if (!total) return [];
  const sorted = [...cuotas].sort((a, b) => a.numero_cuota - b.numero_cuota);

  switch (estado) {
    case 'liquidada':    return sorted; // all paid
    case 'activa':       return sorted.filter(c => isPast(c.fecha_vencimiento) && maybe(0.80)).concat(
                           sorted.filter(c => !isPast(c.fecha_vencimiento)).slice(0, maybe(0.3) ? 1 : 0)
                         );
    case 'pre_mora':     return sorted.filter(c => isPast(c.fecha_vencimiento) && maybe(0.55));
    case 'en_mora':      return sorted.filter(c => isPast(c.fecha_vencimiento) && maybe(0.30));
    case 'cancelada':    return sorted.slice(0, Math.min(randInt(0, 2), sorted.length));
    case 'pendiente_autorizacion': return sorted.slice(0, maybe(0.4) ? randInt(1, 2) : 0);
    default: return sorted.filter(c => isPast(c.fecha_vencimiento) && maybe(0.65));
  }
}

async function run(ctx = {}) {
  const { ventas = [], allCuotas = [] } = ctx;
  const allPagos   = [];
  const allCPagos  = [];
  const allRecibos = [];
  const allFacturas = [];

  // Index cuotas by id_venta
  const cuotasByVenta = {};
  for (const c of allCuotas) {
    if (!cuotasByVenta[c.id_venta]) cuotasByVenta[c.id_venta] = [];
    cuotasByVenta[c.id_venta].push(c);
  }

  const metodos = ['transferencia','transferencia','transferencia','efectivo','efectivo'];

  for (const venta of ventas) {
    if (venta.estado === 'cancelada') continue;
    const cuotas  = cuotasByVenta[venta.id_venta] || [];
    if (!cuotas.length) continue;

    const cuotasAPagar = cuotasToPay(cuotas, venta.estado);

    // Group cuotas into payment batches (1–3 cuotas per pago)
    const cuotasPagadasIds = [];
    let i = 0;
    while (i < cuotasAPagar.length) {
      const batchSize = maybe(0.3) ? Math.min(2, cuotasAPagar.length - i) : 1;
      const batch     = cuotasAPagar.slice(i, i + batchSize);
      i += batchSize;

      const metodo      = pick(metodos);
      const fecha_pago  = randPayDate(batch[0].fecha_vencimiento);
      const referencia  = metodo === 'transferencia' ? `TRF${randInt(10000000, 99999999)}` : null;
      const valor_pago  = batch.reduce((s, c) => s + Number(c.valor_cuota), 0);

      const [pago] = await insert('pago', [{
        fecha_pago,
        valor_pago,
        metodo_pago:  metodo,
        referencia,
        estado:       'aceptado',
        url_baucher:  null,
        numero_cuenta_origen: metodo === 'transferencia' ? `${randInt(100,999)}-${randInt(10000000,99999999)}-${randInt(10,99)}` : null,
        tipo_pago:    'cuota',
        id_comprador: null,
        id_venta:     venta.id_venta,
        id_cuota_propuesta: null,
      }]);
      allPagos.push(pago);

      // cuota_pago
      const cpRows = batch.map(c => ({
        id_pago: pago.id_pago, id_cuota: c.id_cuota, valor_aplicado: Number(c.valor_cuota),
      }));
      const cps = await insert('cuota_pago', cpRows);
      allCPagos.push(...cps);

      // Collect IDs — update en batch al final
      for (const c of batch) cuotasPagadasIds.push(c.id_cuota);

      // Auto recibo
      const [recibo] = await insert('recibo', [{
        numero_recibo: pago.id_pago,
        emitido_por: pick(['auxiliar1@elcondor.com','auxiliar2@elcondor.com']),
        observaciones: null,
      }]);
      allRecibos.push(recibo);
      await insert('recibo_pago', [{ id_recibo: recibo.id_recibo, id_pago: pago.id_pago }]);

      // Factura: 70% of pagos get one
      if (maybe(0.70)) {
        const [factura] = await insert('factura', [{
          numero_factura: allFacturas.length + 1,
          fecha_emision:  fecha_pago,
          valor_facturado: valor_pago,
          estado: maybe(0.04) ? 'anulada' : 'emitida',
          observaciones: null,
        }]);
        allFacturas.push(factura);
        // Link to first cuota in batch
        await insert('cuota_factura', [{ id_cuota: batch[0].id_cuota, id_factura: factura.id_factura }]);
      }

      process.stdout.write('.');
    }

    // Batch update cuotas pagadas de esta venta
    if (cuotasPagadasIds.length) {
      await supabase.schema(SCHEMA).from('cuota')
        .update({ estado: 'pagada' })
        .in('id_cuota', cuotasPagadasIds);
    }

    // Edge case: partial payment on one overdue cuota (comprador with mora)
    if (venta.estado === 'en_mora' && maybe(0.4)) {
      const unpaid = cuotas.filter(c => !cuotasPagadasIds.includes(c.id_cuota) && isPast(c.fecha_vencimiento));
      if (unpaid.length) {
        const c = unpaid[0];
        const parcial = randAmount(Number(c.valor_cuota) * 0.25, Number(c.valor_cuota) * 0.60, 50_000);
        const [pago] = await insert('pago', [{
          fecha_pago:   toISO(TODAY), valor_pago: parcial, metodo_pago: 'transferencia',
          referencia:   `TRF${randInt(10000000,99999999)}`, estado: 'aceptado',
          tipo_pago: 'cuota', id_venta: venta.id_venta,
        }]);
        allPagos.push(pago);
        await insert('cuota_pago', [{ id_pago: pago.id_pago, id_cuota: c.id_cuota, valor_aplicado: parcial }]);
        const [recibo] = await insert('recibo', [{ numero_recibo: pago.id_pago, emitido_por: 'auxiliar1@elcondor.com' }]);
        allRecibos.push(recibo);
        await insert('recibo_pago', [{ id_recibo: recibo.id_recibo, id_pago: pago.id_pago }]);
      }
    }
  }

  // Pagos pendiente_revision (comprobantes de compradores sin validar)
  const ventasActivas = ventas.filter(v => v.estado === 'activa' || v.estado === 'pre_mora');
  for (const venta of ventasActivas.slice(0, 5)) {
    const cuotas = cuotasByVenta[venta.id_venta] || [];
    const proxima = cuotas.find(c => c.estado === 'pendiente');
    if (!proxima) continue;
    const [pago] = await insert('pago', [{
      fecha_pago:   toISO(TODAY), valor_pago: Number(proxima.valor_cuota),
      metodo_pago: 'transferencia', referencia: `TRF${randInt(10000000,99999999)}`,
      estado: 'pendiente_revision',
      url_baucher: 'https://res.cloudinary.com/sgi-condor/image/upload/sgi/bauchers/sample.jpg',
      numero_cuenta_origen: `202-${randInt(10000000,99999999)}-00`,
      tipo_pago: 'cuota', id_venta: venta.id_venta, id_cuota_propuesta: proxima.id_cuota,
    }]);
    allPagos.push(pago);
    await insert('cuota_pago', [{ id_pago: pago.id_pago, id_cuota: proxima.id_cuota, valor_aplicado: Number(proxima.valor_cuota) }]);
  }

  console.log(`\n  ✓ ${allPagos.length} pagos, ${allRecibos.length} recibos, ${allFacturas.length} facturas`);
  return { allPagos, allCPagos, allRecibos, allFacturas };
}

module.exports = { run };
