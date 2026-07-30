jest.mock('../src/config/supabase');
const supabase = require('../src/config/supabase');
const { log } = require('../src/services/auditoria.service');

let inserted;

beforeEach(() => {
  jest.clearAllMocks();
  inserted = null;
  supabase.schema.mockReturnValue({
    from: jest.fn(() => ({
      insert: jest.fn((rows) => {
        inserted = rows;
        return Promise.resolve({ error: null });
      }),
    })),
  });
});

// Every audited operation in the system depends on this row shape: the columns
// are what the auditoría view and the trazabilidad timeline read back.
describe('auditoria.log', () => {
  it('mapea los campos a las columnas de condor.auditoria', async () => {
    await log({
      tabla: 'venta',
      id: 12,
      campo: 'estado',
      anterior: 'vigente',
      nuevo: 'cancelada',
      usuario: 'aux@condor.co',
      motivo: 'cancelacion_solicitada',
    });

    expect(supabase.schema).toHaveBeenCalledWith('condor');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toEqual({
      tabla_afectada: 'venta',
      id_registro:    12,
      campo:          'estado',
      valor_anterior: 'vigente',
      valor_nuevo:    'cancelada',
      usuario_db:     'aux@condor.co',
      motivo:         'cancelacion_solicitada',
    });
  });

  it('convierte a texto los valores no string, para no perder el dato numérico', async () => {
    await log({ tabla: 'cuota', id: 3, campo: 'valor_cuota', anterior: 1000, nuevo: 2500, usuario: 'x@y.z' });

    expect(inserted[0].valor_anterior).toBe('1000');
    expect(inserted[0].valor_nuevo).toBe('2500');
  });

  it('deja en null los extremos ausentes y el motivo omitido', async () => {
    await log({ tabla: 'lote', id: 5, campo: 'precio_base', nuevo: 900, usuario: 'x@y.z' });

    expect(inserted[0].valor_anterior).toBeNull();
    expect(inserted[0].valor_nuevo).toBe('900');
    expect(inserted[0].motivo).toBeNull();
  });

  it('preserva el valor false en lugar de tratarlo como ausente', async () => {
    await log({ tabla: 'venta_comisionista', id: 8, campo: 'causada', anterior: false, nuevo: true, usuario: 'x@y.z' });

    expect(inserted[0].valor_anterior).toBe('false');
    expect(inserted[0].valor_nuevo).toBe('true');
  });

  it('conserva el cero como valor auditado, no como vacío', async () => {
    await log({ tabla: 'cuota', id: 1, campo: 'valor_pagado', anterior: 0, nuevo: 500, usuario: 'x@y.z' });

    expect(inserted[0].valor_anterior).toBe('0');
  });
});
