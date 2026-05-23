const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

async function actualizarMora() {
  const today = new Date().toISOString().split('T')[0];

  const { data: overdue, error: e1 } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select('id_venta')
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', today);
  if (e1) throw new Error(e1.message);

  const overdueIds = [...new Set((overdue || []).map(r => r.id_venta))];

  const { error: e2 } = await supabase.schema(SCHEMA)
    .from('venta')
    .update({ estado: 'en_mora' })
    .in('id_venta', overdueIds.length ? overdueIds : [-1])
    .in('estado', ['activa', 'en_mora']);
  if (e2) throw new Error(e2.message);

  const { data: moraVentas, error: e3 } = await supabase.schema(SCHEMA)
    .from('venta')
    .select('id_venta')
    .eq('estado', 'en_mora');
  if (e3) throw new Error(e3.message);

  const moraIds = (moraVentas || []).map(r => r.id_venta);
  const toReactivate = moraIds.filter(id => !overdueIds.includes(id));

  if (toReactivate.length) {
    const { error: e4 } = await supabase.schema(SCHEMA)
      .from('venta')
      .update({ estado: 'activa' })
      .in('id_venta', toReactivate);
    if (e4) throw new Error(e4.message);
  }

  return { mora: overdueIds.length, reactivated: toReactivate.length };
}

module.exports = { actualizarMora };
