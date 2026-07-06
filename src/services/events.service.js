// In-memory SSE hub for live requerimiento updates (REQ-07).
// Valid while the app runs as a single instance (Railway: 1 replica today).
// If the app ever scales horizontally, replace this with a shared bus
// (Redis pub/sub or Supabase Realtime consumed server-side).

const HEARTBEAT_MS = 30000;

const clients = new Map(); // id -> { res, id_usuario }
let nextId = 1;
let heartbeatTimer = null;

function _startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (!clients.size) return;
    for (const [id, c] of clients) {
      try { c.res.write(": ping\n\n"); } catch (_) { clients.delete(id); }
    }
  }, HEARTBEAT_MS);
  // Never keep the process alive just for pings (lets Jest and scripts exit).
  if (typeof heartbeatTimer.unref === "function") heartbeatTimer.unref();
}

// Registers an open SSE response. Returns the unsubscribe function.
function subscribe(res, usuario) {
  const id = nextId++;
  clients.set(id, { res, id_usuario: usuario?.id_usuario ?? null });
  _startHeartbeat();
  return () => clients.delete(id);
}

// Broadcasts an event to every connected client. Payload stays minimal
// (numero/estado): clients re-fetch their own endpoints, so authorization
// for the actual data is still enforced server-side on the refetch.
function emit(evento) {
  if (!clients.size) return 0;
  const payload = `data: ${JSON.stringify(evento)}\n\n`;
  let sent = 0;
  for (const [id, c] of clients) {
    try {
      c.res.write(payload);
      sent++;
    } catch (_) {
      clients.delete(id);
    }
  }
  return sent;
}

function connectedCount() {
  return clients.size;
}

module.exports = { subscribe, emit, connectedCount };
