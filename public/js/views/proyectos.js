(() => {
  function formatNumber(value) {
    return new Intl.NumberFormat("es-CO").format(value || 0);
  }

  function proyectosView(container) {
    async function render() {
      try {
        const [proyectos, lotes] = await Promise.all([
          API.get("/proyectos"),
          API.get("/lotes"),
        ]);

        const rows = proyectos.map((proyecto) => {
          const id = proyecto.id_proyecto ?? proyecto.id;
          const lotesProyecto = lotes.filter(
            (lote) => (lote.id_proyecto ?? lote.proyectoId) === id
          );
          const disponibles = lotesProyecto.filter(
            (l) => (l.estado || "").toLowerCase() === "disponible"
          ).length;
          const vendidos = lotesProyecto.filter(
            (l) => (l.estado || "").toLowerCase() === "vendido"
          ).length;
          return { ...proyecto, id, totalLotes: lotesProyecto.length, disponibles, vendidos };
        });

        const metaHtml = '<span class="results-chip">' + window.SGIUI.icon("building-2") + " " + rows.length + " proyecto(s)</span>";

        const statsHtml =
          '<section class="stats-grid">' +
          '<article class="stat-card"><div class="stat-label">Total proyectos</div><div class="stat-value">' + formatNumber(rows.length) + '</div><div class="stat-sub">Base actual registrada</div></article>' +
          '<article class="stat-card"><div class="stat-label">Total lotes</div><div class="stat-value">' + formatNumber(lotes.length) + '</div><div class="stat-sub">Inventario consolidado</div></article>' +
          '</section>';

        const tableRows = rows.map((row) =>
          '<tr>' +
          '<td><strong>' + row.id + '</strong></td>' +
          '<td>' + row.nombre + '</td>' +
          '<td>' + row.totalLotes + '</td>' +
          '<td>' + row.disponibles + '</td>' +
          '<td>' + row.vendidos + '</td>' +
          '</tr>'
        ).join('');

        const html =
          '<section class="page-shell">' +
          window.SGIUI.pageHeader({
            kicker: "Gestion",
            title: "Proyectos",
            subtitle: "Consulta los proyectos registrados y su relacion con los lotes disponibles.",
            meta: metaHtml,
          }) +
          statsHtml +
          '<section class="table-wrap">' +
          '<div class="table-header"><h3>Listado de proyectos</h3></div>' +
          '<table><thead><tr><th>ID</th><th>Proyecto</th><th>Total lotes</th><th>Disponibles</th><th>Vendidos</th></tr></thead>' +
          '<tbody>' + tableRows + '</tbody></table>' +
          '</section></section>';

        if (container) container.innerHTML = html;
        window.SGIUI?.hydrate();

      } catch (error) {
        console.error("Error en proyectosView:", error);
        if (container) container.innerHTML =
          '<section class="table-wrap" style="padding:24px;">' +
          '<div class="table-header"><h3>Error al cargar proyectos</h3></div>' +
          '<div style="padding:20px;color:var(--danger)">Ocurrio un error cargando la vista de proyectos.</div>' +
          '</section>';
      }
    }
    render();
  }

  window.proyectosView = proyectosView;
})();

