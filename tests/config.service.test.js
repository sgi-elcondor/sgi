jest.mock("../src/config/supabase");
const supabase = require("../src/config/supabase");
const config   = require("../src/services/config.service");

beforeEach(() => {
  jest.clearAllMocks();
  config._resetCache();
});

// Chain helper: mocks the read path
//   supabase.schema(S).from(t).select(...).eq('clave', k).maybeSingle()
function mockRead({ data = null, error = null } = {}) {
  supabase.schema.mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data, error }),
        })),
      })),
    })),
  });
}

// Chain helper: mocks read + write paths in one call. The read call ('select')
// resolves with `existingRow`; the write call chooses INSERT or UPDATE and
// resolves with `savedRow`.
function mockReadAndWrite({ existingRow = null, savedRow = null, saveError = null } = {}) {
  supabase.schema.mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: existingRow, error: null }),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: savedRow, error: saveError }),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: savedRow, error: saveError }),
        })),
      })),
    })),
  });
}

describe("config.service", () => {
  test("get() lee de BD y castea a número", async () => {
    mockRead({ data: { valor: "7500000", tipo: "number" } });

    const v = await config.get("umbral_compra_grande");

    expect(v).toBe(7_500_000);
    expect(typeof v).toBe("number");
  });

  test("get() cachea el valor y no vuelve a llamar a BD antes del TTL", async () => {
    let calls = 0;
    supabase.schema.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => {
              calls++;
              return Promise.resolve({ data: { valor: "5000000", tipo: "number" }, error: null });
            }),
          })),
        })),
      })),
    });

    const a = await config.get("umbral_compra_grande");
    const b = await config.get("umbral_compra_grande");

    expect(a).toBe(5_000_000);
    expect(b).toBe(5_000_000);
    expect(calls).toBe(1);
  });

  test("get() usa el fallback cuando no hay fila en BD (fresh install)", async () => {
    mockRead({ data: null });

    const v = await config.get("umbral_compra_grande");

    // Default declarado en config.service.DEFAULTS
    expect(v).toBe(config.DEFAULTS.umbral_compra_grande.valor);
  });

  test("get() usa el fallback y no throwa si Supabase devuelve error", async () => {
    mockRead({ data: null, error: { message: "boom" } });

    const v = await config.get("umbral_compra_grande");

    expect(v).toBe(config.DEFAULTS.umbral_compra_grande.valor);
  });

  test("get() tiene fallback para umbral_caja_menor (POL-01, fresh install)", async () => {
    mockRead({ data: null });

    const v = await config.get("umbral_caja_menor");

    expect(v).toBe(config.DEFAULTS.umbral_caja_menor.valor);
    expect(v).toBeGreaterThan(0);
  });

  test("get() de una clave desconocida sin default retorna null", async () => {
    mockRead({ data: null });

    const v = await config.get("clave_inventada");

    expect(v).toBeNull();
  });

  test("set() actualiza si la clave existe e invalida la caché", async () => {
    mockReadAndWrite({
      existingRow: { clave: "umbral_compra_grande", tipo: "number" },
      savedRow:    { clave: "umbral_compra_grande", valor: "6000000", tipo: "number", updated_at: "2026-07-10T00:00:00Z" },
    });

    const fresh = await config.set("umbral_compra_grande", 6_000_000, 42);

    expect(fresh.valor_typed).toBe(6_000_000);
    // La caché debe estar limpia: la siguiente llamada get debe volver a leer
    // desde BD (no del valor cacheado antes del set).
    mockRead({ data: { valor: "6000000", tipo: "number" } });
    const v = await config.get("umbral_compra_grande");
    expect(v).toBe(6_000_000);
  });

  test("set() inserta la fila si la clave no existe", async () => {
    let insertCalls = 0;
    supabase.schema.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn(() => {
          insertCalls++;
          return {
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { clave: "otra_clave", valor: "hola", tipo: "text", updated_at: "x" },
                error: null,
              }),
            })),
          };
        }),
      })),
    });

    const fresh = await config.set("otra_clave", "hola", 1);

    expect(insertCalls).toBe(1);
    expect(fresh.valor_typed).toBe("hola");
  });
});
