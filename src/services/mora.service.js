const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

async function actualizarMora() {
  const { data, error } = await supabase.schema(SCHEMA).rpc('actualizar_mora');
  if (error) throw new Error(error.message);
  console.log('[mora]', JSON.stringify(data));
  return data;
}

module.exports = { actualizarMora };
