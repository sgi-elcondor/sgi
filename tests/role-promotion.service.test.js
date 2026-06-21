jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const { promoverACompradorSiAplica, PROTECTED_ROLES, COMPRADOR_ROL } = require('../src/services/role-promotion.service');

beforeEach(() => jest.clearAllMocks());

// Per-table mock. `usuarios.select().eq().single()` returns the user payload;
// `roles.select().eq().single()` returns the comprador rol row;
// `usuarios.update().eq()` resolves with the configured error/data.
function setup({ usuarioRow, usuarioErr, compradorRolRow, updateError } = {}) {
  const updateEq = jest.fn().mockResolvedValue({ data: null, error: updateError ?? null });

  supabase.schema.mockReturnValue({
    from: jest.fn((table) => {
      if (table === 'usuarios') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: usuarioRow ?? null, error: usuarioErr ?? null }),
            })),
          })),
          update: jest.fn(() => ({ eq: updateEq })),
        };
      }
      if (table === 'roles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: compradorRolRow ?? null, error: null }),
            })),
          })),
        };
      }
      return { select: jest.fn(), update: jest.fn() };
    }),
  });

  return { updateEq };
}

describe('promoverACompradorSiAplica', () => {
  it('returns sin_id_usuario when no id is provided', async () => {
    const result = await promoverACompradorSiAplica(null);
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('sin_id_usuario');
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it('promotes a user with no functional role and reports the previous rol name', async () => {
    const { updateEq } = setup({
      usuarioRow:        { id_usuario: 7, id_rol: null, email: 'a@x.co', nombres: 'Ana', apellidos: 'Gil', roles: null },
      compradorRolRow:   { id_rol: 5 },
    });

    const result = await promoverACompradorSiAplica(7);

    expect(result.promoted).toBe(true);
    expect(result.prevRolName).toBeNull();
    expect(result.newRolName).toBe(COMPRADOR_ROL);
    expect(result.idCompradorRol).toBe(5);
    expect(updateEq).toHaveBeenCalledTimes(1);
  });

  it('skips a user that is already comprador', async () => {
    const { updateEq } = setup({
      usuarioRow:      { id_usuario: 7, id_rol: 5, email: 'a@x.co', roles: { nombre: 'comprador' } },
      compradorRolRow: { id_rol: 5 },
    });

    const result = await promoverACompradorSiAplica(7);

    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('ya_comprador');
    expect(updateEq).not.toHaveBeenCalled();
  });

  it.each([...PROTECTED_ROLES])('preserves the protected role %s', async (rolName) => {
    const { updateEq } = setup({
      usuarioRow:      { id_usuario: 9, id_rol: 2, email: 's@x.co', roles: { nombre: rolName } },
      compradorRolRow: { id_rol: 5 },
    });

    const result = await promoverACompradorSiAplica(9);

    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('rol_protegido');
    expect(result.prevRolName).toBe(rolName);
    expect(updateEq).not.toHaveBeenCalled();
  });

  it('returns usuario_no_encontrado when the lookup fails', async () => {
    setup({ usuarioRow: null, usuarioErr: { message: 'PGRST116' } });
    const result = await promoverACompradorSiAplica(999);
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('usuario_no_encontrado');
  });

  it('returns rol_comprador_no_existe when the comprador rol is missing', async () => {
    setup({
      usuarioRow:      { id_usuario: 7, id_rol: null, email: 'a@x.co', roles: null },
      compradorRolRow: null,
    });
    const result = await promoverACompradorSiAplica(7);
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('rol_comprador_no_existe');
  });

  it('returns update_falla and never throws when the update errors out', async () => {
    setup({
      usuarioRow:      { id_usuario: 7, id_rol: null, email: 'a@x.co', roles: null },
      compradorRolRow: { id_rol: 5 },
      updateError:     { message: 'duplicate key' },
    });
    const result = await promoverACompradorSiAplica(7);
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('update_falla');
    expect(result.error).toBe('duplicate key');
  });
});
