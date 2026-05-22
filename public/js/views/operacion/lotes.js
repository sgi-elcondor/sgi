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
    }).format(Number(value || 0));
  }

  function sgiLoteFormatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function sgiLoteGetStatusBadge(estado = "Disponible") {
    const normalized = sgiNormalizeText(estado);

    const classMap = {
      disponible: "badge badge-info",
      vendido: "badge badge-success",
      entregado: "badge badge-muted"
    };

    return `<span class="${classMap[normalized] || "badge badge-muted"}">${estado}</span>`;
  }

  function sgiExtraerArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.lotes)) return data.lotes;
    if (Array.isArray(data?.proyectos)) return data.proyectos;
    return [];
  }

  function sgiGetProyectoId(proyecto = {}) {
    const id =
      proyecto.id_proyecto ??
      proyecto.idProyecto ??
      proyecto.proyecto_id ??
      proyecto.proyectoId ??
      proyecto.id;

    const parsed = Number(id);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function sgiNormalizarProyecto(proyecto = {}) {
    const nombre =
      proyecto.nombre ||
      proyecto.nombre_proyecto ||
      proyecto.proyecto ||
      proyecto.descripcion ||
      "Proyecto";

    return {
      ...proyecto,
      id: sgiGetProyectoId(proyecto),
      nombre,
      sigla: proyecto.sigla || ""
    };
  }

  function sgiNormalizarLote(lote = {}) {
  const proyectoObj = typeof lote.proyecto === "object" ? lote.proyecto : null;

  const proyectoId =
    lote.id_proyecto ??
    lote.proyectoId ??
    proyectoObj?.id_proyecto ??
    proyectoObj?.id ??
    "";

  const proyecto =
    proyectoObj?.nombre ||
    lote.proyecto ||
    lote.nombre_proyecto ||
    "Proyecto";

  const codigo =
    lote.codigo_lote ||
    lote.codigo ||
    [
      lote.manzana ? `Mz${lote.manzana}` : "",
      lote.numero_lote ? `Lt${lote.numero_lote}` : ""
    ].filter(Boolean).join(" ") ||
    "—";

  const area =
    lote.area_m2 ??
    lote.area ??
    lote.area_total ??
    0;

  return {
    ...lote,
    id: lote.id_lote ?? lote.id,
    id_lote: lote.id_lote ?? lote.id,
    codigo,
    codigo_lote: codigo,
    proyectoId,
    proyecto,
    area,
    dimensiones: lote.dimensiones || `${area} m²`,
    precio: lote.precio_base ?? lote.precio_lista ?? lote.precio ?? lote.valor ?? 0,
    estado: lote.estado || "Disponible",
    fechaCreacion:
      lote.fecha_creacion ||
      lote.fechaCreacion ||
      lote.createdAt ||
      lote.created_at ||
      lote.fecha_registro ||
      null
  };
}

  function sgiParseCodigoLote(codigo) {
    const value = String(codigo || "").trim().toUpperCase();

    if (!value) {
      return {
        manzana: "",
        numero_lote: ""
      };
    }

    const parts = value.split(/[-\s]+/).filter(Boolean);

    if (parts.length >= 2) {
      return {
        manzana: parts[0],
        numero_lote: parts.slice(1).join("-")
      };
    }

    return {
      manzana: "",
      numero_lote: value
    };
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

      const haystack = [lote.codigo, lote.proyecto, lote.estado]
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
          (a, b) =>
            new Date(b.fechaCreacion || 0).getTime() -
            new Date(a.fechaCreacion || 0).getTime()
        );

      case "fecha_asc":
        return cloned.sort(
          (a, b) =>
            new Date(a.fechaCreacion || 0).getTime() -
            new Date(b.fechaCreacion || 0).getTime()
        );

      default:
        return cloned.sort((a, b) => {
          const proyectoCompare = String(a.proyecto).localeCompare(
            String(b.proyecto),
            "es",
            { sensitivity: "base" }
          );

          if (proyectoCompare !== 0) return proyectoCompare;

          return String(a.codigo).localeCompare(String(b.codigo), "es", {
            numeric: true,
            sensitivity: "base"
          });
        });
    }
  }

  function sgiLoteBuildRows(lotes, { showActions = false } = {}) {
    const cols = showActions ? 7 : 6;
    if (!lotes.length) {
      return `<tr><td colspan="${cols}" class="empty-row">No hay lotes que coincidan con los filtros actuales.</td></tr>`;
    }
    return lotes.map(lote => `
      <tr>
        <td><strong>${lote.codigo}</strong></td>
        <td>${lote.proyecto}</td>
        <td>${Number(lote.area || 0)} m²</td>
        <td>${sgiLoteFormatCurrency(lote.precio)}</td>
        <td>${sgiLoteGetStatusBadge(lote.estado)}</td>
        <td>${sgiLoteFormatDate(lote.fechaCreacion)}</td>
        ${showActions ? `<td><button class="btn btn-sm btn-ghost" disabled title="El estado del lote no se modifica manualmente">Solo lectura</button></td>` : ""}
      </tr>`
    ).join("");
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
    if (window.UI?.toast) {
      UI.toast(message, type === "success" ? "ok" : "error");
      return;
    }

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

  async function sgiCargarLotesBackend() {
    const data = await API.get("/lotes");
    return sgiExtraerArray(data).map(sgiNormalizarLote);
  }

  async function sgiCargarProyectosBackend() {
    const data = await API.get("/proyectos");

    return sgiExtraerArray(data)
      .map(sgiNormalizarProyecto)
      .filter((proyecto) => proyecto.id);
  }

 async function sgiCrearLoteBackend(payload) {
  const codigo = String(payload.codigo || "").trim().toUpperCase();
  const proyectoId = Number(payload.proyectoId);
  const area = Number(payload.area);
  const precio = Number(payload.precio);
  const manzana = String(payload.manzana || "").trim().toUpperCase();
  const numeroLote = String(payload.numero_lote || "").trim();
  const dimensiones = String(payload.dimensiones || `${area} m²`).trim();
  const descripcion = String(payload.descripcion || "").trim() || null;
  const codigoPartes = sgiParseCodigoLote(codigo);

  if (!codigo) {
    throw new Error("El código del lote es obligatorio.");
  }

  if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
    throw new Error(
      "Debes seleccionar un proyecto válido antes de crear el lote."
    );
  }

  if (!Number.isFinite(area) || area <= 0) {
    throw new Error("El área debe ser mayor a cero.");
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error("El precio debe ser mayor a cero.");
  }

  const body = {
    id_proyecto: proyectoId,

    codigo_lote: codigo,
    manzana: manzana || codigoPartes.manzana || codigo,
    numero_lote: numeroLote || codigoPartes.numero_lote || codigo,

    area_m2: area,
    dimensiones,

    precio_base: precio,
    precio_lista: precio,

    descripcion,
    estado: "disponible"
  };

  return API.post("/lotes", body);
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
            <label for="loteProyecto">Proyecto</label>
            <select id="loteProyecto" name="proyectoId" required>
              <option value="">Selecciona un proyecto</option>
              ${
                proyectos.length
                  ? proyectos
                      .map(
                        (proyecto) => `
                          <option value="${proyecto.id}">
                            ${proyecto.nombre}
                          </option>
                        `
                      )
                      .join("")
                  : `<option value="" disabled>No hay proyectos disponibles</option>`
              }
            </select>
          </div>

          <div class="form-group">
            <label for="loteManzana">Manzana</label>
            <input
              id="loteManzana"
              name="manzana"
              type="text"
              placeholder="Ej: A"
            />
          </div>

          <div class="form-group">
            <label for="loteNumero">Número de lote</label>
            <input
              id="loteNumero"
              name="numero_lote"
              type="text"
              placeholder="Ej: 22"
            />
          </div>

          <div class="form-group">
            <label for="loteCodigo">Código del lote</label>
            <input
              id="loteCodigo"
              name="codigo"
              type="text"
              placeholder="Se genera automáticamente"
              required
            />
          </div>

          <div class="form-group">
            <label for="loteArea">Área total (m²)</label>
            <input
              id="loteArea"
              name="area"
              type="number"
              min="1"
              step="1"
              placeholder="Ej: 150"
              required
            />
          </div>

          <div class="form-group">
            <label for="loteDimensiones">Medidas del lote</label>
            <input
              id="loteDimensiones"
              name="dimensiones"
              type="text"
              placeholder="Ej: 10m × 15m"
            />
          </div>

          <div class="form-group">
            <label for="lotePrecio">Precio</label>
            <input
              id="lotePrecio"
              name="precio"
              type="text"
              inputmode="numeric"
              placeholder="Ej: 65.000.000"
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

          <div class="form-group form-group--full">
            <label for="loteDescripcion">Descripción</label>
            <textarea
              id="loteDescripcion"
              name="descripcion"
              rows="3"
              placeholder="Observaciones o detalles adicionales del lote"
            ></textarea>
          </div>
        </div>

        <div class="form-note">
          El lote se creará asociado a un proyecto existente y con estado inicial
          <strong>Disponible</strong> para futuras ventas.
        </div>

        <div id="sgiLoteFormError" class="form-error" style="display:none;"></div>

        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="sgiCancelCreateLote">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" id="sgiSubmitCreateLote">
            Guardar lote
          </button>
        </div>
      </form>
    `;

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    const form = document.getElementById("sgiCreateLoteForm");
    const cancelBtn = document.getElementById("sgiCancelCreateLote");
    const submitBtn = document.getElementById("sgiSubmitCreateLote");
    const errorBox = document.getElementById("sgiLoteFormError");
    const codigoInput = document.getElementById("loteCodigo");
    const proyectoSelect = document.getElementById("loteProyecto");
    const manzanaInput = document.getElementById("loteManzana");
    const numeroInput = document.getElementById("loteNumero");
    const areaInput = document.getElementById("loteArea");
    const dimensionesInput = document.getElementById("loteDimensiones");

    let codigoTouched = false;
    codigoInput.addEventListener("input", () => { codigoTouched = true; });

    function sgiAutoGenerarCodigo() {
      if (codigoTouched) return;
      const proyecto = proyectos.find((p) => String(p.id) === String(proyectoSelect.value));
      const sigla = proyecto?.sigla || "";
      const manzana = manzanaInput.value.trim().toUpperCase();
      const numero = numeroInput.value.trim().toUpperCase();
      codigoInput.value = [sigla, manzana, numero].filter(Boolean).join("-");
    }

    proyectoSelect.addEventListener("change", sgiAutoGenerarCodigo);
    manzanaInput.addEventListener("input", sgiAutoGenerarCodigo);
    numeroInput.addEventListener("input", sgiAutoGenerarCodigo);

    const precioInput = document.getElementById("lotePrecio");
    MoneyInput.init(precioInput);

    let dimensionesTouched = false;
    dimensionesInput.addEventListener("input", () => { dimensionesTouched = true; });
    areaInput.addEventListener("input", () => {
      if (!dimensionesTouched) {
        dimensionesInput.value = areaInput.value ? `${areaInput.value} m²` : "";
      }
    });

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
        proyectoId: Number(formData.get("proyectoId")),
        manzana: formData.get("manzana"),
        numero_lote: formData.get("numero_lote"),
        area: formData.get("area"),
        dimensiones: formData.get("dimensiones"),
        precio: String(formData.get("precio") || "").replace(/\./g, ""),
        descripcion: formData.get("descripcion")
      };

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";

        const nuevoLote = await sgiCrearLoteBackend(payload);

        sgiCloseLoteModal();

        const codigoLote =
          nuevoLote?.codigo_lote ||
          nuevoLote?.codigo ||
          payload.codigo;

        sgiShowToast(`Lote ${codigoLote} creado correctamente.`, "success");
        onCreated?.();
      } catch (error) {
        errorBox.textContent = error.message || "No fue posible crear el lote.";
        errorBox.style.display = "block";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Guardar lote";
      }
    };
  }

  function lotesView(container) {
    if (!container) return "";

    const canCreate = AppState.can('lotes', 'crear');

    const state = {
      proyecto: "",
      search: "",
      sortBy: "proyecto_codigo"
    };

    async function renderLotesScreen() {
      try {
        container.innerHTML = window.UI?.loader ? UI.loader() : "";

        const [allLotes, proyectos] = await Promise.all([
          sgiCargarLotesBackend(),
          sgiCargarProyectosBackend()
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
                  <h3 class="section-title">${canCreate ? "Gestión de lotes" : "Lotes disponibles"}</h3>
                  <p class="lotes-intro-text">
                    ${canCreate
                      ? "Visualiza el inventario de lotes por proyecto y registra nuevos lotes listos para comercialización."
                      : "Consulta el inventario de lotes por proyecto."}
                  </p>
                </div>

                ${canCreate ? `
                <div class="hero-actions">
                  <button class="btn btn-primary" id="btnNuevoLote">Nuevo lote</button>
                </div>` : ""}
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
                          ${canCreate ? "<th>Acción</th>" : ""}
                        </tr>
                      </thead>
                      <tbody>
                        ${sgiLoteBuildRows(filteredLotes, { showActions: canCreate })}
                      </tbody>
                    </table>
                  `
                  : `
                    <div class="empty-state">
                      <div class="empty-state-title">No hay resultados</div>
                      <div class="empty-state-text">No encontramos lotes con los filtros actuales.</div>
                      ${canCreate ? `<div><button class="btn btn-primary" id="btnEmptyCreateLote">Crear lote</button></div>` : ""}
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

        window.SGIUI?.hydrate?.();
      } catch (error) {
        console.error("Error cargando lotes:", error);

        container.innerHTML = `
          <section class="table-wrap" style="padding: 24px;">
            <div class="table-header">
              <h3>Error al cargar la vista</h3>
            </div>
            <div style="padding: 20px; color: var(--danger); line-height: 1.6;">
              ${error.message || "Ocurrió un error cargando la gestión de lotes. Revisa la consola para más detalles."}
            </div>
          </section>
        `;
      }
    }

    renderLotesScreen();
  }

  // Single entry point — lotesView resolves permissions internally
  window.lotesView = lotesView;
})();
