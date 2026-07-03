jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const { next, nextPago, nextMicropago, nextVenta, formatCodigoVenta, generarCodigoVenta } = require('../src/services/consecutivos.service');

beforeEach(() => jest.clearAllMocks());

// ── next ──────────────────────────────────────────────────────────────────────

describe('next', () => {
  it('returns a string with the correct format PREFIJO-YYYYMM-NNNNN', async () => {
    supabase.rpc.mockResolvedValue({ data: 7, error: null });
    const result = await next('PAG');
    expect(result).toMatch(/^PAG-\d{6}-00007$/);
  });

  it('pads the sequence number to 5 digits', async () => {
    supabase.rpc.mockResolvedValue({ data: 1, error: null });
    const result = await next('FAC');
    expect(result).toMatch(/^FAC-\d{6}-00001$/);

    supabase.rpc.mockResolvedValue({ data: 99999, error: null });
    const large = await next('FAC');
    expect(large).toMatch(/^FAC-\d{6}-99999$/);
  });

  it('calls the RPC with the correct prefix and current period', async () => {
    supabase.rpc.mockResolvedValue({ data: 1, error: null });
    await next('RC');
    expect(supabase.rpc).toHaveBeenCalledWith('next_consecutivo_condor', expect.objectContaining({
      p_prefijo: 'RC',
    }));
  });

  it('throws when Supabase RPC returns an error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
    await expect(next('PAG')).rejects.toThrow('RPC failed');
  });
});

// ── nextPago ──────────────────────────────────────────────────────────────────

describe('nextPago', () => {
  it('returns both numero_pago and numero_recibo', async () => {
    supabase.rpc.mockResolvedValue({ data: 3, error: null });
    const result = await nextPago();
    expect(result).toHaveProperty('numero_pago');
    expect(result).toHaveProperty('numero_recibo');
  });

  it('numero_pago starts with PAG and numero_recibo starts with RC', async () => {
    supabase.rpc.mockResolvedValue({ data: 5, error: null });
    const { numero_pago, numero_recibo } = await nextPago();
    expect(numero_pago).toMatch(/^PAG-/);
    expect(numero_recibo).toMatch(/^RC-/);
  });

  it('both numbers share the same sequential suffix', async () => {
    supabase.rpc.mockResolvedValue({ data: 12, error: null });
    const { numero_pago, numero_recibo } = await nextPago();
    const pagSuffix = numero_pago.split('-')[2];
    const rcSuffix  = numero_recibo.split('-')[2];
    expect(pagSuffix).toBe(rcSuffix);
  });
});

// ── nextMicropago ─────────────────────────────────────────────────────────────

describe('nextMicropago', () => {
  it('returns both numero_micropago and numero_recibo', async () => {
    supabase.rpc.mockResolvedValue({ data: 2, error: null });
    const result = await nextMicropago();
    expect(result).toHaveProperty('numero_micropago');
    expect(result).toHaveProperty('numero_recibo');
  });

  it('numero_micropago starts with MCOM', async () => {
    supabase.rpc.mockResolvedValue({ data: 1, error: null });
    const { numero_micropago } = await nextMicropago();
    expect(numero_micropago).toMatch(/^MCOM-/);
  });
});

// ── formatCodigoVenta ───────────────────────────────────────────────────────────

describe('formatCodigoVenta', () => {
  it('builds #NNN-SIGLA-LOTE stripping the sigla prefix and separators', () => {
    expect(formatCodigoVenta(14, 'EC1', 'EC1-A-22')).toBe('#014-EC1-A22');
  });

  it('pads the sequence to at least 3 digits and uppercases tokens', () => {
    expect(formatCodigoVenta(7, 'lmr', 'lmr-c-10')).toBe('#007-LMR-C10');
  });

  it('does not pad sequences with 4+ digits', () => {
    expect(formatCodigoVenta(1234, 'EC1', 'EC1-A-22')).toBe('#1234-EC1-A22');
  });

  it('falls back to GEN when there is no sigla and keeps the whole lote code', () => {
    expect(formatCodigoVenta(3, null, 'A-22')).toBe('#003-GEN-A22');
  });

  it('uses SN when the lote code is missing', () => {
    expect(formatCodigoVenta(5, 'EC1', null)).toBe('#005-EC1-SN');
  });
});

// ── nextVenta ───────────────────────────────────────────────────────────────────

describe('nextVenta', () => {
  it('calls the RPC with the VEN prefix and the global period sentinel', async () => {
    supabase.rpc.mockResolvedValue({ data: 9, error: null });
    const n = await nextVenta();
    expect(n).toBe(9);
    expect(supabase.rpc).toHaveBeenCalledWith('next_consecutivo_condor', {
      p_prefijo: 'VEN', p_periodo: '000000',
    });
  });

  it('throws when the RPC returns an error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(nextVenta()).rejects.toThrow('boom');
  });
});

// ── generarCodigoVenta ──────────────────────────────────────────────────────────

describe('generarCodigoVenta', () => {
  it('combines the global sequence with sigla and lote', async () => {
    supabase.rpc.mockResolvedValue({ data: 14, error: null });
    const code = await generarCodigoVenta({ sigla: 'EC1', codigo_lote: 'EC1-A-22' });
    expect(code).toBe('#014-EC1-A22');
  });
});
