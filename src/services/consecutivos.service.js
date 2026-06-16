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

// Builds the descriptive, stored venta code: #NNN-SIGLA-LOTE (e.g. #014-EC1-A22).
// seq is a global, continuous sequence; sigla is the project's; lote is the codigo_lote
// stripped of its sigla prefix and separators. The code is immutable once stored.
function formatCodigoVenta(seq, sigla, codigoLote) {
  const siglaTk = (String(sigla || "").trim().toUpperCase()) || "GEN";
  let lote = String(codigoLote || "").trim();
  if (siglaTk !== "GEN" && lote) {
    const escaped = siglaTk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    lote = lote.replace(new RegExp(`^${escaped}[-_\\s]?`, "i"), "");
  }
  const loteTk = lote.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "SN";
  return `#${String(seq).padStart(3, "0")}-${siglaTk}-${loteTk}`;
}

// Global, continuous venta sequence (does not reset per period). Uses a constant period
// sentinel so next_consecutivo_condor keeps a single ever-increasing counter for 'VEN'.
async function nextVenta() {
  const { data, error } = await supabase.rpc("next_consecutivo_condor", {
    p_prefijo: "VEN",
    p_periodo: "000000",
  });
  if (error) throw new Error(error.message);
  return data;
}

async function generarCodigoVenta({ sigla, codigo_lote }) {
  const seq = await nextVenta();
  return formatCodigoVenta(seq, sigla, codigo_lote);
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

module.exports = { next, nextPago, nextMicropago, nextVenta, formatCodigoVenta, generarCodigoVenta };
