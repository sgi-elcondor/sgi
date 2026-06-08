const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

// RN-15: more than 90 days overdue = en_mora. RN-14: 1..90 = pre_mora.
const MORA_DIAS = 90;

// A payment counts toward the balance only when it is accepted AND backed by an
// emitted recibo (RN-10 / RN-01). A pending or accepted-without-recibo payment is
// never an income and never reduces the saldo.
function _tieneRecibo(pago) {
  if (!pago) return false;
  const rp = pago.recibo_pago;
  return Array.isArray(rp) ? rp.length > 0 : !!rp;
}

function _sumRecibosAceptados(cuotaPagoRows) {
  return (cuotaPagoRows || []).reduce((sum, cp) => {
    if (cp.pago?.estado === 'aceptado' && _tieneRecibo(cp.pago)) {
      return sum + Number(cp.valor_aplicado || 0);
    }
    return sum;
  }, 0);
}

// RN-10: the single saldo formula for the whole system.
function _saldo(valor, totalRecibos) {
  return Math.max(0, Number(valor || 0) - Number(totalRecibos || 0));
}

function _diasVencida(fechaVencimiento, hoy = new Date()) {
  const venc = new Date(fechaVencimiento + 'T12:00:00');
  return Math.floor((hoy - venc) / 86_400_000);
}

// RN-14/15: classify an unpaid cuota by days overdue.
function clasificarMora(diasVencida) {
  if (diasVencida <= 0)         return 'vigente';
  if (diasVencida <= MORA_DIAS) return 'pre_mora';
  return 'en_mora';
}

// RN-04/14/15/16: cuota state is derived from saldo + days, never stored.
function _clasificarEstado({ valorCuota, totalRecibos, fechaVencimiento, hoy = new Date() }) {
  if (_saldo(valorCuota, totalRecibos) <= 0) return 'pagada';
  return clasificarMora(_diasVencida(fechaVencimiento, hoy));
}

// RN-03 / 4.2: factura state derived from the receipts covering its value.
// 'anulada' is an explicit action, not a derived state, so callers keep it as-is.
function _estadoFactura(valorFacturado, totalRecibosFactura) {
  const v = Number(valorFacturado || 0);
  const r = Number(totalRecibosFactura || 0);
  if (r <= 0) return 'emitida';
  if (r >= v) return 'pagada';
  return 'parcialmente_pagada';
}

// 3.3: fractions are covered greedily, in order, by the cumulative receipts.
function _coberturaFracciones(fracciones, totalRecibos) {
  const ordered = [...(fracciones || [])].sort((a, b) => a.numero_fraccion - b.numero_fraccion);
  let restante  = Number(totalRecibos || 0);
  return ordered.map(f => {
    const valor  = Number(f.valor_fraccion || 0);
    const pagado = Math.min(valor, Math.max(0, restante));
    restante     = Math.max(0, restante - valor);
    return {
      id_fraccion:     f.id_fraccion,
      numero_fraccion: f.numero_fraccion,
      valor_fraccion:  valor,
      fecha_propuesta: f.fecha_propuesta || null,
      pagado,
      saldo_pendiente: Math.max(0, valor - pagado),
      cubierta:        valor > 0 && pagado >= valor,
    };
  });
}

