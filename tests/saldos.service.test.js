jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const saldos   = require('../src/services/saldos.service');

beforeEach(() => jest.clearAllMocks());

const HOY = new Date('2026-06-07T12:00:00');

// ── _sumRecibosAceptados (RN-10 / RN-01) ─────────────────────────────────────
describe('_sumRecibosAceptados', () => {
  it('counts only accepted payments backed by an emitted recibo', () => {
    const rows = [
      { valor_aplicado: 100, pago: { estado: 'aceptado',           recibo_pago: [{ id_recibo: 1 }] } },
      { valor_aplicado: 200, pago: { estado: 'pendiente_revision', recibo_pago: [] } },
      { valor_aplicado: 300, pago: { estado: 'rechazado',          recibo_pago: [] } },
      { valor_aplicado: 400, pago: { estado: 'aceptado',           recibo_pago: [] } }, // accepted but no recibo yet
    ];
    expect(saldos._sumRecibosAceptados(rows)).toBe(100);
  });

  it('returns 0 for empty/undefined input', () => {
    expect(saldos._sumRecibosAceptados([])).toBe(0);
    expect(saldos._sumRecibosAceptados(undefined)).toBe(0);
  });
});

// ── _saldo (RN-10) ───────────────────────────────────────────────────────────
describe('_saldo', () => {
  it('subtracts receipts from value', () => {
    expect(saldos._saldo(1000, 400)).toBe(600);
  });
  it('never goes negative', () => {
    expect(saldos._saldo(1000, 1500)).toBe(0);
  });
});

// ── _clasificarEstado (RN-04/14/15/16) ───────────────────────────────────────
describe('_clasificarEstado', () => {
  const base = { valorCuota: 1000, fechaVencimiento: '2026-06-01', hoy: HOY };

  it('is pagada when receipts cover the full value, regardless of dates', () => {
    expect(saldos._clasificarEstado({ ...base, totalRecibos: 1000 })).toBe('pagada');
    expect(saldos._clasificarEstado({ ...base, totalRecibos: 1200 })).toBe('pagada');
  });

  it('is vigente when not yet due', () => {
    expect(saldos._clasificarEstado({ ...base, fechaVencimiento: '2026-07-01', totalRecibos: 0 })).toBe('vigente');
  });

  it('is pre_mora between 1 and 90 days overdue', () => {
    expect(saldos._clasificarEstado({ ...base, fechaVencimiento: '2026-06-06', totalRecibos: 0 })).toBe('pre_mora');
    expect(saldos._clasificarEstado({ ...base, fechaVencimiento: '2026-03-10', totalRecibos: 0 })).toBe('pre_mora');
  });

  it('is en_mora after 90 days overdue', () => {
    expect(saldos._clasificarEstado({ ...base, fechaVencimiento: '2026-01-01', totalRecibos: 0 })).toBe('en_mora');
  });

  it('partial payment does not change the overdue state (RN-04)', () => {
    expect(saldos._clasificarEstado({ ...base, fechaVencimiento: '2026-06-06', totalRecibos: 400 })).toBe('pre_mora');
  });
});

// ── _estadoFactura (RN-03 / 4.2) ─────────────────────────────────────────────
describe('_estadoFactura', () => {
  it('emitida when no receipts', () => {
    expect(saldos._estadoFactura(1000, 0)).toBe('emitida');
  });
  it('parcialmente_pagada when receipts cover part of the value', () => {
    expect(saldos._estadoFactura(1000, 400)).toBe('parcialmente_pagada');
  });
  it('pagada when receipts cover the full value', () => {
    expect(saldos._estadoFactura(1000, 1000)).toBe('pagada');
  });
});

// ── _coberturaFracciones (3.3) ───────────────────────────────────────────────
describe('_coberturaFracciones', () => {
  const fracciones = [
    { id_fraccion: 1, numero_fraccion: 1, valor_fraccion: 400 },
    { id_fraccion: 2, numero_fraccion: 2, valor_fraccion: 400 },
    { id_fraccion: 3, numero_fraccion: 3, valor_fraccion: 400 },
  ];

  it('covers fractions greedily in order', () => {
    const cob = saldos._coberturaFracciones(fracciones, 500);
    expect(cob[0]).toMatchObject({ id_fraccion: 1, pagado: 400, saldo_pendiente: 0, cubierta: true });
    expect(cob[1]).toMatchObject({ id_fraccion: 2, pagado: 100, saldo_pendiente: 300, cubierta: false });
    expect(cob[2]).toMatchObject({ id_fraccion: 3, pagado: 0,   saldo_pendiente: 400, cubierta: false });
  });

  it('marks all covered when receipts reach the total', () => {
    const cob = saldos._coberturaFracciones(fracciones, 1200);
    expect(cob.every(f => f.cubierta)).toBe(true);
  });
});

// ── getSaldoCuota (DB-bound) ─────────────────────────────────────────────────
describe('getSaldoCuota', () => {
  function mockCuota(data) {
    supabase.schema.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data, error: null }) }),
        }),
      }),
    });
  }

  it('computes saldo from accepted receipts only', async () => {
    mockCuota({
      id_cuota: 5, valor_cuota: 1000, fecha_vencimiento: '2026-06-01', numero_cuota: 1, id_venta: 9,
      cuota_fraccion: [],
      cuota_pago: [
        { valor_aplicado: 400, pago: { estado: 'aceptado',           recibo_pago: [{ id_recibo: 1 }] } },
        { valor_aplicado: 300, pago: { estado: 'pendiente_revision', recibo_pago: [] } },
      ],
    });

    const r = await saldos.getSaldoCuota(5);
    expect(r).toEqual({ id_cuota: 5, valor_cuota: 1000, total_recibos: 400, saldo_pendiente: 600 });
  });
});