(() => {
  function proyectosReadView(container) {
    window.proyectosView(container);
  }

  async function proyectosEditView(container) {
    async function render() {
      try {
        const [proyectos, lotes] = await Promise.all([
          API.get("/proyectos"),
          API.get("/lotes"),
        ]);

        const rows = proyectos.map((proyecto) => {
          const id = proyecto.id_proyecto ?? proyecto.id;
          const lotesProyecto = lotes.filter(
            (l) => (l.id_proyecto ?? l.proyectoId) === id
          );
          const disponibles = lotesProyecto.filter(
            (l) => (l.estado || "").toLowerCase() === "disponible"
          ).length;
          const vendidos = lotesProyecto.filter(
            (l) => (l.estado || "").toLowerCase() === "vendido"
          ).length;
          return { ...proyecto, id, totalLotes: lotesProyecto.length, disponibles, vendidos };
        });

        const actionsHtml = '<button class="btn btn-primary" id="btnNuevoProyecto">+ Nuevo proyecto</button>';
        const metaHtml = '<span class="results-chip">' + window.SGIUI.icon("building-2") + " " + rows.length + " proyecto(s)</span>";

        const tableRows = rows.map((row) =>
          '<tr>' +
          '<td><strong>' + row.id + '</strong></td>' +
          '<td>' + row.nombre + '</td>' +
          '<td>' + row.totalLotes + '</td>' +
          '<td>' + row.disponibles + '</td>' +
          '<td>' + row.vendidos + '</td>' +
          '</tr>'
        ).join('');

        const html =
          '<section class="page-shell">' +
          window.SGIUI.pageHeader({
            kicker: "Gestion",
            title: "Proyectos",
            subtitle: "Administra los proyectos y su inventario de lotes.",
            actions: actionsHtml,
            meta: metaHtml,
          }) +
          '<section class="stats-grid">' +
          '<article class="stat-card"><div class="stat-label">Total proyectos</div><div class="stat-value">' + rows.length + '</div><div class="stat-sub">Base actual registrada</div></article>' +
          '<article class="stat-card"><div class="stat-label">Total lotes</div><div class="stat-value">' + lotes.length + '</div><div class="stat-sub">Inventario consolidado</div></article>' +
          '</section>' +
          '<section class="table-wrap">' +
          '<div class="table-header"><h3>Listado de proyectos</h3></div>' +
          '<table><thead><tr><th>ID</th><th>Proyecto</th><th>Total lotes</th><th>Disponibles</th><th>Vendidos</th></tr></thead>' +
          '<tbody>' + tableRows + '</tbody></table>' +
          '</section></section>';

        if (container) container.innerHTML = html;
        window.SGIUI?.hydrate();

        document.getElementById("btnNuevoProyecto")?.addEventListener("click", () => {
          const overlay = document.getElementById("modalOverlay");
          const titleEl = document.getElementById("modalTitle");
          const bodyEl  = document.getElementById("modalBody");
          if (!overlay || !titleEl || !bodyEl) return;

          titleEl.textContent = "Nuevo proyecto";
          bodyEl.innerHTML =
            '<div class="form-grid">' +
            '<div class="form-group" style="grid-column:1/-1"><label>Nombre del proyecto *</label><input type="text" id="np-nombre" placeholder="Ej: Urbanizacion El Condor Fase 1" /></div>' +
            '<div class="form-group" style="grid-column:1/-1"><label>Descripcion</label><input type="text" id="np-desc" placeholder="Descripcion opcional" /></div>' +
            '</div>' +
            '<div id="np-error" class="form-error" style="display:none;margin-top:8px"></div>' +
            '<div class="form-actions">' +
            '<button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>' +
            '<button class="btn btn-primary" id="np-submit">Guardar</button>' +
            '</div>';
          overlay.classList.add("open");
          window.SGIUI?.hydrate();

          document.getElementById("np-submit")?.addEventListener("click", async () => {
            const nombre = document.getElementById("np-nombre").value.trim();
            const desc   = document.getElementById("np-desc").value.trim();
            const errEl  = document.getElementById("np-error");
            const btn    = document.getElementById("np-submit");
            if (!nombre) { errEl.textContent = "El nombre es obligatorio."; errEl.style.display = "block"; return; }
            errEl.style.display = "none";
            btn.disabled = true; btn.textContent = "Guardando...";
            try {
              await API.post("/proyectos", { nombre, descripcion: desc || undefined });
              UI.closeModal();
              window.SGIUI?.toast("Proyecto creado correctamente.", "success", "Exito");
              render();
            } catch (err) {
              errEl.textContent = err.message || "Error al crear el proyecto.";
              errEl.style.display = "block";
              btn.disabled = false; btn.textContent = "Guardar";
            }
          });
        });

      } catch (error) {
        console.error("Error en proyectosEditView:", error);
        if (container) container.innerHTML =
          '<section class="table-wrap" style="padding:24px;">' +
          '<div class="table-header"><h3>Error al cargar proyectos</h3></div>' +
          '<div style="padding:20px;color:var(--danger)">Ocurrio un error cargando la vista.</div>' +
          '</section>';
      }
    }
    render();
  }

  window.proyectosReadView = proyectosReadView;
  window.proyectosEditView = proyectosEditView;
})();