const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

// SEG-05: flags a login from an IP different from the last one on record, so the caller can
// send a "new login" email. The very first login ever (no ultima_ip_login yet) is never
// flagged — there is nothing to compare against, and it would just be noise right after
// registration. Always records the new IP/timestamp, whether or not it turned out to be new.
async function registrarLogin(id_usuario, ip) {
  const { data: previo } = await supabase.schema(SCHEMA).from('usuarios')
    .select('ultima_ip_login')
    .eq('id_usuario', id_usuario)
    .single();

  const esNuevaIp = !!previo?.ultima_ip_login && previo.ultima_ip_login !== ip;

  await supabase.schema(SCHEMA).from('usuarios')
    .update({ ultima_ip_login: ip, ultimo_login_en: new Date().toISOString() })
    .eq('id_usuario', id_usuario);

  return { esNuevaIp };
}

module.exports = { registrarLogin };
