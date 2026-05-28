'use strict';
// bank_transactions + observaciones_juridicas + auditoria adicional
const { insert } = require('./lib/batch');
const { pick, randInt, maybe, randAmount } = require('./lib/rng');
const { toISO, addDays } = require('./lib/dates');

const TODAY = new Date('2026-05-13');

const BANKS = ['bancolombia','davivienda','bogota','bbva','occidente'];

function fmtDate(d) { return toISO(d); }

async function seedBankTransactions(allPagos) {
  const rows = [];

  // 1. Linked transactions: match existing aceptado+transferencia pagos
  const pagosTransf = allPagos.filter(p => p.metodo_pago === 'transferencia' && p.estado === 'aceptado');
  for (const pago of pagosTransf) {
    const exact = maybe(0.75); // 75% exact match, 25% slightly off
    const amount = exact ? Number(pago.valor_pago) : Number(pago.valor_pago) + randInt(-5000, 15000);
    const refMatch = exact && maybe(0.6) ? (pago.referencia || '') : `TRF${randInt(10000000,99999999)}`;
    const daysOff  = exact ? randInt(0, 1) : randInt(1, 4);
    const txDate   = fmtDate(addDays(new Date(pago.fecha_pago), daysOff));
    rows.push({
      bank:             pick(BANKS),
      transaction_date: txDate,
      description:      `TRANSF RECIBIDA ${refMatch}`,
      reference:        pago.referencia || refMatch,
      amount:           amount,
      id_pago:          pago.id_pago, // linked
    });
  }

  // 2. Unlinked transactions (pending_revision pagos + orphan)
  const pagosPend = allPagos.filter(p => p.estado === 'pendiente_revision' && p.metodo_pago === 'transferencia');
  for (const pago of pagosPend) {
    rows.push({
      bank:             pick(BANKS),
      transaction_date: pago.fecha_pago,
      description:      `TRANSF RECIBIDA ${pago.referencia || ''}`,
      reference:        pago.referencia,
      amount:           Number(pago.valor_pago),
      id_pago:          null, // unlinked — waiting validation
    });
  }

  // 3. Pure orphan transactions (not yet matched to any pago)
  const orphanCount = 12;
  for (let i = 0; i < orphanCount; i++) {
    const amount = randAmount(800_000, 8_000_000, 50_000);
    const d      = addDays(TODAY, -randInt(1, 30));
    rows.push({
      bank:             pick(BANKS),
      transaction_date: fmtDate(d),
      description:      `TRANSF ${randInt(1000,9999)}`,
      reference:        maybe(0.7) ? `TRF${randInt(10000000,99999999)}` : null,
      amount,
      id_pago: null,
    });
  }

  const txns = await insert('bank_transaction', rows);
  console.log(`  ✓ ${txns.length} transacciones bancarias`);
  return txns;
}

async function seedObservaciones(ventas) {
  const moraVentas = ventas.filter(v => v.estado === 'en_mora' || v.estado === 'pre_mora');
  const rows = [];
  const estados = ['en_seguimiento','en_proceso_juridico','acuerdo_pago','demanda_presentada'];
  const descs = [
    'Se notificó al comprador sobre el retraso en los pagos. Comprometió ponerse al día en 15 días.',
    'Segunda notificación enviada. El comprador no responde llamadas.',
    'Se firmó acuerdo de pago con plazo de 60 días para normalizar la cartera.',
    'Cliente indica dificultades económicas por desempleo. Se evalúa refinanciación.',
    'Se inició proceso pre-jurídico. Enviada carta de cobro certificada.',
    'El comprador realizó un pago parcial y prometió completar el saldo la próxima semana.',
    'Caso remitido al área jurídica para inicio de proceso de restitución.',
    'Acuerdo de refinanciación aprobado por gerencia. Nueva tabla de amortización generada.',
  ];

  for (const v of moraVentas) {
    const numObs = randInt(1, maybe(0.4) ? 3 : 2);
    for (let i = 0; i < numObs; i++) {
      const daysBack = randInt(5, 90);
      const fecha    = fmtDate(addDays(TODAY, -daysBack));
      rows.push({
        id_venta:       v.id_venta,
        descripcion:    pick(descs),
        estado_proceso: pick(estados),
        usuario_db:     pick(['juridico@elcondor.com','auxiliar1@elcondor.com','admin@elcondor.com']),
        fecha_registro: fecha + 'T09:00:00',
      });
    }
  }

  if (!rows.length) return [];
  const obs = await insert('observacion_juridica', rows);
  console.log(`  ✓ ${obs.length} observaciones juridicas`);
  return obs;
}

