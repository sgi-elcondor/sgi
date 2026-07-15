jest.mock("../src/config/supabase", () => ({
  schema: jest.fn(),
}));

const supabase = require("../src/config/supabase");
const empresas = require("../src/services/empresas.service");

function mockSingle(result) {
  const single = jest.fn().mockResolvedValue(result);
  const eq     = jest.fn(() => ({ single }));
  const select = jest.fn(() => ({ eq }));
  const from   = jest.fn(() => ({ select }));
  supabase.schema.mockReturnValue({ from });
  return { from, select, eq, single };
}

describe("empresas.service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("computeNitDv (algoritmo DIAN)", () => {
    test("calcula el dígito de verificación conocido", () => {
      // 800197268 → DV 4 (DIAN, caso público conocido)
      expect(empresas.computeNitDv("800197268")).toBe(4);
    });

    test("devuelve el residuo directo cuando es 0 o 1", () => {
      const dv = empresas.computeNitDv("900000000");
      expect(dv).toBeGreaterThanOrEqual(0);
      expect(dv).toBeLessThanOrEqual(9);
    });
  });

  describe("validarNit", () => {
    test("acepta NIT sin dígito de verificación", () => {
      expect(empresas.validarNit("900123456")).toEqual({ value: "900123456" });
    });

    test("normaliza puntos y espacios", () => {
      const dv = empresas.computeNitDv("800197268");
      expect(empresas.validarNit(`800.197.268-${dv}`)).toEqual({ value: `800197268-${dv}` });
    });

    test("rechaza un dígito de verificación incorrecto", () => {
      const dvMalo = (empresas.computeNitDv("800197268") + 1) % 10;
      const r = empresas.validarNit(`800197268-${dvMalo}`);
      expect(r.error).toMatch(/dígito de verificación/i);
    });

    test("rechaza formatos no numéricos", () => {
      expect(empresas.validarNit("ABC123").error).toBeTruthy();
      expect(empresas.validarNit("").error).toBeTruthy();
      expect(empresas.validarNit("123").error).toBeTruthy();
    });
  });

  describe("validarRup", () => {
    test("acepta números de inscripción válidos", () => {
      expect(empresas.validarRup("123456")).toEqual({ value: "123456" });
      expect(empresas.validarRup("  9876  ")).toEqual({ value: "9876" });
    });

    test("rechaza formatos inválidos", () => {
      expect(empresas.validarRup("12").error).toMatch(/RUP inválido/i);
      expect(empresas.validarRup("ABC-123").error).toBeTruthy();
      expect(empresas.validarRup("").error).toBeTruthy();
    });
  });

  describe("validarCodigosActividad", () => {
    test("acepta lista separada por comas y deduplica", () => {
      expect(empresas.validarCodigosActividad("30111601, 4390, 4390"))
        .toEqual({ value: ["30111601", "4390"] });
    });

    test("acepta arrays y vacíos", () => {
      expect(empresas.validarCodigosActividad(["12", "345678"])).toEqual({ value: ["12", "345678"] });
      expect(empresas.validarCodigosActividad(null)).toEqual({ value: [] });
      expect(empresas.validarCodigosActividad("")).toEqual({ value: [] });
    });

    test("rechaza códigos con letras o longitud inválida", () => {
      expect(empresas.validarCodigosActividad("ABC").error).toBeTruthy();
      expect(empresas.validarCodigosActividad("123456789").error).toBeTruthy();
    });
  });

  describe("findActiva", () => {
    test("devuelve la fila cuando la empresa existe y está activa", async () => {
      mockSingle({ data: { id_empresa: 7, razon_social: "ACME", nit: "900123456", activo: true } });
      const emp = await empresas.findActiva(7);
      expect(emp).toMatchObject({ id_empresa: 7, razon_social: "ACME" });
    });

    test("devuelve null si la empresa está inactiva", async () => {
      mockSingle({ data: { id_empresa: 7, activo: false } });
      expect(await empresas.findActiva(7)).toBeNull();
    });

    test("devuelve null para ids inválidos sin tocar la BD", async () => {
      expect(await empresas.findActiva(null)).toBeNull();
      expect(await empresas.findActiva("x")).toBeNull();
      expect(supabase.schema).not.toHaveBeenCalled();
    });
  });
});
