// Reusable interactive lotes map (MAP-01/02/03) built on Leaflet + Leaflet-Geoman (free).
// Two entry points: render() is read-only (view + hover/click + filters), renderEditor()
// adds drawing/editing tools for topografo/admin. Both are lazy — the caller must ensure
// SGILibs.ensureMap()/ensureMapEditor() resolved before calling into this module.
(function () {
  "use strict";

  const TILES = {
    light: {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: "&copy; CARTO &copy; OpenStreetMap",
      maxZoom: 20,
      subdomains: "abcd",
      label: "Claro",
    },
    sat: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
      maxZoom: 19,
      subdomains: "abc", // unused (no {s} in this URL) but Leaflet's _getSubdomain() always reads options.subdomains.length
      label: "Satelital",
    },
  };

  const ESTADO_ORDER = ["disponible", "vendido", "entregado", "devolucion"];
  const ESTADO_LABEL = { disponible: "Disponible", vendido: "Vendido", entregado: "Entregado", devolucion: "Devolucion" };
  const ESTADO_COLOR = { disponible: "var(--success)", vendido: "var(--accent)", entregado: "var(--info, #3b82f6)", devolucion: "var(--danger)" };

  const COLOMBIA_CENTER = [4.6097, -74.0817];

  function fmtCOP(n) {
    return n != null ? Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }) : "Consultar";
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function hasValidGeom(lote) {
    return lote?.geom?.type === "Polygon" && Array.isArray(lote.geom.coordinates?.[0]) && lote.geom.coordinates[0].length >= 3;
  }

  function toLatLngs(geom) {
    return geom.coordinates[0].map(([lng, lat]) => [lat, lng]);
  }

  function polygonClassName(lote, isMine) {
    const estado = String(lote.estado || "disponible").toLowerCase();
    return `sgi-lote-poly sgi-lote-poly-${estado}${isMine ? " sgi-lote-poly-mine" : ""}`;
  }

  function popupHtml(lote) {
    const meta = [lote.manzana ? "Mz " + escapeHtml(lote.manzana) : "", lote.area_m2 ? lote.area_m2 + " m²" : ""]
      .filter(Boolean).join(" &middot; ");
    return `
      ${lote.foto_url ? `<img class="sgi-lote-card-photo" src="${escapeHtml(lote.foto_url)}" alt="${escapeHtml(lote.codigo_lote)}" />` : ""}
      <div class="sgi-lote-card-body">
        <div class="sgi-lote-card-code">${escapeHtml(lote.codigo_lote)}</div>
        <div class="sgi-lote-card-meta">${meta || "&nbsp;"}</div>
        <div class="sgi-lote-card-precio">${fmtCOP(lote.precio_base)}</div>
        <button type="button" class="sgi-lote-card-btn" data-ver-detalle="${lote.id_lote}">Ver detalle</button>
      </div>`;
  }

  function addTileToggle(map, wrap) {
    let current = "light";
    let layer = L.tileLayer(TILES.light.url, {
      attribution: TILES.light.attribution, maxZoom: TILES.light.maxZoom, subdomains: TILES.light.subdomains,
    }).addTo(map);

    const box = document.createElement("div");
    box.className = "sgi-map-tile-toggle";
    box.innerHTML = Object.entries(TILES)
      .map(([key, t]) => `<button type="button" data-tile="${key}" class="${key === current ? "active" : ""}">${t.label}</button>`)
      .join("");
    wrap.appendChild(box);

    box.addEventListener("click", e => {
      const btn = e.target.closest("[data-tile]");
      if (!btn || btn.dataset.tile === current) return;
      current = btn.dataset.tile;
      box.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
      map.removeLayer(layer);
      const t = TILES[current];
      layer = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom, subdomains: t.subdomains }).addTo(map);
      layer.bringToBack();
    });
  }

  function addLegend(wrap, misCodigosLoteSize) {
    const legend = document.createElement("div");
    legend.className = "sgi-map-legend";
    legend.innerHTML = ESTADO_ORDER
      .map(k => `<span class="sgi-map-legend-item"><span class="sgi-map-legend-dot" style="background:${ESTADO_COLOR[k]}"></span>${ESTADO_LABEL[k]}</span>`)
      .join("") + (misCodigosLoteSize ? `<span class="sgi-map-legend-item"><span class="sgi-map-legend-dot" style="background:var(--accent)"></span>Tu lote</span>` : "");
    wrap.appendChild(legend);
  }

  function addEmptyState(wrap, msg) {
    const empty = document.createElement("div");
    empty.className = "sgi-map-empty";
    empty.innerHTML = `<strong>Sin lotes geolocalizados</strong><span>${escapeHtml(msg)}</span>`;
    wrap.appendChild(empty);
    return empty;
  }

  function baseMap(canvas) {
    return L.map(canvas, { zoomControl: true, attributionControl: true, minZoom: 3, scrollWheelZoom: true });
  }

  // ------------------------------------------------------------------
  // MAP-01 / MAP-03 — read-only view with hover cards + filters
  // ------------------------------------------------------------------
  function render(container, options) {
    const {
      lotes = [],
      proyecto = null,
      misCodigosLote = new Set(),
      onSelect = null,
    } = options;

    container.innerHTML = `<div class="sgi-map-wrap"><div class="sgi-map-canvas"></div></div>`;
    const wrap   = container.querySelector(".sgi-map-wrap");
    const canvas = container.querySelector(".sgi-map-canvas");

    const map = baseMap(canvas);
    addTileToggle(map, wrap);

    const group = L.featureGroup().addTo(map);
    const layerByLoteId = {};
    const conGeom = lotes.filter(hasValidGeom);

    conGeom.forEach(l => {
      const isMine = misCodigosLote.has(l.codigo_lote);
      const layer = L.polygon(toLatLngs(l.geom), {
        className: polygonClassName(l, isMine),
        weight: isMine ? 3 : 2,
        fillOpacity: 0.35,
      }).addTo(group);
      layerByLoteId[l.id_lote] = layer;

      layer.bindTooltip(
        `${l.codigo_lote}${l.area_m2 ? " · " + l.area_m2 + " m²" : ""}`,
        { sticky: true, className: "sgi-lote-tooltip", direction: "top" }
      );
      layer.bindPopup(popupHtml(l), { minWidth: 220 });
      layer.on("mouseover", () => layer.bringToFront());
      layer.on("popupopen", () => {
        const btn = document.querySelector(`[data-ver-detalle="${l.id_lote}"]`);
        if (btn) btn.addEventListener("click", () => onSelect && onSelect(l), { once: true });
      });
    });

    if (conGeom.length) {
      map.fitBounds(group.getBounds(), { padding: [24, 24] });
      addLegend(wrap, misCodigosLote.size);
    } else if (proyecto?.lat != null && proyecto?.lng != null) {
      map.setView([proyecto.lat, proyecto.lng], 17);
      addEmptyState(wrap, "El equipo de topografia aun no ha dibujado el contorno de los lotes de este proyecto.");
    } else {
      map.setView(COLOMBIA_CENTER, 6);
      addEmptyState(wrap, "Este proyecto aun no tiene coordenadas ni lotes geolocalizados.");
    }

    // MAP-03: price / area / estado filters — dim non-matching lotes, keep the rest full color.
    if (conGeom.length) {
      let filters = { precioMin: null, precioMax: null, areaMin: null, areaMax: null, estados: new Set(ESTADO_ORDER) };

      const panel = document.createElement("div");
      panel.className = "sgi-map-filters";
      panel.innerHTML = `
        <div class="sgi-map-filters-title">${window.SGIUI?.icon("sliders-horizontal") ?? ""} Filtros</div>
        <div class="sgi-map-filters-row">
          <label>Precio (COP)</label>
          <div class="sgi-map-filters-range">
            <input type="number" min="0" placeholder="Min" data-f="precioMin" />
            <input type="number" min="0" placeholder="Max" data-f="precioMax" />
          </div>
        </div>
        <div class="sgi-map-filters-row">
          <label>Area (m²)</label>
          <div class="sgi-map-filters-range">
            <input type="number" min="0" placeholder="Min" data-f="areaMin" />
            <input type="number" min="0" placeholder="Max" data-f="areaMax" />
          </div>
        </div>
        <div class="sgi-map-filters-row">
          <label>Estado</label>
          <div class="sgi-map-filters-chips">
            ${ESTADO_ORDER.map(k => `<span class="sgi-map-filters-chip active" data-estado="${k}">${ESTADO_LABEL[k]}</span>`).join("")}
          </div>
        </div>
        <button type="button" class="sgi-map-filters-reset">Limpiar filtros</button>`;
      wrap.appendChild(panel);

      const applyFilters = () => {
        conGeom.forEach(l => {
          const layer = layerByLoteId[l.id_lote];
          if (!layer || !layer._path) return;
          const estado = String(l.estado || "disponible").toLowerCase();
          const precio = Number(l.precio_base) || 0;
          const area   = Number(l.area_m2) || 0;
          let match = filters.estados.has(estado);
          if (match && filters.precioMin != null) match = precio >= filters.precioMin;
          if (match && filters.precioMax != null) match = precio <= filters.precioMax;
          if (match && filters.areaMin  != null) match = area  >= filters.areaMin;
          if (match && filters.areaMax  != null) match = area  <= filters.areaMax;
          layer._path.classList.toggle("sgi-lote-poly-dim", !match);
        });
      };

      panel.querySelectorAll("input[data-f]").forEach(input => {
        input.addEventListener("input", () => {
          filters[input.dataset.f] = input.value === "" ? null : Number(input.value);
          applyFilters();
        });
      });

      panel.querySelectorAll("[data-estado]").forEach(chip => {
        chip.addEventListener("click", () => {
          const k = chip.dataset.estado;
          if (filters.estados.has(k)) { filters.estados.delete(k); chip.classList.remove("active"); }
          else { filters.estados.add(k); chip.classList.add("active"); }
          applyFilters();
        });
      });

      panel.querySelector(".sgi-map-filters-reset").addEventListener("click", () => {
        filters = { precioMin: null, precioMax: null, areaMin: null, areaMax: null, estados: new Set(ESTADO_ORDER) };
        panel.querySelectorAll("input[data-f]").forEach(i => { i.value = ""; });
        panel.querySelectorAll("[data-estado]").forEach(c => c.classList.add("active"));
        applyFilters();
      });
    }

    return {
      destroy: () => map.remove(),
      panTo: idLote => {
        const layer = layerByLoteId[idLote];
        if (layer) { map.fitBounds(layer.getBounds(), { maxZoom: 19, padding: [40, 40] }); layer.openPopup(); }
      },
    };
  }

  // ------------------------------------------------------------------
  // MAP-02 — drawing / editing contours with Leaflet-Geoman (topografo/admin)
  // ------------------------------------------------------------------
  function renderEditor(container, options) {
    const { proyecto, lotes = [], onGeomChange, onCentroChange } = options;

    container.innerHTML = `
      <div class="sgi-map-editor-layout">
        <div class="sgi-map-editor-sidebar">
          ${lotes.map(l => `
            <div class="sgi-map-lote-item" data-id="${l.id_lote}">
              <div>
                <div class="sgi-map-lote-item-code">${escapeHtml(l.codigo_lote)}</div>
                <div class="sgi-map-lote-item-meta">${[l.manzana ? "Mz " + escapeHtml(l.manzana) : "", l.area_m2 ? l.area_m2 + " m²" : ""].filter(Boolean).join(" · ")}</div>
              </div>
              <span class="sgi-map-lote-item-status ${hasValidGeom(l) ? "done" : "pending"}">${hasValidGeom(l) ? "Ubicado" : "Sin ubicar"}</span>
            </div>`).join("") || `<p style="color:var(--text-muted);font-size:0.8125rem;padding:0.5rem">Sin lotes en este proyecto.</p>`}
        </div>
        <div>
          <div class="sgi-map-editor-toolbar">
            <span class="sgi-map-editor-hint">Selecciona un lote para dibujar o ajustar su contorno.</span>
            <button type="button" class="btn btn-sm" data-action="draw" disabled>Dibujar contorno</button>
            <button type="button" class="btn btn-sm" data-action="edit" disabled>Editar</button>
            <button type="button" class="btn btn-sm" data-action="save" disabled>Guardar</button>
            <button type="button" class="btn btn-sm btn-danger" data-action="delete" disabled>Borrar contorno</button>
            <button type="button" class="btn btn-sm" data-action="centro">Fijar centro del proyecto aqui</button>
          </div>
          <div class="sgi-map-wrap" style="margin-top:0.625rem">
            <div class="sgi-map-canvas sgi-map-canvas-editor"></div>
          </div>
        </div>
      </div>`;

    const wrap     = container.querySelector(".sgi-map-wrap");
    const canvas   = container.querySelector(".sgi-map-canvas");
    const toolbar  = container.querySelector(".sgi-map-editor-toolbar");
    const hint     = toolbar.querySelector(".sgi-map-editor-hint");
    const btnDraw  = toolbar.querySelector('[data-action="draw"]');
    const btnEdit  = toolbar.querySelector('[data-action="edit"]');
    const btnSave  = toolbar.querySelector('[data-action="save"]');
    const btnDel   = toolbar.querySelector('[data-action="delete"]');
    const btnCentro = toolbar.querySelector('[data-action="centro"]');

    const map = baseMap(canvas);
    addTileToggle(map, wrap);
    // No map.pm.addControls(): drawing/editing is driven entirely by our own per-lote toolbar
    // above (Dibujar/Editar/Guardar/Borrar), not Geoman's generic global toolbar.
    map.pm.setGlobalOptions({ allowSelfIntersection: false });

    const group = L.featureGroup().addTo(map);
    const layerByLoteId = {};

    function drawLayer(lote) {
      const layer = L.polygon(toLatLngs(lote.geom), { className: polygonClassName(lote, false), weight: 2, fillOpacity: 0.3 }).addTo(group);
      layer.bindTooltip(lote.codigo_lote, { sticky: true, className: "sgi-lote-tooltip" });
      layerByLoteId[lote.id_lote] = layer;
      return layer;
    }

    lotes.filter(hasValidGeom).forEach(drawLayer);

    if (group.getLayers().length) map.fitBounds(group.getBounds(), { padding: [24, 24] });
    else if (proyecto?.lat != null && proyecto?.lng != null) map.setView([proyecto.lat, proyecto.lng], 17);
    else map.setView(COLOMBIA_CENTER, 6);

    let activeId = null;

    function setToolbarState() {
      const l = lotes.find(x => x.id_lote === activeId);
      const has = !!l && hasValidGeom(l);
      btnDraw.disabled = activeId == null || has;
      btnEdit.disabled = activeId == null || !has;
      btnDel.disabled  = activeId == null || !has;
      btnSave.disabled = true;
      hint.textContent = activeId == null
        ? "Selecciona un lote para dibujar o ajustar su contorno."
        : `Lote ${l.codigo_lote} seleccionado — ${has ? "puedes editarlo o borrarlo" : "dibuja su contorno"}.`;
    }

    function selectLote(id) {
      activeId = id;
      container.querySelectorAll(".sgi-map-lote-item").forEach(el => el.classList.toggle("active", Number(el.dataset.id) === id));
      setToolbarState();
      const layer = layerByLoteId[id];
      if (layer) map.fitBounds(layer.getBounds(), { maxZoom: 19, padding: [40, 40] });
    }

    container.querySelectorAll(".sgi-map-lote-item").forEach(item => {
      item.addEventListener("click", () => selectLote(Number(item.dataset.id)));
    });

    async function persist(id, geom) {
      try {
        await onGeomChange(id, geom);
        const l = lotes.find(x => x.id_lote === id);
        if (l) l.geom = geom;

        if (layerByLoteId[id]) { group.removeLayer(layerByLoteId[id]); delete layerByLoteId[id]; }
        if (geom) drawLayer(l);

        const item = container.querySelector(`.sgi-map-lote-item[data-id="${id}"] .sgi-map-lote-item-status`);
        if (item) { item.textContent = geom ? "Ubicado" : "Sin ubicar"; item.className = `sgi-map-lote-item-status ${geom ? "done" : "pending"}`; }
        window.SGIUI?.toast?.(geom ? "Contorno guardado" : "Contorno eliminado", "success", "Exito");
      } catch (err) {
        window.SGIUI?.toast?.(err.message || "No se pudo guardar el contorno", "error", "Error");
      }
      setToolbarState();
    }

    btnDraw.addEventListener("click", () => {
      if (activeId == null) return;
      map.pm.enableDraw("Polygon", { finishOn: "dblclick" });
    });

    map.on("pm:create", e => {
      const geom = e.layer.toGeoJSON().geometry;
      e.layer.remove();
      if (activeId != null) persist(activeId, geom);
    });

    btnEdit.addEventListener("click", () => {
      const layer = layerByLoteId[activeId];
      if (!layer) return;
      layer.pm.enable();
      btnSave.disabled = false;
    });

    btnSave.addEventListener("click", () => {
      const layer = layerByLoteId[activeId];
      if (!layer) return;
      layer.pm.disable();
      persist(activeId, layer.toGeoJSON().geometry);
    });

    btnDel.addEventListener("click", () => {
      if (activeId == null) return;
      persist(activeId, null);
    });

    btnCentro.addEventListener("click", () => {
      const c = map.getCenter();
      onCentroChange && onCentroChange(c.lat, c.lng);
    });

    setToolbarState();

    return { destroy: () => map.remove() };
  }

  window.SGIMap = { render, renderEditor };
})();
