const supabase = require('../config/supabase');
const saldos   = require('./saldos.service');
const SCHEMA   = 'condor';

const UMBRAL_COMISION = 0.30;

async function verificarComision(id_venta, email) {
  // Load venta value and comisionista links
  const { data: venta, error: ev } = await supabase.schema(SCHEMA)
    .from('venta')
    .select('valor_total, venta_comisionista(id_usuario, valor_comision, causada)')
    .eq('id_venta', id_venta)
    .single();

  if (ev || !venta) return;

  const comisiones = venta.venta_comisionista || [];
  if (comisiones.length === 0) return;

  // Skip if all commissions already triggered
  const pendientes = comisiones.filter(c => !c.causada);
  if (pendientes.length === 0) return;

  // RN-10/RN-19: only receipt-backed payments count toward the venta total, the same
  // criterion every other module uses (single source of truth).
  const { data: pagos, error: ep } = await supabase.schema(SCHEMA)
    .from('pago')
    .select('valor_pago, estado, recibo_pago(id_recibo)')
    .eq('id_venta', id_venta)
    .eq('estado', 'aceptado');

  if (ep) return;

  const totalPagado = (pagos || [])
    .filter(p => saldos.pagoLiquidado(p))
    .reduce((s, p) => s + Number(p.valor_pago), 0);
  const umbral      = Number(venta.valor_total) * UMBRAL_COMISION;

  if (totalPagado < umbral) return false;

  // Trigger commission: mark all pending as causada
  const ahora = new Date().toISOString();

  const { error: eu } = await supabase.schema(SCHEMA)
    .from('venta_comisionista')
    .update({ causada: true, fecha_causada: ahora })
    .eq('id_venta', id_venta)
    .eq('causada', false);

  if (eu) {
    console.error('[comisiones] Error al marcar causada:', eu.message);
    return false;
  }

  await supabase.schema(SCHEMA).from('auditoria').insert([{
    tabla_afectada: 'venta_comisionista',
    id_registro:    id_venta,
    campo:          'causada',
    valor_anterior: 'false',
    valor_nuevo:    'true',
    usuario_db:     email,
    fecha_cambio:   ahora,
    motivo:         `comision_causada_30pct:pagado=${totalPagado},total=${venta.valor_total}`,
  }]);

  console.log(`[comisiones] Comisión causada — venta ${id_venta}, pagado: ${totalPagado}/${venta.valor_total}`);
  return true;
}

module.exports = { verificarComision };
