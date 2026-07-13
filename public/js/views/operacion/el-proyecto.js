window.elProyectoView = async function (container) {
  const vc = container || document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  let proyectos, lotes, misVentas;
  try {
    [proyectos, lotes, misVentas] = await Promise.all([
      API.get("/proyectos"),
      API.get("/lotes"),
      API.get("/ventas/mis-ventas").catch(() => []),
    ]);
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }

  const fmtM = n => n != null
    ? Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    : "Consultar";

  const misCodigosLote = new Set(
    (misVentas || []).map(v => v.lote?.codigo_lote).filter(Boolean)
  );

  const lotesPorProyecto = {};
  (lotes || []).forEach(l => {
    if (!lotesPorProyecto[l.id_proyecto]) lotesPorProyecto[l.id_proyecto] = [];
    lotesPorProyecto[l.id_proyecto].push(l);
  });

  let mapHandle = null;
  let selectedProyectoIdx = 0;
  if (misVentas?.length) {
    const miProyecto = misVentas[0].lote?.proyecto?.nombre;
    if (miProyecto) {
      const idx = (proyectos || []).findIndex(p => p.nombre === miProyecto);
      if (idx >= 0) selectedProyectoIdx = idx;
    }
  }

  let sortKey = "codigo";

  const SORT_OPTIONS = [
    { key: "codigo",      label: "Código" },
    { key: "precio_asc",  label: "Precio ↑" },
    { key: "precio_desc", label: "Precio ↓" },
    { key: "area_asc",    label: "Área ↑" },
    { key: "area_desc",   label: "Área ↓" },
  ];

  function sortDisponibles(list) {
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "precio_asc":  return (a.precio_base ?? Infinity)  - (b.precio_base ?? Infinity);
        case "precio_desc": return (b.precio_base ?? -Infinity) - (a.precio_base ?? -Infinity);
        case "area_asc":    return (a.area_m2 ?? Infinity)      - (b.area_m2 ?? Infinity);
        case "area_desc":   return (b.area_m2 ?? -Infinity)     - (a.area_m2 ?? -Infinity);
        default:            return (a.codigo_lote || "").localeCompare(b.codigo_lote || "");
      }
    });
  }

  function selectLote(loteId, loteMap) {
    const detailSection = document.getElementById("lote-detail-section");
    const detailPanel   = document.getElementById("lote-detail-panel");
    const detailHeader  = document.getElementById("lote-detail-header");

    vc.querySelectorAll(".lote-disponible-card.selected").forEach(c => c.classList.remove("selected"));

    const card = vc.querySelector(`.lote-disponible-card[data-id="${loteId}"]`);
    if (card) card.classList.add("selected");

    const l = loteMap[Number(loteId)];
    if (!l) { detailSection.style.display = "none"; return; }

    const isMine = misCodigosLote.has(l.codigo_lote);
    detailSection.style.display = "";
    detailHeader.innerHTML = `<h3>${window.SGIUI?.icon("info") ?? ""} ${l.codigo_lote}${isMine ? ' <span class="badge badge-accent" style="margin-left:0.5rem">Tu lote</span>' : ""}</h3>`;
    detailPanel.innerHTML = `
      <div class="lote-detail-field">
        <span class="lote-detail-label">Estado</span>
        <span class="lote-detail-value">${UI.badge(l.estado)}</span>
      </div>
      ${l.manzana ? `<div class="lote-detail-field"><span class="lote-detail-label">Manzana</span><span class="lote-detail-value">${l.manzana}</span></div>` : ""}
      ${l.area_m2 ? `<div class="lote-detail-field"><span class="lote-detail-label">Area</span><span class="lote-detail-value">${l.area_m2} m²</span></div>` : ""}
      ${l.dimensiones ? `<div class="lote-detail-field"><span class="lote-detail-label">Dimensiones</span><span class="lote-detail-value">${l.dimensiones}</span></div>` : ""}
      ${l.precio_base ? `<div class="lote-detail-field"><span class="lote-detail-label">Precio base</span><span class="lote-detail-value" style="color:var(--success)">${fmtM(l.precio_base)}</span></div>` : ""}
      ${l.descripcion ? `<div class="lote-detail-field" style="grid-column:1/-1"><span class="lote-detail-label">Descripcion</span><span class="lote-detail-value" style="font-size:0.875rem;font-weight:400">${l.descripcion}</span></div>` : ""}
    `;
    window.SGIUI?.hydrate();
  }

  function clearSelection() {
    vc.querySelectorAll(".lote-disponible-card.selected").forEach(c => c.classList.remove("selected"));
    const detailSection = document.getElementById("lote-detail-section");
    if (detailSection) detailSection.style.display = "none";
  }

  function render(pidx) {
    const proyecto         = (proyectos || [])[pidx];
    const lotesDelProyecto = proyecto ? (lotesPorProyecto[proyecto.id_proyecto] || []) : [];
    const disponibles      = lotesDelProyecto.filter(l => l.estado === "disponible");
    const vendidos         = lotesDelProyecto.filter(l => l.estado === "vendido").length;
    const entregados       = lotesDelProyecto.filter(l => l.estado === "entregado").length;
    const total            = lotesDelProyecto.length;
    const pctVendido       = total > 0 ? Math.round((vendidos + entregados) / total * 100) : 0;

    const loteMap = {};
    lotesDelProyecto.forEach(l => { loteMap[l.id_lote] = l; });

    const sortedDisponibles = sortDisponibles(disponibles);

    const sortControlHtml = disponibles.length > 1
      ? `<div class="lote-selector" style="padding:0.75rem 1.25rem 0">${SORT_OPTIONS.map(o =>
          `<button class="lote-tab ${sortKey === o.key ? "active" : ""}" data-sort="${o.key}">${o.label}</button>`
        ).join("")}</div>`
      : "";

    const disponiblesHtml = sortedDisponibles.length
      ? sortedDisponibles.map(l => `
        <div class="lote-disponible-card" data-id="${l.id_lote}" role="button" tabindex="0" title="Ver en plano">
          <div class="lote-disponible-code">${l.codigo_lote}</div>
          <div class="lote-disponible-meta">${[l.manzana ? "Mz " + l.manzana : "", l.area_m2 ? l.area_m2 + " m²" : ""].filter(Boolean).join(" · ")}</div>
          <div class="lote-disponible-precio">${fmtM(l.precio_base)}</div>
        </div>`).join("")
      : `<p style="color:var(--text-muted);font-size:0.875rem;padding:0.75rem 1.25rem">No hay lotes disponibles en este proyecto.</p>`;

    const proyectoSelector = (proyectos || []).length > 1
      ? `<div class="lote-selector">${proyectos.map((p, i) =>
          `<button class="lote-tab ${i === pidx ? "active" : ""}" data-pidx="${i}">${p.nombre}</button>`
        ).join("")}</div>`
      : "";

    vc.innerHTML = `
      <section class="page-shell">
        ${window.SGIUI?.pageHeader({
          kicker:   "El Proyecto",
          title:    proyecto?.nombre || "Proyecto",
          subtitle: proyecto?.ubicacion || "Informacion del proyecto",
          meta:     `<span class="results-chip">${window.SGIUI?.icon("map-pin") ?? ""} ${disponibles.length} lote(s) disponible(s)</span>`,
        }) ?? ""}

        ${proyectoSelector}

        ${proyecto?.descripcion ? `<p class="proyecto-descripcion">${proyecto.descripcion}</p>` : ""}

        <div class="proyecto-stats-row">
          <div class="proyecto-stat">
            <span class="proyecto-stat-val">${total}</span>
            <span class="proyecto-stat-label">Total lotes</span>
          </div>
          <div class="proyecto-stat success">
            <span class="proyecto-stat-val">${disponibles.length}</span>
            <span class="proyecto-stat-label">Disponibles</span>
          </div>
          <div class="proyecto-stat accent">
            <span class="proyecto-stat-val">${vendidos}</span>
            <span class="proyecto-stat-label">Vendidos</span>
          </div>
          <div class="proyecto-stat info">
            <span class="proyecto-stat-val">${entregados}</span>
            <span class="proyecto-stat-label">Entregados</span>
          </div>
          <div class="proyecto-stat muted">
            <span class="proyecto-stat-val">${pctVendido}%</span>
            <span class="proyecto-stat-label">Comercializado</span>
          </div>
        </div>

        <section class="table-wrap">
          <div class="table-header"><h3>${window.SGIUI?.icon("map") ?? ""} Mapa del proyecto</h3></div>
          <div id="lote-map-container" style="padding:1rem 1.25rem">${UI.loader()}</div>
        </section>

        <section class="table-wrap lote-detail-section" id="lote-detail-section" style="display:none;margin-top:0.5rem">
          <div class="table-header" id="lote-detail-header"></div>
          <div class="lote-detail-panel" id="lote-detail-panel"></div>
        </section>

        <section class="table-wrap" style="margin-top:1rem">
          <div class="table-header">
            <h3>${window.SGIUI?.icon("tag") ?? ""} Lotes disponibles (${disponibles.length})</h3>
          </div>
          ${sortControlHtml}
          <div class="lotes-disponibles-grid">${disponiblesHtml}</div>
        </section>
      </section>`;

    window.SGIUI?.hydrate();

    vc.querySelectorAll("[data-pidx]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedProyectoIdx = Number(btn.dataset.pidx);
        render(selectedProyectoIdx);
      });
    });

    vc.querySelectorAll("[data-sort]").forEach(btn => {
      btn.addEventListener("click", () => {
        sortKey = btn.dataset.sort;
        render(selectedProyectoIdx);
      });
    });

    vc.querySelectorAll(".lote-disponible-card").forEach(card => {
      const activate = () => {
        const wasSelected = card.classList.contains("selected");
        if (wasSelected) { clearSelection(); return; }
        selectLote(card.dataset.id, loteMap);
        vc.querySelector("#lote-map-container")?.closest(".table-wrap")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        mapHandle?.panTo(Number(card.dataset.id));
      };
      card.addEventListener("click", activate);
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });
    });

    if (mapHandle) { mapHandle.destroy(); mapHandle = null; }
    const mapContainer = document.getElementById("lote-map-container");
    if (mapContainer && proyecto) {
      window.SGILibs.ensureMap()
        .then(() => {
          if (!document.getElementById("lote-map-container")) return; // view changed meanwhile
          mapHandle = window.SGIMap.render(mapContainer, {
            lotes: lotesDelProyecto,
            proyecto,
            misCodigosLote,
            onSelect: l => {
              selectLote(l.id_lote, loteMap);
              document.getElementById("lote-detail-section").scrollIntoView({ behavior: "smooth", block: "nearest" });
            },
          });
        })
        .catch(() => {
          mapContainer.innerHTML = `<p style="color:var(--danger)">No se pudo cargar el mapa interactivo.</p>`;
        });
    }
  }

  render(selectedProyectoIdx);
};
