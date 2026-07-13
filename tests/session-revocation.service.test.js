jest.mock('../src/config/supabase');
jest.mock('../src/config/firebase', () => ({
  auth: jest.fn(),
}));

const supabase = require('../src/config/supabase');
const admin    = require('../src/config/firebase');
const { revocarSesionesVencidas } = require('../src/services/session-revocation.service');

beforeEach(() => jest.clearAllMocks());

function setupFromMock({ sinBaseline = [], vencidos = [] } = {}) {
  const updateEq = jest.fn().mockResolvedValue({ error: null });

  supabase.schema.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockImplementation(() => ({
        is: jest.fn().mockResolvedValue({ data: sinBaseline }),
        // .select().lt().not() chain for the "vencidos" query
        lt: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: vencidos }),
        }),
      })),
      update: jest.fn().mockReturnValue({ eq: updateEq }),
    }),
  });

  return { updateEq };
}

describe('revocarSesionesVencidas', () => {
  it('assigns a jittered baseline to users that never had one, without revoking them', async () => {
    const revokeRefreshTokens = jest.fn();
    admin.auth.mockReturnValue({ revokeRefreshTokens });

    const { updateEq } = setupFromMock({ sinBaseline: [{ id_usuario: 1 }, { id_usuario: 2 }] });

    const result = await revocarSesionesVencidas();

    expect(result.nuevosConBaseline).toBe(2);
    expect(updateEq).toHaveBeenCalledTimes(2);
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('revokes refresh tokens for users past the 30-day threshold and advances their baseline', async () => {
    const revokeRefreshTokens = jest.fn().mockResolvedValue();
    admin.auth.mockReturnValue({ revokeRefreshTokens });

    const { updateEq } = setupFromMock({
      vencidos: [{ id_usuario: 9, firebase_uid: 'uid-9' }],
    });

    const result = await revocarSesionesVencidas();

    expect(revokeRefreshTokens).toHaveBeenCalledWith('uid-9');
    expect(result.revocados).toBe(1);
    expect(updateEq).toHaveBeenCalled();
  });

  it('does not advance the baseline when revokeRefreshTokens fails', async () => {
    const revokeRefreshTokens = jest.fn().mockRejectedValue(new Error('firebase down'));
    admin.auth.mockReturnValue({ revokeRefreshTokens });

    const { updateEq } = setupFromMock({
      vencidos: [{ id_usuario: 9, firebase_uid: 'uid-9' }],
    });

    const result = await revocarSesionesVencidas();

    expect(result.revocados).toBe(0);
    expect(updateEq).not.toHaveBeenCalled();
  });
});
