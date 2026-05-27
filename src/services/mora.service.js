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

  const { data: moraVentas, error: emv } = await supabase.schema(SCHEMA)
    .from('venta')
    .select('id_venta')
    .eq('estado', 'en_mora');

  if (emv) throw new Error(emv.message);

  const moraIds = (moraVentas || []).map(v => v.id_venta);
  let salieroMora = 0;

  if (moraIds.length > 0) {
    const { data: aunVencidas, error: eav } = await supabase.schema(SCHEMA)
      .from('cuota')
      .select('id_venta')
      .lt('fecha_vencimiento', umbral)
      .neq('estado', 'pagada')
      .in('id_venta', moraIds);

    if (eav) throw new Error(eav.message);

    const sigueEnMoraSet = new Set((aunVencidas || []).map(c => c.id_venta));
    const revertirIds    = moraIds.filter(id => !sigueEnMoraSet.has(id));

    if (revertirIds.length > 0) {
      const { error: er } = await supabase.schema(SCHEMA)
        .from('venta')
        .update({ estado: 'activa' })
        .in('id_venta', revertirIds);

      if (er) throw new Error(er.message);
      salieroMora = revertirIds.length;
    }
  }

  const resumen = {
    fecha:         hoy,
    entraron_mora: enMoraIds.length,
    salieron_mora: salieroMora,
  };

  if (enMoraIds.length > 0 || salieroMora > 0) console.log('[mora]', JSON.stringify(resumen));
  return resumen;
}

module.exports = { actualizarMora };
