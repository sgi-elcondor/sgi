const notificaciones = require("../services/notificaciones.service");

// GET /api/v1/notificaciones — the caller's latest notifications + unread count.
async function getMias(req, res) {
  try {
    const [items, noLeidas] = await Promise.all([
      notificaciones.listar(req.usuario.id_usuario),
      notificaciones.contarNoLeidas(req.usuario.id_usuario),
    ]);
    return res.json({ items, no_leidas: noLeidas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/v1/notificaciones/leidas — body { ids?: number[] }; all when omitted.
async function marcarLeidas(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) && req.body.ids.length ? req.body.ids : null;
    await notificaciones.marcarLeidas(req.usuario.id_usuario, ids);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getMias, marcarLeidas };
