(() => {
  const EXPORT_ROLES = ["admin", "gerencia", "auxiliar_contable"];

  const sortState = { col: null, dir: "asc" };
  let cachedLotes = [];

  const TABLE_COLS = [
    { key: "id",          label: "ID"          },
    { key: "nombre",      label: "Proyecto"    },
    { key: "sigla",       label: "Sigla"       },
    { key: "totalLotes",  label: "Total lotes" },
    { key: "disponibles", label: "Disponibles" },
    { key: "vendidos",    label: "Vendidos"    },
  ];

  function fmt(n) {
    return new Intl.NumberFormat("es-CO").format(n || 0);
  }

  function fmtCOP(n) {
    if (n == null || n === "") return "—";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
  }

  function pct(part, total) {
    return total > 0 ? ((part / total) * 100).toFixed(1) : "0.0";
  }

  function appliedSort(rows) {
    if (!sortState.col) return rows;
    return [...rows].sort((a, b) => {
      let va = a[sortState.col] ?? "";
      let vb = b[sortState.col] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortState.dir === "asc" ? -1 : 1;
      if (va > vb) return sortState.dir === "asc" ? 1 : -1;
      return 0;
    });
  }

  function buildTableHTML(rows) {
    const thead = `<thead><tr>${TABLE_COLS.map(c => {
      const active = sortState.col === c.key;
      const cls    = active ? `sortable sort-${sortState.dir}` : "sortable";
      return `<th class="${cls}" data-col="${c.key}">${c.label} <span class="sort-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M423.5-574 289.29-439.79Q272-422.5 248.5-421.75t-41.48-16.75q-17.52-17.5-16.77-41t18.07-40.81L439.41-751.1q7.91-7.9 18.97-13.15 11.06-5.25 21.78-5.25 10.71 0 21.78 5.25Q513-759 520.5-751.5l232 232q19 19 19 40.75t-18.52 39.25Q735-422 712.08-422q-22.91 0-40.08-17.5L536.5-574v349.52q0 22.79-16.79 39.64Q502.92-168 480.21-168t-39.71-16.84q-17-16.85-17-39.64V-574Z"/></svg></span></th>`;
    }).join("")}</tr></thead>`;

    const tbody = `<tbody>${appliedSort(rows).map(r =>
      `<tr class="clickable-row" data-id="${r.id}" title="Ver detalle del proyecto">
        <td><strong>${r.id}</strong></td>
        <td>${r.nombre}</td>
        <td>${r.sigla ? `<span style="font-family:monospace;font-weight:600">${r.sigla}</span>` : "<span style='color:var(--text-muted)'>—</span>"}</td>
        <td>${r.totalLotes}</td>
        <td>${r.disponibles}</td>
        <td>${r.vendidos}</td>
      </tr>`
    ).join("")}</tbody>`;

    return thead + tbody;
  }

  function wireSortHeaders(tableEl, rows) {
    tableEl.querySelectorAll("th[data-col]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (sortState.col === col) {
          sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
        } else {
          sortState.col = col;
          sortState.dir = "asc";
        }
        tableEl.innerHTML = buildTableHTML(rows);
        wireSortHeaders(tableEl, rows);
        wireRowClicks(tableEl, rows);
      });
    });
  }

  function wireRowClicks(tableEl, rows) {
    const canExport = EXPORT_ROLES.includes(window.currentUser?.rol);
    tableEl.querySelectorAll("tr.clickable-row").forEach(tr => {
      tr.addEventListener("click", () => {
        const id  = parseInt(tr.dataset.id, 10);
        const row = rows.find(r => r.id === id);
        if (!row) return;
        const projectLotes = cachedLotes.filter(l => l.id_proyecto === id);
        showProjectDetail(row, projectLotes, canExport);
      });
    });
  }

  function showProjectDetail(row, projectLotes, canExport) {
    const overlay = document.getElementById("modalOverlay");
    const titleEl = document.getElementById("modalTitle");
    const bodyEl  = document.getElementById("modalBody");
    if (!overlay || !titleEl || !bodyEl) return;

    const disponibles  = projectLotes.filter(l => (l.estado || "").toLowerCase() === "disponible").length;
    const vendidos     = projectLotes.filter(l => (l.estado || "").toLowerCase() === "vendido").length;
    const entregados   = projectLotes.filter(l => (l.estado || "").toLowerCase() === "entregado").length;
    const total        = projectLotes.length;
    const areaTotal    = projectLotes.reduce((s, l) => s + (l.area_m2 || 0), 0);
    const withPrice    = projectLotes.filter(l => l.precio_base);
    const precioTotal  = withPrice.reduce((s, l) => s + (l.precio_base || 0), 0);
    const precioAvg    = withPrice.length ? precioTotal / withPrice.length : 0;
    const ocupacion    = vendidos + entregados;

    titleEl.textContent = row.nombre;

    const kpis = [
      { label: "Total lotes",  value: fmt(total),                          sub: "Inventario del proyecto"               },
      { label: "Disponibles",  value: fmt(disponibles),                    sub: `${pct(disponibles, total)}% del total` },
      { label: "Vendidos",     value: fmt(vendidos),                       sub: `${pct(vendidos, total)}% del total`    },
      { label: "Entregados",   value: fmt(entregados),                     sub: `${pct(entregados, total)}% del total`  },
      { label: "Ocupación",    value: `${pct(ocupacion, total)}%`,         sub: "(Vendidos + Entregados) ÷ Total"       },
      { label: "Área total",   value: `${fmt(areaTotal.toFixed(1))} m²`,   sub: "Suma del área de todos los lotes"      },
      { label: "Precio prom.", value: fmtCOP(Math.round(precioAvg)),       sub: "Precio base promedio por lote"         },
      { label: "Valor total",  value: fmtCOP(Math.round(precioTotal)),     sub: "Suma del valor base del inventario"    },
    ];

    const kpiHTML = kpis.map(k =>
      `<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:0.5rem;padding:0.875rem 0.5rem;text-align:center">
        <div style="font-size:1.05rem;font-weight:700;color:var(--color-primary);word-break:break-all">${k.value}</div>
        <div style="font-size:0.72rem;font-weight:600;color:var(--text-primary);margin-top:0.25rem">${k.label}</div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-top:0.125rem;line-height:1.3">${k.sub}</div>
      </div>`
    ).join("");

    const estadoBadge = (estado) => {
      const map = { disponible: "success", vendido: "warning", entregado: "info" };
      const cls = map[(estado || "").toLowerCase()] || "default";
      return `<span class="badge badge-${cls}">${estado || "—"}</span>`;
    };

    const lotesRows = projectLotes.map(l =>
      `<tr>
        <td>${l.codigo_lote || "—"}</td>
        <td>${l.manzana || "—"}</td>
        <td>${l.numero_lote || "—"}</td>
        <td>${l.area_m2 != null ? `${l.area_m2} m²` : "—"}</td>
        <td>${l.precio_base != null ? fmtCOP(l.precio_base) : "—"}</td>
        <td>${estadoBadge(l.estado)}</td>
      </tr>`
    ).join("");

    const metaChips = [
      row.sigla     ? `<span style="font-family:monospace;background:var(--bg-tertiary,var(--bg-secondary));padding:0.15rem 0.5rem;border-radius:0.25rem;font-weight:600;font-size:0.82rem;border:1px solid var(--border-color)">${row.sigla}</span>` : "",
      row.ubicacion ? `<span style="color:var(--text-muted);font-size:0.82rem">📍 ${row.ubicacion}</span>` : "",
    ].filter(Boolean).join(" ");

    bodyEl.innerHTML =
      `<div style="display:flex;flex-direction:column;gap:1rem">` +
      (metaChips ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem">${metaChips}</div>` : "") +
      (row.descripcion ? `<p style="color:var(--text-secondary);font-size:0.82rem;margin:0;line-height:1.5">${row.descripcion}</p>` : "") +
      `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem">${kpiHTML}</div>` +
      (projectLotes.length
        ? `<div class="table-wrap" style="margin:0">
            <div class="table-header"><h3 style="font-size:0.85rem;margin:0">Lotes del proyecto</h3></div>
            <div style="overflow-x:auto;max-height:16rem">
              <table>
                <thead><tr>
                  <th>Código</th><th>Manzana</th><th>N° Lote</th><th>Área</th><th>Precio base</th><th>Estado</th>
                </tr></thead>
                <tbody>${lotesRows}</tbody>
              </table>
            </div>
           </div>`
        : `<p style="color:var(--text-muted);text-align:center;padding:1rem 0;margin:0">Sin lotes registrados.</p>`
      ) +
      `<div class="form-actions" style="margin-top:0.5rem">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cerrar</button>
        ${canExport ? `<button class="btn btn-primary" id="btnExportProjectPDF">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Exportar PDF
        </button>` : ""}
       </div>` +
      `</div>`;

    overlay.classList.add("open");
    window.SGIUI?.hydrate();

    if (canExport) {
      document.getElementById("btnExportProjectPDF")?.addEventListener("click", () => {
        exportProjectPDF(row, projectLotes);
      });
    }
  }

  function exportProjectPDF(row, projectLotes) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const SX  = window.SGIExport.pdf;

    const disponibles = projectLotes.filter(l => (l.estado || "").toLowerCase() === "disponible").length;
    const vendidos    = projectLotes.filter(l => (l.estado || "").toLowerCase() === "vendido").length;
    const entregados  = projectLotes.filter(l => (l.estado || "").toLowerCase() === "entregado").length;
    const total       = projectLotes.length;
    const areaTotal   = projectLotes.reduce((s, l) => s + (l.area_m2 || 0), 0);
    const withPrice   = projectLotes.filter(l => l.precio_base);
    const precioTotal = withPrice.reduce((s, l) => s + (l.precio_base || 0), 0);
    const precioAvg   = withPrice.length ? precioTotal / withPrice.length : 0;
    const ocupacion   = vendidos + entregados;

    let y = SX.brand(doc);

    const metaParts = [
      row.sigla     ? `Sigla ${row.sigla}` : null,
      row.ubicacion ? row.ubicacion : null,
    ].filter(Boolean).join("  ·  ");
    const subtitle  = [metaParts, row.descripcion].filter(Boolean).join("\n");
    y = SX.title(doc, y + 2, {
      title:    `Ficha de Proyecto · ${row.nombre}`,
      subtitle: subtitle || undefined,
    });

    y = SX.section(doc, y + 2, { kicker: "Resumen", title: "Indicadores Clave" });
    y = SX.kpiCards(doc, y, [
      { label: "Total lotes",  value: fmt(total),                         desc: "Inventario registrado" },
      { label: "Disponibles",  value: fmt(disponibles),                   desc: `${pct(disponibles, total)}% sin venta` },
      { label: "Vendidos",     value: fmt(vendidos),                      desc: `${pct(vendidos, total)}% con venta activa` },
      { label: "Entregados",   value: fmt(entregados),                    desc: `${pct(entregados, total)}% entregados` },
      { label: "Ocupación",    value: `${pct(ocupacion, total)}%`,        desc: "Vendidos + Entregados" },
      { label: "Área total",   value: `${fmt(areaTotal.toFixed(0))} m²`,  desc: "Suma de áreas" },
      { label: "Precio prom.", value: `$${fmt(Math.round(precioAvg))}`,   desc: "Por lote del inventario" },
      { label: "Valor total",  value: `$${fmt(Math.round(precioTotal))}`, desc: "Suma del inventario" },
    ], { perRow: 4 });

    if (projectLotes.length > 0) {
      y = SX.section(doc, y + 6, { kicker: "Detalle", title: "Inventario de Lotes" });

      const areaTotal  = projectLotes.reduce((s, l) => s + Number(l.area_m2 || 0), 0);
      const valorTotal = projectLotes.reduce((s, l) => s + Number(l.precio_base || 0), 0);

      doc.autoTable({
        startY: y,
        head: [["Código", "Manzana", "N° Lote", "Área (m²)", "Precio Base", "Estado"]],
        body: projectLotes.map(l => [
          l.codigo_lote   || "—",
          l.manzana       || "—",
          l.numero_lote   || "—",
          l.area_m2 != null ? String(l.area_m2) : "—",
          l.precio_base   != null ? `$${fmt(l.precio_base)}` : "—",
          l.estado        || "—",
        ]),
        foot: [[
          `Total · ${projectLotes.length} lote${projectLotes.length === 1 ? "" : "s"}`,
          "", "",
          `${areaTotal.toLocaleString("es-CO")} m²`,
          `$${fmt(valorTotal)}`,
          "",
        ]],
        showFoot: "lastPage",
        ...SX.tableTheme(),
        footStyles: SX.footStyles(),
        columnStyles: {
          0: { cellWidth: 24 },
          1: { halign: "center", cellWidth: 20 },
          2: { halign: "center", cellWidth: 20 },
          3: { halign: "right",  cellWidth: 24 },
          4: { halign: "right",  cellWidth: 46 },
          5: { halign: "center", cellWidth: 22 },
        },
        ...SX.statusColumn(5, e => {
          const n = String(e || "").toLowerCase();
          return n === "disponible" ? "success" : n === "vendido" ? "info" : n === "entregado" ? "muted" : "warning";
        }),
      });
    }

    SX.footer(doc);

    const slug = (row.sigla || row.nombre).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    doc.save(`proyecto_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function exportExcel(rows, lotes) {
    const SX = window.SGIExport.xlsx;
    const wb = SX.setup();

    const totalLotes = lotes.length;
    const totalDisp  = lotes.filter(l => (l.estado || "").toLowerCase() === "disponible").length;
    const totalVend  = lotes.filter(l => (l.estado || "").toLowerCase() === "vendido").length;

    // ── Hoja 1: Resumen ────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet("Resumen", { tabColor: { argb: SX.C.primary } });
    ws1.columns = [
      { key: "a", width: 38 },
      { key: "b", width: 16 },
      { key: "c", width: 16 },
      { key: "d", width: 16 },
      { key: "e", width: 16 },
    ];

    SX.masthead(ws1, {
      title:     "Reporte de Proyectos",
      subtitle:  "Estado consolidado del portafolio inmobiliario",
      mergeCols: 5,
    });

    SX.kpiRow(ws1, [
      { label: "Proyectos",   value: rows.length },
      { label: "Total lotes", value: totalLotes },
      { label: "Disponibles", value: totalDisp },
      { label: "Vendidos",    value: totalVend },
      { label: "Ocupación",   value: totalLotes ? totalVend / totalLotes : 0, percent: true },
    ]);

    SX.sectionHeader(ws1, "Indicadores Globales", { mergeCols: 5 });
    const kpiHeader = ws1.addRow(["Indicador", "Valor", "Descripción", "", ""]);
    ws1.mergeCells(kpiHeader.number, 3, kpiHeader.number, 5);
    SX.styleHeader(kpiHeader);

    const kpiData = [
      ["Total de proyectos registrados",  rows.length, "Proyectos activos en la plataforma a la fecha"],
      ["Total de lotes en inventario",    totalLotes,  "Suma de todos los lotes de todos los proyectos"],
      ["Lotes disponibles para la venta", totalDisp,   "Lotes sin venta activa asignada"],
      ["Lotes vendidos",                  totalVend,   "Lotes con venta activa o finalizada en el sistema"],
      ["Porcentaje de ocupación",         totalLotes ? totalVend / totalLotes : 0, "Lotes vendidos ÷ total de lotes"],
    ];
    kpiData.forEach((rowData, i) => {
      const r = ws1.addRow(rowData);
      ws1.mergeCells(r.number, 3, r.number, 5);
      SX.styleBody(r, i % 2 !== 0);
      r.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      r.getCell(2).font = { name: "Calibri", bold: true, size: 11, color: { argb: SX.C.primary } };
      if (i === kpiData.length - 1) r.getCell(2).numFmt = SX.NF.percent;
    });

    ws1.views = [{ state: "frozen", ySplit: 5 }];

    // ── Hoja 2: Proyectos ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet("Proyectos", { tabColor: { argb: SX.C.primary } });
    ws2.columns = [
      { key: "id",          width: 8  },
      { key: "nombre",      width: 32 },
      { key: "sigla",       width: 10 },
      { key: "ubicacion",   width: 28 },
      { key: "descripcion", width: 38 },
      { key: "totalLotes",  width: 14 },
      { key: "disponibles", width: 14 },
      { key: "vendidos",    width: 12 },
      { key: "ocupacion",   width: 14 },
    ];

    SX.masthead(ws2, {
      title:     "Detalle de Proyectos",
      subtitle:  `${rows.length} proyecto${rows.length === 1 ? "" : "s"} en el reporte`,
      mergeCols: 9,
    });

    ws2.addRow([]).height = 4;
    const projHeader = ws2.addRow([
      "ID", "Nombre", "Sigla", "Ubicación", "Descripción",
      "Total Lotes", "Disponibles", "Vendidos", "Ocupación",
    ]);
    SX.styleHeader(projHeader);
    const projHeaderRow = projHeader.number;

    rows.forEach((r, i) => {
      const row = ws2.addRow([
        r.id,
        r.nombre,
        r.sigla       || "",
        r.ubicacion   || "",
        r.descripcion || "",
        r.totalLotes,
        r.disponibles,
        r.vendidos,
        r.totalLotes ? r.vendidos / r.totalLotes : 0,
      ]);
      SX.styleBody(row, i % 2 !== 0);
      [6, 7, 8].forEach(c => {
        row.getCell(c).alignment = { vertical: "middle", horizontal: "center" };
      });
      row.getCell(9).numFmt = SX.NF.percent;
      row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
    });

    ws2.views = [{ state: "frozen", ySplit: projHeaderRow }];
    ws2.autoFilter = {
      from: { row: projHeaderRow, column: 1 },
      to:   { row: projHeaderRow, column: 9 },
    };

    // ── Hoja 3: Lotes ──────────────────────────────────────────────────────
    const ws3 = wb.addWorksheet("Lotes", { tabColor: { argb: SX.C.primary } });
    ws3.columns = [
      { key: "id_lote",      width: 10 },
      { key: "codigo",       width: 14 },
      { key: "proyecto",     width: 28 },
      { key: "manzana",      width: 12 },
      { key: "numero_lote",  width: 12 },
      { key: "area_m2",      width: 12 },
      { key: "precio_base",  width: 18 },
      { key: "dimensiones",  width: 18 },
      { key: "estado",       width: 14 },
      { key: "descripcion",  width: 40 },
    ];

    SX.masthead(ws3, {
      title:     "Inventario de Lotes",
      subtitle:  `${lotes.length} lote${lotes.length === 1 ? "" : "s"} consolidados de todos los proyectos`,
      mergeCols: 10,
    });

    ws3.addRow([]).height = 4;
    const lotHeader = ws3.addRow([
      "ID Lote", "Código", "Proyecto", "Manzana", "Núm. Lote",
      "Área (m²)", "Precio Base", "Dimensiones", "Estado", "Descripción",
    ]);
    SX.styleHeader(lotHeader);
    const lotHeaderRow = lotHeader.number;

    lotes.forEach((l, i) => {
      const proj = rows.find(r => r.id === l.id_proyecto);
      const row  = ws3.addRow([
        l.id_lote,
        l.codigo_lote || "",
        proj ? proj.nombre : "",
        l.manzana     || "",
        l.numero_lote || "",
        l.area_m2     ?? "",
        l.precio_base ?? "",
        l.dimensiones || "",
        l.estado      || "",
        l.descripcion || "",
      ]);
      SX.styleBody(row, i % 2 !== 0);
      if (typeof l.area_m2     === "number") row.getCell(6).numFmt = SX.NF.decimal;
      if (typeof l.precio_base === "number") row.getCell(7).numFmt = SX.NF.money;
      row.getCell(6).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
      row.getCell(7).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    });

    ws3.views = [{ state: "frozen", ySplit: lotHeaderRow }];
    ws3.autoFilter = {
      from: { row: lotHeaderRow, column: 1 },
      to:   { row: lotHeaderRow, column: 10 },
    };

    await SX.download(wb, `proyectos_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPDF(rows, lotes) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const SX  = window.SGIExport.pdf;

    const totalLotes = lotes.length;
    const totalDisp  = lotes.filter(l => (l.estado || "").toLowerCase() === "disponible").length;
    const totalVend  = lotes.filter(l => (l.estado || "").toLowerCase() === "vendido").length;

    let y = SX.brand(doc);

    y = SX.title(doc, y + 2, {
      title:    "Reporte Ejecutivo de Proyectos",
      subtitle: "Estado actual del portafolio inmobiliario y sus métricas de disponibilidad y ocupación a la fecha de generación.",
    });

    y = SX.section(doc, y + 2, { kicker: "Resumen", title: "Indicadores Globales" });
    y = SX.kpiCards(doc, y, [
      { label: "Proyectos",   value: String(rows.length),         desc: "Proyectos activos" },
      { label: "Total lotes", value: fmt(totalLotes),             desc: "Inventario consolidado" },
      { label: "Disponibles", value: fmt(totalDisp),              desc: "Sin venta activa" },
      { label: "Vendidos",    value: fmt(totalVend),              desc: "Con venta activa" },
      { label: "Ocupación",   value: `${pct(totalVend, totalLotes)}%`, desc: "Vendidos ÷ total" },
    ], { perRow: 5 });

    y = SX.section(doc, y + 6, { kicker: "Detalle", title: "Proyectos" });

    doc.autoTable({
      startY: y,
      head: [["ID", "Nombre", "Sigla", "Ubicación", "Lotes", "Disp.", "Vend.", "Ocup."]],
      body: rows.map(r => [
        r.id,
        r.nombre,
        r.sigla     || "—",
        r.ubicacion || "—",
        r.totalLotes,
        r.disponibles,
        r.vendidos,
        `${pct(r.vendidos, r.totalLotes)}%`,
      ]),
      foot: [[
        "", `Total · ${rows.length} proyecto${rows.length === 1 ? "" : "s"}`, "", "",
        totalLotes, totalDisp, totalVend, `${pct(totalVend, totalLotes)}%`,
      ]],
      showFoot: "lastPage",
      ...SX.tableTheme(),
      footStyles: SX.footStyles(),
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { cellWidth: 50 },
        2: { halign: "center", cellWidth: 14 },
        3: { cellWidth: 48 },
        4: { halign: "center", cellWidth: 14 },
        5: { halign: "center", cellWidth: 14 },
        6: { halign: "center", cellWidth: 14 },
        7: { halign: "center", cellWidth: 16 },
      },
    });

    SX.footer(doc);
    doc.save(`reporte_proyectos_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function render(container) {
    const canCreate = AppState.can("proyectos", "crear");
    const canExport = EXPORT_ROLES.includes(window.currentUser?.rol);

    try {
      const [proyectos, lotes] = await Promise.all([
        API.get("/proyectos"),
        API.get("/lotes"),
      ]);

      cachedLotes = lotes;

      const rows = proyectos.map(p => {
        const id  = p.id_proyecto ?? p.id;
        const del = lotes.filter(l => l.id_proyecto === id);
        return {
          ...p, id,
          totalLotes:  del.length,
          disponibles: del.filter(l => (l.estado || "").toLowerCase() === "disponible").length,
          vendidos:    del.filter(l => (l.estado || "").toLowerCase() === "vendido").length,
        };
      });

      const exportButtons = canExport
        ? `<button class="btn btn-ghost" id="btnExportExcel">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Exportar Excel
           </button>
           <button class="btn btn-ghost" id="btnExportPDF">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9" x2="10" y2="9"/></svg>
            Exportar PDF
           </button>`
        : "";

      const createButton = canCreate
        ? `<button class="btn btn-primary" id="btnNuevoProyecto">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo proyecto
           </button>`
        : "";

      container.innerHTML =
        '<style>.clickable-row:hover td{background:var(--bg-hover,rgba(255,78,0,0.04));cursor:pointer}.clickable-row td:last-child::after{content:"›";float:right;color:var(--text-muted);font-size:1rem;line-height:1}</style>' +
        '<section class="page-shell">' +
        window.SGIUI.pageHeader({
          kicker:   "Gestion",
          title:    "Proyectos",
          subtitle: canCreate
            ? "Administra los proyectos y su inventario de lotes."
            : "Consulta los proyectos registrados y su relacion con los lotes disponibles.",
          meta:     `<span class="results-chip">${window.SGIUI.icon("building-2")} ${rows.length} proyecto(s)</span>`,
          actions:  exportButtons + createButton,
        }) +
        '<section class="stats-grid">' +
        `<article class="stat-card"><div class="stat-label">Total proyectos</div><div class="stat-value">${fmt(rows.length)}</div><div class="stat-sub">Base actual registrada</div></article>` +
        `<article class="stat-card"><div class="stat-label">Total lotes</div><div class="stat-value">${fmt(lotes.length)}</div><div class="stat-sub">Inventario consolidado</div></article>` +
        "</section>" +
        '<section class="table-wrap">' +
        '<div class="table-header"><h3>Listado de proyectos</h3><span style="font-size:0.75rem;color:var(--text-muted)">Haz clic en una fila para ver el detalle</span></div>' +
        `<table id="proj-table">${buildTableHTML(rows)}</table>` +
        "</section></section>";

      window.SGIUI?.hydrate();

      const projTable = document.getElementById("proj-table");
      if (projTable) {
        wireSortHeaders(projTable, rows);
        wireRowClicks(projTable, rows);
      }

      if (canExport) {
        document.getElementById("btnExportExcel")?.addEventListener("click", async () => {
          await exportExcel(rows, lotes);
        });
        document.getElementById("btnExportPDF")?.addEventListener("click", () => {
          exportPDF(rows, lotes);
        });
      }

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
                sigla:       sigla     || undefined,
                ubicacion:   ubicacion || undefined,
                descripcion: desc      || undefined,
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
