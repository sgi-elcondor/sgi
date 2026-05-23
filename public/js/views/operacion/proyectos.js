(() => {
  function fmt(n) {
    return new Intl.NumberFormat("es-CO").format(n || 0);
  }

  function buildRows(rows) {
    return rows.map(r =>
      `<tr>
        <td><strong>${r.id}</strong></td>
        <td>${r.nombre}</td>
        <td>${r.totalLotes}</td>
        <td>${r.disponibles}</td>
        <td>${r.vendidos}</td>
      </tr>`
    ).join("");
  }

  async function render(container) {
    const canCreate = AppState.can("proyectos", "crear");

    try {
      const [proyectos, lotes] = await Promise.all([
        API.get("/proyectos"),
        API.get("/lotes"),
      ]);

      const rows = proyectos.map(p => {
        const id = p.id_proyecto ?? p.id;
        const del = lotes.filter(l => (l.id_proyecto ?? l.proyectoId) === id);
        return {
          ...p, id,
          totalLotes:  del.length,
          disponibles: del.filter(l => (l.estado || "").toLowerCase() === "disponible").length,
          vendidos:    del.filter(l => (l.estado || "").toLowerCase() === "vendido").length,
        };
      });

      container.innerHTML =
        '<section class="page-shell">' +
        window.SGIUI.pageHeader({
          kicker:   "Gestion",
          title:    "Proyectos",
          subtitle: canCreate
            ? "Administra los proyectos y su inventario de lotes."
            : "Consulta los proyectos registrados y su relacion con los lotes disponibles.",
          meta:     `<span class="results-chip">${window.SGIUI.icon("building-2")} ${rows.length} proyecto(s)</span>`,
          actions:  canCreate ? '<button class="btn btn-primary" id="btnNuevoProyecto"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo proyecto</button>' : "",
        }) +
        '<section class="stats-grid">' +
        `<article class="stat-card"><div class="stat-label">Total proyectos</div><div class="stat-value">${fmt(rows.length)}</div><div class="stat-sub">Base actual registrada</div></article>` +
        `<article class="stat-card"><div class="stat-label">Total lotes</div><div class="stat-value">${fmt(lotes.length)}</div><div class="stat-sub">Inventario consolidado</div></article>` +
        "</section>" +
        '<section class="table-wrap">' +
        '<div class="table-header"><h3>Listado de proyectos</h3></div>' +
        '<table><thead><tr><th>ID</th><th>Proyecto</th><th>Total lotes</th><th>Disponibles</th><th>Vendidos</th></tr></thead>' +
        `<tbody>${buildRows(rows)}</tbody></table>` +
        "</section></section>";

      window.SGIUI?.hydrate();

      if (canCreate) {
        document.getElementById("btnNuevoProyecto")?.addEventListener("click", () => {
          const overlay = document.getElementById("modalOverlay");
          const titleEl = document.getElementById("modalTitle");
          const bodyEl  = document.getElementById("modalBody");
          if (!overlay || !titleEl || !bodyEl) return;

          titleEl.textContent = "Nuevo proyecto";
          bodyEl.innerHTML =
            '<div class="form-grid">' +
            '<div class="form-group" style="grid-column:1/-1"><label>Nombre del proyecto *</label>' +
            '<input type="text" id="np-nombre" placeholder="Ej: Urbanizacion El Condor Fase 1" /></div>' +
            '<div class="form-group"><label>Sigla</label>' +
            '<input type="text" id="np-sigla" maxlength="3" placeholder="Ej: EC1" style="text-transform:uppercase" /></div>' +
            '<div class="form-group"><label>Ubicacion</label>' +
            '<input type="text" id="np-ubicacion" placeholder="Ej: Calle 10 # 5-23, Municipio" /></div>' +
            '<div class="form-group" style="grid-column:1/-1"><label>Descripcion</label>' +
            '<textarea id="np-desc" rows="3" placeholder="Descripcion opcional del proyecto"></textarea></div>' +
            '</div>' +
            '<div id="np-error" class="form-error" style="display:none;margin-top:8px"></div>' +
            '<div class="form-actions">' +
            '<button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>' +
            '<button class="btn btn-primary" id="np-submit">Guardar</button>' +
            "</div>";
          overlay.classList.add("open");
          window.SGIUI?.hydrate();

          document.getElementById("np-sigla")?.addEventListener("input", function() {
            this.value = this.value.toUpperCase();
          });

          document.getElementById("np-submit")?.addEventListener("click", async () => {
            const nombre    = document.getElementById("np-nombre").value.trim();
            const sigla     = document.getElementById("np-sigla").value.trim().toUpperCase();
            const ubicacion = document.getElementById("np-ubicacion").value.trim();
            const desc      = document.getElementById("np-desc").value.trim();
            const errEl     = document.getElementById("np-error");
            const btn       = document.getElementById("np-submit");
            if (!nombre) { errEl.textContent = "El nombre es obligatorio."; errEl.style.display = "block"; return; }
            if (sigla && sigla.length > 3) { errEl.textContent = "La sigla debe tener maximo 3 caracteres."; errEl.style.display = "block"; return; }
            errEl.style.display = "none";
            btn.disabled = true; btn.textContent = "Guardando...";
            try {
              await API.post("/proyectos", {
                nombre,
                sigla:     sigla     || undefined,
                ubicacion: ubicacion || undefined,
                descripcion: desc    || undefined,
              });
              UI.closeModal();
              window.SGIUI?.toast("Proyecto creado correctamente.", "success", "Exito");
              render(container);
            } catch (err) {
              errEl.textContent = err.message || "Error al crear el proyecto.";
              errEl.style.display = "block";
              btn.disabled = false; btn.textContent = "Guardar";
            }
          });
        });
      }

    } catch (error) {
      console.error("Error en proyectosView:", error);
      container.innerHTML =
        '<section class="table-wrap" style="padding:24px">' +
        '<div class="table-header"><h3>Error al cargar proyectos</h3></div>' +
        `<div style="padding:20px;color:var(--danger)">${error.message || "Ocurrio un error cargando la vista."}</div>` +
        "</section>";
    }
  }

  window.proyectosView = function(container) {
    const vc = container || document.getElementById("viewContainer");
    if (vc) vc.innerHTML = UI.loader();
    render(vc);
  };
})();
