// Minimal, dependency-free fixed-window rate limiter keyed by client IP. It is NOT a substitute
// for a real WAF/edge limiter, but it blunts brute-force and email-spam on the public auth
// routes (login, password reset) which otherwise have no throttle. Relies on `trust proxy`
// (set in index.js) so req.ip reflects the real client behind the TLS proxy.
const _buckets = new Map(); // key -> { count, resetAt }

function rateLimit({ windowMs = 60_000, max = 30, keyGenerator = null } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = keyGenerator ? `${ip}:${keyGenerator(req)}` : ip;

    let bucket = _buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      _buckets.set(key, bucket);
    }
    bucket.count++;

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error:       'Demasiadas solicitudes. Intenta de nuevo en un momento.',
        retry_after: retryAfter,
      });
    }
    next();
  };
}

// Periodic cleanup so the map cannot grow unbounded from one-off IPs.
const _sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of _buckets) {
    if (now > bucket.resetAt) _buckets.delete(key);
  }
}, 5 * 60_000);
_sweep.unref?.();

module.exports = { rateLimit };