async function _fetchCuota(id_cuota) {
  const { data, error } = await supabase.schema(SCHEMA)
    .from('cuota')
    .select(`
      id_cuota, valor_cuota, fecha_vencimiento, numero_cuota, id_venta,
      cuota_fraccion(id_fraccion, numero_fraccion, valor_fraccion, fecha_propuesta),
      cuota_pago(valor_aplicado, pago:id_pago(estado, recibo_pago(id_recibo)))
    `)
    .eq('id_cuota', id_cuota)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// RN-10: canonical saldo of a cuota = valor - sum of accepted receipts.
async function getSaldoCuota(id_cuota) {
  const c = await _fetchCuota(id_cuota);
  if (!c) return null;
  const totalRecibos = _sumRecibosAceptados(c.cuota_pago);
  return {
    id_cuota:        c.id_cuota,
    valor_cuota:     Number(c.valor_cuota),
    total_recibos:   totalRecibos,
    saldo_pendiente: _saldo(c.valor_cuota, totalRecibos),
  };
}

// Rich, view-facing summary so the comprador and the aux render the same reality
// (RN-19). valor_en_revision is informational only and never part of the saldo.
async function getResumenCuota(id_cuota, { hoy = new Date() } = {}) {
  const c = await _fetchCuota(id_cuota);
  if (!c) return null;

  const totalRecibos = _sumRecibosAceptados(c.cuota_pago);
  const saldo  = _saldo(c.valor_cuota, totalRecibos);
  const estado = _clasificarEstado({
    valorCuota: c.valor_cuota, totalRecibos, fechaVencimiento: c.fecha_vencimiento, hoy,
  });

  const { data: enRev } = await supabase.schema(SCHEMA)
    .from('pago')
    .select('valor_pago')
    .eq('id_cuota_propuesta', id_cuota)
    .eq('estado', 'pendiente_revision');
  const valorEnRevision = (enRev || []).reduce((s, p) => s + Number(p.valor_pago || 0), 0);

  const fracciones = (c.cuota_fraccion || []).length
    ? _coberturaFracciones(c.cuota_fraccion, totalRecibos)
    : [];

  return {
    id_cuota:          c.id_cuota,
    numero_cuota:      c.numero_cuota,
    id_venta:          c.id_venta,
    valor_cuota:       Number(c.valor_cuota),
    total_recibos:     totalRecibos,
    saldo_pendiente:   saldo,
    valor_en_revision: valorEnRevision,
    estado,
    dias_vencida:      _diasVencida(c.fecha_vencimiento, hoy),
    tiene_fracciones:  fracciones.length > 0,
    fracciones,
  };
}

async function getEstadoCuota(id_cuota, opts) {
  const r = await getResumenCuota(id_cuota, opts);
  return r ? r.estado : null;
}

async function getSaldoFraccion(id_fraccion) {
  const { data: frac, error } = await supabase.schema(SCHEMA)
    .from('cuota_fraccion')
    .select('id_fraccion, id_cuota, numero_fraccion, valor_fraccion')
    .eq('id_fraccion', id_fraccion)
    .single();
  if (error) throw new Error(error.message);
  if (!frac) return null;

  const c            = await _fetchCuota(frac.id_cuota);
  const totalRecibos = _sumRecibosAceptados(c?.cuota_pago);
  const cobertura    = _coberturaFracciones(c?.cuota_fraccion, totalRecibos);
  return cobertura.find(f => f.id_fraccion === frac.id_fraccion) || {
    id_fraccion:     frac.id_fraccion,
    numero_fraccion: frac.numero_fraccion,
    valor_fraccion:  Number(frac.valor_fraccion),
    pagado:          0,
    saldo_pendiente: Number(frac.valor_fraccion),
    cubierta:        false,
  };
}

// RN-03 / 4.2: factura state derived from the receipts covering its cuota/fracción.
async function getEstadoFactura(id_factura) {
  const { data: f, error } = await supabase.schema(SCHEMA)
    .from('factura')
    .select('id_factura, valor_facturado, estado, cuota_factura(id_cuota, id_fraccion)')
    .eq('id_factura', id_factura)
    .single();
  if (error) throw new Error(error.message);
  if (!f) return null;
  if (f.estado === 'anulada') return 'anulada';

  const link = (f.cuota_factura || [])[0];
  if (!link) return _estadoFactura(f.valor_facturado, 0);

  const c            = await _fetchCuota(link.id_cuota);
  const totalRecibos = _sumRecibosAceptados(c?.cuota_pago);

  let cubierto;
  if (link.id_fraccion) {
    const cob  = _coberturaFracciones(c?.cuota_fraccion, totalRecibos);
    const item = cob.find(x => x.id_fraccion === link.id_fraccion);
    cubierto   = item ? item.pagado : 0;
  } else {
    cubierto = totalRecibos;
  }
  return _estadoFactura(f.valor_facturado, cubierto);
}

module.exports = {
  MORA_DIAS,
  clasificarMora,
  getSaldoCuota,
  getResumenCuota,
  getEstadoCuota,
  getSaldoFraccion,
  getEstadoFactura,
  // exported for unit testing the pure logic
  _sumRecibosAceptados,
  _saldo,
  _diasVencida,
  _clasificarEstado,
  _estadoFactura,
  _coberturaFracciones,
};
