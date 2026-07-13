jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const { registrarLogin } = require('../src/services/login-alert.service');

beforeEach(() => jest.clearAllMocks());

function setupFromMock(previo) {
  const updateEq = jest.fn().mockResolvedValue({ error: null });
  supabase.schema.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: previo }),
        }),
      }),
      update: jest.fn().mockReturnValue({ eq: updateEq }),
    }),
  });
  return { updateEq };
}

describe('registrarLogin', () => {
  it('is not flagged as new on the very first login (no previous IP on record)', async () => {
    setupFromMock(null);
    const result = await registrarLogin(1, '1.2.3.4');
    expect(result.esNuevaIp).toBe(false);
  });

  it('is not flagged when the IP matches the last one on record', async () => {
    setupFromMock({ ultima_ip_login: '1.2.3.4' });
    const result = await registrarLogin(1, '1.2.3.4');
    expect(result.esNuevaIp).toBe(false);
  });

  it('is flagged when the IP differs from the last one on record', async () => {
    setupFromMock({ ultima_ip_login: '1.2.3.4' });
    const result = await registrarLogin(1, '9.9.9.9');
    expect(result.esNuevaIp).toBe(true);
  });

  it('always records the latest IP and timestamp', async () => {
    const { updateEq } = setupFromMock({ ultima_ip_login: '1.2.3.4' });
    await registrarLogin(1, '9.9.9.9');
    expect(updateEq).toHaveBeenCalledWith('id_usuario', 1);
  });
});
