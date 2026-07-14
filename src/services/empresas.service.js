// ALI-01/ALI-02: validation and lookup helpers for empresa_aliada, shared by
// the empresas, gastos and requerimientos controllers.
const supabase = require("../config/supabase");
const SCHEMA   = "condor";

// DIAN check-digit weights, applied right-to-left over the NIT base number.
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

function computeNitDv(nitBase) {
  const digits = String(nitBase).split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (NIT_WEIGHTS[i] || 0);
  }
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
}

// Accepts "900123456", "900.123.456-7" or "900123456-7". When the check digit
// is present it is verified with the DIAN algorithm.
function validarNit(raw) {
  const nit = String(raw || "").replace(/[.\s]/g, "");
  if (!/^\d{5,15}(-\d)?$/.test(nit)) {
    return { error: "NIT inválido. Usa solo dígitos, opcionalmente con dígito de verificación (ej: 900123456-7)." };
  }
  const [base, dv] = nit.split("-");
  if (dv !== undefined && computeNitDv(base) !== Number(dv)) {
    return { error: `El dígito de verificación no corresponde: para el NIT ${base} debería ser ${computeNitDv(base)}.` };
  }
  return { value: nit };
}

// RUP: registration number in the Registro Único de Proponentes (digits only).
function validarRup(raw) {
  const rup = String(raw || "").trim();
  if (!/^\d{4,15}$/.test(rup)) {
    return { error: "RUP inválido: se espera el número de inscripción en el Registro Único de Proponentes (solo dígitos, entre 4 y 15)." };
  }
  return { value: rup };
}

// Activity codes (UNSPSC/CIIU): 2 to 8 digits each. Accepts an array or a
// comma-separated string; returns a deduplicated clean array.
function validarCodigosActividad(raw) {
  if (raw == null || raw === "") return { value: [] };
  const list  = Array.isArray(raw) ? raw : String(raw).split(",");
  const clean = list.map(c => String(c).trim()).filter(Boolean);
  for (const c of clean) {
    if (!/^\d{2,8}$/.test(c)) {
      return { error: `Código de actividad inválido: "${c}" (se esperan solo dígitos, entre 2 y 8).` };
    }
  }
  return { value: [...new Set(clean)] };
}

// Returns the active empresa row or null. Used before linking a gasto or a
// desembolso to an empresa (ALI-02).
async function findActiva(idEmpresa) {
  const id = Number(idEmpresa);
  if (!id) return null;
  const { data } = await supabase.schema(SCHEMA)
    .from("empresa_aliada")
    .select("id_empresa, razon_social, nit, activo")
    .eq("id_empresa", id)
    .single();
  return data?.activo ? data : null;
}

module.exports = { computeNitDv, validarNit, validarRup, validarCodigosActividad, findActiva, NIT_WEIGHTS };
