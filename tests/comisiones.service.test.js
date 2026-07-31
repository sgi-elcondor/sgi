jest.mock('../src/config/supabase');
jest.mock('../src/services/saldos.service', () => ({
  // Only receipt-backed payments count (RN-10). The unit under test must rely on
  // this predicate instead of re-deriving it.
  pagoLiquidado: jest.fn(p => Array.isArray(p.recibo_pago) && p.recibo_pago.length > 0),
}));

const supabase = require('../src/config/supabase');
const saldos   = require('../src/services/saldos.service');
const { verificarComision } = require('../src/services/comisiones.service');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

/**
 * Mocks the four chains the service uses and captures what it writes:
 *   venta               .select().eq().single()
 *   pago                .select().eq().eq()
 *   venta_comisionista  .update().eq().eq()
 *   auditoria           .insert()
 */
function setup({ venta, ventaError = null, pagos = [], pagosError = null, updateError = null } = {}) {
  const written = { update: null, updateFilters: [], audit: null };

  supabase.schema.mockReturnValue({
    from: jest.fn((table) => {
      if (table === 'venta') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: venta ?? null, error: ventaError }),
            })),
          })),
        };
      }

      if (table === 'pago') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: pagos, error: pagosError }),
            })),
          })),
        };
      }

      if (table === 'venta_comisionista') {
        return {
          update: jest.fn((payload) => {
            written.update = payload;
            return {
              eq: jest.fn((col, val) => {
                written.updateFilters.push([col, val]);
                return {
                  eq: jest.fn((col2, val2) => {
                    written.updateFilters.push([col2, val2]);
                    return Promise.resolve({ error: updateError });
                  }),
                };
              }),
            };
          }),
        };
      }

      if (table === 'auditoria') {
        return {
          insert: jest.fn((rows) => {
            written.audit = rows;
            return Promise.resolve({ error: null });
          }),
        };
      }

      return {};
    }),
  });

  return written;
}

const pagoConRecibo = valor => ({ valor_pago: valor, estado: 'aceptado', recibo_pago: [{ id_recibo: 1 }] });
const pagoSinRecibo = valor => ({ valor_pago: valor, estado: 'aceptado', recibo_pago: [] });
const comisionista  = (causada = false) => ({ id_usuario: 7, valor_comision: 500, causada });

describe('verificarComision — casos que no deben causar comisión', () => {
  it('no hace nada si la venta no existe', async () => {
    const w = setup({ venta: null, ventaError: { message: 'not found' } });
    await expect(verificarComision(1, 'a@b.c')).resolves.toBeUndefined();
    expect(w.update).toBeNull();
  });

  it('no hace nada si la venta no tiene comisionistas', async () => {
    const w = setup({ venta: { valor_total: 1000, total_permutas: 0, venta_comisionista: [] } });
    await expect(verificarComision(1, 'a@b.c')).resolves.toBeUndefined();
    expect(w.update).toBeNull();
  });

  it('no hace nada si todas las comisiones ya están causadas', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 1000, venta_comisionista: [comisionista(true)] },
    });
    await expect(verificarComision(1, 'a@b.c')).resolves.toBeUndefined();
    expect(w.update).toBeNull();
  });

  it('devuelve false y no escribe si el pagado está por debajo del 30%', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 0, venta_comisionista: [comisionista()] },
      pagos: [pagoConRecibo(299)],
    });
    await expect(verificarComision(1, 'a@b.c')).resolves.toBe(false);
    expect(w.update).toBeNull();
    expect(w.audit).toBeNull();
  });

  it('ignora los pagos sin recibo respaldado (RN-10)', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 0, venta_comisionista: [comisionista()] },
      // 900 aceptados pero sin recibo: no cuentan, así que no se alcanza el 30%.
      pagos: [pagoSinRecibo(900), pagoConRecibo(100)],
    });
    await expect(verificarComision(1, 'a@b.c')).resolves.toBe(false);
    expect(saldos.pagoLiquidado).toHaveBeenCalled();
    expect(w.update).toBeNull();
  });
});

describe('verificarComision — umbral del 30%', () => {
  it('causa la comisión exactamente en el 30%', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 0, venta_comisionista: [comisionista()] },
      pagos: [pagoConRecibo(300)],
    });

    await expect(verificarComision(1, 'a@b.c')).resolves.toBe(true);
    expect(w.update).toMatchObject({ causada: true });
    expect(w.update.fecha_causada).toEqual(expect.any(String));
  });

  it('sólo marca las comisiones pendientes, nunca las ya causadas', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 0, venta_comisionista: [comisionista(), comisionista(true)] },
      pagos: [pagoConRecibo(400)],
    });

    await verificarComision(42, 'a@b.c');

    expect(w.updateFilters).toEqual(
      expect.arrayContaining([['id_venta', 42], ['causada', false]])
    );
  });

  it('las permutas cuentan como pago para alcanzar el umbral', async () => {
    const w = setup({
      // Sin permutas serían 100/1000 = 10%; con 250 de permuta, 35%.
      venta: { valor_total: 1000, total_permutas: 250, venta_comisionista: [comisionista()] },
      pagos: [pagoConRecibo(100)],
    });

    await expect(verificarComision(1, 'a@b.c')).resolves.toBe(true);
    expect(w.update).toMatchObject({ causada: true });
  });

  it('las permutas por sí solas pueden causar la comisión', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 300, venta_comisionista: [comisionista()] },
      pagos: [],
    });

    await expect(verificarComision(1, 'a@b.c')).resolves.toBe(true);
    expect(w.update).toMatchObject({ causada: true });
  });
});

describe('verificarComision — trazabilidad y errores', () => {
  it('deja constancia en auditoría con el monto pagado y el total', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 100, venta_comisionista: [comisionista()] },
      pagos: [pagoConRecibo(250)],
    });

    await verificarComision(99, 'aux@condor.co');

    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({
      tabla_afectada: 'venta_comisionista',
      id_registro:    99,
      campo:          'causada',
      valor_anterior: 'false',
      valor_nuevo:    'true',
      usuario_db:     'aux@condor.co',
    });
    // 250 en pagos + 100 de permuta
    expect(w.audit[0].motivo).toBe('comision_causada_30pct:pagado=350,total=1000');
  });

  it('devuelve false y no audita si falla el UPDATE', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 0, venta_comisionista: [comisionista()] },
      pagos: [pagoConRecibo(500)],
      updateError: { message: 'conflicto' },
    });

    await expect(verificarComision(1, 'a@b.c')).resolves.toBe(false);
    expect(w.audit).toBeNull();
  });

  it('no causa la comisión si falla la consulta de pagos', async () => {
    const w = setup({
      venta: { valor_total: 1000, total_permutas: 0, venta_comisionista: [comisionista()] },
      pagosError: { message: 'timeout' },
    });

    await expect(verificarComision(1, 'a@b.c')).resolves.toBeUndefined();
    expect(w.update).toBeNull();
  });
});
