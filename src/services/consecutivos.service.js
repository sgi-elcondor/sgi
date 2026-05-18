const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

function periodo() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function next(prefijo) {
  const p = periodo();
  const { data, error } = await supabase.rpc('next_consecutivo_condor', {
    p_prefijo: prefijo,
    p_periodo: p,
  });
  if (error) throw new Error(error.message);
  return `${prefijo}-${p}-${String(data).padStart(5, '0')}`;
}

async function nextPago() {
  const p   = periodo();
  const n   = await next('PAG');
  const num = n.split('-').pop();
  return {
    numero_pago:   `PAG-${p}-${num}`,
    numero_recibo: `RC-${p}-${num}`,
  };
}

async function nextMicropago() {
  const p = periodo();
  const [{ data: mcomN, error: e1 }, { data: rcN, error: e2 }] = await Promise.all([
    supabase.rpc('next_consecutivo_condor', { p_prefijo: 'MCOM', p_periodo: p }),
    supabase.rpc('next_consecutivo_condor', { p_prefijo: 'PAG',  p_periodo: p }),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  return {
    numero_micropago: `MCOM-${p}-${String(mcomN).padStart(5, '0')}`,
    numero_recibo:    `RC-${p}-${String(rcN).padStart(5, '0')}`,
  };
}

module.exports = { next, nextPago, nextMicropago };
