jest.mock("../src/config/supabase");
const supabase = require("../src/config/supabase");
const notif    = require("../src/services/notificaciones.service");

beforeEach(() => jest.clearAllMocks());

// Table-aware mock: roles resolves .single(), usuarios chains two .eq(), and
// notificacion captures the inserted rows.
function setup({ rol = { id_rol: 8 }, usuariosRol = [], insertError = null } = {}) {
  const inserted = [];
  supabase.schema.mockReturnValue({
    from: jest.fn((table) => {
      if (table === "roles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: rol, error: null }),
            })),
          })),
        };
      }
      if (table === "usuarios") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: usuariosRol, error: null }),
            })),
          })),
        };
      }
      // notificacion
      return {
        insert: jest.fn((rows) => {
          inserted.push(...rows);
          return Promise.resolve({ error: insertError });
        }),
      };
    }),
  });
  return inserted;
}

describe("notificaciones.crear", () => {
  it("inserta una fila por cada destinatario (ids + rol, deduplicados)", async () => {
    const inserted = setup({ usuariosRol: [{ id_usuario: 5 }, { id_usuario: 7 }] });

    const n = await notif.crear({
      paraIds:   [5, 9],
      paraRoles: ["jefe_area"],
      titulo:    "Nuevo requerimiento REQ-1",
      vista:     "aprobaciones",
    });

    expect(n).toBe(3); // 5 (dedupe), 7, 9
    expect(inserted.map(r => r.id_usuario).sort()).toEqual([5, 7, 9]);
    expect(inserted[0].titulo).toBe("Nuevo requerimiento REQ-1");
  });

  it("excluye al autor de la acción (excepto)", async () => {
    const inserted = setup();

    const n = await notif.crear({
      paraIds: [3, 4],
      excepto: 3,
      titulo:  "REQ-2 aprobado",
    });

    expect(n).toBe(1);
    expect(inserted.map(r => r.id_usuario)).toEqual([4]);
  });

  it("devuelve 0 sin insertar cuando no hay destinatarios", async () => {
    const inserted = setup();
    const n = await notif.crear({ paraIds: [3], excepto: 3, titulo: "x" });
    expect(n).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("devuelve 0 sin titulo", async () => {
    setup();
    expect(await notif.crear({ paraIds: [1] })).toBe(0);
  });

  it("no lanza si el insert falla (best-effort)", async () => {
    setup({ insertError: { message: "boom" } });
    await expect(notif.crear({ paraIds: [1], titulo: "x" })).resolves.toBe(0);
  });
});
