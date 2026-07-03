const supabase = require('../config/supabase');
const SCHEMA   = 'condor';

// Roles that already carry a specific function in the platform — these are never auto-promoted
// when a venta is registered. Anything outside this set (including a NULL id_rol) is eligible.
// Keep in sync with condor.roles.nombre values.
const PROTECTED_ROLES = new Set([
  'admin',
  'auxiliar_contable',
  'asesor',
  'asesor_comercial',
  'gerencia',
  'juridico',
  'comisionista',
  'auditoria',
]);

const COMPRADOR_ROL = 'comprador';

async function _findCompradorRolId() {
  const { data } = await supabase.schema(SCHEMA)
    .from('roles').select('id_rol').eq('nombre', COMPRADOR_ROL).single();
  return data?.id_rol ?? null;
}

// Promotes a user to 'comprador' when their first venta is registered.
// Skipped when the user is already a comprador or holds a protected (functional) role.
// Never throws: failures are reported in the result so the caller can keep the sale alive.
async function promoverACompradorSiAplica(id_usuario) {
  if (!id_usuario) return { promoted: false, reason: 'sin_id_usuario' };

  try {
    const { data: usuario, error: eUser } = await supabase.schema(SCHEMA)
      .from('usuarios')
      .select('id_usuario, id_rol, email, nombres, apellidos, roles:id_rol(nombre)')
      .eq('id_usuario', id_usuario)
      .single();

    if (eUser || !usuario) {
      return { promoted: false, reason: 'usuario_no_encontrado', error: eUser?.message };
    }

    const prevRolName = usuario.roles?.nombre ?? null;

    if (prevRolName === COMPRADOR_ROL) {
      return { promoted: false, reason: 'ya_comprador', usuario, prevRolName };
    }
    if (prevRolName && PROTECTED_ROLES.has(prevRolName)) {
      return { promoted: false, reason: 'rol_protegido', usuario, prevRolName };
    }

    const idCompradorRol = await _findCompradorRolId();
    if (!idCompradorRol) {
      return { promoted: false, reason: 'rol_comprador_no_existe' };
    }

    const { error: eUpd } = await supabase.schema(SCHEMA)
      .from('usuarios')
      .update({ id_rol: idCompradorRol })
      .eq('id_usuario', id_usuario);

    if (eUpd) {
      return { promoted: false, reason: 'update_falla', error: eUpd.message };
    }

    return {
      promoted:    true,
      usuario,
      prevRolName,
      newRolName:  COMPRADOR_ROL,
      idCompradorRol,
    };
  } catch (err) {
    return { promoted: false, reason: 'exception', error: err.message };
  }
}

module.exports = { promoverACompradorSiAplica, PROTECTED_ROLES, COMPRADOR_ROL };
