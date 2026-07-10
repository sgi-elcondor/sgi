const crypto = require('crypto');

jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const {
  crearChallenge, reenviarCodigo, verificarCodigo, limpiarExpirados,
} = require('../src/services/two-factor.service');

beforeEach(() => jest.clearAllMocks());

function sha256(v) {
  return crypto.createHash('sha256').update(v).digest('hex');
}

function setupFromMock({ maybeSingle, single, updateResult = { error: null }, deleteResult = { error: null } } = {}) {
  const updateEq = jest.fn().mockResolvedValue(updateResult);
  const deleteLt = jest.fn().mockResolvedValue(deleteResult);

  const chain = {
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(single ?? { data: null, error: null }),
      }),
    }),
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue(maybeSingle ?? { data: null }),
      }),
    }),
    update: jest.fn().mockReturnValue({ eq: updateEq }),
    delete: jest.fn().mockReturnValue({ lt: deleteLt }),
  };

  supabase.schema.mockReturnValue({ from: jest.fn().mockReturnValue(chain) });
  return { updateEq, deleteLt, chain };
}

const FUTURE = new Date(Date.now() + 5 * 60_000).toISOString();
const PAST   = new Date(Date.now() - 60_000).toISOString();

// ── crearChallenge ──────────────────────────────────────────────────────────

describe('crearChallenge', () => {
  it('returns a 6-digit code and the inserted challenge id', async () => {
    setupFromMock({ single: { data: { id_challenge: 'abc-123' }, error: null } });

    const result = await crearChallenge(5);

    expect(result.id_challenge).toBe('abc-123');
    expect(result.codigo).toMatch(/^\d{6}$/);
  });

  it('throws when the insert fails', async () => {
    setupFromMock({ single: { data: null, error: { message: 'insert failed' } } });
    await expect(crearChallenge(5)).rejects.toThrow('insert failed');
  });
});

// ── verificarCodigo ──────────────────────────────────────────────────────────

describe('verificarCodigo', () => {
  it('fails with CHALLENGE_INVALIDO when the challenge does not exist', async () => {
    setupFromMock({ maybeSingle: { data: null } });
    const result = await verificarCodigo('x', '123456');
    expect(result).toEqual({ ok: false, error: 'CHALLENGE_INVALIDO' });
  });

  it('fails with CHALLENGE_INVALIDO when already consumed', async () => {
    setupFromMock({
      maybeSingle: { data: {
        id_challenge: 'x', id_usuario: 1, codigo_hash: sha256('123456'),
        intentos: 0, expira_en: FUTURE, consumido_en: '2024-01-01T00:00:00Z',
      } },
    });
    const result = await verificarCodigo('x', '123456');
    expect(result).toEqual({ ok: false, error: 'CHALLENGE_INVALIDO' });
  });

  it('fails with CODIGO_EXPIRADO when past expira_en', async () => {
    setupFromMock({
      maybeSingle: { data: {
        id_challenge: 'x', id_usuario: 1, codigo_hash: sha256('123456'),
        intentos: 0, expira_en: PAST, consumido_en: null,
      } },
    });
    const result = await verificarCodigo('x', '123456');
    expect(result).toEqual({ ok: false, error: 'CODIGO_EXPIRADO' });
  });

  it('fails with MAX_INTENTOS when the attempt cap was already reached', async () => {
    setupFromMock({
      maybeSingle: { data: {
        id_challenge: 'x', id_usuario: 1, codigo_hash: sha256('123456'),
        intentos: 5, expira_en: FUTURE, consumido_en: null,
      } },
    });
    const result = await verificarCodigo('x', '123456');
    expect(result).toEqual({ ok: false, error: 'MAX_INTENTOS' });
  });

  it('increments intentos and fails with CODIGO_INCORRECTO on a wrong code', async () => {
    const { updateEq } = setupFromMock({
      maybeSingle: { data: {
        id_challenge: 'x', id_usuario: 9, codigo_hash: sha256('123456'),
        intentos: 1, expira_en: FUTURE, consumido_en: null,
      } },
    });
    const result = await verificarCodigo('x', '000000');
    expect(result).toEqual({ ok: false, error: 'CODIGO_INCORRECTO', id_usuario: 9 });
    expect(updateEq).toHaveBeenCalled();
  });

  it('marks the challenge consumed and returns ok on a matching code', async () => {
    const { updateEq } = setupFromMock({
      maybeSingle: { data: {
        id_challenge: 'x', id_usuario: 9, codigo_hash: sha256('123456'),
        intentos: 0, expira_en: FUTURE, consumido_en: null,
      } },
    });
    const result = await verificarCodigo('x', '123456');
    expect(result).toEqual({ ok: true, id_usuario: 9 });
    expect(updateEq).toHaveBeenCalled();
  });
});

// ── reenviarCodigo ───────────────────────────────────────────────────────────

describe('reenviarCodigo', () => {
  it('fails with CHALLENGE_INVALIDO when not found or consumed', async () => {
    setupFromMock({ maybeSingle: { data: null } });
    const result = await reenviarCodigo('x');
    expect(result).toEqual({ error: 'CHALLENGE_INVALIDO' });
  });

  it('fails with MAX_REENVIOS after 3 resends', async () => {
    setupFromMock({ maybeSingle: { data: { id_challenge: 'x', id_usuario: 1, reenvios: 3, consumido_en: null } } });
    const result = await reenviarCodigo('x');
    expect(result).toEqual({ error: 'MAX_REENVIOS' });
  });

  it('returns a new 6-digit code and the owning user', async () => {
    const { updateEq } = setupFromMock({ maybeSingle: { data: { id_challenge: 'x', id_usuario: 7, reenvios: 1, consumido_en: null } } });
    const result = await reenviarCodigo('x');
    expect(result.id_usuario).toBe(7);
    expect(result.codigo).toMatch(/^\d{6}$/);
    expect(updateEq).toHaveBeenCalled();
  });
});

// ── limpiarExpirados ─────────────────────────────────────────────────────────

describe('limpiarExpirados', () => {
  it('deletes challenges older than the given threshold', async () => {
    const { deleteLt } = setupFromMock({ deleteResult: { error: null } });
    await limpiarExpirados(2);
    expect(deleteLt).toHaveBeenCalledWith('creado_en', expect.any(String));
  });
});
