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
      doc.text("Inversiones & Construcciones · NIT 901.708.415-1", this.M_LEFT, 17);
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

    // Footer (totals) row styling for autoTable `foot`.
    footStyles() {
      const P = PDF_PALETTE;
      return {
        fillColor: P.soft,
        textColor: P.dark,
        fontStyle: "bold",
        fontSize: 8.5,
        lineColor: P.border,
        lineWidth: 0.1,
      };
    },

    // autoTable hooks that render a colored status pill in one column.
    // variantOf(rawText) → "success" | "info" | "muted" | "warning" | "danger".
    statusColumn(columnIndex, variantOf) {
      const PILL = {
        success: { fill: [220, 252, 231], text: [21, 128, 61] },
        info:    { fill: [255, 233, 222], text: [197, 60, 0] },
        muted:   { fill: [241, 245, 249], text: [100, 116, 139] },
        warning: { fill: [254, 243, 199], text: [180, 83, 9] },
        danger:  { fill: [254, 226, 226], text: [185, 28, 28] },
      };
      return {
        didParseCell(data) {
          if (data.section === "body" && data.column.index === columnIndex) {
            data.cell.text = [""]; // drawn manually in didDrawCell
          }
        },
        didDrawCell(data) {
          if (data.section !== "body" || data.column.index !== columnIndex) return;
          const raw = data.cell.raw;
          if (raw == null || raw === "" || raw === "—") return;
          const label = String(raw);
          const col   = PILL[variantOf(label)] || PILL.muted;
          const doc   = data.doc;
          const { x, y, width, height } = data.cell;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.2);
          const pillH = 4.6;
          const pillW = Math.min(width - 2, doc.getTextWidth(label) + 5);
          const px = x + (width - pillW) / 2;
          const py = y + (height - pillH) / 2;

          doc.setFillColor(...col.fill);
          doc.roundedRect(px, py, pillW, pillH, pillH / 2, pillH / 2, "F");
          doc.setTextColor(...col.text);
          doc.text(label, x + width / 2, py + pillH / 2, { align: "center", baseline: "middle" });
        },
      };
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
      c2a.value = "Inversiones & Construcciones · NIT 901.708.415-1";
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Comprobante builder — single-column "receipt" layout (Bancolombia-style)
  // shared by facturas, recibos and recibos de comisión.
  // ─────────────────────────────────────────────────────────────────────────────
  const RECEIPT_ICONS = {
    check:    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    receipt:  '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    user:     '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    pin:      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    map:      '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
    briefcase:'<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    hash:     '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
    file:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock:    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    card:     '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    tag:      '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    coins:    '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    note:     '<path d="M3 3h18v14a2 2 0 0 1-2 2H8l-5 3z"/>',
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${RECEIPT_ICONS[name] || RECEIPT_ICONS.tag}</svg>`;
  }

  // Colombian date formatting (dd/mm/yyyy). Handles date-only strings safely
  // (adds midday to avoid timezone day-shifts).
  function fmtDate(d) {
    if (!d) return "";
    const s  = String(d);
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s;
    const dt = new Date(iso);
    if (isNaN(dt)) return s;
    return dt.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  // Preload the brand logo image so it can be drawn synchronously onto the QR canvas.
  let _logoImg = null;
  function _preloadLogo() {
    try {
      const src = window.SGIBrand && window.SGIBrand.logoWatermark;
      if (src && !_logoImg) {
        const img = new Image();
        img.onload = () => { _logoImg = img; };
        img.src = src;
      }
    } catch (_) {}
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _preloadLogo);
    else _preloadLogo();
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  // Generates a QR locally as a PNG data URI, with the Cóndor logo in the center
  // (when the logo image is already loaded). High error correction (H) keeps it
  // scannable. PNG raster renders reliably on screen, print and rasterized download
  // (html2pdf). Falls back to the online service if the library is unavailable.
  function qrDataUri(text) {
    try {
      if (typeof qrcode === "function" && typeof document !== "undefined") {
        const qr = qrcode(0, "H");
        qr.addData(String(text));
        qr.make();

        const count  = qr.getModuleCount();
        const margin = 4;
        const scale  = 10;
        const dim    = (count + margin * 2) * scale;

        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = dim;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, dim, dim);
        ctx.fillStyle = "#0f172a";
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
          }
        }

        if (_logoImg && _logoImg.complete && _logoImg.naturalWidth) {
          const lDim  = Math.round(count * 0.22) * scale;
          const lPos  = (dim - lDim) / 2;
          const padPx = scale * 0.9;
          ctx.fillStyle = "#ffffff";
          _roundRect(ctx, lPos - padPx, lPos - padPx, lDim + padPx * 2, lDim + padPx * 2, scale * 1.2);
          ctx.fill();
          ctx.drawImage(_logoImg, lPos, lPos, lDim, lDim);
        }

        return canvas.toDataURL("image/png");
      }
    } catch (_) {}
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(text)}`;
  }

  function comprobanteHTML(o) {
    const {
      docTitle    = "Comprobante — El Cóndor S.A.S.",
      badge       = "Comprobante",
      fields      = [],
      extraHTML   = "",
      afterTotalHTML = "",
      trace       = [],
      totalLabel  = "Total",
      totalValue  = "",
      totalWords  = "",
      stamp       = null,
      qrUrl       = "",
      qrCaption   = "",
    } = o;

    const logo = (window.SGIBrand && window.SGIBrand.logoWatermark) || "";

    const fieldsHTML = fields
      .filter(f => f && f.value != null && f.value !== "" && f.value !== "—")
      .map(f => {
        const valueHTML = f.badge
          ? `<span class="cmp-pill cmp-pill-${f.badge}">${f.value}</span>`
          : f.value;
        return `
        <div class="cmp-field">
          <span class="cmp-field-icon">${icon(f.icon)}</span>
          <div class="cmp-field-body">
            <div class="cmp-field-label">${f.label}</div>
            <div class="cmp-field-value">${valueHTML}</div>
          </div>
        </div>`;
      }).join("");

    const STAMP_COLORS = {
      danger:  "#dc2626",
      success: "#15803d",
      muted:   "#94a3b8",
      info:    "#c53c00",
    };
    const stampHTML = stamp && stamp.label ? `
      <div class="cmp-stamp" style="--stamp:${STAMP_COLORS[stamp.variant] || STAMP_COLORS.muted}">${stamp.label}</div>` : "";

    const traceHTML = (trace && trace.length) ? `
      <div class="cmp-trace">
        <div class="cmp-trace-head">
          <span class="cmp-trace-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
          <div>
            <div class="cmp-trace-title">Trazabilidad documental</div>
            <div class="cmp-trace-sub">Cadena Cuota → Factura → Pago → Recibo</div>
          </div>
        </div>
        <div class="cmp-trace-list">
          ${trace.map((t, i) => `
            <div class="cmp-trace-row${i === trace.length - 1 ? " last" : ""}${t.current ? " is-current" : ""}">
              <span class="cmp-trace-node${t.current ? " current" : ""}"></span>
              <span class="cmp-trace-label">${t.label}</span>
              <span class="cmp-trace-value${t.value ? "" : " pending"}">${t.value || "Pendiente"}</span>
            </div>`).join("")}
        </div>
      </div>` : "";

    const fileName = (docTitle.split("—")[0].trim() || "Comprobante").replace(/[^\wáéíóúñ.\-\s]/gi, "").replace(/\s+/g, "_");

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.3/dist/html2pdf.bundle.min.js"></script>
  <style>
    :root{
      --accent:#ff4e00;--accent-dark:#c53c00;--accent-soft:#ffe9de;
      --ink:#0f172a;--text:#1e293b;--muted:#94a3b8;--soft:#64748b;
      --line:#e8edf3;--line-soft:#f1f5f9;--bg:#eef2f7;--surface:#ffffff;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:var(--bg)}
    body{
      font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
      color:var(--text);padding:40px 16px 28px;-webkit-font-smoothing:antialiased;
    }
    .card{
      position:relative;overflow:hidden;
      max-width:460px;margin:0 auto;background:var(--surface);
      border-radius:20px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 14px 40px rgba(15,23,42,.10);
      padding:36px 30px 28px;
    }
    .cmp-stamp{
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%) rotate(-15deg);
      padding:5px 22px;border:3px solid var(--stamp);border-radius:8px;
      color:var(--stamp);font-size:26px;font-weight:800;letter-spacing:.12em;
      text-transform:uppercase;opacity:.22;pointer-events:none;z-index:3;white-space:nowrap;
    }
    .cmp-logo{position:relative;display:flex;justify-content:center;align-items:center;margin-bottom:24px}
    .cmp-logo img{width:160px;max-width:62%;height:auto}
    .cmp-badge{
      background:var(--ink);color:#fff;text-align:center;
      font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
      padding:11px 16px;border-radius:10px;margin-bottom:8px;
    }
    .cmp-fields{padding:8px 4px 0}
    .cmp-field{display:flex;align-items:flex-start;gap:14px;padding:13px 0;border-bottom:1px solid var(--line-soft)}
    .cmp-field:last-child{border-bottom:0}
    .cmp-field-icon{flex-shrink:0;width:22px;height:22px;color:var(--soft);margin-top:1px}
    .cmp-field-icon svg{width:100%;height:100%}
    .cmp-field-body{min-width:0;flex:1}
    .cmp-field-label{font-size:11px;color:var(--muted);font-weight:500;letter-spacing:.01em}
    .cmp-field-value{font-size:14px;color:var(--ink);font-weight:600;margin-top:2px;word-break:break-word}

    .cmp-extra{margin-top:18px}
    .cmp-extra-title{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 4px 10px}
    .cmp-stat-row{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 4px;color:var(--soft)}
    .cmp-stat-row strong{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
    .cmp-prog{height:7px;background:var(--line-soft);border-radius:99px;overflow:hidden;margin:8px 4px 2px;border:1px solid var(--line)}
    .cmp-prog-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-dark));border-radius:99px}
    .cmp-mini{width:100%;border-collapse:collapse;margin-top:8px}
    .cmp-mini th{font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);text-align:left;padding:6px 6px;border-bottom:1px solid var(--line)}
    .cmp-mini td{font-size:11.5px;color:var(--soft);padding:7px 6px;border-bottom:1px solid var(--line-soft);font-variant-numeric:tabular-nums}
    .cmp-mini td.r,.cmp-mini th.r{text-align:right}
    .cmp-mini tr.cur td{background:var(--accent-soft);color:var(--accent-dark);font-weight:600}

    .cmp-trace{margin-top:20px;padding:18px;background:var(--line-soft);border-radius:12px;border:1px solid var(--line)}
    .cmp-trace-head{display:flex;align-items:center;gap:11px;margin-bottom:12px}
    .cmp-trace-ico{flex-shrink:0;width:30px;height:30px;border-radius:8px;background:var(--surface);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--accent)}
    .cmp-trace-ico svg{width:16px;height:16px}
    .cmp-trace-title{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink)}
    .cmp-trace-sub{font-size:10.5px;color:var(--muted);margin-top:1px}
    .cmp-trace-list{padding-left:2px}
    .cmp-trace-row{position:relative;display:flex;align-items:center;gap:12px;padding:8px 8px 8px 22px;border-radius:8px}
    .cmp-trace-row::before{content:"";position:absolute;left:6px;top:0;bottom:0;width:2px;background:var(--line)}
    .cmp-trace-row:first-child::before{top:50%}
    .cmp-trace-row.last::before{bottom:50%}
    .cmp-trace-node{position:absolute;left:1px;width:11px;height:11px;border-radius:50%;background:var(--surface);border:2px solid var(--muted);z-index:1}
    .cmp-trace-node.current{border-color:var(--accent);background:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
    .cmp-trace-label{font-size:12.5px;color:var(--soft);flex:1}
    .cmp-trace-value{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;font-weight:600;color:var(--ink)}
    .cmp-trace-value.pending{font-family:inherit;font-weight:500;color:var(--muted);font-style:italic}
    .cmp-trace-row.is-current{background:var(--surface)}
    .cmp-trace-row.is-current .cmp-trace-label{color:var(--ink);font-weight:600}
    .cmp-trace-row.is-current .cmp-trace-value{color:var(--accent-dark)}

    .cmp-total{
      margin-top:22px;background:var(--accent-soft);border-radius:12px;
      padding:16px 20px;text-align:center;
    }
    .cmp-total-label{font-size:12px;font-weight:700;color:var(--accent-dark);letter-spacing:.02em}
    .cmp-total-value{font-size:26px;font-weight:800;color:var(--accent-dark);margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
    .cmp-total-words{font-size:9.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin-top:8px;line-height:1.5}

    .cmp-qr{display:flex;align-items:center;gap:14px;margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}
    .cmp-qr-box{width:82px;height:82px;padding:4px;border:1px solid var(--line);border-radius:10px;flex-shrink:0}
    .cmp-qr-box img,.cmp-qr-box svg{width:100%;height:100%;display:block}
    .cmp-qr-cap{font-size:11px;color:var(--soft);line-height:1.55}
    .cmp-qr-cap strong{color:var(--text);font-weight:600}

    .cmp-footer{
      display:flex;justify-content:space-between;align-items:center;gap:12px;
      margin-top:22px;padding-top:16px;border-top:1px solid var(--line);
      font-size:10px;color:var(--muted);line-height:1.5;
    }
    .cmp-footer .brand{color:var(--soft);font-weight:600}

    .cmp-pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.02em}
    .cmp-pill-success{background:#dcfce7;color:#15803d}
    .cmp-pill-warning{background:#fef3c7;color:#b45309}
    .cmp-pill-danger{background:#fee2e2;color:#b91c1c}
    .cmp-pill-info{background:var(--accent-soft);color:var(--accent-dark)}
    .cmp-pill-muted{background:var(--line-soft);color:var(--soft)}

    .actions{display:flex;justify-content:center;gap:10px;margin-top:22px}
    .btn{font-family:inherit;cursor:pointer;border:none;border-radius:10px;padding:11px 22px;font-size:13.5px;font-weight:600;transition:transform .12s,box-shadow .12s,background .15s}
    .btn-p{background:var(--accent);color:#fff;box-shadow:0 1px 0 rgba(197,60,0,.3),0 6px 14px rgba(197,60,0,.18)}
    .btn-p:hover{background:var(--accent-dark);transform:translateY(-1px)}
    .btn-c{background:#fff;color:var(--soft);border:1px solid var(--line)}
    .btn-c:hover{background:var(--line-soft);color:var(--text)}

    .print-foot{display:none}
    @media print{
      html,body{background:#fff}
      body{padding:0}
      @page{margin:7mm 0 11mm}
      .card{box-shadow:none;border-radius:0;max-width:none;padding:0 20px}
      .actions{display:none}

      /* Compact spacing so a standard comprobante fits on a single page */
      .cmp-logo{margin-bottom:12px}
      .cmp-logo img{width:128px}
      .cmp-badge{margin-bottom:4px;padding:8px 16px}
      .cmp-fields{padding:4px 4px 0}
      .cmp-field{padding:8px 0}
      .cmp-total{margin-top:14px;padding:12px 20px}
      .cmp-total-value{font-size:22px}
      .cmp-trace{margin-top:12px;padding:12px 14px}
      .cmp-trace-row{padding:5px 8px 5px 22px}
      .cmp-qr{margin-top:12px;padding-top:12px}
      .cmp-extra{margin-top:12px}
      .cmp-footer{margin-top:14px;padding-top:10px}

      .cmp-total,.cmp-trace,.cmp-qr,.cmp-extra,.cmp-field,.cmp-trace-row,.cmp-mini tr,.cmp-tail{
        break-inside:avoid;page-break-inside:avoid;
      }
      .cmp-trace-head{break-after:avoid;page-break-after:avoid}
      .print-foot{
        display:block;position:fixed;left:0;right:0;bottom:4mm;
        text-align:center;font-size:8px;color:#94a3b8;letter-spacing:.02em;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    ${logo ? `<div class="cmp-logo">${stampHTML}<img src="${logo}" alt="El Cóndor"></div>` : stampHTML}
    <div class="cmp-badge">${badge}</div>
    <div class="cmp-fields">${fieldsHTML}</div>
    ${extraHTML || ""}
    <div class="cmp-total">
      <div class="cmp-total-label">${totalLabel}</div>
      <div class="cmp-total-value">${totalValue}</div>
      ${totalWords ? `<div class="cmp-total-words">${totalWords}</div>` : ""}
    </div>
    ${afterTotalHTML || ""}
    <div class="cmp-tail">
      ${traceHTML}
      ${qrUrl ? `
        <div class="cmp-qr">
          <div class="cmp-qr-box">${/^\s*<svg/.test(qrUrl) ? qrUrl : `<img src="${qrUrl}" alt="QR" loading="lazy">`}</div>
          <div class="cmp-qr-cap">${qrCaption || ""}</div>
        </div>` : ""}
    </div>
    <div class="cmp-footer">
      <span class="brand">El Cóndor S.A.S. · Inversiones &amp; Construcciones</span>
      <span>${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</span>
    </div>
  </div>

  <div class="print-foot">El Cóndor S.A.S. · Inversiones &amp; Construcciones · NIT 901.708.415-1</div>

  <div class="actions">
    <button class="btn btn-p" id="cmpDownload">Descargar PDF</button>
    <button class="btn btn-c" id="cmpPrint">Imprimir</button>
    <button class="btn btn-c" onclick="window.close()">Cerrar</button>
  </div>

  <script>
    (function(){
      var FILE = ${JSON.stringify(fileName)} + ".pdf";
      var printBtn = document.getElementById("cmpPrint");
      var dlBtn    = document.getElementById("cmpDownload");
      if (printBtn) printBtn.addEventListener("click", function(){ window.print(); });
      if (dlBtn) dlBtn.addEventListener("click", function(){
        var card = document.querySelector(".card");
        if (!window.html2pdf || !card) { window.print(); return; }
        dlBtn.disabled = true;
        var original = dlBtn.textContent;
        dlBtn.textContent = "Generando…";
        window.html2pdf().set({
          margin:       [8, 6, 14, 6],
          filename:     FILE,
          image:        { type: "jpeg", quality: 0.98 },
          html2canvas:  { scale: 3, useCORS: true, backgroundColor: "#ffffff", logging: false },
          jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak:    { mode: ["css", "legacy"], avoid: [".cmp-tail", ".cmp-total", ".cmp-trace", ".cmp-qr", ".cmp-extra", ".cmp-field"] }
        }).from(card).save().then(function(){
          dlBtn.disabled = false; dlBtn.textContent = original;
        }).catch(function(){
          dlBtn.disabled = false; dlBtn.textContent = original;
          window.print();
        });
      });
    })();
  </script>
</body>
</html>`;
  }

  window.SGIExport = { pdf: PDF, xlsx: XLSX, numToWordsES, CONTACT, comprobanteHTML, fmtDate, qrDataUri };
})();
