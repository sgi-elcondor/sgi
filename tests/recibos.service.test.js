jest.mock('../src/config/supabase');
jest.mock('../src/services/consecutivos.service');
const supabase        = require('../src/config/supabase');
const { nextPago }    = require('../src/services/consecutivos.service');
const { crearParaPago } = require('../src/services/recibos.service');

beforeEach(() => jest.clearAllMocks());

// Builds a per-table mock: { tableName: { method: resolvedValue } }
function setupFromMock(tableMap) {
  supabase.schema.mockReturnValue({
    from: jest.fn().mockImplementation((table) => {
      const config = tableMap[table] ?? {};
      const eqTerminal = jest.fn().mockImplementation(() =>
        Promise.resolve(config.eqResult ?? { data: null, error: null })
      );
      const maybeSingleFn = jest.fn().mockResolvedValue(config.maybeSingle ?? { data: null });
      const singleFn      = jest.fn().mockResolvedValue(config.single ?? { data: null, error: null });

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn, single: singleFn }),
        }),
        update: jest.fn().mockReturnValue({ eq: eqTerminal }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ single: singleFn }),
          then: undefined,
          // allow direct await of insert()
          ...( config.insertResult !== undefined
            ? { [Symbol.toStringTag]: 'Promise', then: (r) => Promise.resolve(config.insertResult).then(r) }
            : {} ),
        }),
      };
    }),
  });
}

// ── crearParaPago ────────────────────────────────────────────────────────────

describe('crearParaPago', () => {
  it('returns early without creating when a recibo already exists for the pago', async () => {
    setupFromMock({
      recibo_pago: { maybeSingle: { data: { id_recibo: 1 } } },
    });

    const result = await crearParaPago({ id_pago: 10, numero_pago: 'PAG-202401-00001', emitido_por: 'user@test.com' });

    expect(result.recibo).toBeNull();
    expect(nextPago).not.toHaveBeenCalled();
  });

  it('generates a new consecutive when numero_pago is not provided', async () => {
    nextPago.mockResolvedValue({ numero_pago: 'PAG-202401-00005', numero_recibo: 'RC-202401-00005' });

    const newRecibo = { id_recibo: 7, numero_recibo: 'RC-202401-00005' };
    setupFromMock({
      recibo_pago: { maybeSingle: { data: null } },
      pago:        { eqResult: { error: null } },
      recibo:      { maybeSingle: { data: null }, single: { data: newRecibo, error: null } },
    });

    await crearParaPago({ id_pago: 10, emitido_por: 'user@test.com' });

    expect(nextPago).toHaveBeenCalledTimes(1);
  });

  it('reuses an orphan recibo instead of creating a duplicate', async () => {
    nextPago.mockResolvedValue({ numero_pago: 'PAG-202401-00006', numero_recibo: 'RC-202401-00006' });

    const orphan = { id_recibo: 3 };
    setupFromMock({
      recibo_pago: { maybeSingle: { data: null } },
      pago:        { eqResult: { error: null } },
      // orphan found by numero_recibo
      recibo:      { maybeSingle: { data: orphan }, single: { data: orphan, error: null } },
    });

    const result = await crearParaPago({ id_pago: 20, emitido_por: 'user@test.com' });

    // recibo returned should be the orphan, not a new one
    expect(result.recibo).toMatchObject(orphan);
  });
});
