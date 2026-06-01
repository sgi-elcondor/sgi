(function () {
  // ─────────────────────────────────────────────────────────────────────────────
  // PDF helpers (jsPDF + autoTable)
  // ─────────────────────────────────────────────────────────────────────────────
  const PDF_PALETTE = {
    primary:    [255, 78, 0],
    primarySoft:[255, 240, 232],
    dark:       [15, 23, 42],
    text:       [30, 41, 59],
    muted:      [100, 116, 139],
    soft:       [248, 250, 252],
    softer:     [252, 252, 253],
    border:     [226, 232, 240],
    divider:    [203, 213, 225],
    white:      [255, 255, 255],
    success:    [22, 163, 74],
    danger:     [220, 38, 38],
  };

  const PDF = {
    PALETTE: PDF_PALETTE,
    M_LEFT:  14,
    M_RIGHT: 14,

    pageWidth(doc)  { return doc.internal.pageSize.getWidth(); },
    pageHeight(doc) { return doc.internal.pageSize.getHeight(); },

    // Top masthead: thin accent stripe + brand + tagline + date. Returns the Y
    // coordinate where content can start.
    brand(doc) {
      const P = PDF_PALETTE;
      const W = this.pageWidth(doc);

      doc.setFillColor(...P.primary);
      doc.rect(0, 0, W, 2.5, "F");

      doc.setTextColor(...P.dark);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("El Cóndor S.A.S.", this.M_LEFT, 12);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...P.muted);
      doc.text("Sistema de Gestión Inmobiliaria", this.M_LEFT, 17);
      doc.text(`Generado · ${new Date().toLocaleString("es-CO")}`, W - this.M_RIGHT, 12, { align: "right" });

      doc.setDrawColor(...P.border);
      doc.setLineWidth(0.2);
      doc.line(0, 22, W, 22);

      return 32;
    },

    // Document title with thin orange underline + optional subtitle.
    title(doc, y, { title, subtitle } = {}) {
      const P = PDF_PALETTE;
      const W = this.pageWidth(doc);

      doc.setTextColor(...P.dark);
      doc.setFontSize(17);
      doc.setFont("helvetica", "bold");
      doc.text(title, this.M_LEFT, y);

      doc.setDrawColor(...P.primary);
      doc.setLineWidth(0.6);
      doc.line(this.M_LEFT, y + 2.5, this.M_LEFT + 22, y + 2.5);

      let next = y + 8;
      if (subtitle) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...P.muted);
        const lines = doc.splitTextToSize(subtitle, W - this.M_LEFT - this.M_RIGHT);
        doc.text(lines, this.M_LEFT, next);
        next += lines.length * 4.2;
      }
      return next + 4;
    },

    // Section header: small accent kicker + title in dark + thin divider.
    section(doc, y, { kicker, title }) {
      const P = PDF_PALETTE;
      const W = this.pageWidth(doc);

      if (y > this.pageHeight(doc) - 30) { doc.addPage(); y = 30; }

      if (kicker) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...P.primary);
        if (doc.setCharSpace) doc.setCharSpace(0.4);
        doc.text(kicker.toUpperCase(), this.M_LEFT, y);
        if (doc.setCharSpace) doc.setCharSpace(0);
        y += 4;
      }

      doc.setFontSize(11.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...P.dark);
      doc.text(title, this.M_LEFT, y);

      doc.setDrawColor(...P.border);
      doc.setLineWidth(0.2);
      doc.line(this.M_LEFT, y + 2, W - this.M_RIGHT, y + 2);

      return y + 7;
    },

    // KPI cards laid out in a responsive grid. kpis: [{ label, value, desc?, accent? }]
    kpiCards(doc, y, kpis, { perRow = null, height = 26 } = {}) {
      const P = PDF_PALETTE;
      const W = this.pageWidth(doc);
      const usable = W - this.M_LEFT - this.M_RIGHT;
      const cols   = perRow || kpis.length;
      const gap    = 3;
      const cardW  = (usable - gap * (cols - 1)) / cols;
      const cardH  = height;

      kpis.forEach((k, i) => {
        const col = i % cols;
        const rw  = Math.floor(i / cols);
        const x   = this.M_LEFT + col * (cardW + gap);
        const ky  = y + rw * (cardH + gap);

        // White card with subtle border
        doc.setFillColor(...P.white);
        doc.setDrawColor(...P.border);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, ky, cardW, cardH, 1.5, 1.5, "FD");

        // Top accent strip
        doc.setFillColor(...P.primary);
        doc.rect(x, ky, cardW, 0.9, "F");

        // Label (small uppercase muted)
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...P.muted);
        if (doc.setCharSpace) doc.setCharSpace(0.4);
        doc.text(String(k.label || "").toUpperCase(), x + 4, ky + 6.5);
        if (doc.setCharSpace) doc.setCharSpace(0);

        // Big value
        const valColor = k.accent === false ? P.dark : P.primary;
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...valColor);
        doc.text(String(k.value ?? "—"), x + 4, ky + 14);

        // Description (small muted)
        if (k.desc) {
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...P.muted);
          const lines = doc.splitTextToSize(String(k.desc), cardW - 8);
          doc.text(lines.slice(0, 2), x + 4, ky + 20);
        }
      });

      const rows = Math.ceil(kpis.length / cols);
      return y + rows * (cardH + gap);
    },

    // Standard styling for an autoTable. Returns the options object.
    tableTheme({ head = true } = {}) {
      const P = PDF_PALETTE;
      const base = {
        styles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: P.text,
          lineColor: P.border,
          lineWidth: 0.1,
          font: "helvetica",
        },
        alternateRowStyles: { fillColor: P.softer },
        margin: { left: this.M_LEFT, right: this.M_RIGHT },
        theme: "grid",
      };
      if (head) {
        base.headStyles = {
          fillColor: P.dark,
          textColor: P.white,
          fontStyle: "bold",
          fontSize: 8,
          halign: "left",
          cellPadding: 3.5,
        };
      }
      return base;
    },

    // Two-column label/value table for detail sections.
    detailTable(doc, y, rows, opts = {}) {
      const P = PDF_PALETTE;
      doc.autoTable({
        startY: y,
        body: rows,
        theme: "plain",
        styles: {
          fontSize: 9,
          cellPadding: { top: 3, right: 4, bottom: 3, left: 0 },
          textColor: P.text,
          lineColor: P.border,
          lineWidth: 0,
          font: "helvetica",
        },
        columnStyles: {
          0: { fontStyle: "normal", textColor: P.muted, cellWidth: 52 },
          1: { fontStyle: "bold",   textColor: P.dark },
        },
        didDrawCell(data) {
          if (data.section === "body" && data.column.index === 1) {
            doc.setDrawColor(...P.border);
            doc.setLineWidth(0.1);
            const yEnd = data.cell.y + data.cell.height;
            doc.line(PDF.M_LEFT, yEnd, PDF.pageWidth(doc) - PDF.M_RIGHT, yEnd);
          }
        },
        margin: { left: this.M_LEFT, right: this.M_RIGHT },
        ...opts,
      });
      return doc.lastAutoTable.finalY + 2;
    },

    // Bottom footer on every page.
    footer(doc) {
      const P = PDF_PALETTE;
      const W = this.pageWidth(doc);
      const H = this.pageHeight(doc);
      const count = doc.internal.getNumberOfPages();
      for (let i = 1; i <= count; i++) {
        doc.setPage(i);
        doc.setDrawColor(...P.border);
        doc.setLineWidth(0.2);
        doc.line(this.M_LEFT, H - 10, W - this.M_RIGHT, H - 10);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...P.muted);
        doc.text("El Cóndor S.A.S. · Uso interno y confidencial", this.M_LEFT, H - 5);
        doc.text(`Página ${i} de ${count}`, W - this.M_RIGHT, H - 5, { align: "right" });
      }
    },
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Excel helpers (ExcelJS)
  // ─────────────────────────────────────────────────────────────────────────────
  const XLSX_C = {
    primary:    "FFFF4E00",
    primarySoft:"FFFFF2EC",
    dark:       "FF0F172A",
    text:       "FF1E293B",
    muted:      "FF64748B",
    white:      "FFFFFFFF",
    slate:      "FFF8FAFC",
    slateMid:   "FFF1F5F9",
    border:     "FFE2E8F0",
    green:      "FF16A34A",
    red:        "FFDC2626",
  };

  const XLSX_NF = {
    money:    '"$ "#,##0',
    moneyDec: '"$ "#,##0.00',
    percent:  "0.0%",
    integer:  "#,##0",
    decimal:  "#,##0.00",
    date:     "dd/mm/yyyy",
    datetime: "dd/mm/yyyy hh:mm",
  };

  const XLSX = {
    C: XLSX_C,
    NF: XLSX_NF,

    setup(creator = "SGI El Cóndor") {
      const wb = new ExcelJS.Workbook();
      wb.creator  = creator;
      wb.created  = new Date();
      wb.modified = new Date();
      return wb;
    },

    // Renders a clean masthead at the top: brand, tagline+date, accent line,
    // document title and optional subtitle. Returns next free row index.
    masthead(ws, { title, subtitle, mergeCols = 6 } = {}) {
      const C = XLSX_C;

      ws.mergeCells(1, 1, 1, mergeCols);
      const c1 = ws.getCell(1, 1);
      c1.value = "El Cóndor S.A.S.";
      c1.font  = { name: "Calibri", bold: true, size: 16, color: { argb: C.dark } };
      c1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      ws.getRow(1).height = 26;

      const half = Math.max(1, Math.floor(mergeCols / 2));
      ws.mergeCells(2, 1, 2, half);
      const c2a = ws.getCell(2, 1);
      c2a.value = "Sistema de Gestión Inmobiliaria";
      c2a.font  = { name: "Calibri", size: 10, color: { argb: C.muted } };
      c2a.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

      ws.mergeCells(2, half + 1, 2, mergeCols);
      const c2b = ws.getCell(2, half + 1);
      c2b.value = `Generado: ${new Date().toLocaleString("es-CO")}`;
      c2b.font  = { name: "Calibri", size: 10, italic: true, color: { argb: C.muted } };
      c2b.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
      ws.getRow(2).height = 18;

      ws.mergeCells(3, 1, 3, mergeCols);
      ws.getCell(3, 1).border = { bottom: { style: "medium", color: { argb: C.primary } } };
      ws.getRow(3).height = 4;

      let next = 4;
      if (title) {
        ws.mergeCells(next, 1, next, mergeCols);
        const ct = ws.getCell(next, 1);
        ct.value = title;
        ct.font  = { name: "Calibri", bold: true, size: 14, color: { argb: C.dark } };
        ct.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        ws.getRow(next).height = 26;
        next++;

        if (subtitle) {
          ws.mergeCells(next, 1, next, mergeCols);
          const cs = ws.getCell(next, 1);
          cs.value = subtitle;
          cs.font  = { name: "Calibri", size: 10, color: { argb: C.muted } };
          cs.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
          ws.getRow(next).height = 18;
          next++;
        }
      }
      return next + 1;
    },

    // Section title row with a thick orange left border and subtle bg.
    sectionHeader(ws, title, { mergeCols = 6 } = {}) {
      const C = XLSX_C;

      ws.addRow([]).height = 6;
      const row = ws.addRow([title]);
      ws.mergeCells(row.number, 1, row.number, mergeCols);
      const c = ws.getCell(row.number, 1);
      c.value = title;
      c.font  = { name: "Calibri", bold: true, size: 11, color: { argb: C.dark } };
      c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate } };
      c.border = { left: { style: "thick", color: { argb: C.primary } } };
      row.height = 22;
      return row.number;
    },

    // Style a table HEADER row.
    styleHeader(row) {
      const C = XLSX_C;
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.dark } };
        cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: C.white } };
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      });
      row.height = 22;
    },

    // Style a table BODY row (alternating background).
    styleBody(row, isAlt = false) {
      const C = XLSX_C;
      row.eachCell({ includeEmpty: true }, cell => {
        cell.font = { name: "Calibri", size: 10, color: { argb: C.text } };
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
        cell.border = { bottom: { style: "thin", color: { argb: C.border } } };
        if (isAlt) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate } };
      });
      row.height = 18;
    },

    // Add a label / value pair (2-column row). Optionally formatted as money/percent.
    keyValue(ws, label, value, { money = false, percent = false, valueColor = null } = {}) {
      const C = XLSX_C;
      const r = ws.addRow([label, value]);
      const lab = r.getCell(1);
      const val = r.getCell(2);
      lab.font = { name: "Calibri", size: 10, color: { argb: C.muted } };
      lab.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      val.font = { name: "Calibri", bold: true, size: 10, color: { argb: valueColor || C.text } };
      val.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      if (money)        val.numFmt = XLSX_NF.money;
      else if (percent) val.numFmt = XLSX_NF.percent;
      r.height = 18;
      lab.border = { bottom: { style: "hair", color: { argb: C.border } } };
      val.border = { bottom: { style: "hair", color: { argb: C.border } } };
      return r;
    },

    // KPI grid as a single row of "card-like" cells.
    kpiRow(ws, kpis, { startCol = 1 } = {}) {
      const C = XLSX_C;
      // Labels row
      const labRow = ws.addRow(kpis.map(k => k.label.toUpperCase()));
      labRow.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col < startCol) return;
        cell.font = { name: "Calibri", bold: true, size: 9, color: { argb: C.muted } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate } };
        cell.border = { top: { style: "medium", color: { argb: C.primary } } };
      });
      labRow.height = 22;
      // Values row
      const valRow = ws.addRow(kpis.map(k => k.value));
      valRow.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col < startCol) return;
        const k = kpis[col - startCol];
        cell.font = { name: "Calibri", bold: true, size: 16, color: { argb: C.primary } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.white } };
        cell.border = { bottom: { style: "thin", color: { argb: C.border } } };
        if (k.money) cell.numFmt = XLSX_NF.money;
        if (k.percent) cell.numFmt = XLSX_NF.percent;
      });
      valRow.height = 28;
      return valRow.number;
    },

    // Save the workbook and trigger a download.
    async download(wb, filename) {
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href       = url;
      a.download   = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Number → words (Spanish, Colombian pesos). Used by the receipt templates.
  // ─────────────────────────────────────────────────────────────────────────────
  function numToWordsES(n) {
    if (!Number.isFinite(n)) return "";
    n = Math.round(Math.abs(n));
    if (n === 0) return "CERO PESOS COLOMBIANOS";

    const UNI = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
    const ESP = {
      10: "DIEZ", 11: "ONCE", 12: "DOCE", 13: "TRECE", 14: "CATORCE", 15: "QUINCE",
      16: "DIECISÉIS", 17: "DIECISIETE", 18: "DIECIOCHO", 19: "DIECINUEVE",
      20: "VEINTE", 21: "VEINTIUNO", 22: "VEINTIDÓS", 23: "VEINTITRÉS", 24: "VEINTICUATRO",
      25: "VEINTICINCO", 26: "VEINTISÉIS", 27: "VEINTISIETE", 28: "VEINTIOCHO", 29: "VEINTINUEVE",
    };
    const DEC = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
    const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
                 "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

    function u1k(x) {
      if (x === 0) return "";
      if (x === 100) return "CIEN";
      let s = "";
      const h = Math.floor(x / 100);
      const r = x % 100;
      if (h > 0) s += CEN[h];
      if (r > 0) {
        if (s) s += " ";
        if (ESP[r]) s += ESP[r];
        else {
          const d = Math.floor(r / 10);
          const u = r % 10;
          let part = DEC[d];
          if (u > 0) part += (part ? " Y " : "") + UNI[u];
          s += part;
        }
      }
      return s;
    }

    let out = "";
    const ml = Math.floor(n / 1_000_000);
    const k  = Math.floor((n % 1_000_000) / 1000);
    const r  = n % 1000;

    if (ml > 0) out += (ml === 1 ? "UN MILLÓN" : u1k(ml) + " MILLONES") + " ";
    if (k  > 0) out += (k  === 1 ? "MIL"       : u1k(k)  + " MIL")      + " ";
    if (r  > 0) out += u1k(r);

    return out.trim() + " PESOS COLOMBIANOS";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Datos de contacto del negocio.
  // EDITAR el número de WhatsApp con el real de atención al cliente de El Cóndor.
  // Formato: código de país (57 = Colombia) + número celular sin "+" ni espacios.
  // ─────────────────────────────────────────────────────────────────────────────
  const CONTACT = {
    whatsapp: "573218905216",
  };

  window.SGIExport = { pdf: PDF, xlsx: XLSX, numToWordsES, CONTACT };
})();
