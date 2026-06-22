window.auditoriaView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  let allData;
  try {
    allData = await API.get("/reportes/auditoria?limit=500");
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }
  if (!Array.isArray(allData)) allData = [];

  // ── Humanization maps ────────────────────────────────────────────────────

  const MODULE_LABELS = {
    pago: "Pagos", venta: "Ventas", cuota: "Cuotas",
    factura: "Facturas", recibo: "Recibos", lote: "Lotes",
    proyecto: "Proyectos", usuario: "Usuarios", rol_permiso: "Permisos",
    comisionista: "Comisionistas", gasto: "Gastos",
    venta_comprador: "Compradores de venta", cuota_pago: "Aplicación de pagos",
    venta_comisionista: "Comisiones", observacion_juridica: "Jurídico",
    bank_transaction: "Transacciones bancarias", cuota_fraccion: "Fracciones de cuota",
    cuota_factura: "Factura de cuota",
  };

  const OP_LABELS = { INSERT: "Creación", UPDATE: "Modificación", DELETE: "Eliminación" };

  const FIELD_LABELS = {
    estado: "Estado", valor_cuota: "Valor cuota", valor_total: "Valor total",
    fecha_vencimiento: "Fecha vencimiento", metodo_pago: "Método de pago",
    precio_base: "Precio base", activo: "Activo", rol: "Rol", motivo: "Motivo",
    nombre: "Nombre", descripcion: "Descripción", estado_juridico: "Estado jurídico",
    numero_cuotas: "N° cuotas", fecha_inicio: "Fecha inicio", porcentaje: "Porcentaje",
    causada: "Comisión causada", pagada: "Comisión pagada", valor_comision: "Valor comisión",
  };

  const humanModule = t  => MODULE_LABELS[t]  || (t  || "—");
  const humanOp     = op => OP_LABELS[(op || "").toUpperCase()] || op || "—";
  const humanField  = f  => FIELD_LABELS[f]  || (f  || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const fmtVal = v => {
    if (!v || v === "null") return "—";
    if (v.startsWith("{")) {
      try {
        const obj = JSON.parse(v);
        const parts = [];
        if (obj.valor  != null) parts.push(window.SGIHelpers?.fmtMiles(Number(obj.valor)) ?? obj.valor);
        if (obj.metodo) parts.push(String(obj.metodo).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
        if (obj.tipo)   parts.push(String(obj.tipo).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
        if (parts.length) return parts.join(" · ");
        return Object.entries(obj).map(([k, val]) => `${k}: ${val}`).join(" · ");
      } catch (_) {}
    }
    return v;
  };

  const opBadge = op => {
    const u   = (op || "").toUpperCase();
    const cls = u === "INSERT" ? "success" : u === "DELETE" ? "danger" : "warning";
    return `<span class="badge badge-${cls}">${humanOp(op)}</span>`;
  };

  // ── Criticality ──────────────────────────────────────────────────────────

  const CRITICAL_TABLES  = new Set(["pago", "venta", "recibo", "factura", "cuota"]);
  const FINANCIAL_FIELDS = new Set(["estado", "valor_cuota", "valor_total", "precio_base", "activo"]);

  function getCriticality(r) {
    const op = (r.operacion || "").toUpperCase();
    if (op === "DELETE") return "high";
    if (CRITICAL_TABLES.has(r.tabla_afectada) && FINANCIAL_FIELDS.has(r.campo)) return "high";
    if (CRITICAL_TABLES.has(r.tabla_afectada)) return "medium";
    return "low";
  }

  // ── Event grouping (same tabla + id + usuario within 30 s) ──────────────

  function groupEvents(records) {
    const groups = [];
    const used   = new Set();
    records.forEach((r, i) => {
      if (used.has(i)) return;
      const t0    = new Date(r.fecha_cambio).getTime();
      let crit    = getCriticality(r);
      const group = {
        ...r,
        criticality: crit,
        changes: [{ campo: r.campo, anterior: r.valor_anterior, nuevo: r.valor_nuevo }],
      };
      records.forEach((r2, j) => {
        if (j <= i || used.has(j)) return;
        if (r2.tabla_afectada !== r.tabla_afectada) return;
        if (String(r2.id_registro) !== String(r.id_registro)) return;
        if (r2.usuario !== r.usuario) return;
        if (Math.abs(new Date(r2.fecha_cambio).getTime() - t0) > 30000) return;
        group.changes.push({ campo: r2.campo, anterior: r2.valor_anterior, nuevo: r2.valor_nuevo });
        const c2 = getCriticality(r2);
        if (c2 === "high" || (c2 === "medium" && group.criticality === "low")) group.criticality = c2;
        used.add(j);
      });
      used.add(i);
      groups.push(group);
    });
    return groups;
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────

  function buildKPIs(records) {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart  = Date.now() - 7 * 86400000;
    const today  = records.filter(r => new Date(r.fecha_cambio).getTime() >= todayStart).length;
    const week   = records.filter(r => new Date(r.fecha_cambio).getTime() >= weekStart).length;
    const users  = new Set(records.map(r => r.usuario).filter(Boolean)).size;
    const modCount = {};
    records.filter(r => new Date(r.fecha_cambio).getTime() >= weekStart)
           .forEach(r => { modCount[r.tabla_afectada] = (modCount[r.tabla_afectada] || 0) + 1; });
    const topModule = Object.entries(modCount).sort((a, b) => b[1] - a[1])[0];
    return { today, week, users, topModule };
  }

  // ── Filter state (survives re-renders) ───────────────────────────────────

  let filters = { q: "", tabla: "", operacion: "", desde: "", hasta: "" };

  function applyFilters(records) {
    return records.filter(r => {
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const hay = [r.usuario, r.tabla_afectada, r.campo, r.valor_nuevo, r.motivo]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.tabla     && r.tabla_afectada !== filters.tabla) return false;
      if (filters.operacion && (r.operacion || "").toUpperCase() !== filters.operacion) return false;
      if (filters.desde && new Date(r.fecha_cambio) < new Date(filters.desde)) return false;
      if (filters.hasta) {
        const h = new Date(filters.hasta); h.setHours(23, 59, 59, 999);
        if (new Date(r.fecha_cambio) > h) return false;
      }
      return true;
    });
  }

  // ── One-time derived data ─────────────────────────────────────────────────

  const kpis   = buildKPIs(allData);
  const tablas = [...new Set(allData.map(r => r.tabla_afectada).filter(Boolean))].sort();
  const ops    = [...new Set(allData.map(r => (r.operacion || "").toUpperCase()).filter(Boolean))].sort();

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderDetailPanel(group) {
    const hasMotivo = group.motivo && group.motivo !== "null";
    return `
      <div class="audit-detail-panel">
        <div class="audit-detail-header">
          <div class="audit-detail-title">
            <span class="audit-crit-dot audit-crit-${group.criticality}"></span>
            ${opBadge(group.operacion)} en <strong>${humanModule(group.tabla_afectada)}</strong>
            <span class="audit-id-cell">#${group.id_registro}</span>
          </div>
          <button class="audit-detail-close" id="audit-detail-close">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="audit-detail-meta">
          <span><i data-lucide="user"></i>${group.usuario || "—"}</span>
          <span><i data-lucide="clock"></i>${new Date(group.fecha_cambio).toLocaleString("es-CO")}</span>
          ${hasMotivo ? `<span><i data-lucide="message-square"></i>${group.motivo}</span>` : ""}
        </div>
        <div class="audit-diff-grid">
          ${group.changes.map(ch => {
            const emptyBefore = !ch.anterior || ch.anterior === "null";
            const emptyAfter  = !ch.nuevo    || ch.nuevo    === "null";
            return `
              <div class="audit-diff-row">
                <div class="audit-diff-field">${humanField(ch.campo)}</div>
                <div class="audit-diff-before${emptyBefore ? " audit-diff-empty" : ""}">
                  <span class="audit-diff-label">Antes</span>${fmtVal(ch.anterior)}
                </div>
                <div class="audit-diff-arrow"><i data-lucide="arrow-right"></i></div>
                <div class="audit-diff-after${emptyAfter ? " audit-diff-empty" : ""}">
                  <span class="audit-diff-label">Después</span>${fmtVal(ch.nuevo)}
                </div>
              </div>`;
          }).join("")}
        </div>
      </div>`;
  }

  function renderTableBody(filtered) {
    const grouped = groupEvents(filtered);
    if (!grouped.length) {
      return {
        html: `<div class="audit-empty"><p>No hay registros que coincidan con los filtros aplicados.</p></div>`,
        grouped,
      };
    }
    const html = `
      <div class="audit-table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th style="width:1.25rem"></th>
              <th>Módulo</th>
              <th>Acción</th>
              <th>Registro</th>
              <th>Campos modificados</th>
              <th>Usuario</th>
              <th>Fecha y hora</th>
            </tr>
          </thead>
          <tbody>
            ${grouped.map((g, idx) => `
              <tr class="audit-row audit-crit-row-${g.criticality}" data-idx="${idx}">
                <td><span class="audit-crit-dot audit-crit-${g.criticality}"></span></td>
                <td><span class="audit-module-badge">${humanModule(g.tabla_afectada)}</span></td>
                <td>${opBadge(g.operacion)}</td>
                <td class="audit-id-cell">#${g.id_registro}</td>
                <td class="audit-changes-cell">
                  ${g.changes.map(ch => `<span class="audit-field-chip">${humanField(ch.campo)}</span>`).join("")}
                </td>
                <td>${g.usuario || "—"}</td>
                <td class="audit-date-cell">${new Date(g.fecha_cambio).toLocaleString("es-CO")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
    return { html, grouped };
  }

  // ── Main render (called on every filter change) ───────────────────────────

  function renderFull() {
    const filtered          = applyFilters(allData);
    const { html: tableHtml, grouped } = renderTableBody(filtered);
    const hasActiveFilters  = Object.values(filters).some(Boolean);

    vc.innerHTML = `
      <section class="page-shell">
        ${window.SGIUI?.pageHeader({
          kicker:   "Control",
          title:    "Bitácora de Auditoría",
          subtitle: "Historial detallado de acciones críticas del sistema",
        }) ?? ""}

        <div class="audit-kpi-row">
          <div class="audit-kpi">
            <span class="audit-kpi-val">${kpis.today}</span>
            <span class="audit-kpi-label">Acciones hoy</span>
          </div>
          <div class="audit-kpi">
            <span class="audit-kpi-val">${kpis.week}</span>
            <span class="audit-kpi-label">Últimos 7 días</span>
          </div>
          <div class="audit-kpi">
            <span class="audit-kpi-val">${kpis.users}</span>
            <span class="audit-kpi-label">Usuarios activos</span>
          </div>
          ${kpis.topModule ? `
          <div class="audit-kpi audit-kpi-accent">
            <span class="audit-kpi-val audit-kpi-val-sm">${humanModule(kpis.topModule[0])}</span>
            <span class="audit-kpi-label">Módulo más activo</span>
          </div>` : ""}
        </div>

        <div class="table-wrap">
          <div class="table-header">
            <h3><i data-lucide="shield"></i> Bitácora
              <span class="results-chip">${grouped.length} evento(s)${hasActiveFilters ? " filtrados" : ""} de ${allData.length}</span>
            </h3>
          </div>

          <div class="audit-filters">
            <input class="form-control audit-filter-input" id="af-q" type="text"
              placeholder="Buscar por usuario, módulo, campo, valor…"
              value="${filters.q.replace(/"/g, "&quot;")}">
            <select class="form-control audit-filter-select" id="af-tabla">
              <option value="">Todos los módulos</option>
              ${tablas.map(t => `<option value="${t}" ${filters.tabla === t ? "selected" : ""}>${humanModule(t)}</option>`).join("")}
            </select>
            <select class="form-control audit-filter-select" id="af-op">
              <option value="">Todas las acciones</option>
              ${ops.map(op => `<option value="${op}" ${filters.operacion === op ? "selected" : ""}>${humanOp(op)}</option>`).join("")}
            </select>
            <input class="form-control audit-filter-date" id="af-desde" type="date"
              value="${filters.desde}" title="Desde">
            <input class="form-control audit-filter-date" id="af-hasta" type="date"
              value="${filters.hasta}" title="Hasta">
            ${hasActiveFilters
              ? `<button class="btn btn-ghost btn-sm" id="af-clear"><i data-lucide="x"></i> Limpiar</button>`
              : ""}
          </div>

          <div class="audit-legend">
            <span class="audit-legend-item"><span class="audit-crit-dot audit-crit-high"></span>Alta criticidad</span>
            <span class="audit-legend-item"><span class="audit-crit-dot audit-crit-medium"></span>Media</span>
            <span class="audit-legend-item"><span class="audit-crit-dot audit-crit-low"></span>Baja</span>
            <span class="audit-legend-hint"><i data-lucide="mouse-pointer-2"></i>Clic en fila para ver detalle</span>
          </div>

          <div id="audit-detail-wrap"></div>
          <div id="audit-body">${tableHtml}</div>
        </div>
      </section>`;

    window.SGIUI?.hydrate();
    bindEvents(grouped);
  }

  function bindEvents(grouped) {
    let searchTimer;

    vc.querySelector("#af-q")?.addEventListener("input", e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { filters.q = e.target.value.trim(); renderFull(); }, 300);
    });

    vc.querySelector("#af-tabla")?.addEventListener("change", e => { filters.tabla = e.target.value; renderFull(); });
    vc.querySelector("#af-op")?.addEventListener("change",    e => { filters.operacion = e.target.value; renderFull(); });
    vc.querySelector("#af-desde")?.addEventListener("change", e => { filters.desde = e.target.value; renderFull(); });
    vc.querySelector("#af-hasta")?.addEventListener("change", e => { filters.hasta = e.target.value; renderFull(); });
    vc.querySelector("#af-clear")?.addEventListener("click",  () => {
      filters = { q: "", tabla: "", operacion: "", desde: "", hasta: "" };
      renderFull();
    });

    const detailWrap = document.getElementById("audit-detail-wrap");

    vc.querySelectorAll(".audit-row").forEach(row => {
      row.addEventListener("click", () => {
        const idx = Number(row.dataset.idx);
        const g   = grouped[idx];
        if (!g) return;

        const isOpen = detailWrap.dataset.open === String(idx);
        vc.querySelectorAll(".audit-row.active").forEach(r => r.classList.remove("active"));

        if (isOpen) {
          detailWrap.innerHTML   = "";
          detailWrap.dataset.open = "";
          return;
        }

        detailWrap.innerHTML    = renderDetailPanel(g);
        detailWrap.dataset.open = String(idx);
        row.classList.add("active");
        window.SGIUI?.hydrate();

        detailWrap.querySelector("#audit-detail-close")?.addEventListener("click", () => {
          detailWrap.innerHTML    = "";
          detailWrap.dataset.open = "";
          row.classList.remove("active");
        });

        detailWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  }

  renderFull();
};
