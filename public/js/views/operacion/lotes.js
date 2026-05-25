(() => {
  function sgiNormalizeText(text = "") {
    return String(text)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
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
      vendido:    "badge badge-success",
      entregado:  "badge badge-muted"
    };
    return `<span class="${classMap[normalized] || "badge badge-muted"}">${estado}</span>`;
  }

  function sgiExtraerArray(data) {
    if (Array.isArray(data))           return data;
    if (Array.isArray(data?.data))     return data.data;
    if (Array.isArray(data?.items))    return data.items;
    if (Array.isArray(data?.lotes))    return data.lotes;
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
    return { ...proyecto, id: sgiGetProyectoId(proyecto), nombre, sigla: proyecto.sigla || "" };
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
        lote.manzana    ? `Mz${lote.manzana}`    : "",
        lote.numero_lote ? `Lt${lote.numero_lote}` : ""
      ].filter(Boolean).join(" ") ||
      "—";

    const area = lote.area_m2 ?? lote.area ?? lote.area_total ?? 0;

    return {
      ...lote,
      id:           lote.id_lote ?? lote.id,
      id_lote:      lote.id_lote ?? lote.id,
      codigo,
      codigo_lote:  codigo,
      manzana:      lote.manzana      || "—",
      numero_lote:  lote.numero_lote  || "—",
      proyectoId,
      proyecto,
      area,
      dimensiones:  lote.dimensiones || `${area} m²`,
      precio:       lote.precio_base ?? lote.precio_lista ?? lote.precio ?? lote.valor ?? 0,
      estado:       lote.estado || "Disponible",
      fechaCreacion:
        lote.fecha_creacion ||
        lote.fechaCreacion  ||
        lote.createdAt      ||
        lote.created_at     ||
        lote.fecha_registro ||
        null
    };
  }

  function sgiParseCodigoLote(codigo) {
    const value = String(codigo || "").trim().toUpperCase();
    if (!value) return { manzana: "", numero_lote: "" };
    const parts = value.split(/[-\s]+/).filter(Boolean);
    if (parts.length >= 2) return { manzana: parts[0], numero_lote: parts.slice(1).join("-") };
    return { manzana: "", numero_lote: value };
  }

  function sgiLoteBuildSummary(lotes) {
    const summary = { total: lotes.length, disponibles: 0, vendidos: 0, entregados: 0 };
    lotes.forEach(lote => {
      const estado = sgiNormalizeText(lote.estado);
      if (estado === "disponible") summary.disponibles += 1;
      if (estado === "vendido")    summary.vendidos    += 1;
      if (estado === "entregado")  summary.entregados  += 1;
    });
    return summary;
  }

  function sgiLoteApplyFilters(lotes, state) {
    const search = sgiNormalizeText(state.search);
    return lotes.filter(lote => {
      const matchesProject = !state.proyecto || String(lote.proyectoId) === String(state.proyecto);
      const haystack = [lote.codigo, lote.manzana, lote.numero_lote, lote.proyecto, lote.estado]
        .map(sgiNormalizeText).join(" ");
      const matchesSearch = !search || haystack.includes(search);
      return matchesProject && matchesSearch;
    });
  }

  function sgiLoteSortByCol(lotes, col, dir) {
    if (!col) {
      return [...lotes].sort((a, b) => {
        const pc = String(a.proyecto).localeCompare(String(b.proyecto), "es", { sensitivity: "base" });
        if (pc !== 0) return pc;
        return String(a.codigo).localeCompare(String(b.codigo), "es", { numeric: true, sensitivity: "base" });
      });
    }

    const numericCols = new Set(["area", "precio"]);
    const dateCols    = new Set(["fechaCreacion"]);

    return [...lotes].sort((a, b) => {
      let va = a[col] ?? "";
      let vb = b[col] ?? "";
      let cmp;
      if (dateCols.has(col)) {
        cmp = new Date(va || 0).getTime() - new Date(vb || 0).getTime();
      } else if (numericCols.has(col)) {
        cmp = Number(va) - Number(vb);
      } else {
        cmp = String(va).localeCompare(String(vb), "es", { numeric: true, sensitivity: "base" });
      }
      return dir === "asc" ? cmp : -cmp;
    });
  }

  function sgiLoteBuildRows(lotes, { showActions = false } = {}) {
    const cols = showActions ? 9 : 8;
    if (!lotes.length) {
      return `<tr><td colspan="${cols}" class="empty-row">No hay lotes que coincidan con los filtros actuales.</td></tr>`;
    }
    return lotes.map(lote => `
      <tr>
        <td>${lote.proyecto}</td>
        <td><strong>${lote.codigo}</strong></td>
        <td>${lote.manzana}</td>
        <td>${lote.numero_lote}</td>
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
    if (window.UI?.toast) { UI.toast(message, type === "success" ? "ok" : "error"); return; }
    const root  = sgiEnsureToastRoot();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-title">${type === "success" ? "Éxito" : "Atención"}</div>
      <div class="toast-message">${message}</div>
    `;
    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 220); }, 2800);
  }

  function sgiCloseLoteModal() {
    const overlay = document.getElementById("modalOverlay");
    const title   = document.getElementById("modalTitle");
    const body    = document.getElementById("modalBody");
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
    return sgiExtraerArray(data).map(sgiNormalizarProyecto).filter(p => p.id);
  }

  async function sgiCrearLoteBackend(payload) {
    const codigo      = String(payload.codigo || "").trim().toUpperCase();
    const proyectoId  = Number(payload.proyectoId);
    const area        = Number(payload.area);
    const precio      = Number(payload.precio);
    const manzana     = String(payload.manzana || "").trim().toUpperCase();
    const numeroLote  = String(payload.numero_lote || "").trim();
    const dimensiones = String(payload.dimensiones || `${area} m²`).trim();
    const descripcion = String(payload.descripcion || "").trim() || null;
    const codigoPartes = sgiParseCodigoLote(codigo);

    if (!codigo) throw new Error("El código del lote es obligatorio.");
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) throw new Error("Debes seleccionar un proyecto válido antes de crear el lote.");
    if (!Number.isFinite(area)   || area   <= 0) throw new Error("El área debe ser mayor a cero.");
    if (!Number.isFinite(precio) || precio <= 0) throw new Error("El precio debe ser mayor a cero.");

    return API.post("/lotes", {
      id_proyecto:  proyectoId,
      codigo_lote:  codigo,
      manzana:      manzana || codigoPartes.manzana || codigo,
      numero_lote:  numeroLote || codigoPartes.numero_lote || codigo,
      area_m2:      area,
      dimensiones,
      precio_base:  precio,
      precio_lista: precio,
      descripcion,
      estado: "disponible"
    });
  }

  function sgiOpenCreateLoteModal(proyectos, onCreated) {
    const overlay  = document.getElementById("modalOverlay");
    const title    = document.getElementById("modalTitle");
    const body     = document.getElementById("modalBody");
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
              ${proyectos.length
                ? proyectos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join("")
                : `<option value="" disabled>No hay proyectos disponibles</option>`}
            </select>
          </div>

          <div class="form-group">
            <label for="loteManzana">Manzana</label>
            <input id="loteManzana" name="manzana" type="text" placeholder="Ej: A" />
          </div>

          <div class="form-group">
            <label for="loteNumero">Número de lote</label>
            <input id="loteNumero" name="numero_lote" type="text" placeholder="Ej: 22" />
          </div>

          <div class="form-group">
            <label for="loteCodigo">Código del lote</label>
            <input id="loteCodigo" name="codigo" type="text" placeholder="Se genera automáticamente" required />
          </div>

          <div class="form-group">
            <label for="loteArea">Área total (m²)</label>
            <input id="loteArea" name="area" type="number" min="1" step="1" placeholder="Ej: 150" required />
          </div>

          <div class="form-group">
            <label for="loteDimensiones">Medidas del lote</label>
            <input id="loteDimensiones" name="dimensiones" type="text" placeholder="Ej: 10m × 15m" />
          </div>

          <div class="form-group">
            <label for="lotePrecio">Precio</label>
            <input id="lotePrecio" name="precio" type="text" inputmode="numeric" placeholder="Ej: 65.000.000" required />
          </div>

          <div class="form-group">
            <label for="loteEstadoInicial">Estado inicial</label>
            <input id="loteEstadoInicial" type="text" value="Disponible" disabled />
          </div>

          <div class="form-group form-group--full">
            <label for="loteDescripcion">Descripción</label>
            <textarea id="loteDescripcion" name="descripcion" rows="3" placeholder="Observaciones o detalles adicionales del lote"></textarea>
          </div>
        </div>

        <div class="form-note">
          El lote se creará asociado a un proyecto existente y con estado inicial
          <strong>Disponible</strong> para futuras ventas.
        </div>

        <div id="sgiLoteFormError" class="form-error" style="display:none;"></div>

        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="sgiCancelCreateLote">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="sgiSubmitCreateLote">Guardar lote</button>
        </div>
      </form>
    `;

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    const form        = document.getElementById("sgiCreateLoteForm");
    const cancelBtn   = document.getElementById("sgiCancelCreateLote");
    const submitBtn   = document.getElementById("sgiSubmitCreateLote");
    const errorBox    = document.getElementById("sgiLoteFormError");
    const codigoInput = document.getElementById("loteCodigo");
    const proyectoSelect  = document.getElementById("loteProyecto");
    const manzanaInput    = document.getElementById("loteManzana");
    const numeroInput     = document.getElementById("loteNumero");
    const areaInput       = document.getElementById("loteArea");
    const dimensionesInput = document.getElementById("loteDimensiones");

    let codigoTouched = false;
    codigoInput.addEventListener("input", () => { codigoTouched = true; });

    function sgiAutoGenerarCodigo() {
      if (codigoTouched) return;
      const proyecto = proyectos.find(p => String(p.id) === String(proyectoSelect.value));
      const sigla    = proyecto?.sigla || "";
      const manzana  = manzanaInput.value.trim().toUpperCase();
      const numero   = numeroInput.value.trim().toUpperCase();
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
      if (!dimensionesTouched) dimensionesInput.value = areaInput.value ? `${areaInput.value} m²` : "";
    });

    const closeHandler = () => sgiCloseLoteModal();
    closeBtn.onclick  = closeHandler;
    cancelBtn.onclick = closeHandler;

    form.onsubmit = async event => {
      event.preventDefault();
      errorBox.style.display = "none";
      errorBox.textContent   = "";

      const formData = new FormData(form);
      const payload  = {
        codigo:       formData.get("codigo"),
        proyectoId:   Number(formData.get("proyectoId")),
        manzana:      formData.get("manzana"),
        numero_lote:  formData.get("numero_lote"),
        area:         formData.get("area"),
        dimensiones:  formData.get("dimensiones"),
        precio:       String(formData.get("precio") || "").replace(/\./g, ""),
        descripcion:  formData.get("descripcion")
      };

      try {
        submitBtn.disabled    = true;
        submitBtn.textContent = "Guardando...";
        const nuevoLote = await sgiCrearLoteBackend(payload);
        sgiCloseLoteModal();
        sgiShowToast(`Lote ${nuevoLote?.codigo_lote || nuevoLote?.codigo || payload.codigo} creado correctamente.`, "success");
        onCreated?.();
      } catch (error) {
        errorBox.textContent   = error.message || "No fue posible crear el lote.";
        errorBox.style.display = "block";
      } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = "Guardar lote";
      }
    };
  }

  // ── Tabla con headers clicables ────────────────────────────────────────────

  const EXPORT_ROLES = ["admin", "gerencia", "auxiliar_contable"];

  const LOTE_COLS = [
    { key: "proyecto",      label: "Proyecto"        },
    { key: "codigo",        label: "Código"          },
    { key: "manzana",       label: "Manzana"         },
    { key: "numero_lote",   label: "Núm. Lote"       },
    { key: "area",          label: "Área"            },
    { key: "precio",        label: "Precio"          },
    { key: "estado",        label: "Estado"          },
    { key: "fechaCreacion", label: "Fecha creación"  },
  ];

  function buildLotesTableHTML(filteredLotes, sortState, canCreate) {
    const thead = `<thead><tr>
      ${LOTE_COLS.map(c => {
        const active = sortState.sortCol === c.key;
        const cls    = active ? `sortable sort-${sortState.sortDir}` : "sortable";
        return `<th class="${cls}" data-col="${c.key}">${c.label} <span class="sort-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M423.5-574 289.29-439.79Q272-422.5 248.5-421.75t-41.48-16.75q-17.52-17.5-16.77-41t18.07-40.81L439.41-751.1q7.91-7.9 18.97-13.15 11.06-5.25 21.78-5.25 10.71 0 21.78 5.25Q513-759 520.5-751.5l232 232q19 19 19 40.75t-18.52 39.25Q735-422 712.08-422q-22.91 0-40.08-17.5L536.5-574v349.52q0 22.79-16.79 39.64Q502.92-168 480.21-168t-39.71-16.84q-17-16.85-17-39.64V-574Z"/></svg></span></th>`;
      }).join("")}
      ${canCreate ? "<th>Acción</th>" : ""}
    </tr></thead>`;

    const sorted = sgiLoteSortByCol(filteredLotes, sortState.sortCol, sortState.sortDir);
    const tbody  = `<tbody>${sgiLoteBuildRows(sorted, { showActions: canCreate })}</tbody>`;
    return thead + tbody;
  }

  function wireLotesSortHeaders(tableEl, filteredLotes, sortState, canCreate) {
    tableEl.querySelectorAll("th[data-col]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (sortState.sortCol === col) {
          sortState.sortDir = sortState.sortDir === "asc" ? "desc" : "asc";
        } else {
          sortState.sortCol = col;
          sortState.sortDir = "asc";
        }
        tableEl.innerHTML = buildLotesTableHTML(filteredLotes, sortState, canCreate);
        wireLotesSortHeaders(tableEl, filteredLotes, sortState, canCreate);
      });
    });
  }

  // ── Exportación ───────────────────────────────────────────────────────────

  async function exportLotesExcel(filteredLotes, proyectos) {
    const ORANGE      = "FFFF4E00";
    const ORANGE_SOFT = "FFFFF2EE";
    const ORANGE_MID  = "FFFFCFBD";
    const DARK        = "FF1E2937";
    const WHITE       = "FFFFFFFF";
    const GRAY_LIGHT  = "FFF8F9FA";

    const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    const subFill    = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_MID } };
    const altFill    = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_SOFT } };
    const plainFill  = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
    const titleFont  = { bold: true, size: 14, color: { argb: WHITE }, name: "Calibri" };
    const headerFont = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    const subFont    = { bold: true, size: 10, color: { argb: ORANGE }, name: "Calibri" };
    const bodyFont   = { size: 10, color: { argb: DARK }, name: "Calibri" };
    const thinBorder = { style: "thin", color: { argb: ORANGE_MID } };
    const cellBorder = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    function applyTableRow(row, isAlt) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill      = isAlt ? altFill : plainFill;
        cell.font      = bodyFont;
        cell.border    = cellBorder;
        cell.alignment = { vertical: "middle", wrapText: true };
      });
      row.height = 18;
    }

    function applyHeaderRow(row) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill      = headerFill;
        cell.font      = headerFont;
        cell.border    = cellBorder;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      row.height = 22;
    }

    const totalDisp     = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "disponible").length;
    const totalVend     = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "vendido").length;
    const totalEntregado = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "entregado").length;

    const wb = new ExcelJS.Workbook();
    wb.creator = "SGI El Cóndor";
    wb.created = new Date();

    // ── Hoja 1: Resumen ──────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet("Resumen", { tabColor: { argb: ORANGE } });
    ws1.columns = [
      { key: "a", width: 38 },
      { key: "b", width: 16 },
      { key: "c", width: 52 },
    ];

    ws1.mergeCells("A1:C1");
    Object.assign(ws1.getCell("A1"), {
      value:     "INVENTARIO DE LOTES — EL CÓNDOR S.A.S.",
      fill:      headerFill,
      font:      titleFont,
      alignment: { horizontal: "center", vertical: "middle" },
    });
    ws1.getRow(1).height = 32;

    ws1.mergeCells("A2:C2");
    Object.assign(ws1.getCell("A2"), {
      value:     "Sistema de Gestión Inmobiliaria (SGI)",
      fill:      { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF7733" } },
      font:      { bold: false, size: 10, color: { argb: WHITE }, name: "Calibri" },
      alignment: { horizontal: "center", vertical: "middle" },
    });
    ws1.getRow(2).height = 18;

    ws1.mergeCells("A3:C3");
    Object.assign(ws1.getCell("A3"), {
      value:     `Generado: ${new Date().toLocaleString("es-CO")}`,
      fill:      { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_LIGHT } },
      font:      { size: 9, color: { argb: "FF64748B" }, italic: true, name: "Calibri" },
      alignment: { horizontal: "right", vertical: "middle" },
    });
    ws1.getRow(3).height = 16;

    ws1.addRow([]);

    ws1.mergeCells("A5:C5");
    Object.assign(ws1.getCell("A5"), {
      value:     "INDICADORES GLOBALES",
      fill:      subFill,
      font:      subFont,
      alignment: { horizontal: "left", vertical: "middle" },
    });
    ws1.getRow(5).height = 20;

    applyHeaderRow(ws1.addRow(["Indicador", "Valor", "Descripción"]));

    [
      ["Total de lotes en la vista actual",    filteredLotes.length, "Lotes mostrados con los filtros aplicados al exportar"],
      ["Lotes disponibles para la venta",      totalDisp,            "Lotes sin venta activa asignada"],
      ["Lotes vendidos",                       totalVend,            "Lotes con venta activa o finalizada en el sistema"],
      ["Lotes entregados",                     totalEntregado,       "Lotes cuyo proceso de venta y entrega está finalizado"],
    ].forEach((rowData, i) => applyTableRow(ws1.addRow(rowData), i % 2 !== 0));

    ws1.addRow([]);
    ws1.mergeCells(`A${ws1.rowCount + 1}:C${ws1.rowCount + 1}`);
    const byProjCell = ws1.getCell(`A${ws1.rowCount}`);
    Object.assign(byProjCell, {
      value:     "LOTES POR PROYECTO",
      fill:      subFill,
      font:      subFont,
      alignment: { horizontal: "left", vertical: "middle" },
    });
    ws1.getRow(ws1.rowCount).height = 20;

    applyHeaderRow(ws1.addRow(["Proyecto", "Total", "Disponibles", "Vendidos", "Entregados"]));

    const byProj = {};
    filteredLotes.forEach(l => {
      const k = l.proyecto || "Sin proyecto";
      if (!byProj[k]) byProj[k] = { total: 0, disp: 0, vend: 0, entr: 0 };
      byProj[k].total++;
      const est = sgiNormalizeText(l.estado);
      if (est === "disponible") byProj[k].disp++;
      if (est === "vendido")    byProj[k].vend++;
      if (est === "entregado")  byProj[k].entr++;
    });
    Object.entries(byProj).forEach(([nombre, s], i) => {
      applyTableRow(ws1.addRow([nombre, s.total, s.disp, s.vend, s.entr]), i % 2 !== 0);
    });

    // ── Hoja 2: Lotes ────────────────────────────────────────────────────────
    const ws2 = wb.addWorksheet("Lotes", { tabColor: { argb: ORANGE } });
    ws2.columns = [
      { key: "proyecto",     width: 32 },
      { key: "codigo",       width: 16 },
      { key: "manzana",      width: 12 },
      { key: "numero_lote",  width: 14 },
      { key: "area",         width: 12 },
      { key: "precio",       width: 18 },
      { key: "estado",       width: 14 },
      { key: "dimensiones",  width: 18 },
      { key: "fechaCreacion", width: 18 },
      { key: "descripcion",  width: 42 },
    ];

    ws2.mergeCells("A1:J1");
    Object.assign(ws2.getCell("A1"), {
      value:     "INVENTARIO DE LOTES — EL CÓNDOR S.A.S.",
      fill:      headerFill,
      font:      titleFont,
      alignment: { horizontal: "center", vertical: "middle" },
    });
    ws2.getRow(1).height = 28;

    ws2.addRow([]);

    applyHeaderRow(ws2.addRow([
      "Proyecto", "Código", "Manzana", "Núm. Lote", "Área (m²)",
      "Precio", "Estado", "Dimensiones", "Fecha creación", "Descripción",
    ]));

    filteredLotes.forEach((l, i) => {
      applyTableRow(ws2.addRow([
        l.proyecto      || "",
        l.codigo        || "",
        l.manzana !== "—" ? l.manzana : "",
        l.numero_lote !== "—" ? l.numero_lote : "",
        l.area          ?? "",
        l.precio        ?? "",
        l.estado        || "",
        l.dimensiones   || "",
        l.fechaCreacion ? new Date(l.fechaCreacion).toLocaleDateString("es-CO") : "",
        l.descripcion   || "",
      ]), i % 2 !== 0);
    });

    ws2.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 10 } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `lotes_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportLotesPDF(filteredLotes) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const totalDisp      = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "disponible").length;
    const totalVend      = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "vendido").length;
    const totalEntregado = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "entregado").length;

    const C_PRIMARY = [255, 78, 0];
    const C_DARK    = [30, 41, 59];
    const C_GRAY    = [100, 116, 139];
    const C_LIGHT   = [255, 248, 245];
    const C_INFO_BG = [255, 242, 235];
    const C_WHITE   = [255, 255, 255];
    const C_DIVIDER = [255, 207, 189];

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(...C_PRIMARY);
    doc.rect(0, 0, 297, 28, "F");

    doc.setTextColor(...C_WHITE);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EL CÓNDOR S.A.S.", 14, 13);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Sistema de Gestión Inmobiliaria — SGI", 14, 21);
    doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, 283, 21, { align: "right" });

    // ── Título ────────────────────────────────────────────────────────────────
    doc.setTextColor(...C_DARK);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de Inventario de Lotes", 14, 40);

    doc.setDrawColor(...C_PRIMARY);
    doc.setLineWidth(0.6);
    doc.line(14, 43, 283, 43);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C_GRAY);
    const introLines = doc.splitTextToSize(
      "Este reporte presenta el inventario de lotes registrados en el sistema SGI El Cóndor. " +
      "Incluye el estado de cada lote (disponible, vendido o entregado), sus características físicas y precio. " +
      "Los datos reflejan el estado a la fecha de generación con los filtros activos al momento de exportar.",
      269
    );
    doc.text(introLines, 14, 49);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    let y = 63;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C_DARK);
    doc.text("Indicadores del Inventario", 14, y);

    doc.setDrawColor(...C_DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(14, y + 2, 283, y + 2);
    y += 7;

    const kpis = [
      { value: String(filteredLotes.length), label: "Total Lotes",   desc: "Lotes en la vista exportada." },
      { value: String(totalDisp),            label: "Disponibles",   desc: "Sin venta activa asignada." },
      { value: String(totalVend),            label: "Vendidos",      desc: "Con venta activa o finalizada." },
      { value: String(totalEntregado),       label: "Entregados",    desc: "Proceso de venta completado." },
    ];

    const cardW = 63;
    const cardH = 22;
    const gapX  = 3;

    kpis.forEach((k, i) => {
      const x = 14 + i * (cardW + gapX);
      doc.setFillColor(...C_LIGHT);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
      doc.setDrawColor(...C_DIVIDER);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C_PRIMARY);
      doc.text(k.value, x + cardW / 2, y + 10, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C_DARK);
      doc.text(k.label, x + cardW / 2, y + 16, { align: "center" });

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C_GRAY);
      doc.text(k.desc, x + cardW / 2, y + 20, { align: "center" });
    });

    y += cardH + 10;

    // ── Guía de columnas ──────────────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C_DARK);
    doc.text("Detalle del Inventario", 14, y);

    doc.setDrawColor(...C_DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(14, y + 2, 283, y + 2);
    y += 6;

    doc.setFillColor(...C_INFO_BG);
    doc.roundedRect(14, y, 269, 16, 2, 2, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C_PRIMARY);
    doc.text("Guía de columnas:", 17, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C_DARK);
    const colDefs = [
      "Proyecto — Nombre del proyecto al que pertenece el lote.",
      "Código — Identificador único del lote (incluye sigla, manzana y número).",
      "Manzana — Bloque o manzana dentro del proyecto.",
      "Núm. Lote — Número de lote dentro de la manzana.",
      "Área — Superficie del lote en metros cuadrados.",
      "Precio — Precio base de lista del lote.",
      "Estado — Disponible: sin venta | Vendido: con venta activa | Entregado: proceso finalizado.",
      "Fecha creación — Fecha en que el lote fue registrado en el sistema.",
    ];
    const half = Math.ceil(colDefs.length / 2);
    doc.text(doc.splitTextToSize(colDefs.slice(0, half).join("   "), 260), 17, y + 10);
    doc.text(doc.splitTextToSize(colDefs.slice(half).join("   "), 260), 17, y + 14);

    y += 20;

    // ── Tabla ─────────────────────────────────────────────────────────────────
    doc.autoTable({
      startY: y,
      head: [["Proyecto", "Código", "Manzana", "Núm. Lote", "Área (m²)", "Precio", "Estado", "Fecha creación"]],
      body: filteredLotes.map(l => [
        l.proyecto      || "—",
        l.codigo        || "—",
        l.manzana !== "—" ? l.manzana : "—",
        l.numero_lote !== "—" ? l.numero_lote : "—",
        `${Number(l.area || 0)} m²`,
        sgiLoteFormatCurrency(l.precio),
        l.estado        || "—",
        l.fechaCreacion ? new Date(l.fechaCreacion).toLocaleDateString("es-CO") : "—",
      ]),
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        lineColor: C_DIVIDER,
        lineWidth: 0.2,
        textColor: C_DARK,
      },
      headStyles: {
        fillColor: C_PRIMARY,
        textColor: C_WHITE,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      alternateRowStyles: { fillColor: C_LIGHT },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 28, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 34, halign: "right" },
        6: { cellWidth: 24, halign: "center" },
        7: { cellWidth: 26, halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });

    // ── Pie de página ─────────────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(...C_LIGHT);
      doc.rect(0, pageH - 12, 297, 12, "F");
      doc.setDrawColor(...C_DIVIDER);
      doc.setLineWidth(0.3);
      doc.line(0, pageH - 12, 297, pageH - 12);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C_GRAY);
      doc.text("El Cóndor S.A.S. — Uso interno y confidencial", 14, pageH - 4.5);
      doc.text(`Página ${i} de ${pageCount}`, 283, pageH - 4.5, { align: "right" });
    }

    doc.save(`reporte_lotes_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ── Vista principal ────────────────────────────────────────────────────────

  function lotesView(container) {
    if (!container) return "";

    const canCreate = AppState.can("lotes", "crear");
    const canExport = EXPORT_ROLES.includes(window.currentUser?.rol);

    const state = {
      proyecto: "",
      search:   "",
      sortCol:  null,
      sortDir:  "asc",
    };

    let _allLotes    = null;
    let _proyectos   = null;

    async function loadData(forceRefresh = false) {
      if (!forceRefresh && _allLotes !== null && _proyectos !== null) {
        return { lotes: _allLotes, proyectos: _proyectos };
      }
      const [lotes, proyectos] = await Promise.all([
        sgiCargarLotesBackend(),
        sgiCargarProyectosBackend(),
      ]);
      _allLotes  = lotes;
      _proyectos = proyectos;
      return { lotes, proyectos };
    }

    async function renderLotesScreen(forceRefresh = false) {
      try {
        container.innerHTML = window.UI?.loader ? UI.loader() : "";

        const { lotes: allLotes, proyectos } = await loadData(forceRefresh);

        const filteredLotes = sgiLoteApplyFilters(allLotes, state);
        const summary       = sgiLoteBuildSummary(filteredLotes);

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
                ${(canExport || canCreate) ? `
                <div class="hero-actions">
                  ${canExport ? `
                    <button class="btn btn-ghost" id="btnLotesExportExcel">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      Exportar Excel
                    </button>
                    <button class="btn btn-ghost" id="btnLotesExportPDF">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9" x2="10" y2="9"/></svg>
                      Exportar PDF
                    </button>` : ""}
                  ${canCreate ? `<button class="btn btn-primary" id="btnNuevoLote">Nuevo lote</button>` : ""}
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
              <div class="table-header"><h3>Filtros y búsqueda</h3></div>
              <div class="filter-bar">
                <div class="form-group filter-field">
                  <label for="filtroProyecto">Proyecto</label>
                  <select id="filtroProyecto">
                    <option value="">Todos</option>
                    ${proyectos.map(p => `
                      <option value="${p.id}" ${String(state.proyecto) === String(p.id) ? "selected" : ""}>
                        ${p.nombre}
                      </option>`).join("")}
                  </select>
                </div>
                <div class="form-group filter-field">
                  <label for="buscarLote">Buscar</label>
                  <input id="buscarLote" type="text"
                    placeholder="Buscar por código, manzana, lote, proyecto o estado"
                    value="${state.search}" />
                </div>
              </div>
            </section>

            <section class="table-wrap">
              <div class="table-header"><h3>Listado de lotes</h3></div>
              ${filteredLotes.length
                ? `<table id="lotes-table">${buildLotesTableHTML(filteredLotes, state, canCreate)}</table>`
                : `<div class="empty-state">
                    <div class="empty-state-title">No hay resultados</div>
                    <div class="empty-state-text">No encontramos lotes con los filtros actuales.</div>
                    ${canCreate ? `<div><button class="btn btn-primary" id="btnEmptyCreateLote">Crear lote</button></div>` : ""}
                   </div>`}
            </section>
          </section>
        `;

        const lotesTable = document.getElementById("lotes-table");
        if (lotesTable) wireLotesSortHeaders(lotesTable, filteredLotes, state, canCreate);

        document.getElementById("filtroProyecto")?.addEventListener("change", e => {
          state.proyecto = e.target.value;
          renderLotesScreen();
        });

        document.getElementById("buscarLote")?.addEventListener("input", e => {
          state.search = e.target.value;
          renderLotesScreen();
        });

        if (canExport) {
          document.getElementById("btnLotesExportExcel")?.addEventListener("click", async () => {
            await exportLotesExcel(filteredLotes, proyectos);
          });
          document.getElementById("btnLotesExportPDF")?.addEventListener("click", () => {
            exportLotesPDF(filteredLotes);
          });
        }

        document.getElementById("btnNuevoLote")?.addEventListener("click", () => {
          sgiOpenCreateLoteModal(proyectos, () => renderLotesScreen(true));
        });

        document.getElementById("btnEmptyCreateLote")?.addEventListener("click", () => {
          sgiOpenCreateLoteModal(proyectos, () => renderLotesScreen(true));
        });

        window.SGIUI?.hydrate?.();
      } catch (error) {
        console.error("Error cargando lotes:", error);
        container.innerHTML = `
          <section class="table-wrap" style="padding: 24px;">
            <div class="table-header"><h3>Error al cargar la vista</h3></div>
            <div style="padding: 20px; color: var(--danger); line-height: 1.6;">
              ${error.message || "Ocurrió un error cargando la gestión de lotes. Revisa la consola para más detalles."}
            </div>
          </section>
        `;
      }
    }

    renderLotesScreen();
  }

  window.lotesView = lotesView;
})();
