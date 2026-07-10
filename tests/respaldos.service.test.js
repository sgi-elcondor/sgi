jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const {
  listar,
  obtener,
  crearSolicitudRestauracion,
  obtenerRestauracion,
  marcarRestauracionFallida,
  dispararWorkflowRestore,
} = require('../src/services/respaldos.service');

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.GITHUB_PAT;
  global.fetch = jest.fn();
});

describe('listar', () => {
  it('excludes purged rows and orders by fecha descending', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [{ id_respaldo: 1, estado: 'completado' }],
      error: null,
    });
    const neq   = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ neq });
    supabase.schema.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) });

    const result = await listar();

    expect(neq).toHaveBeenCalledWith('estado', 'purgado');
    expect(order).toHaveBeenCalledWith('fecha', { ascending: false });
    expect(result).toEqual([{ id_respaldo: 1, estado: 'completado' }]);
  });

  it('throws when the query errors', async () => {
    const order  = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const neq    = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ neq });
    supabase.schema.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) });

    await expect(listar()).rejects.toThrow('boom');
  });
});

describe('obtener / obtenerRestauracion', () => {
  it('obtener returns null when the row does not exist', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq          = jest.fn().mockReturnValue({ maybeSingle });
    const select      = jest.fn().mockReturnValue({ eq });
    supabase.schema.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) });

    expect(await obtener(999)).toBeNull();
  });

  it('obtenerRestauracion returns the row', async () => {
    const row = { id_restauracion: 5, estado: 'en_progreso' };
    const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
    const eq          = jest.fn().mockReturnValue({ maybeSingle });
    const select      = jest.fn().mockReturnValue({ eq });
    supabase.schema.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) });

    expect(await obtenerRestauracion(5)).toEqual(row);
  });
});

describe('crearSolicitudRestauracion', () => {
  it('inserts a row with the given scope and requester', async () => {
    const inserted = { id_restauracion: 1, id_respaldo: 10, alcance: 'ALL', estado: 'en_progreso' };
    const single = jest.fn().mockResolvedValue({ data: inserted, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    supabase.schema.mockReturnValue({ from: jest.fn().mockReturnValue({ insert }) });

    const result = await crearSolicitudRestauracion({ id_respaldo: 10, alcance: 'ALL', id_usuario: 3 });

    expect(insert).toHaveBeenCalledWith([{ id_respaldo: 10, alcance: 'ALL', solicitado_por: 3 }]);
    expect(result).toEqual(inserted);
  });
});

describe('marcarRestauracionFallida', () => {
  it('updates estado, detalle and finalizado_en', async () => {
    const eq     = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    supabase.schema.mockReturnValue({ from: jest.fn().mockReturnValue({ update }) });

    await marcarRestauracionFallida(7, 'algo salió mal');

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'fallido',
      detalle: 'algo salió mal',
    }));
    expect(eq).toHaveBeenCalledWith('id_restauracion', 7);
  });
});

describe('dispararWorkflowRestore', () => {
  it('throws when GITHUB_PAT is not configured', async () => {
    await expect(dispararWorkflowRestore({
      id_restauracion: 1, id_respaldo: 2, alcance: 'ALL', ubicacion: 'x',
    })).rejects.toThrow('GITHUB_PAT');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls the GitHub workflow_dispatch endpoint with the expected inputs', async () => {
    process.env.GITHUB_PAT = 'test-token';
    global.fetch.mockResolvedValue({ ok: true });

    await dispararWorkflowRestore({
      id_restauracion: 1, id_respaldo: 2, alcance: 'venta', ubicacion: 'diarios/x.dump', ubicacion_r2: 'diarios/x.dump',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/actions/workflows/restore.yml/dispatches'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.inputs).toEqual({
      id_respaldo: '2', alcance: 'venta', id_restauracion: '1',
      ubicacion: 'diarios/x.dump', ubicacion_r2: 'diarios/x.dump',
    });
  });

  it('throws with the response body when GitHub returns a non-ok status', async () => {
    process.env.GITHUB_PAT = 'test-token';
    global.fetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('not found') });

    await expect(dispararWorkflowRestore({
      id_restauracion: 1, id_respaldo: 2, alcance: 'ALL', ubicacion: 'x',
    })).rejects.toThrow('404');
  });
});
