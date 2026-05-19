jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const { next, nextPago, nextMicropago } = require('../src/services/consecutivos.service');

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
