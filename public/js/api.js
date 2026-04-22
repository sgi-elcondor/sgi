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
      const auth = window._firebaseAuth;
      const user = auth?.currentUser;

      if (user) {
        const newToken = await user.getIdToken(true);
        localStorage.setItem("fb_token", newToken);
        config.headers.Authorization = `Bearer ${newToken}`;
        response = await fetch(endpoint, config);
      } else {
        window.location.href = "/login.html";
        return;
      }
    } catch {
      window.location.href = "/login.html";
      return;
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

(() => {
  const KEYS = {
    proyectos: "sgi_proyectos",
    lotes: "sgi_lotes",
  };

  const read = (key) => JSON.parse(localStorage.getItem(key) || "[]");
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const upper = (value = "") => String(value).trim().toUpperCase();

  window.api = {
    async getProyectos() {
      return read(KEYS.proyectos).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },

    async getLotes() {
      return read(KEYS.lotes).sort((a, b) => {
        const byProject = a.proyecto.localeCompare(b.proyecto);
        return byProject || a.codigo.localeCompare(b.codigo, "es", { numeric: true });
      });
    },

    async createLote(payload = {}) {
      const proyectos = read(KEYS.proyectos);
      const lotes = read(KEYS.lotes);

      const codigo = upper(payload.codigo);
      const proyectoId = Number(payload.proyectoId);
      const area = Number(payload.area);
      const precio = Number(payload.precio);

      if (!codigo) throw new Error("El código del lote es obligatorio.");

      const proyecto = proyectos.find((p) => p.id === proyectoId);
      if (!proyecto) throw new Error("Debes seleccionar un proyecto existente.");

      if (!Number.isFinite(area) || area <= 0) {
        throw new Error("El área debe ser mayor a 0.");
      }

      if (!Number.isFinite(precio) || precio <= 0) {
        throw new Error("El precio debe ser mayor a 0.");
      }

      const existe = lotes.some((l) => upper(l.codigo) === codigo);
      if (existe) throw new Error("Ya existe un lote con ese código.");

      const nuevoLote = {
        id: Date.now(),
        codigo,
        proyectoId: proyecto.id,
        proyecto: proyecto.nombre,
        area,
        precio,
        estado: "Disponible",
        fechaCreacion: new Date().toISOString(),
      };

      lotes.push(nuevoLote);
      write(KEYS.lotes, lotes);

      return nuevoLote;
    },

    async resetLotesDemo() {
      localStorage.removeItem(KEYS.proyectos);
      localStorage.removeItem(KEYS.lotes);
      seedDemoData();
    },
  };

  function seedDemoData() {
    if (!read(KEYS.proyectos).length) {
      write(KEYS.proyectos, [
        { id: 1, nombre: "Reserva Norte" },
        { id: 2, nombre: "Altos del Lago" },
        { id: 3, nombre: "Mirador del Condor" },
      ]);
    }

    if (!read(KEYS.lotes).length) {
      const demoLotes = [
        ["A-12", 1, "Reserva Norte", 120, 85000000, "Disponible", "2026-04-01T10:00:00.000Z"],
        ["B-07", 1, "Reserva Norte", 98, 72000000, "Vendido", "2026-04-02T10:00:00.000Z"],
        ["C-03", 2, "Altos del Lago", 140, 99000000, "Entregado", "2026-04-03T10:00:00.000Z"],
        ["D-15", 3, "Mirador del Condor", 110, 81000000, "Disponible", "2026-04-04T10:00:00.000Z"],
      ].map(([codigo, proyectoId, proyecto, area, precio, estado, fechaCreacion], index) => ({
        id: index + 1,
        codigo,
        proyectoId,
        proyecto,
        area,
        precio,
        estado,
        fechaCreacion,
      }));

      write(KEYS.lotes, demoLotes);
    }
  }

  seedDemoData();
})();