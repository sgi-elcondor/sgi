'use strict';
// Ventas + cuotas + relaciones (módulo más complejo)
const { insert } = require('./lib/batch');
const { pick, randInt, maybe, randAmount, shuffle } = require('./lib/rng');
const { randSaleDate, addMonths, toISO } = require('./lib/dates');

const TODAY = '2026-05-13';

// Genera cuotas igual que el controller (sumarMeses + distribución uniforme con ajuste en última)
function buildCuotas(idVenta, { cuota_inicial, valor_total, numero_cuotas_inicial, fecha_primera_cuota_inicial, numero_cuotas, fecha_primera_cuota, totalPermutas = 0 }) {
  const filas = [];
  const ci  = Number(cuota_inicial) || 0;
  const nci = Math.max(1, parseInt(numero_cuotas_inicial) || 1);
  const tp  = Number(totalPermutas) || 0;
  let offset = 0;

  if (ci > 0) {
    const base = Math.floor(ci / nci);
    for (let i = 0; i < nci; i++) {
      const valor = i === nci - 1 ? ci - base * (nci - 1) : base;
      filas.push({
        id_venta: idVenta, numero_cuota: i + 1, tipo: 'inicial',
        fecha_vencimiento: addMonths(fecha_primera_cuota_inicial, i),
        valor_cuota: valor, estado: 'pendiente', es_extraordinaria: false,
      });
    }
    offset = nci;
  }

  const saldo = Math.max(0, Number(valor_total) - ci - tp);
  const nc    = parseInt(numero_cuotas) || 0;
  if (saldo > 0 && nc > 0) {
    const base = Math.floor(saldo / nc);
    for (let i = 0; i < nc; i++) {
      filas.push({
        id_venta: idVenta, numero_cuota: offset + i + 1, tipo: 'regular',
        fecha_vencimiento: addMonths(fecha_primera_cuota, i),
        valor_cuota: i === nc - 1 ? saldo - base * (nc - 1) : base,
        estado: 'pendiente', es_extraordinaria: false,
      });
    }
  }
  return filas;
}

// Define plan by lot price tier
function planDePago(precio) {
  if (precio < 25_000_000) {
    const ci = randAmount(precio * 0.10, precio * 0.20, 200_000);
    return { cuota_inicial: ci, numero_cuotas_inicial: randInt(2, 4), numero_cuotas: randInt(12, 24) };
  }
  if (precio < 60_000_000) {
    const ci = randAmount(precio * 0.12, precio * 0.22, 500_000);
    return { cuota_inicial: ci, numero_cuotas_inicial: randInt(3, 6), numero_cuotas: randInt(18, 36) };
  }
  const ci = randAmount(precio * 0.15, precio * 0.25, 1_000_000);
  return { cuota_inicial: ci, numero_cuotas_inicial: randInt(4, 8), numero_cuotas: randInt(24, 60) };
}

// Distribución de estados por proyecto (index)
const ESTADO_POOLS = [
  // Reserva Norte (exitoso): 18 ventas
  ['activa','activa','activa','activa','activa','activa','activa','activa','liquidada','liquidada','liquidada','pre_mora','pre_mora','en_mora','en_mora','en_mora','cancelada','pendiente_autorizacion'],
  // Villa del Río: 14 ventas
  ['activa','activa','activa','activa','activa','liquidada','liquidada','pre_mora','pre_mora','en_mora','en_mora','cancelada','cancelada','pendiente_autorizacion'],
  // Parque Central (lento): 9 ventas
  ['activa','activa','activa','liquidada','pre_mora','en_mora','cancelada','pendiente_autorizacion','pendiente_autorizacion'],
  // Hacienda del Sol (nuevo): 6 ventas
  ['activa','activa','activa','activa','pendiente_autorizacion','en_mora'],
];

