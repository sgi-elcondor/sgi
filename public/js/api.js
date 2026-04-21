// public/js/api.js

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('fb_token');

  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  };

  let response = await fetch(endpoint, config);

  // Token expirado → refresca usando la instancia global de Firebase
  if (response.status === 401) {
    try {
      const auth = window._firebaseAuth;
      const user = auth?.currentUser;

      if (user) {
        const newToken = await user.getIdToken(true);
        localStorage.setItem('fb_token', newToken);
        config.headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(endpoint, config); // reintenta UNA vez
      } else {
        window.location.href = '/login.html';
        return;
      }
    } catch {
      window.location.href = '/login.html';
      return;
    }
  }

  return response;
}

// ─────────────────────────────────────────────────────────
// API object
// ─────────────────────────────────────────────────────────
const API = {
  base: "/api",

  async get(path) {
    const r = await apiFetch(this.base + path);
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },

  async post(path, body) {
    const r = await apiFetch(this.base + path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },

  async put(path, body) {
    const r = await apiFetch(this.base + path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },

  async patch(path, body) {
    const r = await apiFetch(this.base + path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },

  async delete(path) {
    const r = await apiFetch(this.base + path, {
      method: "DELETE",
    });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
};