async function seedAuditoria(ventas, allPagos) {
  const rows = [];
  const users = ['auxiliar1@elcondor.com','auxiliar2@elcondor.com','admin@elcondor.com','gerencia@elcondor.com'];

  // Cambios de estado en ventas
  for (const v of ventas) {
    if (v.estado === 'cancelada') {
      const daysBack = randInt(10, 80);
      rows.push({
        tabla_afectada: 'venta', id_registro: v.id_venta, campo: 'estado',
        valor_anterior: 'activa', valor_nuevo: 'cancelada',
        usuario_db:  pick(users), motivo: 'Solicitud del cliente por cambio de proyecto.',
        fecha_cambio: fmtDate(addDays(TODAY, -daysBack)) + 'T10:00:00',
      });
    }
    if (v.estado === 'en_mora' || v.estado === 'pre_mora') {
      const daysBack = randInt(5, 45);
      rows.push({
        tabla_afectada: 'venta', id_registro: v.id_venta, campo: 'estado',
        valor_anterior: 'activa', valor_nuevo: v.estado,
        usuario_db: pick(users), motivo: 'Cuotas vencidas sin pago registrado.',
        fecha_cambio: fmtDate(addDays(TODAY, -daysBack)) + 'T08:30:00',
      });
    }
    if (v.estado === 'liquidada') {
      rows.push({
        tabla_afectada: 'venta', id_registro: v.id_venta, campo: 'estado',
        valor_anterior: 'activa', valor_nuevo: 'liquidada',
        usuario_db: pick(users), motivo: 'Pago total del lote verificado.',
        fecha_cambio: fmtDate(addDays(TODAY, -randInt(5, 40))) + 'T14:00:00',
      });
    }
  }

  // Pagos aceptados
  const sample = allPagos.filter(p => p.estado === 'aceptado').slice(0, 30);
  for (const p of sample) {
    rows.push({
      tabla_afectada: 'pago', id_registro: p.id_pago, campo: 'creacion_pago',
      valor_anterior: null, valor_nuevo: JSON.stringify({ valor: p.valor_pago, metodo: p.metodo_pago }),
      usuario_db: pick(users), motivo: 'registro_pago',
      fecha_cambio: p.fecha_pago + 'T11:00:00',
    });
  }

  // Ediciones de cuota (algunos valores ajustados)
  rows.push(
    { tabla_afectada: 'cuota', id_registro: 5, campo: 'valor_cuota', valor_anterior: '1850000', valor_nuevo: '1750000', usuario_db: 'auxiliar1@elcondor.com', motivo: 'edicion_auxiliar_contable', fecha_cambio: '2026-02-14T10:30:00' },
    { tabla_afectada: 'cuota', id_registro: 5, campo: 'fecha_vencimiento', valor_anterior: '2026-02-15', valor_nuevo: '2026-02-28', usuario_db: 'auxiliar1@elcondor.com', motivo: 'edicion_auxiliar_contable', fecha_cambio: '2026-02-14T10:31:00' },
    { tabla_afectada: 'cuota', id_registro: 12, campo: 'valor_cuota', valor_anterior: '3200000', valor_nuevo: '3100000', usuario_db: 'auxiliar2@elcondor.com', motivo: 'edicion_auxiliar_contable', fecha_cambio: '2026-03-05T09:15:00' },
  );

  const aud = await insert('auditoria', rows);
  console.log(`  ✓ ${aud.length} registros de auditoria`);
  return aud;
}

async function run(ctx = {}) {
  const { ventas = [], allPagos = [] } = ctx;
  console.log('→ Transacciones bancarias...');
  const txns = await seedBankTransactions(allPagos);
  console.log('→ Observaciones juridicas...');
  const obs  = await seedObservaciones(ventas);
  console.log('→ Auditoria...');
  const aud  = await seedAuditoria(ventas, allPagos);
  return { txns, obs, aud };
}

module.exports = { run };
