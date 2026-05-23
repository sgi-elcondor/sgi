const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

async function actualizarMora() {
  const hoy = new Date().toISOString().split('T')[0];

  const umbralDate = new Date();
  umbralDate.setDate(umbralDate.getDate() - 90);
  const umbral = umbralDate.toISOString().split('T')[0];

  const { data: cuotasVencidas, error: ev } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_venta')
    .lt('fecha_vencimiento', umbral)
    .eq('estado', 'pendiente');

  if (ev) throw new Error(ev.message);

  const enMoraIds = [...new Set((cuotasVencidas || []).map(c => c.id_venta))];

  if (enMoraIds.length > 0) {
    const { error: em } = await supabase.schema(SCHEMA)
      .from('venta')
      .update({ estado: 'en_mora' })
      .in('id_venta', enMoraIds)
      .eq('estado', 'activa');

    if (em) throw new Error(em.message);
  }

  const { data: ventasEnMora, error: evm } = await supabase.schema(SCHEMA)
    .from('venta')
    .select('id_venta')
    .eq('estado', 'en_mora');

  if (evm) throw new Error(evm.message);

  const salenDeMoraIds = (ventasEnMora || [])
    .map(v => v.id_venta)
    .filter(id => !enMoraIds.includes(id));

  if (salenDeMoraIds.length > 0) {
    const { error: es } = await supabase.schema(SCHEMA)
      .from('venta')
      .update({ estado: 'activa' })
      .in('id_venta', salenDeMoraIds);

    if (es) throw new Error(es.message);
  }

  const resumen = {
    fecha:         hoy,
    entraron_mora: enMoraIds.length,
    salieron_mora: salenDeMoraIds.length,
  };

  console.log('[mora]', JSON.stringify(resumen));
  return resumen;
}

module.exports = { actualizarMora };