async function run(ctx = {}) {
  const { proyectos = [], lotes = [], compradores = [], comisionistas = [] } = ctx;
  const allVentas  = [];
  const allCuotas  = [];
  const allVC      = [];
  const allVCom    = [];

  // Index lotes by project
  const lotesByProject = {};
  lotes.forEach(l => {
    if (!lotesByProject[l.id_proyecto]) lotesByProject[l.id_proyecto] = [];
    lotesByProject[l.id_proyecto].push(l);
  });

  // Shuffle compradores for assignment
  const comprPool  = shuffle([...compradores]);
  let   comprIdx   = 0;
  const comisPool  = [...comisionistas];

  for (let pi = 0; pi < proyectos.length; pi++) {
    const proyecto  = proyectos[pi];
    const proyLotes = shuffle(lotesByProject[proyecto.id_proyecto] || []);
    const estados   = shuffle([...ESTADO_POOLS[pi]]);

    for (let vi = 0; vi < estados.length; vi++) {
      const lote   = proyLotes[vi];
      if (!lote) continue;
      const estado = estados[vi];

      // Sale date — older for liquidadas and morose, newer for pending
      const fechaVenta = randSaleDate();
      const saleDate   = fechaVenta.split('T')[0];

      // Pricing
      const base     = lote.precio_base;
      const descuento = maybe(0.25) ? randAmount(base * 0.02, base * 0.06, 100_000) : 0;
      const valor_total = base - descuento;

      // Payment plan
      const plan = planDePago(valor_total);
      const { cuota_inicial, numero_cuotas_inicial, numero_cuotas } = plan;

      // First cuota dates based on sale date
      const fecha_primera_cuota_inicial = addMonths(saleDate, 0);
      const fecha_primera_cuota         = addMonths(saleDate, numero_cuotas_inicial);

      // Compradores: 85% single buyer, 15% joint
      let compradores_venta = [];
      if (maybe(0.15) && comprPool.length > comprIdx + 1) {
        const c1 = comprPool[comprIdx++];
        const c2 = comprPool[comprIdx++];
        compradores_venta = [
          { id_comprador: c1.id_comprador, porcentaje: 50 },
          { id_comprador: c2.id_comprador, porcentaje: 50 },
        ];
      } else {
        const c = comprPool[comprIdx % comprPool.length];
        comprIdx++;
        compradores_venta = [{ id_comprador: c.id_comprador, porcentaje: 100 }];
      }

      // Comisionista: 70% of sales have one
      let comisionista = null;
      if (maybe(0.70)) {
        comisionista = comisPool[randInt(0, comisPool.length - 1)];
      }
      const valor_comision = comisionista ? randAmount(valor_total * 0.02, valor_total * 0.05, 100_000) : 0;

      // Observaciones
      const obs = maybe(0.3) ? pick([
        'Cliente solicita división del lote en dos partes al finalizar pago.',
        'Se acordó descuento por pronto pago en cuotas iniciales.',
        'Pendiente firma de promesa de compraventa.',
        'Cliente referido por comisionista principal.',
        null,
      ]) : null;

      // Insert venta
      const [venta] = await insert('venta', [{
        id_lote:          lote.id_lote,
        valor_total,
        cuota_inicial,
        estado,
        observaciones:    obs,
        total_permutas:   null,
        detalle_permutas: null,
        fecha_venta:      saleDate,
      }]);

      allVentas.push(venta);

      // venta_comprador
      const vcRows = compradores_venta.map(cv => ({
        id_venta: venta.id_venta, id_comprador: cv.id_comprador, porcentaje: cv.porcentaje,
      }));
      const vc = await insert('venta_comprador', vcRows);
      allVC.push(...vc);

      // venta_comisionista
      if (comisionista && estado !== 'cancelada') {
        const [vcom] = await insert('venta_comisionista', [{
          id_venta: venta.id_venta, id_comisionista: comisionista.id_comisionista, valor_comision,
        }]);
        allVCom.push(vcom);
      }

      // Generate cuotas
      const cuotaRows = buildCuotas(venta.id_venta, {
        cuota_inicial, valor_total, numero_cuotas_inicial,
        fecha_primera_cuota_inicial, numero_cuotas, fecha_primera_cuota,
      });
      if (cuotaRows.length) {
        const cuotas = await insert('cuota', cuotaRows);
        venta._cuotas = cuotas;
        allCuotas.push(...cuotas);
      }

      process.stdout.write('.');
    }
  }
  console.log(`\n  ✓ ${allVentas.length} ventas, ${allCuotas.length} cuotas`);
  return { ventas: allVentas, allVC, allVCom, allCuotas };
}

module.exports = { run };
