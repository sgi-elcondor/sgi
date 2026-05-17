const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

/**
 * Adds N months to a YYYY-MM-DD date string.
 * Clamps the day to the last day of the target month.
 */
function sumarMeses(fechaStr, meses) {
  const d = new Date(fechaStr + 'T12:00:00');
  if (isNaN(d.getTime())) throw new Error(`Invalid date: "${fechaStr}"`);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  return d.toISOString().split('T')[0];
}

/**
 * Generates and inserts the full payment plan for a sale.
 * Returns the number of installments created.
 */
async function generarPlanDePago(idVenta, {
  cuota_inicial,
  valor_total,
  numero_cuotas_inicial,
  fecha_primera_cuota_inicial,
  numero_cuotas,
  fecha_primera_cuota,
  microcuotas,
  totalPermutas,
}) {
  const filas = [];
  const ci    = Number(cuota_inicial)  || 0;
  const nci   = Math.max(1, parseInt(numero_cuotas_inicial, 10) || 1);
  const tp    = Number(totalPermutas)  || 0;
  let offset  = 0;

  if (ci > 0) {
    const base = Math.floor(ci / nci);
    for (let i = 0; i < nci; i++) {
      const mc    = Array.isArray(microcuotas) ? microcuotas[i] : null;
      const valor = Number(mc?.valor) > 0
        ? Number(mc.valor)
        : i === nci - 1 ? ci - base * (nci - 1) : base;
      const fecha = mc?.fecha || sumarMeses(fecha_primera_cuota_inicial, i);
      filas.push({
        id_venta:          idVenta,
        numero_cuota:      i + 1,
        tipo:              'inicial',
        fecha_vencimiento: fecha,
        valor_cuota:       valor,
        estado:            'pendiente',
        es_extraordinaria: false,
      });
    }
    offset = nci;
  }

  const saldo = Math.max(0, Number(valor_total) - ci - tp);
  const nc    = parseInt(numero_cuotas, 10) || 0;

  if (saldo > 0 && nc > 0) {
    const base = Math.floor(saldo / nc);
    for (let i = 0; i < nc; i++) {
      filas.push({
        id_venta:          idVenta,
        numero_cuota:      offset + i + 1,
        tipo:              'regular',
        fecha_vencimiento: sumarMeses(fecha_primera_cuota, i),
        valor_cuota:       i === nc - 1 ? saldo - base * (nc - 1) : base,
        estado:            'pendiente',
        es_extraordinaria: false,
      });
    }
  }

  if (filas.length === 0) return 0;

  const { error } = await supabase.schema(SCHEMA).from('cuota').insert(filas);
  if (error) throw error;

  return filas.length;
}

/**
 * Marks a cuota as paid if the applied amount covers its full value.
 */
async function marcarPagadaSiCubre(id_cuota, valor_aplicado) {
  const { data: cuota } = await supabase.schema(SCHEMA)
    .from('cuota').select('valor_cuota').eq('id_cuota', id_cuota).single();
  if (!cuota) return;
  if (Number(valor_aplicado) >= Number(cuota.valor_cuota)) {
    await supabase.schema(SCHEMA).from('cuota')
      .update({ estado: 'pagada' }).eq('id_cuota', id_cuota);
  }
}

/**
 * Rolls back all data created for a sale (used when creation fails mid-way).
 */
async function limpiarVentaCreada(idVenta) {
  if (!idVenta) return;
  await supabase.schema(SCHEMA).from('cuota').delete().eq('id_venta', idVenta);
  await supabase.schema(SCHEMA).from('venta_comisionista').delete().eq('id_venta', idVenta);
  await supabase.schema(SCHEMA).from('venta_comprador').delete().eq('id_venta', idVenta);
  await supabase.schema(SCHEMA).from('venta').delete().eq('id_venta', idVenta);
}

module.exports = { sumarMeses, generarPlanDePago, marcarPagadaSiCubre, limpiarVentaCreada };
