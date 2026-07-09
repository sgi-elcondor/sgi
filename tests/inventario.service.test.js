jest.mock("../src/config/supabase");
const supabase   = require("../src/config/supabase");
const inventario = require("../src/services/inventario.service");

beforeEach(() => jest.clearAllMocks());

function setupInsert({ error = null } = {}) {
  const inserted = [];
  supabase.schema.mockReturnValue({
    from: jest.fn(() => ({
      insert: jest.fn((rows) => {
        inserted.push(...rows);
        return Promise.resolve({ error });
      }),
    })),
  });
  return inserted;
}

function setupSelect(movimientos) {
  supabase.schema.mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn(() => {
        const p = Promise.resolve({ data: movimientos, error: null });
        p.eq = jest.fn().mockResolvedValue({
          data: movimientos.filter(m => m._eqMatch !== false),
          error: null,
        });
        return p;
      }),
    })),
  });
}

describe("normalizarMaterial", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(inventario.normalizarMaterial("  Cemento   GRÍS  ")).toBe("cemento gris");
    expect(inventario.normalizarMaterial("Tubería PVC ½")).toBe(inventario.normalizarMaterial("tuberia pvc ½"));
  });

  it("tolera valores vacíos", () => {
    expect(inventario.normalizarMaterial(null)).toBe("");
  });
});

describe("registrarEntradas", () => {
  const requerimiento = { id_requerimiento: 9, categoria: "materiales", id_proyecto: 2 };

  it("inserta un movimiento de entrada por ítem recibido", async () => {
    const inserted = setupInsert();

    const n = await inventario.registrarEntradas({
      requerimiento,
      id_recepcion: 4,
      id_usuario: 7,
      items: [
        { descripcion: "Cemento Gris", unidad: "bulto", cantidad: 10 },
        { descripcion: "Arena", unidad: "m3", cantidad: 2.5 },
      ],
    });

    expect(n).toBe(2);
    expect(inserted[0]).toMatchObject({
      tipo: "entrada",
      material: "cemento gris",
      descripcion: "Cemento Gris",
      categoria: "materiales",
      cantidad: 10,
      id_proyecto: 2,
      id_requerimiento: 9,
      id_recepcion: 4,
      creado_por: 7,
    });
  });

  it("ignora ítems sin cantidad positiva o sin descripción", async () => {
    const inserted = setupInsert();
    const n = await inventario.registrarEntradas({
      requerimiento,
      items: [
        { descripcion: "Cemento", unidad: "bulto", cantidad: 0 },
        { descripcion: "  ", unidad: "und", cantidad: 5 },
      ],
    });
    expect(n).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("es best-effort: devuelve 0 sin lanzar si el insert falla", async () => {
    setupInsert({ error: { message: "boom" } });
    await expect(inventario.registrarEntradas({
      requerimiento,
      items: [{ descripcion: "Cemento", cantidad: 1 }],
    })).resolves.toBe(0);
  });
});

describe("stockActual", () => {
  it("deriva el saldo: entradas suman, salidas restan, agrupado por material+unidad", async () => {
    setupSelect([
      { tipo: "entrada", material: "cemento gris", descripcion: "Cemento Gris", categoria: "materiales", unidad: "bulto", cantidad: 10, id_proyecto: 1, created_at: "2026-07-01T10:00:00Z" },
      { tipo: "entrada", material: "cemento gris", descripcion: "Cemento gris 50kg", categoria: "materiales", unidad: "bulto", cantidad: 5, id_proyecto: 1, created_at: "2026-07-03T10:00:00Z" },
      { tipo: "salida",  material: "cemento gris", descripcion: "Cemento Gris", categoria: "materiales", unidad: "bulto", cantidad: 4, id_proyecto: 1, created_at: "2026-07-04T10:00:00Z" },
      { tipo: "entrada", material: "arena",        descripcion: "Arena",        categoria: "materiales", unidad: "m3",    cantidad: 2, id_proyecto: 1, created_at: "2026-07-02T10:00:00Z" },
    ]);

    const stock = await inventario.stockActual();

    expect(stock).toHaveLength(2);
    const cemento = stock.find(s => s.material === "cemento gris");
    expect(cemento.cantidad).toBe(11); // 10 + 5 - 4
    expect(cemento.descripcion).toBe("Cemento gris 50kg"); // la de la última entrada
    expect(cemento.ultima_entrada).toBe("2026-07-03T10:00:00Z");
    expect(cemento.ultima_salida).toBe("2026-07-04T10:00:00Z");
  });

  it("separa el mismo material por unidad", async () => {
    setupSelect([
      { tipo: "entrada", material: "cemento", descripcion: "Cemento", unidad: "bulto", cantidad: 3, id_proyecto: 1, created_at: "2026-07-01T10:00:00Z" },
      { tipo: "entrada", material: "cemento", descripcion: "Cemento", unidad: "kg",    cantidad: 50, id_proyecto: 1, created_at: "2026-07-01T10:00:00Z" },
    ]);
    const stock = await inventario.stockActual();
    expect(stock).toHaveLength(2);
  });
});
