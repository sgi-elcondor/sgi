// Converts a stored GeoJSON Polygon back into the human-editable "lat,lng; lat,lng; ..."
// text used by the bulk template. Drops the closing point (first === last) so the user
// doesn't have to deal with the duplicate — the backend re-closes it on upload.
function _geomToCoordenadasText(geom) {
  if (geom?.type !== "Polygon" || !Array.isArray(geom.coordinates?.[0])) return "";
  const ring = geom.coordinates[0];
  const pts  = ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  return pts.map(([lng, lat]) => `${lat},${lng}`).join("; ");
}

async function _descargarPlantilla(proyecto, lotesDelProyecto) {
  await window.SGILibs.ensureExport();
  const SX = window.SGIExport.xlsx;
  const wb = SX.setup();

  const ws = wb.addWorksheet("Lotes", { tabColor: { argb: SX.C.primary } });
  ws.columns = [
    { header: "id_lote (no editar)", key: "id_lote",     width: 16 },
    { header: "Codigo",              key: "codigo_lote", width: 16 },
    { header: "Manzana",             key: "manzana",     width: 12 },
    { header: "N Lote",              key: "numero_lote", width: 10 },
    { header: "Area (m2)",           key: "area_m2",      width: 12 },
    { header: "Coordenadas (lat,lng; lat,lng; ...)", key: "coordenadas", width: 60 },
  ];
  SX.styleHeader(ws.getRow(1));

  lotesDelProyecto.forEach((l, i) => {
    const r = ws.addRow({
      id_lote:     l.id_lote,
      codigo_lote: l.codigo_lote,
      manzana:     l.manzana || "",
      numero_lote: l.numero_lote || "",
      area_m2:     l.area_m2 || "",
      coordenadas: _geomToCoordenadasText(l.geom),
    });
    SX.styleBody(r, i % 2 !== 0);
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const guia = wb.addWorksheet("Instrucciones");
  guia.columns = [{ width: 3 }, { width: 95 }];
  const rows = [
    ["", "Como completar esta plantilla"],
    ["", ""],
    ["", "1. No modifiques la columna 'id_lote' ni borres filas: identifican cada lote."],
    ["", "2. En la columna 'Coordenadas', escribe los vertices del contorno del lote en orden"],
    ["", "   (recorriendo el perimetro), separados por punto y coma:"],
    ["", "   4.161234,-74.845678; 4.161500,-74.845400; 4.161100,-74.845100"],
    ["", ""],
    ["", "3. Minimo 3 puntos. No hace falta repetir el primer punto al final para cerrar"],
    ["", "   el contorno: el sistema lo cierra automaticamente."],
    ["", ""],
    ["", "4. Como conseguir las coordenadas: en Google Maps, clic derecho sobre cada esquina"],
    ["", "   del predio copia las coordenadas (aparecen como 'lat, lng'); pegalas en orden."],
    ["", ""],
    ["", "5. Deja la celda de Coordenadas vacia en los lotes que NO quieres modificar: esa"],
    ["", "   fila se omite y su contorno actual (si tiene) se conserva sin cambios."],
    ["", ""],
    ["", "6. Guarda el archivo y subelo de vuelta desde el boton 'Subir plantilla'."],
    ["", ""],
    ["", "Como lo guarda el sistema: cada contorno se convierte a formato GeoJSON (el estandar"],
    ["", "de mapas) y se guarda en el lote. Se ve de inmediato en 'El Proyecto' y en este editor,"],
    ["", "y sigue siendo editable a mano (dibujo/arrastre) despues de la carga masiva."],
  ];
  rows.forEach((r, i) => {
    const row = guia.addRow(r);
    if (i === 0) row.getCell(2).font = { name: "Calibri", bold: true, size: 13 };
    else row.getCell(2).font = { name: "Calibri", size: 10.5 };
    row.getCell(2).alignment = { wrapText: true };
  });

  const nombre = (proyecto.sigla || proyecto.nombre || "proyecto").toString()
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await SX.download(wb, `plantilla-mapa-${nombre}.xlsx`);
}

async function _leerPlantilla(file) {
  await window.SGILibs.ensureExport();
  const buffer = await file.arrayBuffer();
  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet("Lotes");
  if (!ws) throw new Error("El archivo no tiene una hoja 'Lotes'. Usa la plantilla descargada desde este editor.");

  const filas = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const idLote = row.getCell(1).value;
    if (idLote == null || idLote === "") return;
    filas.push({
      id_lote:     Number(idLote),
      codigo_lote: row.getCell(2).value ?? "",
      coordenadas: String(row.getCell(6).value ?? ""),
    });
  });
  return filas;
}

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
  let pendingResultado = ""; // batch-upload result HTML to re-show after a data refresh + re-render

  function initEditor(proyecto, lotesDelProyecto) {
    if (editorHandle) { editorHandle.destroy(); editorHandle = null; }
    const editorContainer = document.getElementById("mapa-editor-container");
    if (!editorContainer || !proyecto) return;

    editorContainer.innerHTML = UI.loader();
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
          <div class="table-header"><h3>${window.SGIUI?.icon("file-spreadsheet") ?? ""} Carga masiva de coordenadas</h3></div>
          <div class="mapa-batch-panel">
            <p class="mapa-batch-intro">
              Descarga la plantilla con todos los lotes de <strong>${proyecto?.nombre || "este proyecto"}</strong>,
              completa la columna de coordenadas en Excel y vuelve a subirla para actualizar
              varios contornos a la vez.
            </p>
            <div class="mapa-batch-actions">
              <button type="button" class="btn btn-sm" id="mapa-batch-download">
                ${window.SGIUI?.icon("download") ?? ""} Descargar plantilla (.xlsx)
              </button>
              <label class="btn btn-sm mapa-batch-upload-label">
                ${window.SGIUI?.icon("upload") ?? ""} Subir plantilla
                <input type="file" id="mapa-batch-file" accept=".xlsx" hidden>
              </label>
              <span id="mapa-batch-filename" class="mapa-batch-filename"></span>
            </div>
            <details class="mapa-batch-guide">
              <summary>${window.SGIUI?.icon("help-circle") ?? ""} ¿Cómo funciona la carga masiva?</summary>
              <ol>
                <li>Descarga la plantilla: trae una fila por cada lote del proyecto, con su código y, si ya tiene contorno, sus coordenadas actuales.</li>
                <li>Abre el archivo en Excel, Google Sheets o similar.</li>
                <li>En la columna <strong>Coordenadas</strong>, escribe los vértices del contorno recorriendo el perímetro del predio, separados por punto y coma: <code>4.161234,-74.845678; 4.161500,-74.845400; 4.161100,-74.845100</code></li>
                <li>Mínimo 3 puntos. No hace falta repetir el primer punto al final — el sistema cierra el contorno automáticamente.</li>
                <li>¿De dónde salen las coordenadas? En Google Maps, clic derecho sobre cada esquina del predio copia "lat, lng" al portapapeles.</li>
                <li>Deja en blanco la columna de coordenadas en los lotes que no quieres tocar: esa fila se omite y el contorno actual (si existe) se conserva igual.</li>
                <li>No edites la columna <strong>id_lote</strong> ni borres filas — es lo que identifica cada lote al subir el archivo.</li>
                <li>Guarda y sube el archivo con el botón "Subir plantilla". El sistema valida cada fila: aplica las correctas y te muestra el detalle de cualquier error para que solo corrijas esas.</li>
              </ol>
              <p class="mapa-batch-guide-note">
                El contorno se guarda como GeoJSON en el lote y se ve de inmediato en "El Proyecto"
                y en este editor; después de la carga masiva sigue siendo editable a mano (dibujo/arrastre) como siempre.
              </p>
            </details>
            <div id="mapa-batch-resultado"></div>
          </div>
        </section>

        <section class="table-wrap" style="margin-top:0.75rem">
          <div class="table-header"><h3>${window.SGIUI?.icon("pencil-ruler") ?? ""} Contorno de lotes</h3></div>
          <div id="mapa-editor-container" style="padding:1rem 1.25rem">${UI.loader()}</div>
        </section>
      </section>`;

    window.SGIUI?.hydrate();

    if (pendingResultado) {
      const el = document.getElementById("mapa-batch-resultado");
      if (el) el.innerHTML = pendingResultado;
      pendingResultado = "";
      window.SGIUI?.hydrate();
    }

    vc.querySelectorAll("[data-pidx]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedProyectoIdx = Number(btn.dataset.pidx);
        render(selectedProyectoIdx);
      });
    });

    const btnDescargar = document.getElementById("mapa-batch-download");
    const fileInput     = document.getElementById("mapa-batch-file");
    const filenameEl     = document.getElementById("mapa-batch-filename");
    const resultadoEl    = document.getElementById("mapa-batch-resultado");

    btnDescargar?.addEventListener("click", async () => {
      btnDescargar.disabled = true;
      const original = btnDescargar.innerHTML;
      btnDescargar.textContent = "Generando...";
      try {
        await _descargarPlantilla(proyecto, lotesDelProyecto);
      } catch (e) {
        window.SGIUI?.toast?.(e.message || "No se pudo generar la plantilla", "error", "Error");
      } finally {
        btnDescargar.disabled = false;
        btnDescargar.innerHTML = original;
        window.SGIUI?.hydrate();
      }
    });

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      filenameEl.textContent = file.name;
      resultadoEl.innerHTML = `<p class="mapa-batch-loading">${window.SGIUI?.icon("loader-2") ?? ""} Procesando "${file.name}"...</p>`;
      window.SGIUI?.hydrate();

      try {
        const filas = await _leerPlantilla(file);
        if (!filas.length) throw new Error("No se encontraron filas con id_lote en el archivo.");

        const resp = await API.post("/lotes/geometria-batch", { id_proyecto: proyecto.id_proyecto, filas });

        const okMsg = `${resp.actualizados} lote(s) actualizado(s)${resp.omitidos ? `, ${resp.omitidos} sin cambios (vacios)` : ""}.`;
        const erroresHtml = (resp.errores || []).length
          ? `<div class="mapa-batch-errores">
              <p>${resp.errores.length} fila(s) con error:</p>
              <ul>${resp.errores.map(e => `<li>Fila ${e.fila} (${e.codigo_lote || "?"}): ${e.motivo}</li>`).join("")}</ul>
            </div>`
          : "";
        const resultadoHtml = `<p class="mapa-batch-ok">${window.SGIUI?.icon("check-circle") ?? ""} ${okMsg}</p>${erroresHtml}`;
        window.SGIUI?.toast?.(okMsg, resp.errores?.length ? "info" : "success", resp.errores?.length ? "Carga con avisos" : "Exito");

        if (resp.actualizados > 0) {
          lotes = await API.get("/lotes");
          Object.keys(lotesPorProyecto).forEach(k => delete lotesPorProyecto[k]);
          lotes.forEach(l => {
            if (!lotesPorProyecto[l.id_proyecto]) lotesPorProyecto[l.id_proyecto] = [];
            lotesPorProyecto[l.id_proyecto].push(l);
          });
          pendingResultado = resultadoHtml;
          render(selectedProyectoIdx);
        } else {
          resultadoEl.innerHTML = resultadoHtml;
          window.SGIUI?.hydrate();
        }
      } catch (e) {
        resultadoEl.innerHTML = `<p class="mapa-batch-error">${window.SGIUI?.icon("x-circle") ?? ""} ${e.message || "No se pudo procesar el archivo"}</p>`;
        window.SGIUI?.hydrate();
      } finally {
        fileInput.value = "";
      }
    });

    initEditor(proyecto, lotesDelProyecto);
  }

  render(selectedProyectoIdx);
};
