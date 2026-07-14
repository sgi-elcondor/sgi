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
  },
  umbral_caja_menor: {
    tipo: "number",
    validate: (v) => Number.isFinite(v) && v > 0 ? null : "Debe ser un número positivo.",
  },
};

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
