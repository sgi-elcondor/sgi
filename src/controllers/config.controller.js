const configService = require("../services/config.service");
const auditoria     = require("../services/auditoria.service");

const SCHEMA = "condor";

// Whitelist of keys editable via the API. Anything outside the list is
// rejected — the config table can grow, but each new key must be added here
// consciously to prevent arbitrary side effects.
const EDITABLE_KEYS = {
  umbral_compra_grande: {
    tipo: "number",
    validate: (v) => Number.isFinite(v) && v > 0 ? null : "Debe ser un número positivo.",
    // POL-04: the three purchase tiers must never overlap.
    validateRelated: async (v) => {
      const caja = Number(await configService.get("umbral_caja_menor"));
      return Number.isFinite(caja) && v <= caja
        ? `Debe ser mayor que el tope de caja menor ($${caja.toLocaleString("es-CO")}); de lo contrario desaparecería la compra estándar.`
        : null;
    },
  },
  umbral_caja_menor: {
    tipo: "number",
    validate: (v) => Number.isFinite(v) && v > 0 ? null : "Debe ser un número positivo.",
    validateRelated: async (v) => {
      const grande = Number(await configService.get("umbral_compra_grande"));
      return Number.isFinite(grande) && v >= grande
        ? `Debe ser menor que el umbral de compra grande ($${grande.toLocaleString("es-CO")}); la doble firma nunca se salta.`
        : null;
    },
  },
};

// SEG-09: /config/:clave has a non-numeric param, so the permission middleware
// (which only strips numeric segments) never matches its ROUTE_PERMISSIONS key.
// Authorization for those routes must therefore be enforced here.
function _puedeConfig(req, accion) {
  return req.usuario?.rol === "admin" || req.usuario?.permisos?.has(`config:${accion}`);
}

// GET /api/v1/config
async function listar(req, res) {
  try {
    const rows = await configService.listar();
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v1/config/:clave
async function get(req, res) {
  try {
    if (!_puedeConfig(req, "leer")) {
      return res.status(403).json({ error: "No tienes permiso para consultar la configuración", requerido: "config:leer" });
    }
    const value = await configService.get(req.params.clave);
    if (value === null) return res.status(404).json({ error: "Clave no encontrada" });
    return res.json({ clave: req.params.clave, valor: value });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/config/:clave  Body: { valor }
async function actualizar(req, res) {
  try {
    if (!_puedeConfig(req, "actualizar")) {
      return res.status(403).json({ error: "No tienes permiso para modificar la configuración", requerido: "config:actualizar" });
    }
    const clave = req.params.clave;
    const rule  = EDITABLE_KEYS[clave];
    if (!rule) return res.status(400).json({ error: `La clave '${clave}' no es editable desde la API.` });

    let valor = req.body?.valor;
    if (valor === undefined || valor === null || valor === "") {
      return res.status(422).json({ error: "El valor es obligatorio." });
    }

    if (rule.tipo === "number") valor = Number(valor);
    const errValidacion = rule.validate ? rule.validate(valor) : null;
    if (errValidacion) return res.status(422).json({ error: errValidacion });

    const errRelacion = rule.validateRelated ? await rule.validateRelated(valor) : null;
    if (errRelacion) return res.status(422).json({ error: errRelacion });

    const previo = await configService.get(clave);

    const fresh = await configService.set(clave, valor, req.usuario.id_usuario);

    await auditoria.log({
      tabla:    "config_sistema",
      id:       0,
      campo:    clave,
      anterior: previo == null ? null : String(previo),
      nuevo:    String(valor),
      usuario:  req.usuario.email,
      motivo:   "actualizacion_config",
    });

    return res.json({ ok: true, clave, valor: fresh.valor_typed, updated_at: fresh.updated_at });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { listar, get, actualizar, EDITABLE_KEYS };
