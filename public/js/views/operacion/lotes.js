(() => {
  let _canEditLotes = false;
  let _lotesCtx     = null;

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
      id_venta:     lote.id_venta ?? null,
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
    const estado = sgiNormalizeText(state.estado);
    return lotes.filter(lote => {
      const matchesProject = !state.proyecto || String(lote.proyectoId) === String(state.proyecto);
      const matchesEstado  = !estado || sgiNormalizeText(lote.estado) === estado;
      const haystack = [lote.codigo, lote.manzana, lote.numero_lote, lote.proyecto, lote.estado]
        .map(sgiNormalizeText).join(" ");
      const matchesSearch = !search || haystack.includes(search);
      return matchesProject && matchesEstado && matchesSearch;
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

  function sgiLoteBuildRows(lotes) {
    if (!lotes.length) {
      return `<tr><td colspan="9" class="empty-row">No hay lotes que coincidan con los filtros actuales.</td></tr>`;
    }
    return lotes.map(lote => {
      const acciones = [];
      if (_canEditLotes) acciones.push(`<button class="btn btn-sm btn-ghost" onclick="sgiEditLote(${lote.id_lote})" title="Editar lote">Editar</button>`);
      if (lote.id_venta) acciones.push(`<button class="btn btn-sm btn-ghost" onclick="verVenta(${lote.id_venta})" title="Ver la venta de este lote">Ver venta</button>`);
      const accionesHTML = acciones.length
        ? acciones.join(" ")
        : `<span style="color:var(--text-muted);font-size:.8rem">—</span>`;
      return `
      <tr>
        <td>${lote.proyecto}</td>
        <td><strong>${lote.codigo}</strong></td>
        <td>${lote.manzana}</td>
        <td>${lote.numero_lote}</td>
        <td>${Number(lote.area || 0)} m²</td>
        <td>${sgiLoteFormatCurrency(lote.precio)}</td>
        <td>${sgiLoteGetStatusBadge(lote.estado)}</td>
        <td>${sgiLoteFormatDate(lote.fechaCreacion)}</td>
        <td style="white-space:nowrap;text-align:center">${accionesHTML}</td>
      </tr>`;
    }).join("");
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

  function sgiBuildLotePayload(payload) {
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
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) throw new Error("Debes seleccionar un proyecto válido.");
    if (!Number.isFinite(area)   || area   <= 0) throw new Error("El área debe ser mayor a cero.");
    if (!Number.isFinite(precio) || precio <= 0) throw new Error("El precio debe ser mayor a cero.");

    return {
      id_proyecto:  proyectoId,
      codigo_lote:  codigo,
      manzana:      manzana || codigoPartes.manzana || codigo,
      numero_lote:  numeroLote || codigoPartes.numero_lote || codigo,
      area_m2:      area,
      dimensiones,
      precio_base:  precio,
      precio_lista: precio,
      descripcion
    };
  }

  async function sgiCrearLoteBackend(payload) {
    return API.post("/lotes", { ...sgiBuildLotePayload(payload), estado: "disponible" });
  }

  async function sgiActualizarLoteBackend(id, payload) {
    return API.put(`/lotes/${id}`, sgiBuildLotePayload(payload));
  }

  function sgiOpenLoteModal(proyectos, lote, onSaved) {
    const overlay  = document.getElementById("modalOverlay");
    const title    = document.getElementById("modalTitle");
    const body     = document.getElementById("modalBody");
    const closeBtn = document.getElementById("modalClose");
    if (!overlay || !title || !body || !closeBtn) return;

    const isEdit       = !!(lote && (lote.id_lote ?? lote.id));
    const loteId       = isEdit ? (lote.id_lote ?? lote.id) : null;
    const loteVentaId  = isEdit ? (lote.id_venta ?? null) : null;
    const originalPrecio = Number(lote?.precio_base) || 0;
    const val    = (v) => (v == null || v === "—") ? "" : String(v);

    title.textContent = isEdit ? "Editar lote" : "Crear lote";

    const proyectoActual = isEdit ? String(lote.id_proyecto ?? lote.proyectoId ?? "") : "";

    body.innerHTML = `
      <form id="sgiLoteForm">
        <div class="form-grid">
          <div class="form-group">
            <label for="loteProyecto">Proyecto</label>
            <select id="loteProyecto" name="proyectoId" required>
              <option value="">Selecciona un proyecto</option>
              ${proyectos.length
                ? proyectos.map(p => `<option value="${p.id}" ${String(p.id) === proyectoActual ? "selected" : ""}>${p.nombre}</option>`).join("")
                : `<option value="" disabled>No hay proyectos disponibles</option>`}
            </select>
          </div>

          <div class="form-group">
            <label for="loteManzana">Manzana</label>
            <input id="loteManzana" name="manzana" type="text" placeholder="Ej: A" value="${val(lote?.manzana)}" />
          </div>

          <div class="form-group">
            <label for="loteNumero">Número de lote</label>
            <input id="loteNumero" name="numero_lote" type="text" placeholder="Ej: 22" value="${val(lote?.numero_lote)}" />
          </div>

          <div class="form-group">
            <label for="loteCodigo">Código del lote</label>
            <input id="loteCodigo" name="codigo" type="text" placeholder="Se genera automáticamente" value="${val(lote?.codigo_lote)}" required />
          </div>

          <div class="form-group">
            <label for="loteArea">Área total (m²)</label>
            <input id="loteArea" name="area" type="number" min="1" step="1" placeholder="Ej: 150" value="${val(lote?.area_m2)}" required />
          </div>

          <div class="form-group">
            <label for="loteDimensiones">Medidas del lote</label>
            <input id="loteDimensiones" name="dimensiones" type="text" placeholder="Ej: 10m × 15m" value="${val(lote?.dimensiones)}" />
          </div>

          <div class="form-group">
            <label for="lotePrecio">Precio</label>
            <input id="lotePrecio" name="precio" type="text" inputmode="numeric" placeholder="Ej: 65.000.000" value="${val(lote?.precio_base)}" required />
          </div>

          ${isEdit
            ? `<div class="form-group">
                 <label for="loteEstadoInicial">Estado</label>
                 <input id="loteEstadoInicial" type="text" value="${val(lote?.estado) || "Disponible"}" disabled />
               </div>`
            : `<div class="form-group">
                 <label for="loteEstadoInicial">Estado inicial</label>
                 <input id="loteEstadoInicial" type="text" value="Disponible" disabled />
               </div>`}

          <div class="form-group form-group--full">
            <label for="loteDescripcion">Descripción</label>
            <textarea id="loteDescripcion" name="descripcion" rows="3" placeholder="Observaciones o detalles adicionales del lote">${val(lote?.descripcion)}</textarea>
          </div>
        </div>

        <div class="form-note">
          ${isEdit
            ? (loteVentaId
                ? "Este lote está vendido. Si cambias su <strong>valor</strong>, se abrirá el plan de cuotas de la venta para que lo reajustes y todo cuadre exacto; los demás datos se guardan normal."
                : "Los cambios se reflejarán en el inventario y en todas las vistas del sistema.")
            : "El lote se creará asociado a un proyecto existente y con estado inicial <strong>Disponible</strong> para futuras ventas."}
        </div>

        <div id="sgiLoteFormError" class="form-error" style="display:none;"></div>

        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="sgiCancelLote">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="sgiSubmitLote">${isEdit ? "Guardar cambios" : "Guardar lote"}</button>
        </div>
      </form>
    `;

    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    const form        = document.getElementById("sgiLoteForm");
    const cancelBtn   = document.getElementById("sgiCancelLote");
    const submitBtn   = document.getElementById("sgiSubmitLote");
    const errorBox    = document.getElementById("sgiLoteFormError");
    const codigoInput = document.getElementById("loteCodigo");
    const proyectoSelect  = document.getElementById("loteProyecto");
    const manzanaInput    = document.getElementById("loteManzana");
    const numeroInput     = document.getElementById("loteNumero");
    const areaInput       = document.getElementById("loteArea");
    const dimensionesInput = document.getElementById("loteDimensiones");

    // In edit mode keep the existing code untouched unless the user edits it explicitly.
    let codigoTouched = isEdit;
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
    if (precioInput.value) precioInput.value = MoneyInput.format(precioInput.value);

    let dimensionesTouched = isEdit;
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

      const nuevoPrecio  = Number(payload.precio);
      const precioCambio = isEdit && Number.isFinite(nuevoPrecio) && nuevoPrecio !== originalPrecio;

      try {
        submitBtn.disabled    = true;
        submitBtn.textContent = "Guardando...";

        // Sold lote + value change → save the rest keeping the price, then hand off to the
        // venta's balanced plan editor seeded with the new value (RN-17/§8.4). If the aux
        // cancels or the plan doesn't cuadrar, the new value is simply never applied.
        if (loteVentaId && precioCambio) {
          await sgiActualizarLoteBackend(loteId, { ...payload, precio: String(originalPrecio) });
          sgiCloseLoteModal();
          sgiShowToast("Ajusta el plan de cuotas para aplicar el nuevo valor del lote.", "success");
          if (typeof window._editarPlanCuotas === "function") {
            window._editarPlanCuotas(loteVentaId, nuevoPrecio);
          } else {
            window.location.hash = "#ventas";
          }
          return;
        }

        const saved = isEdit
          ? await sgiActualizarLoteBackend(loteId, payload)
          : await sgiCrearLoteBackend(payload);
        sgiCloseLoteModal();
        const codigoFinal = saved?.codigo_lote || saved?.codigo || payload.codigo;
        sgiShowToast(
          isEdit ? `Lote ${codigoFinal} actualizado correctamente.` : `Lote ${codigoFinal} creado correctamente.`,
          "success"
        );
        onSaved?.();
      } catch (error) {
        errorBox.textContent   = error.message || (isEdit ? "No fue posible actualizar el lote." : "No fue posible crear el lote.");
        errorBox.style.display = "block";
      } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = isEdit ? "Guardar cambios" : "Guardar lote";
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

  function buildLotesTableHTML(filteredLotes, sortState) {
    const thead = `<thead><tr>
      ${LOTE_COLS.map(c => {
        const active = sortState.sortCol === c.key;
        const cls    = active ? `sortable sort-${sortState.sortDir}` : "sortable";
        return `<th class="${cls}" data-col="${c.key}">${c.label} <span class="sort-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M423.5-574 289.29-439.79Q272-422.5 248.5-421.75t-41.48-16.75q-17.52-17.5-16.77-41t18.07-40.81L439.41-751.1q7.91-7.9 18.97-13.15 11.06-5.25 21.78-5.25 10.71 0 21.78 5.25Q513-759 520.5-751.5l232 232q19 19 19 40.75t-18.52 39.25Q735-422 712.08-422q-22.91 0-40.08-17.5L536.5-574v349.52q0 22.79-16.79 39.64Q502.92-168 480.21-168t-39.71-16.84q-17-16.85-17-39.64V-574Z"/></svg></span></th>`;
      }).join("")}
      <th>Acción</th>
    </tr></thead>`;

    const sorted = sgiLoteSortByCol(filteredLotes, sortState.sortCol, sortState.sortDir);
    const tbody  = `<tbody>${sgiLoteBuildRows(sorted)}</tbody>`;
    return thead + tbody;
  }

  function wireLotesSortHeaders(tableEl, filteredLotes, sortState) {
    tableEl.querySelectorAll("th[data-col]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (sortState.sortCol === col) {
          sortState.sortDir = sortState.sortDir === "asc" ? "desc" : "asc";
        } else {
          sortState.sortCol = col;
          sortState.sortDir = "asc";
        }
        tableEl.innerHTML = buildLotesTableHTML(filteredLotes, sortState);
        wireLotesSortHeaders(tableEl, filteredLotes, sortState);
      });
    });
  }

  // ── Exportación ───────────────────────────────────────────────────────────

  async function exportLotesExcel(filteredLotes, proyectos) {
    if (window.SGILibs) await window.SGILibs.ensureExport();
    const SX = window.SGIExport.xlsx;
    const wb = SX.setup();

    const totalDisp      = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "disponible").length;
    const totalVend      = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "vendido").length;
    const totalEntregado = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "entregado").length;

    // ── Hoja 1: Resumen ──────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet("Resumen", { tabColor: { argb: SX.C.primary } });
    ws1.columns = [
      { key: "a", width: 36 },
      { key: "b", width: 16 },
      { key: "c", width: 16 },
      { key: "d", width: 16 },
      { key: "e", width: 16 },
    ];

    SX.masthead(ws1, {
      title:     "Inventario de Lotes",
      subtitle:  "Estado actual aplicando los filtros activos al momento de exportar",
      mergeCols: 5,
    });

    SX.kpiRow(ws1, [
      { label: "Total lotes", value: filteredLotes.length },
      { label: "Disponibles", value: totalDisp },
      { label: "Vendidos",    value: totalVend },
      { label: "Entregados",  value: totalEntregado },
      { label: "Ocupación",   value: filteredLotes.length ? (totalVend + totalEntregado) / filteredLotes.length : 0, percent: true },
    ]);

    SX.sectionHeader(ws1, "Indicadores", { mergeCols: 5 });
    const indHead = ws1.addRow(["Indicador", "Valor", "Descripción", "", ""]);
    ws1.mergeCells(indHead.number, 3, indHead.number, 5);
    SX.styleHeader(indHead);

    [
      ["Total de lotes en la vista actual", filteredLotes.length, "Lotes mostrados con los filtros aplicados al exportar"],
      ["Lotes disponibles",                 totalDisp,            "Lotes sin venta activa asignada"],
      ["Lotes vendidos",                    totalVend,            "Lotes con venta activa o finalizada en el sistema"],
      ["Lotes entregados",                  totalEntregado,       "Lotes cuyo proceso de venta y entrega está finalizado"],
    ].forEach((rowData, i) => {
      const r = ws1.addRow(rowData);
      ws1.mergeCells(r.number, 3, r.number, 5);
      SX.styleBody(r, i % 2 !== 0);
      r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      r.getCell(2).font = { name: "Calibri", bold: true, size: 11, color: { argb: SX.C.primary } };
    });

    SX.sectionHeader(ws1, "Lotes por proyecto", { mergeCols: 5 });
    const projHead = ws1.addRow(["Proyecto", "Total", "Disponibles", "Vendidos", "Entregados"]);
    SX.styleHeader(projHead);

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
      const r = ws1.addRow([nombre, s.total, s.disp, s.vend, s.entr]);
      SX.styleBody(r, i % 2 !== 0);
      for (let col = 2; col <= 5; col++) {
        r.getCell(col).alignment = { vertical: "middle", horizontal: "center" };
      }
    });

    ws1.views = [{ state: "frozen", ySplit: 5 }];

    // ── Hoja 2: Lotes ────────────────────────────────────────────────────────
    const ws2 = wb.addWorksheet("Lotes", { tabColor: { argb: SX.C.primary } });
    ws2.columns = [
      { key: "proyecto",      width: 28 },
      { key: "codigo",        width: 16 },
      { key: "manzana",       width: 12 },
      { key: "numero_lote",   width: 12 },
      { key: "area",          width: 12 },
      { key: "precio",        width: 18 },
      { key: "estado",        width: 14 },
      { key: "dimensiones",   width: 18 },
      { key: "fechaCreacion", width: 16 },
      { key: "descripcion",   width: 42 },
    ];

    SX.masthead(ws2, {
      title:     "Inventario de Lotes — Detalle",
      subtitle:  `${filteredLotes.length} lote${filteredLotes.length === 1 ? "" : "s"} exportado${filteredLotes.length === 1 ? "" : "s"}`,
      mergeCols: 10,
    });

    ws2.addRow([]).height = 4;
    const hRow = ws2.addRow([
      "Proyecto", "Código", "Manzana", "Núm. Lote", "Área (m²)",
      "Precio", "Estado", "Dimensiones", "Fecha creación", "Descripción",
    ]);
    SX.styleHeader(hRow);
    const headerRowNum = hRow.number;

    filteredLotes.forEach((l, i) => {
      const r = ws2.addRow([
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
      ]);
      SX.styleBody(r, i % 2 !== 0);
      if (typeof l.area === "number")   r.getCell(5).numFmt = SX.NF.decimal;
      if (typeof l.precio === "number") r.getCell(6).numFmt = SX.NF.money;
      r.getCell(5).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
      r.getCell(6).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    });

    ws2.views = [{ state: "frozen", ySplit: headerRowNum }];
    ws2.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to:   { row: headerRowNum, column: 10 },
    };

    await SX.download(wb, `lotes_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportLotesPDF(filteredLotes, ctx = {}) {
    if (window.SGILibs) await window.SGILibs.ensureExport();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const SX  = window.SGIExport.pdf;

    const totalDisp      = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "disponible").length;
    const totalVend      = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "vendido").length;
    const totalEntregado = filteredLotes.filter(l => sgiNormalizeText(l.estado) === "entregado").length;
    const ocupacionPct   = filteredLotes.length
      ? Math.round((totalVend + totalEntregado) / filteredLotes.length * 100)
      : 0;
    const areaTotal      = filteredLotes.reduce((s, l) => s + Number(l.area || 0), 0);
    const valorTotal     = filteredLotes.reduce((s, l) => s + Number(l.precio || 0), 0);

    // Active filters → human-readable description for the report subtitle.
    const st        = ctx.state || {};
    const proyNombre = st.proyecto
      ? (ctx.proyectos || []).find(p => String(p.id) === String(st.proyecto))?.nombre || st.proyecto
      : null;
    const filtros = [
      proyNombre   ? `Proyecto: ${proyNombre}` : null,
      st.estado    ? `Estado: ${st.estado}`    : null,
      st.search    ? `Búsqueda: "${st.search}"` : null,
    ].filter(Boolean);
    const subtitle = filtros.length
      ? `Filtros aplicados — ${filtros.join("  ·  ")}`
      : "Reporte del inventario completo (sin filtros aplicados).";

    let y = SX.brand(doc);

    y = SX.title(doc, y + 2, { title: "Inventario de Lotes", subtitle });

    y = SX.kpiCards(doc, y + 2, [
      { label: "Total lotes", value: String(filteredLotes.length), desc: "En la vista exportada" },
      { label: "Disponibles", value: String(totalDisp),            desc: "Sin venta activa" },
      { label: "Vendidos",    value: String(totalVend),            desc: "Con venta activa o finalizada" },
      { label: "Entregados",  value: String(totalEntregado),       desc: "Proceso completado" },
      { label: "Ocupación",   value: `${ocupacionPct}%`,           desc: "Vendidos + Entregados / Total" },
    ], { perRow: 5 });

    y = SX.section(doc, y + 6, { kicker: "Detalle", title: "Inventario por lote" });

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
      foot: [[
        `Total · ${filteredLotes.length} lote${filteredLotes.length === 1 ? "" : "s"}`,
        "", "", "",
        `${areaTotal.toLocaleString("es-CO")} m²`,
        sgiLoteFormatCurrency(valorTotal),
        "", "",
      ]],
      showFoot: "lastPage",
      ...SX.tableTheme(),
      footStyles: SX.footStyles(),
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 22, halign: "right"  },
        5: { cellWidth: 36, halign: "right"  },
        6: { cellWidth: 28, halign: "center" },
        7: { cellWidth: 30, halign: "center" },
      },
      ...SX.statusColumn(6, e => {
        const n = sgiNormalizeText(e);
        return n === "disponible" ? "success" : n === "vendido" ? "info" : n === "entregado" ? "muted" : "warning";
      }),
    });

    SX.footer(doc);
    doc.save(`reporte_lotes_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ── Vista principal ────────────────────────────────────────────────────────

  function lotesView(container) {
    if (!container) return "";

    const canCreate = AppState.can("lotes", "crear");
    const canExport = EXPORT_ROLES.includes(window.currentUser?.rol);
    _canEditLotes   = AppState.can("lotes", "actualizar");

    const state = {
      proyecto: "",
      estado:   "",
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

    function renderSummary(summary) {
      const el = document.getElementById("lotes-summary-section");
      if (!el) return;
      el.innerHTML = `
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
      `;
    }

    function renderTable(filteredLotes) {
      const el = document.getElementById("lotes-table-section");
      if (!el) return;
      el.innerHTML = filteredLotes.length
        ? `<div class="table-header"><h3>Listado de lotes</h3></div>
           <div class="sticky-table-scroll"><table id="lotes-table">${buildLotesTableHTML(filteredLotes, state)}</table></div>`
        : `<div class="table-header"><h3>Listado de lotes</h3></div>
           <div class="empty-state">
             <div class="empty-state-title">No hay resultados</div>
             <div class="empty-state-text">No encontramos lotes con los filtros actuales.</div>
             ${canCreate ? `<div><button class="btn btn-primary" id="btnEmptyCreateLote">Crear lote</button></div>` : ""}
           </div>`;

      const lotesTable = document.getElementById("lotes-table");
      if (lotesTable) wireLotesSortHeaders(lotesTable, filteredLotes, state);

      document.getElementById("btnEmptyCreateLote")?.addEventListener("click", () => {
        sgiOpenLoteModal(_proyectos, null, () => renderLotesScreen(true));
      });
    }

    function applyFilters() {
      if (_allLotes === null) return;
      const filteredLotes = sgiLoteApplyFilters(_allLotes, state);
      renderSummary(sgiLoteBuildSummary(filteredLotes));
      renderTable(filteredLotes);
    }

    async function renderLotesScreen(forceRefresh = false) {
      try {
        container.innerHTML = window.UI?.loader ? UI.loader() : "";

        const { lotes: allLotes, proyectos } = await loadData(forceRefresh);

        _lotesCtx = { proyectos, refresh: () => renderLotesScreen(true) };

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
              <div class="stats-grid lotes-summary-grid" id="lotes-summary-section"></div>
            </section>

            <section class="table-wrap lotes-filter-section">
              <div class="table-header"><h3>Filtros y búsqueda</h3></div>
              ${window.SGIUI.filterBar({ fields: [
                { type: "select", id: "filtroProyecto", label: "Proyecto", value: state.proyecto,
                  options: [{ value: "", label: "Todos" }, ...proyectos.map(p => ({ value: p.id, label: p.nombre }))] },
                { type: "select", id: "filtroEstado", label: "Estado", value: state.estado, options: [
                  { value: "", label: "Todos" }, { value: "disponible", label: "Disponible" },
                  { value: "vendido", label: "Vendido" }, { value: "entregado", label: "Entregado" },
                ] },
                { type: "search", id: "buscarLote", label: "Buscar", value: state.search,
                  placeholder: "Buscar por código, manzana, lote o proyecto", grow: true },
              ] })}
            </section>

            <section class="table-wrap" id="lotes-table-section"></section>
          </section>
        `;

        renderSummary(summary);
        renderTable(filteredLotes);

        document.getElementById("filtroProyecto")?.addEventListener("change", e => {
          state.proyecto = e.target.value;
          applyFilters();
        });

        document.getElementById("filtroEstado")?.addEventListener("change", e => {
          state.estado = e.target.value;
          applyFilters();
        });

        document.getElementById("buscarLote")?.addEventListener("input", e => {
          state.search = e.target.value;
          applyFilters();
        });

        if (canExport) {
          document.getElementById("btnLotesExportExcel")?.addEventListener("click", async () => {
            await exportLotesExcel(sgiLoteApplyFilters(_allLotes, state), proyectos);
          });
          document.getElementById("btnLotesExportPDF")?.addEventListener("click", () => {
            exportLotesPDF(sgiLoteApplyFilters(_allLotes, state), { state, proyectos });
          });
        }

        document.getElementById("btnNuevoLote")?.addEventListener("click", () => {
          sgiOpenLoteModal(proyectos, null, () => renderLotesScreen(true));
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

  window.sgiEditLote = async function (id) {
    if (!_lotesCtx) return;
    try {
      const lote = await API.get(`/lotes/${id}`);
      sgiOpenLoteModal(_lotesCtx.proyectos, lote, _lotesCtx.refresh);
    } catch (error) {
      sgiShowToast(error.message || "No fue posible cargar el lote.", "error");
    }
  };

  window.lotesView = lotesView;
})();
