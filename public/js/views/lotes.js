(() => {
  function sgiNormalizeText(text = "") {
    return String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function sgiLoteFormatCurrency(value = 0) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(value);
  }

  function sgiLoteFormatDate(value) {
    if (!value) return "—";

    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(value));
  }

  function sgiLoteGetStatusBadge(estado) {
    const normalized = sgiNormalizeText(estado);

    const classMap = {
      disponible: "badge badge-info",
      vendido: "badge badge-success",
      entregado: "badge badge-muted"
    };

    return `<span class="${classMap[normalized] || "badge badge-muted"}">${estado}</span>`;
  }

  function sgiLoteBuildSummary(lotes) {
    const summary = {
      total: lotes.length,
      disponibles: 0,
      vendidos: 0,
      entregados: 0
    };

    lotes.forEach((lote) => {
      const estado = sgiNormalizeText(lote.estado);

      if (estado === "disponible") summary.disponibles += 1;
      if (estado === "vendido") summary.vendidos += 1;
      if (estado === "entregado") summary.entregados += 1;
    });

    return summary;
  }

  function sgiLoteApplyFilters(lotes, state) {
    const search = sgiNormalizeText(state.search);

    return lotes.filter((lote) => {
      const matchesProject =
        !state.proyecto || String(lote.proyectoId) === String(state.proyecto);

      const haystack = [
        lote.codigo,
        lote.proyecto,
        lote.estado
      ]
        .map(sgiNormalizeText)
        .join(" ");

      const matchesSearch = !search || haystack.includes(search);

      return matchesProject && matchesSearch;
    });
  }

  function sgiLoteSortList(lotes, sortBy) {
    const cloned = [...lotes];

    switch (sortBy) {
      case "codigo":
        return cloned.sort((a, b) =>
          String(a.codigo).localeCompare(String(b.codigo), "es", {
            numeric: true,
            sensitivity: "base"
          })
        );

      case "precio_desc":
        return cloned.sort((a, b) => Number(b.precio) - Number(a.precio));

      case "precio_asc":
        return cloned.sort((a, b) => Number(a.precio) - Number(b.precio));

      case "fecha_desc":
        return cloned.sort(
          (a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()
        );

      case "fecha_asc":
        return cloned.sort(
          (a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime()
        );

      default:
        return cloned.sort((a, b) => {
          const proyectoCompare = String(a.proyecto).localeCompare(String(b.proyecto), "es", {
            sensitivity: "base"
          });

          if (proyectoCompare !== 0) return proyectoCompare;

          return String(a.codigo).localeCompare(String(b.codigo), "es", {
            numeric: true,
            sensitivity: "base"
          });
        });
    }
  }

  function sgiLoteBuildRows(lotes) {
    if (!lotes.length) {
      return `
        <tr>
          <td colspan="7" class="empty-row">
            No hay lotes que coincidan con los filtros actuales.
          </td>
        </tr>
      `;
    }

    return lotes.map((lote) => `
      <tr>
        <td><strong>${lote.codigo}</strong></td>
        <td>${lote.proyecto}</td>
        <td>${lote.area} m²</td>
        <td>${sgiLoteFormatCurrency(lote.precio)}</td>
        <td>${sgiLoteGetStatusBadge(lote.estado)}</td>
        <td>${sgiLoteFormatDate(lote.fechaCreacion)}</td>
        <td>
          <button
            class="btn btn-sm btn-ghost"
            disabled
            title="El estado del lote no se modifica manualmente"
          >
            Solo lectura
          </button>
        </td>
      </tr>
    `).join("");
  }

  function sgiEnsureToastRoot() {
    let root = document.getElementById("toastRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "toastRoot";
      root.className = "toast-root";
      document.body.appendChild(root);
    }

    return root;
  }

  function sgiShowToast(message, type = "success") {
    const root = sgiEnsureToastRoot();
    const toast = document.createElement("div");

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-title">${type === "success" ? "Éxito" : "Atención"}</div>
      <div class="toast-message">${message}</div>
    `;

    root.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 220);
    }, 2800);
  }

  function sgiCloseLoteModal() {
    const overlay = document.getElementById("modalOverlay");
    const title = document.getElementById("modalTitle");
    const body = document.getElementById("modalBody");

    if (!overlay || !title || !body) return;

    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    title.textContent = "";
    body.innerHTML = "";
  }

  function sgiOpenCreateLoteModal(proyectos, onCreated) {
    const overlay = document.getElementById("modalOverlay");
    const title = document.getElementById("modalTitle");
    const body = document.getElementById("modalBody");
    const closeBtn = document.getElementById("modalClose");

    if (!overlay || !title || !body || !closeBtn) return;

    title.textContent = "Crear lote";

    body.innerHTML = `
      <form id="sgiCreateLoteForm">
        <div class="form-grid">
          <div class="form-group">
            <label for="loteCodigo">Código del lote</label>
            <input
              id="loteCodigo"
              name="codigo"
              type="text"
              placeholder="Ej: E-22"
              required
            />
          </div>

          <div class="form-group">
            <label for="loteProyecto">Proyecto</label>
            <select id="loteProyecto" name="proyectoId" required>
              <option value="">Selecciona un proyecto</option>
              ${proyectos.map((proyecto) => `
                <option value="${proyecto.id}">${proyecto.nombre}</option>
              `).join("")}
            </select>
          </div>

          <div class="form-group">
            <label for="loteArea">Área (m²)</label>
            <input
              id="loteArea"
              name="area"
              type="number"
              min="1"
              step="1"
              placeholder="Ej: 100"
              required
            />
          </div>

          <div class="form-group">
            <label for="lotePrecio">Precio</label>
            <input
              id="lotePrecio"
              name="precio"
              type="number"
              min="1"
              step="1"
              placeholder="Ej: 65000000"
              required
            />
          </div>

          <div class="form-group">
            <label for="loteEstadoInicial">Estado inicial</label>
            <input
              id="loteEstadoInicial"
              type="text"
              value="Disponible"
              disabled
            />
          </div>
        </div>

        <div class="form-note">
          El lote se creará asociado a un proyecto existente y con estado inicial
          <strong>Disponible</strong>.
        </div>

        <div id="sgiLoteFormError" class="form-error" style="display:none;"></div>

        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="sgiCancelCreateLote">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary">
            Guardar lote
          </button>
        </div>
      </form>
    `;

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    const form = document.getElementById("sgiCreateLoteForm");
    const cancelBtn = document.getElementById("sgiCancelCreateLote");
    const errorBox = document.getElementById("sgiLoteFormError");

    const closeHandler = () => sgiCloseLoteModal();

    closeBtn.onclick = closeHandler;
    cancelBtn.onclick = closeHandler;

    overlay.onclick = (event) => {
      if (event.target === overlay) {
        sgiCloseLoteModal();
      }
    };

    form.onsubmit = async (event) => {
      event.preventDefault();

      errorBox.style.display = "none";
      errorBox.textContent = "";

      const formData = new FormData(form);

      const payload = {
        codigo: formData.get("codigo"),
        proyectoId: formData.get("proyectoId"),
        area: formData.get("area"),
        precio: formData.get("precio")
      };

      try {
        const nuevoLote = await window.api.createLote(payload);
        sgiCloseLoteModal();
        sgiShowToast(`Lote ${nuevoLote.codigo} creado correctamente.`, "success");
        onCreated?.();
      } catch (error) {
        errorBox.textContent = error.message || "No fue posible crear el lote.";
        errorBox.style.display = "block";
      }
    };
  }

  function lotesView(container) {
    if (!container) return "";

    const state = {
      proyecto: "",
      search: "",
      sortBy: "proyecto_codigo"
    };

    async function renderLotesScreen() {
      try {
        const [allLotes, proyectos] = await Promise.all([
          window.api.getLotes(),
          window.api.getProyectos()
        ]);

        const filteredLotes = sgiLoteSortList(
          sgiLoteApplyFilters(allLotes, state),
          state.sortBy
        );

        const summary = sgiLoteBuildSummary(filteredLotes);

        container.innerHTML = `
          <section class="dashboard-shell">
            <section class="table-wrap lotes-intro">
              <div class="lotes-intro-body">
                <div>
                  <span class="section-kicker">Inventario</span>
                  <h3 class="section-title">Gestión de lotes</h3>
                  <p class="lotes-intro-text">
                    Visualiza el inventario de lotes por proyecto y registra nuevos
                    lotes listos para comercialización.
                  </p>
                </div>

                <div class="hero-actions">
                  <button class="btn btn-primary" id="btnNuevoLote">Nuevo lote</button>
                </div>
              </div>
            </section>

            <section class="dashboard-block">
              <div class="section-head">
                <div>
                  <span class="section-kicker">Resumen</span>
                  <h3 class="section-title">Estado del inventario</h3>
                </div>
              </div>

              <div class="stats-grid lotes-summary-grid">
                <article class="stat-card">
                  <div class="stat-label">Total lotes</div>
                  <div class="stat-value">${summary.total}</div>
                  <div class="stat-sub">Resultado actual</div>
                </article>

                <article class="stat-card">
                  <div class="stat-label">Disponibles</div>
                  <div class="stat-value">${summary.disponibles}</div>
                  <div class="stat-sub">Listos para comercialización</div>
                </article>

                <article class="stat-card">
                  <div class="stat-label">Vendidos</div>
                  <div class="stat-value">${summary.vendidos}</div>
                  <div class="stat-sub">Con venta registrada</div>
                </article>

                <article class="stat-card">
                  <div class="stat-label">Entregados</div>
                  <div class="stat-value">${summary.entregados}</div>
                  <div class="stat-sub">Proceso finalizado</div>
                </article>
              </div>
            </section>

            <section class="table-wrap">
              <div class="table-header">
                <h3>Filtros y búsqueda</h3>
              </div>

              <div class="filter-bar">
                <div class="form-group filter-field">
                  <label for="filtroProyecto">Proyecto</label>
                  <select id="filtroProyecto">
                    <option value="">Todos</option>
                    ${proyectos.map((proyecto) => `
                      <option
                        value="${proyecto.id}"
                        ${String(state.proyecto) === String(proyecto.id) ? "selected" : ""}
                      >
                        ${proyecto.nombre}
                      </option>
                    `).join("")}
                  </select>
                </div>

                <div class="form-group filter-field">
                  <label for="buscarLote">Buscar</label>
                  <input
                    id="buscarLote"
                    type="text"
                    placeholder="Buscar por código, proyecto o estado"
                    value="${state.search}"
                  />
                </div>

                <div class="form-group filter-field">
                  <label for="ordenLotes">Ordenar por</label>
                  <select id="ordenLotes">
                    <option value="proyecto_codigo" ${state.sortBy === "proyecto_codigo" ? "selected" : ""}>
                      Proyecto + código
                    </option>
                    <option value="codigo" ${state.sortBy === "codigo" ? "selected" : ""}>
                      Código
                    </option>
                    <option value="precio_desc" ${state.sortBy === "precio_desc" ? "selected" : ""}>
                      Precio mayor a menor
                    </option>
                    <option value="precio_asc" ${state.sortBy === "precio_asc" ? "selected" : ""}>
                      Precio menor a mayor
                    </option>
                    <option value="fecha_desc" ${state.sortBy === "fecha_desc" ? "selected" : ""}>
                      Más recientes
                    </option>
                    <option value="fecha_asc" ${state.sortBy === "fecha_asc" ? "selected" : ""}>
                      Más antiguos
                    </option>
                  </select>
                </div>
              </div>
            </section>

            <section class="table-wrap">
              <div class="table-header">
                <h3>Listado de lotes</h3>
              </div>

              ${
                filteredLotes.length
                  ? `
                    <table>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Proyecto</th>
                          <th>Área</th>
                          <th>Precio</th>
                          <th>Estado</th>
                          <th>Fecha creación</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${sgiLoteBuildRows(filteredLotes)}
                      </tbody>
                    </table>
                  `
                  : `
                    <div class="empty-state">
                      <div class="empty-state-title">No hay resultados</div>
                      <div class="empty-state-text">
                        No encontramos lotes con los filtros actuales. Puedes cambiar
                        la búsqueda o crear un nuevo lote.
                      </div>
                      <div>
                        <button class="btn btn-primary" id="btnEmptyCreateLote">
                          Crear lote
                        </button>
                      </div>
                    </div>
                  `
              }
            </section>
          </section>
        `;

        const filtroProyecto = document.getElementById("filtroProyecto");
        const buscarLote = document.getElementById("buscarLote");
        const ordenLotes = document.getElementById("ordenLotes");
        const btnNuevoLote = document.getElementById("btnNuevoLote");
        const btnEmptyCreateLote = document.getElementById("btnEmptyCreateLote");

        filtroProyecto?.addEventListener("change", () => {
          state.proyecto = filtroProyecto.value;
          renderLotesScreen();
        });

        buscarLote?.addEventListener("input", () => {
          state.search = buscarLote.value;
          renderLotesScreen();
        });

        ordenLotes?.addEventListener("change", () => {
          state.sortBy = ordenLotes.value;
          renderLotesScreen();
        });

        btnNuevoLote?.addEventListener("click", () => {
          sgiOpenCreateLoteModal(proyectos, renderLotesScreen);
        });

        btnEmptyCreateLote?.addEventListener("click", () => {
          sgiOpenCreateLoteModal(proyectos, renderLotesScreen);
        });
      } catch (error) {
        console.error("Error cargando lotes:", error);

        container.innerHTML = `
          <section class="table-wrap" style="padding: 24px;">
            <div class="table-header">
              <h3>Error al cargar la vista</h3>
            </div>
            <div style="padding: 20px; color: var(--danger); line-height: 1.6;">
              Ocurrió un error cargando la gestión de lotes. Revisa la consola para más detalles.
            </div>
          </section>
        `;
      }
    }

    renderLotesScreen();
  }

  window.lotesView = lotesView;
})();