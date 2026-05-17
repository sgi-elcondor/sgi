const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

/**
 * @param {{ tabla: string, id: number|string, campo: string, anterior?: any, nuevo?: any, usuario: string, motivo?: string }} entry
 */
async function log({ tabla, id, campo, anterior = null, nuevo = null, usuario, motivo = null }) {
  await supabase.schema(SCHEMA).from('auditoria').insert([{
    tabla_afectada: tabla,
    id_registro:    id,
    campo,
    valor_anterior: anterior !== null ? String(anterior) : null,
    valor_nuevo:    nuevo    !== null ? String(nuevo)    : null,
    usuario_db:     usuario,
    motivo,
  }]);
}

module.exports = { log };
