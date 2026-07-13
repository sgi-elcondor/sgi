window.mapaEditorView = async function (container) {
  const vc = container || document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  let proyectos, lotes;
  try {
    [proyectos, lotes] = await Promise.all([
      API.get("/proyectos"),
      API.get("/lotes"),
    ]);
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }

  const lotesPorProyecto = {};
  (lotes || []).forEach(l => {
    if (!lotesPorProyecto[l.id_proyecto]) lotesPorProyecto[l.id_proyecto] = [];
    lotesPorProyecto[l.id_proyecto].push(l);
  });

  let selectedProyectoIdx = 0;
  let editorHandle = null;

  function render(pidx) {
    if (editorHandle) { editorHandle.destroy(); editorHandle = null; }

    const proyecto = (proyectos || [])[pidx];
    const lotesDelProyecto = proyecto ? (lotesPorProyecto[proyecto.id_proyecto] || []) : [];
    const ubicados = lotesDelProyecto.filter(l => l.geom?.type === "Polygon").length;

    const proyectoSelector = (proyectos || []).length > 1
      ? `<div class="lote-selector">${proyectos.map((p, i) =>
          `<button class="lote-tab ${i === pidx ? "active" : ""}" data-pidx="${i}">${p.nombre}</button>`
        ).join("")}</div>`
      : "";

    vc.innerHTML = `
      <section class="page-shell">
        ${window.SGIUI?.pageHeader({
          kicker:   "Editor de mapa",
          title:    proyecto?.nombre || "Proyecto",
          subtitle: "Dibuja y ajusta el contorno de cada lote sobre el mapa",
          meta:     `<span class="results-chip">${window.SGIUI?.icon("map-pin") ?? ""} ${ubicados}/${lotesDelProyecto.length} lote(s) ubicados</span>`,
        }) ?? ""}

        ${proyectoSelector}

        <section class="table-wrap" style="margin-top:0.75rem">
          <div class="table-header"><h3>${window.SGIUI?.icon("pencil-ruler") ?? ""} Contorno de lotes</h3></div>
          <div id="mapa-editor-container" style="padding:1rem 1.25rem">${UI.loader()}</div>
        </section>
      </section>`;

    window.SGIUI?.hydrate();

    vc.querySelectorAll("[data-pidx]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedProyectoIdx = Number(btn.dataset.pidx);
        render(selectedProyectoIdx);
      });
    });

    const editorContainer = document.getElementById("mapa-editor-container");
    if (!editorContainer || !proyecto) return;

    window.SGILibs.ensureMapEditor()
      .then(() => {
        if (!document.getElementById("mapa-editor-container")) return; // view changed meanwhile
        editorHandle = window.SGIMap.renderEditor(editorContainer, {
          proyecto,
          lotes: lotesDelProyecto,
          onGeomChange: async (idLote, geom) => {
            await API.patch(`/lotes/${idLote}/geometria`, { geom });
          },
          onCentroChange: async (lat, lng) => {
            await API.patch(`/proyectos/${proyecto.id_proyecto}/ubicacion`, { lat, lng });
            proyecto.lat = lat;
            proyecto.lng = lng;
            window.SGIUI?.toast?.("Centro del proyecto actualizado", "success", "Exito");
          },
        });
      })
      .catch(() => {
        editorContainer.innerHTML = `<p style="color:var(--danger)">No se pudo cargar el editor de mapa.</p>`;
      });
  }

  render(selectedProyectoIdx);
};
