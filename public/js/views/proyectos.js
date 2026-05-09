(() => {
  function formatNumber(value = 0) {
    return new Intl.NumberFormat("es-CO").format(value);
  }

  function proyectosView(container) {
    async function render() {
      try {
        const [proyectos, lotes] = await Promise.all([
          window.api.getProyectos(),
          window.api.getLotes()
        ]);

        const rows = proyectos.map((proyecto) => {
          const lotesProyecto = lotes.filter((lote) => lote.proyectoId === proyecto.id);
          const disponibles = lotesProyecto.filter((lote) => lote.estado === "Disponible").length;
          const vendidos = lotesProyecto.filter((lote) => lote.estado === "Vendido").length;

          return {
            ...proyecto,
            totalLotes: lotesProyecto.length,
            disponibles,
            vendidos
          };
        });

        const html = `
          <section class="page-shell">
            ${window.SGIUI.pageHeader({
              kicker: "Gestión",
              title: "Proyectos",
              subtitle: "Consulta los proyectos registrados y su relación con los lotes disponibles para comercialización.",
              meta: `
                <span class="results-chip">${window.SGIUI.icon("building-2")} ${rows.length} proyecto(s)</span>
              `
            })}

            <section class="stats-grid">
              <article class="stat-card">
                <div class="stat-label">Total proyectos</div>
                <div class="stat-value">${formatNumber(rows.length)}</div>
                <div class="stat-sub">Base actual registrada</div>
              </article>

              <article class="stat-card">
                <div class="stat-label">Total lotes</div>
                <div class="stat-value">${formatNumber(lotes.length)}</div>
                <div class="stat-sub">Inventario consolidado</div>
              </article>
            </section>

            <section class="table-wrap">
              <div class="table-header">
                <h3>Listado de proyectos</h3>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Proyecto</th>
                    <th>Total lotes</th>
                    <th>Disponibles</th>
                    <th>Vendidos</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      <td><strong>${row.id}</strong></td>
                      <td>${row.nombre}</td>
                      <td>${row.totalLotes}</td>
                      <td>${row.disponibles}</td>
                      <td>${row.vendidos}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </section>
          </section>
        `;

        if (container) container.innerHTML = html;
      } catch (error) {
        console.error("Error en proyectosView:", error);
        if (container) {
          container.innerHTML = `
            <section class="table-wrap" style="padding: 24px;">
              <div class="table-header">
                <h3>Error al cargar proyectos</h3>
              </div>
              <div style="padding: 20px; color: var(--danger); line-height: 1.6;">
                Ocurrió un error cargando la vista de proyectos.
              </div>
            </section>
          `;
        }
      }
    }

    render();
  }

  window.proyectosView = proyectosView;
})();