const supabase       = require('../config/supabase');
const { nextPago }   = require('./consecutivos.service');
const SCHEMA         = 'condor';

/**
 * Creates a recibo and links it to a pago.
 * If a recibo with the same numero already exists (orphan from a failed tx), reuses it.
 * Also updates pago.numero_pago if not already set.
 *
 * @param {{ id_pago: number, numero_pago?: string, emitido_por: string }} opts
 * @returns {{ recibo: object|null, numero_pago: string, error?: string }}
 */
async function crearParaPago({ id_pago, numero_pago, emitido_por }) {
  const existing = await supabase.schema(SCHEMA)
    .from('recibo_pago').select('id_recibo').eq('id_pago', id_pago).maybeSingle();

  if (existing.data) return { recibo: null, numero_pago };

  let consec;
  if (!numero_pago) {
    consec       = await nextPago();
    numero_pago  = consec.numero_pago;
    await supabase.schema(SCHEMA).from('pago')
      .update({ numero_pago }).eq('id_pago', id_pago);
  } else {
    const p   = numero_pago.replace('PAG-', 'RC-');
    consec    = { numero_recibo: p };
  }

  const numero_recibo = consec.numero_recibo;
  const fecha_emision = new Date().toISOString().split('T')[0];

  const orphan = await supabase.schema(SCHEMA)
    .from('recibo').select('id_recibo').eq('numero_recibo', numero_recibo).maybeSingle();

  let idRecibo = null;
  let recibo   = null;

  if (orphan.data) {
    idRecibo = orphan.data.id_recibo;
    recibo   = orphan.data;
  } else {
    const { data: nuevo, error } = await supabase.schema(SCHEMA).from('recibo')
      .insert([{ numero_recibo, fecha_emision, emitido_por }])
      .select().single();
    if (error) return { recibo: null, numero_pago, error: error.message };
    idRecibo = nuevo.id_recibo;
    recibo   = nuevo;
  }

  const { error: linkErr } = await supabase.schema(SCHEMA).from('recibo_pago')
    .insert([{ id_recibo: idRecibo, id_pago }]);

  if (linkErr) return { recibo: null, numero_pago, error: `recibo_pago: ${linkErr.message}` };

  return { recibo, numero_pago };
}

module.exports = { crearParaPago };
