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
    .neq('estado', 'pagada');

  if (ev) throw new Error(ev.message);

  const enMoraIds = [...new Set((cuotasVencidas || []).map(c => c.id_venta))];

  if (enMoraIds.length > 0) {
    const { error: em } = await supabase.schema(SCHEMA)
      .from('venta')
      .update({ estado: 'en_mora' })
      .in('id_venta', enMoraIds)
      .in('estado', ['activa', 'pre_mora']);

    if (em) throw new Error(em.message);
  }

  const resumen = {
    fecha:         hoy,
    entraron_mora: enMoraIds.length,
  };

  if (enMoraIds.length > 0) console.log('[mora]', JSON.stringify(resumen));
  return resumen;
}

module.exports = { actualizarMora };
