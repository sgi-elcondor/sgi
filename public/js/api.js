// public/js/api.js

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("fb_token");

  if (!token) {
    window.location.href = "/login.html";
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
        window.location.href = "/login.html";
        return;
      }
    } catch {
      // Token refresh error — only redirect if there is no active session
      if (!window._firebaseAuth?.currentUser) {
        window.location.href = "/login.html";
        return;
      }
    }
  }

  return response;
}

const API = {
  base: "/api",

  async request(path, options = {}) {
    const response = await apiFetch(this.base + path, {
      method: options.method || "GET",
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response) return null;

    let data = null;
    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      throw new Error(data?.error || response.statusText || "Error en la solicitud");
    }

    return data;
  },

  get(path) {
    return this.request(path);
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

  delete(path) {
    return this.request(path, { method: "DELETE" });
  },
};

window.API = API;