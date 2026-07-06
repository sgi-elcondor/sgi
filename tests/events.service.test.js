const events = require("../src/services/events.service");

function fakeRes() {
  return { write: jest.fn() };
}

describe("events.service (SSE hub)", () => {
  test("emit entrega el payload a los suscriptores", () => {
    const res = fakeRes();
    const unsubscribe = events.subscribe(res, { id_usuario: 1 });

    const sent = events.emit({ tipo: "requerimiento", numero: "REQ-1", estado: "aprobado_jefe" });

    expect(sent).toBe(1);
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"numero":"REQ-1"')
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.stringMatching(/^data: .*\n\n$/s)
    );
    unsubscribe();
  });

  test("unsubscribe deja de entregar eventos", () => {
    const res = fakeRes();
    const unsubscribe = events.subscribe(res, { id_usuario: 2 });
    unsubscribe();

    const sent = events.emit({ tipo: "requerimiento", numero: "REQ-2" });

    expect(sent).toBe(0);
    expect(res.write).not.toHaveBeenCalledWith(expect.stringContaining("REQ-2"));
  });

  test("una conexion rota se descarta sin afectar a las demas", () => {
    const rota  = { write: jest.fn(() => { throw new Error("EPIPE"); }) };
    const sana  = fakeRes();
    const un1 = events.subscribe(rota, { id_usuario: 3 });
    const un2 = events.subscribe(sana, { id_usuario: 4 });

    const sent = events.emit({ tipo: "requerimiento", numero: "REQ-3" });

    expect(sent).toBe(1);
    expect(sana.write).toHaveBeenCalledWith(expect.stringContaining("REQ-3"));
    expect(events.connectedCount()).toBe(1);

    un1();
    un2();
  });

  test("emit sin clientes no falla y devuelve 0", () => {
    expect(events.emit({ tipo: "requerimiento", numero: "REQ-4" })).toBe(0);
  });
});
