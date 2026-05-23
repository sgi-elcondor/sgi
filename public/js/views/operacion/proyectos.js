(() => {
  const EXPORT_ROLES = ["admin", "gerencia", "auxiliar_contable"];

  function fmt(n) {
    return new Intl.NumberFormat("es-CO").format(n || 0);
  }

  function pct(part, total) {
    return total > 0 ? ((part / total) * 100).toFixed(1) : "0.0";
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

  async function exportExcel(rows, lotes) {
    const ORANGE      = "FFFF4E00";
    const ORANGE_SOFT = "FFFFF2EE";
    const ORANGE_MID  = "FFFFCFBD";
    const DARK        = "FF1E2937";
    const WHITE       = "FFFFFFFF";
    const GRAY_LIGHT  = "FFF8F9FA";

    const headerFill   = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    const subFill      = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_MID } };
    const altFill      = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_SOFT } };
    const plainFill    = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
    const titleFont    = { bold: true, size: 14, color: { argb: WHITE }, name: "Calibri" };
    const headerFont   = { bold: true, size: 10, color: { argb: WHITE }, name: "Calibri" };
    const subFont      = { bold: true, size: 10, color: { argb: ORANGE }, name: "Calibri" };
    const bodyFont     = { size: 10, color: { argb: DARK }, name: "Calibri" };
    const thinBorder   = { style: "thin", color: { argb: ORANGE_MID } };
    const cellBorder   = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    function applyTableRow(row, isAlt) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill   = isAlt ? altFill : plainFill;
        cell.font   = bodyFont;
        cell.border = cellBorder;
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

    const wb = new ExcelJS.Workbook();
    wb.creator = "SGI El Cóndor";
    wb.created = new Date();

    const totalLotes = lotes.length;
    const totalDisp  = lotes.filter(l => (l.estado || "").toLowerCase() === "disponible").length;
    const totalVend  = lotes.filter(l => (l.estado || "").toLowerCase() === "vendido").length;

    // ── Hoja 1: Resumen ────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet("Resumen", { tabColor: { argb: ORANGE } });
    ws1.columns = [
      { key: "a", width: 38 },
      { key: "b", width: 16 },
      { key: "c", width: 52 },
    ];

    ws1.mergeCells("A1:C1");
    const t1 = ws1.getCell("A1");
    t1.value     = "REPORTE DE PROYECTOS — EL CÓNDOR S.A.S.";
    t1.fill      = headerFill;
    t1.font      = titleFont;
    t1.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(1).height = 32;

    ws1.mergeCells("A2:C2");
    const t2 = ws1.getCell("A2");
    t2.value     = "Sistema de Gestión Inmobiliaria (SGI)";
    t2.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF7733" } };
    t2.font      = { bold: false, size: 10, color: { argb: WHITE }, name: "Calibri" };
    t2.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(2).height = 18;

    ws1.mergeCells("A3:C3");
    const t3 = ws1.getCell("A3");
    t3.value     = `Generado: ${new Date().toLocaleString("es-CO")}`;
    t3.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_LIGHT } };
    t3.font      = { size: 9, color: { argb: "FF64748B" }, italic: true, name: "Calibri" };
    t3.alignment = { horizontal: "right", vertical: "middle" };
    ws1.getRow(3).height = 16;

    ws1.addRow([]);

    ws1.mergeCells("A5:C5");
    const sectionCell = ws1.getCell("A5");
    sectionCell.value     = "INDICADORES GLOBALES";
    sectionCell.fill      = subFill;
    sectionCell.font      = subFont;
    sectionCell.alignment = { horizontal: "left", vertical: "middle" };
    ws1.getRow(5).height  = 20;

    const kpiHeader = ws1.addRow(["Indicador", "Valor", "Descripción"]);
    applyHeaderRow(kpiHeader);

    const kpiData = [
      ["Total de proyectos registrados",  rows.length,                          "Proyectos activos en la plataforma a la fecha"],
      ["Total de lotes en inventario",    totalLotes,                           "Suma de todos los lotes de todos los proyectos"],
      ["Lotes disponibles para la venta", totalDisp,                            "Lotes sin venta activa asignada"],
      ["Lotes vendidos",                  totalVend,                            "Lotes con venta activa o finalizada en el sistema"],
      ["Porcentaje de ocupación (%)",     parseFloat(pct(totalVend, totalLotes)), "Lotes vendidos ÷ total de lotes × 100"],
    ];
    kpiData.forEach((rowData, i) => {
      applyTableRow(ws1.addRow(rowData), i % 2 !== 0);
    });

    // ── Hoja 2: Proyectos ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet("Proyectos", { tabColor: { argb: ORANGE } });
    ws2.columns = [
      { key: "id",          width: 8  },
      { key: "nombre",      width: 36 },
      { key: "sigla",       width: 10 },
      { key: "ubicacion",   width: 36 },
      { key: "descripcion", width: 42 },
      { key: "totalLotes",  width: 14 },
      { key: "disponibles", width: 14 },
      { key: "vendidos",    width: 12 },
      { key: "ocupacion",   width: 14 },
    ];

    ws2.mergeCells("A1:I1");
    const pt1 = ws2.getCell("A1");
    pt1.value     = "PROYECTOS INMOBILIARIOS — EL CÓNDOR S.A.S.";
    pt1.fill      = headerFill;
    pt1.font      = titleFont;
    pt1.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(1).height = 28;

    ws2.addRow([]);

    const projHeader = ws2.addRow([
      "ID", "Nombre", "Sigla", "Ubicación", "Descripción",
      "Total Lotes", "Disponibles", "Vendidos", "Ocupación (%)",
    ]);
    applyHeaderRow(projHeader);

    rows.forEach((r, i) => {
      applyTableRow(ws2.addRow([
        r.id,
        r.nombre,
        r.sigla       || "",
        r.ubicacion   || "",
        r.descripcion || "",
        r.totalLotes,
        r.disponibles,
        r.vendidos,
        parseFloat(pct(r.vendidos, r.totalLotes)),
      ]), i % 2 !== 0);
    });

    ws2.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 9 } };

    // ── Hoja 3: Lotes ──────────────────────────────────────────────────────
    const ws3 = wb.addWorksheet("Lotes", { tabColor: { argb: ORANGE } });
    ws3.columns = [
      { key: "id_lote",      width: 10 },
      { key: "codigo",       width: 14 },
      { key: "proyecto",     width: 32 },
      { key: "manzana",      width: 12 },
      { key: "numero_lote",  width: 14 },
      { key: "area_m2",      width: 12 },
      { key: "precio_base",  width: 16 },
      { key: "dimensiones",  width: 18 },
      { key: "estado",       width: 14 },
      { key: "descripcion",  width: 40 },
    ];

    ws3.mergeCells("A1:J1");
    const lt1 = ws3.getCell("A1");
    lt1.value     = "INVENTARIO DE LOTES — EL CÓNDOR S.A.S.";
    lt1.fill      = headerFill;
    lt1.font      = titleFont;
    lt1.alignment = { horizontal: "center", vertical: "middle" };
    ws3.getRow(1).height = 28;

    ws3.addRow([]);

    const lotHeader = ws3.addRow([
      "ID Lote", "Código", "Proyecto", "Manzana", "Número de Lote",
      "Área (m²)", "Precio Base", "Dimensiones", "Estado", "Descripción",
    ]);
    applyHeaderRow(lotHeader);

    lotes.forEach((l, i) => {
      const proj = rows.find(r => r.id === l.id_proyecto);
      applyTableRow(ws3.addRow([
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
      ]), i % 2 !== 0);
    });

    ws3.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 10 } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `proyectos_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportPDF(rows, lotes) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const totalLotes = lotes.length;
    const totalDisp  = lotes.filter(l => (l.estado || "").toLowerCase() === "disponible").length;
    const totalVend  = lotes.filter(l => (l.estado || "").toLowerCase() === "vendido").length;

    const C_PRIMARY = [255, 78, 0];
    const C_DARK    = [30, 41, 59];
    const C_GRAY    = [100, 116, 139];
    const C_LIGHT   = [255, 248, 245];
    const C_BLUE_BG = [255, 242, 235];
    const C_WHITE   = [255, 255, 255];
    const C_DIVIDER = [255, 207, 189];

    // ── Header ─────────────────────────────────────────────────────────────
    doc.setFillColor(...C_PRIMARY);
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(...C_WHITE);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EL CÓNDOR S.A.S.", 14, 14);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Sistema de Gestión Inmobiliaria — SGI", 14, 22);
    doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, 196, 22, { align: "right" });

    // ── Título ─────────────────────────────────────────────────────────────
    doc.setTextColor(...C_DARK);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte Ejecutivo de Proyectos", 14, 44);

    doc.setDrawColor(...C_PRIMARY);
    doc.setLineWidth(0.6);
    doc.line(14, 47, 196, 47);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C_GRAY);
    const introLines = doc.splitTextToSize(
      "Este reporte presenta el estado actual del portafolio de proyectos inmobiliarios de El Cóndor S.A.S. " +
      "Incluye indicadores clave del inventario de lotes y la ficha completa de cada proyecto con sus métricas " +
      "de disponibilidad y ocupación a la fecha de generación. Uso exclusivo para análisis interno y toma de decisiones.",
      182
    );
    doc.text(introLines, 14, 53);

    // ── Sección: Indicadores Globales ─────────────────────────────────────
    let y = 72;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C_DARK);
    doc.text("Indicadores Globales", 14, y);

    doc.setDrawColor(...C_DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(14, y + 2, 196, y + 2);
    y += 7;

    const kpis = [
      {
        value: String(rows.length),
        label: "Proyectos",
        desc:  "Total de proyectos registrados en el sistema a la fecha.",
      },
      {
        value: fmt(totalLotes),
        label: "Total Lotes",
        desc:  "Inventario consolidado: suma de todos los lotes de todos los proyectos.",
      },
      {
        value: fmt(totalDisp),
        label: "Disponibles",
        desc:  "Lotes sin venta activa asignada, aptos para la comercialización.",
      },
      {
        value: fmt(totalVend),
        label: "Vendidos",
        desc:  "Lotes vinculados a una venta activa o finalizada en el sistema.",
      },
      {
        value: `${pct(totalVend, totalLotes)}%`,
        label: "Ocupación",
        desc:  "Porcentaje de lotes vendidos sobre el inventario total (lotes vendidos ÷ total × 100).",
      },
    ];

    const cardW  = 35.6;
    const cardH  = 26;
    const gapX   = 1.5;

    kpis.forEach((k, i) => {
      const x = 14 + i * (cardW + gapX);

      doc.setFillColor(...C_LIGHT);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
      doc.setDrawColor(...C_DIVIDER);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");

      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C_PRIMARY);
      doc.text(k.value, x + cardW / 2, y + 10, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C_DARK);
      doc.text(k.label, x + cardW / 2, y + 16, { align: "center" });

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C_GRAY);
      const dLines = doc.splitTextToSize(k.desc, cardW - 4);
      doc.text(dLines, x + cardW / 2, y + 21, { align: "center" });
    });

    y += cardH + 12;

    // ── Sección: Tabla de Proyectos ─────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C_DARK);
    doc.text("Detalle de Proyectos", 14, y);

    doc.setDrawColor(...C_DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(14, y + 2, 196, y + 2);
    y += 6;

    // Guía de columnas
    doc.setFillColor(...C_BLUE_BG);
    doc.roundedRect(14, y, 182, 20, 2, 2, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C_PRIMARY);
    doc.text("Guía de columnas:", 17, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C_DARK);

    const colDefs = [
      "ID — Identificador único del proyecto en la base de datos.",
      "Nombre — Denominación oficial del proyecto inmobiliario.",
      "Sigla — Código abreviado de hasta 3 caracteres.",
      "Ubicación — Dirección o zona geográfica del proyecto.",
      "Lotes — Total de lotes registrados bajo este proyecto.",
      "Disp. — Lotes sin venta activa asignada.",
      "Vend. — Lotes con venta activa o finalizada.",
      "Ocup.% — (Vendidos ÷ Total Lotes) × 100.",
    ];
    const half = Math.ceil(colDefs.length / 2);
    const row1 = colDefs.slice(0, half).join("   ");
    const row2 = colDefs.slice(half).join("   ");
    doc.text(doc.splitTextToSize(row1, 174), 17, y + 11);
    doc.text(doc.splitTextToSize(row2, 174), 17, y + 16);

    y += 24;

    doc.autoTable({
      startY: y,
      head: [["ID", "Nombre", "Sigla", "Ubicación", "Lotes", "Disp.", "Vend.", "Ocup.%"]],
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
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: C_DIVIDER,
        lineWidth: 0.2,
        textColor: C_DARK,
      },
      headStyles: {
        fillColor: C_PRIMARY,
        textColor: C_WHITE,
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
      },
      alternateRowStyles: { fillColor: C_LIGHT },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { cellWidth: 48 },
        2: { halign: "center", cellWidth: 14 },
        3: { cellWidth: 48 },
        4: { halign: "center", cellWidth: 14 },
        5: { halign: "center", cellWidth: 14 },
        6: { halign: "center", cellWidth: 14 },
        7: { halign: "center", cellWidth: 18 },
      },
      margin: { left: 14, right: 14 },
    });

    // ── Pie de página en todas las páginas ──────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();

      doc.setFillColor(...C_LIGHT);
      doc.rect(0, pageH - 13, 210, 13, "F");
      doc.setDrawColor(...C_DIVIDER);
      doc.setLineWidth(0.3);
      doc.line(0, pageH - 13, 210, pageH - 13);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C_GRAY);
      doc.text("El Cóndor S.A.S. — Uso interno y confidencial", 14, pageH - 5);
      doc.text(`Página ${i} de ${pageCount}`, 196, pageH - 5, { align: "right" });
    }

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
        '<div class="table-header"><h3>Listado de proyectos</h3></div>' +
        '<table><thead><tr><th>ID</th><th>Proyecto</th><th>Total lotes</th><th>Disponibles</th><th>Vendidos</th></tr></thead>' +
        `<tbody>${buildRows(rows)}</tbody></table>` +
        "</section></section>";

      window.SGIUI?.hydrate();

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
