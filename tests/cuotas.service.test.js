jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const { sumarMeses, generarPlanDePago, marcarPagadaSiCubre, limpiarVentaCreada } = require('../src/services/cuotas.service');

beforeEach(() => jest.clearAllMocks());

// Builds a chainable Supabase mock covering the patterns used in cuotas.service
function buildMock({ insertResult, singleResult, updateResult } = {}) {
  const eqChain = {
    single:      jest.fn().mockResolvedValue(singleResult ?? { data: null }),
    maybeSingle: jest.fn().mockResolvedValue(singleResult ?? { data: null }),
  };
  const updateChain = { eq: jest.fn().mockResolvedValue(updateResult ?? { error: null }) };
  const deleteChain = { eq: jest.fn().mockResolvedValue({ error: null }) };

  const fromChain = {
    select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue(eqChain) }),
    insert: jest.fn().mockResolvedValue(insertResult ?? { error: null }),
    update: jest.fn().mockReturnValue(updateChain),
    delete: jest.fn().mockReturnValue(deleteChain),
  };

  supabase.schema.mockReturnValue({ from: jest.fn().mockReturnValue(fromChain) });
  return fromChain;
}

// ── sumarMeses ────────────────────────────────────────────────────────────────

describe('sumarMeses', () => {
  it('adds months to a mid-month date', () => {
    expect(sumarMeses('2024-01-15', 1)).toBe('2024-02-15');
    expect(sumarMeses('2024-01-15', 12)).toBe('2025-01-15');
  });

  it('adds 0 months and returns the same date', () => {
    expect(sumarMeses('2024-06-10', 0)).toBe('2024-06-10');
  });

  it('crosses year boundary correctly', () => {
    expect(sumarMeses('2024-11-30', 2)).toBe('2025-01-30');
    expect(sumarMeses('2024-12-31', 1)).toBe('2025-01-31');
  });

  it('clamps day to last day of target month', () => {
    expect(sumarMeses('2024-01-31', 1)).toBe('2024-02-29'); // leap year
    expect(sumarMeses('2023-01-31', 1)).toBe('2023-02-28'); // non-leap year
    expect(sumarMeses('2024-03-31', 1)).toBe('2024-04-30');
  });

  it('throws on invalid date string', () => {
    expect(() => sumarMeses('not-a-date', 1)).toThrow('Invalid date');
  });
});

// ── generarPlanDePago ────────────────────────────────────────────────────────

describe('generarPlanDePago', () => {
  const base = {
    cuota_inicial:              0,
    valor_total:                12000000,
    numero_cuotas_inicial:      1,
    fecha_primera_cuota_inicial: null,
    numero_cuotas:              12,
    fecha_primera_cuota:        '2024-02-01',
    microcuotas:                null,
    totalPermutas:              0,
  };

  it('generates only regular installments when there is no initial payment', async () => {
    const mock = buildMock();
    const count = await generarPlanDePago(1, base);
    expect(count).toBe(12);
    const rows = mock.insert.mock.calls[0][0];
    expect(rows.every(r => r.tipo === 'regular')).toBe(true);
  });

  it('generates only initial installments when the saldo is 0', async () => {
    const mock = buildMock();
    const count = await generarPlanDePago(1, {
      ...base,
      cuota_inicial:               6000000,
      valor_total:                 6000000,
      numero_cuotas_inicial:       2,
      fecha_primera_cuota_inicial: '2024-01-01',
      numero_cuotas:               0,
    });
    expect(count).toBe(2);
    const rows = mock.insert.mock.calls[0][0];
    expect(rows.every(r => r.tipo === 'inicial')).toBe(true);
  });

  it('generates both types when initial and regular are present', async () => {
    const mock = buildMock();
    const count = await generarPlanDePago(1, {
      ...base,
      cuota_inicial:               3000000,
      numero_cuotas_inicial:       1,
      fecha_primera_cuota_inicial: '2024-01-01',
      numero_cuotas:               9,
    });
    expect(count).toBe(10);
    const rows = mock.insert.mock.calls[0][0];
    expect(rows.filter(r => r.tipo === 'inicial')).toHaveLength(1);
    expect(rows.filter(r => r.tipo === 'regular')).toHaveLength(9);
  });

  it('discounts permutas from the regular installments total', async () => {
    const mock = buildMock();
    await generarPlanDePago(1, { ...base, valor_total: 10000000, numero_cuotas: 10, totalPermutas: 2000000 });
    const rows = mock.insert.mock.calls[0][0];
    const total = rows.reduce((sum, r) => sum + r.valor_cuota, 0);
    expect(total).toBe(8000000);
  });

  it('returns 0 and skips insert when there is nothing to generate', async () => {
    buildMock();
    const count = await generarPlanDePago(1, { ...base, valor_total: 0, numero_cuotas: 0 });
    expect(count).toBe(0);
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it('distributes the rounding remainder in the last installment', async () => {
    const mock = buildMock();
    await generarPlanDePago(1, { ...base, valor_total: 10000000, numero_cuotas: 3 });
    const rows = mock.insert.mock.calls[0][0];
    const total = rows.reduce((sum, r) => sum + r.valor_cuota, 0);
    expect(total).toBe(10000000);
  });

  it('throws when Supabase insert returns an error', async () => {
    buildMock({ insertResult: { error: { message: 'DB error' } } });
    await expect(generarPlanDePago(1, { ...base, numero_cuotas: 1 })).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ── marcarPagadaSiCubre ───────────────────────────────────────────────────────

describe('marcarPagadaSiCubre', () => {
  it('marks as paid when amount exactly covers the installment', async () => {
    const mock = buildMock({ singleResult: { data: { valor_cuota: 500000 } } });
    await marcarPagadaSiCubre(1, 500000);
    expect(mock.update).toHaveBeenCalledWith({ estado: 'pagada' });
  });

  it('marks as paid when amount exceeds the installment value', async () => {
    const mock = buildMock({ singleResult: { data: { valor_cuota: 500000 } } });
    await marcarPagadaSiCubre(1, 750000);
    expect(mock.update).toHaveBeenCalledWith({ estado: 'pagada' });
  });

  it('does not update when amount is less than the installment value', async () => {
    const mock = buildMock({ singleResult: { data: { valor_cuota: 500000 } } });
    await marcarPagadaSiCubre(1, 499999);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it('does nothing when the installment is not found', async () => {
    const mock = buildMock({ singleResult: { data: null } });
    await marcarPagadaSiCubre(99, 500000);
    expect(mock.update).not.toHaveBeenCalled();
  });
});

// ── limpiarVentaCreada ────────────────────────────────────────────────────────

describe('limpiarVentaCreada', () => {
  it('does nothing when idVenta is falsy', async () => {
    buildMock();
    await limpiarVentaCreada(null);
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it('deletes from all 4 related tables', async () => {
    const fromMock = jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    });
    supabase.schema.mockReturnValue({ from: fromMock });

    await limpiarVentaCreada(42);

    const tables = fromMock.mock.calls.map(([table]) => table);
    expect(tables).toContain('cuota');
    expect(tables).toContain('venta_comisionista');
    expect(tables).toContain('venta_comprador');
    expect(tables).toContain('venta');
  });
});
