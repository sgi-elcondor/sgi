jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const {
  inactivosPorIds,
  inactivosDeVenta,
  inactivosDeCuota,
  nombresInactivos,
} = require('../src/services/usuarios.service');

beforeEach(() => jest.clearAllMocks());

// Per-table mock. `.in()` resolves directly; `.eq()` is a thenable that also exposes `.single()`.
function setup(tableMap) {
  supabase.schema.mockReturnValue({
    from: jest.fn((table) => {
      const cfg = tableMap[table] ?? {};
      return {
        select: jest.fn(() => ({
          in: jest.fn().mockResolvedValue(cfg.in ?? { data: [], error: null }),
          eq: jest.fn(() => {
            const p = Promise.resolve(cfg.eq ?? { data: [], error: null });
            p.single = jest.fn().mockResolvedValue(cfg.single ?? { data: null, error: null });
            return p;
          }),
        })),
      };
    }),
  });
}

describe('inactivosPorIds', () => {
  it('returns only the users with activo === false', async () => {
    setup({
      usuarios: { in: { data: [
        { id_usuario: 1, nombres: 'Ana',  apellidos: 'Gil',  activo: true  },
        { id_usuario: 2, nombres: 'Beto', apellidos: 'Ruiz', activo: false },
      ] } },
    });

    const result = await inactivosPorIds([1, 2]);

    expect(result).toHaveLength(1);
    expect(result[0].id_usuario).toBe(2);
  });

  it('short-circuits without querying when ids is empty', async () => {
    setup({});
    const result = await inactivosPorIds([]);
    expect(result).toEqual([]);
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it('dedupes ids and ignores falsy values', async () => {
    setup({ usuarios: { in: { data: [] } } });
    await inactivosPorIds([1, 1, 0, null, 2]);
    // The query ran once; dedupe/filtering happens before the call.
    expect(supabase.schema).toHaveBeenCalledTimes(1);
  });
});

describe('inactivosDeVenta', () => {
  it('maps the venta compradores and returns the inactive ones', async () => {
    setup({
      venta_comprador: { eq: { data: [{ id_usuario: 5 }, { id_usuario: 6 }] } },
      usuarios:        { in: { data: [{ id_usuario: 6, nombres: 'Cris', apellidos: 'Paz', activo: false }] } },
    });

    const result = await inactivosDeVenta(99);

    expect(result).toHaveLength(1);
    expect(result[0].id_usuario).toBe(6);
  });

  it('returns [] when idVenta is missing', async () => {
    setup({});
    expect(await inactivosDeVenta(null)).toEqual([]);
    expect(supabase.schema).not.toHaveBeenCalled();
  });
});

describe('inactivosDeCuota', () => {
  it('resolves the venta of the cuota and returns its inactive compradores', async () => {
    setup({
      cuota:    { single: { data: { venta: { venta_comprador: [{ id_usuario: 7 }] } } } },
      usuarios: { in: { data: [{ id_usuario: 7, nombres: 'Eva', apellidos: '', activo: false }] } },
    });

    const result = await inactivosDeCuota(42);

    expect(result).toHaveLength(1);
    expect(result[0].id_usuario).toBe(7);
  });
});

describe('nombresInactivos', () => {
  it('joins full names, trims missing apellidos and falls back to the id', () => {
    const text = nombresInactivos([
      { id_usuario: 1, nombres: 'Ana', apellidos: 'Gil' },
      { id_usuario: 2, nombres: 'Eva', apellidos: '' },
      { id_usuario: 3 },
    ]);
    expect(text).toBe('Ana Gil, Eva, usuario 3');
  });

  it('returns an empty string for an empty list', () => {
    expect(nombresInactivos([])).toBe('');
  });
});
