// public/js/api.js

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("fb_token");

  if (!token) {
    window.location.href = "/login";
    return;
  }

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  };

  let response = await fetch(endpoint, config);

  if (response.status === 401) {
    // SEG-04: the server already revoked the refresh token behind this session (monthly forced
    // relogin, or a 2FA/account lockout event). Retrying getIdToken(true) would just fail against
    // Firebase a moment later — skip straight to /login instead of burning a round trip on it.
    let code = null;
    try { code = (await response.clone().json())?.code || null; } catch {}
    if (code === 'SESION_REVOCADA') {
      localStorage.removeItem("fb_token");
      window.location.href = "/login";
      return;
    }

    try {
      // Espera a que Firebase resuelva el estado de auth antes de decidir
      if (window._authReady) await window._authReady;

      const auth = window._firebaseAuth;
      const user = auth?.currentUser;

      if (user) {
        const newToken = await user.getIdToken(true);
        localStorage.setItem("fb_token", newToken);
        config.headers.Authorization = `Bearer ${newToken}`;
        response = await fetch(endpoint, config);
      } else {
        // Only redirect if Firebase confirms there is no active session
        localStorage.removeItem("fb_token");
        window.location.href = "/login";
        return;
      }
    } catch {
      // Token refresh error — only redirect if there is no active session
      if (!window._firebaseAuth?.currentUser) {
        window.location.href = "/login";
        return;
      }
    }
  }

  return response;
}

// Client-side cache for stable catalogs (proyectos, lotes, roles...). Opt-in via getCached();
// plain get() is never cached. Any mutation (POST/PUT/PATCH/DELETE) auto-invalidates the cached
// GETs of the same top-level resource, so a cached catalog never outlives a change to it.
const _cache = new Map(); // path -> { data, ts, revalidating }

function _clone(d) {
  if (d == null) return d;
  return typeof structuredClone === "function" ? structuredClone(d) : JSON.parse(JSON.stringify(d));
}

const API = {
  base: "/api/v1",

  async request(path, options = {}) {
    const method     = options.method || "GET";
    const isMutation = method !== "GET";

    if (isMutation) window.UI?.showGlobalLoading();

    try {
      const response = await apiFetch(this.base + path, {
        method,
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response) return null;

      let data = null;
      try {
        data = await response.json();
      } catch {}

      if (!response.ok) {
        const err = new Error(data?.error || response.statusText || "Error en la solicitud");
        err.status = response.status;
        err.code   = data?.code || null;
        throw err;
      }

      // A successful write to a resource invalidates its cached reads (e.g. POST /proyectos
      // clears cached GET /proyectos and GET /proyectos/123).
      if (isMutation) {
        const resource = "/" + path.replace(/^\//, "").split(/[/?]/)[0];
        this.invalidate(resource);
      }

      return data;
    } finally {
      if (isMutation) window.UI?.hideGlobalLoading();
    }
  },

  get(path) {
    return this.request(path);
  },

  // Cached GET for stable catalogs. Returns a clone (so callers can sort/mutate freely). Within
  // `ttl` the cached value is returned as-is; past it, with `swr` the stale value is returned
  // immediately and refreshed in the background for the next read.
  async getCached(path, { ttl = 60000, swr = true } = {}) {
    const entry = _cache.get(path);
    const fresh = entry && (Date.now() - entry.ts) < ttl;

    if (entry && (fresh || swr)) {
      if (!fresh) this._revalidate(path);
      return _clone(entry.data);
    }

    const data = await this.get(path);
    _cache.set(path, { data, ts: Date.now(), revalidating: false });
    return _clone(data);
  },

  _revalidate(path) {
    const entry = _cache.get(path);
    if (!entry || entry.revalidating) return;
    entry.revalidating = true;
    this.get(path)
      .then((data) => _cache.set(path, { data, ts: Date.now(), revalidating: false }))
      .catch(() => { entry.revalidating = false; });
  },

  // Remove cached reads whose path equals or starts with `prefix`.
  invalidate(prefix) {
    for (const key of [..._cache.keys()]) {
      if (key === prefix || key.startsWith(prefix + "/") || key.startsWith(prefix + "?")) {
        _cache.delete(key);
      }
    }
  },

  post(path, body) {
    return this.request(path, { method: "POST", body });
  },

  put(path, body) {
    return this.request(path, { method: "PUT", body });
  },

  patch(path, body) {
    return this.request(path, { method: "PATCH", body });
  },

  delete(path, body) {
    return this.request(path, { method: "DELETE", body });
  },
};

window.API = API;