// Stock view (INV-03): derived inventory by material/category with last
// entrada/salida. Consumes the movements ledger built in INV-01/INV-02.
(function () {

const icon     = (name) => window.SGIUI?.icon(name) ?? "";
const fmtQty   = n => Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });
const fmtFecha = ts => ts ? new Date(ts).toLocaleDateString("es-CO") : "—";

let _stock = [];
const _f   = { q: "", cat: "", proy: "", agotados: false };

window.inventarioView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  try {
    _stock = await API.get("/inventario/stock");
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }
  _stock = _stock || [];

  const SGIReq = window.SGIReq || {};
  const conStock   = _stock.filter(s => s.cantidad > 0);
  const agotados   = _stock.filter(s => s.cantidad <= 0).length;
  const categorias = [...new Set(_stock.map(s => s.categoria).filter(Boolean))].sort();
  const proyectos  = [...new Map(_stock.filter(s => s.proyecto).map(s => [s.id_proyecto, s])).values()];

  vc.innerHTML = `
    <section class="page-shell">
      ${window.SGIUI?.pageHeader({
        kicker:   "Inventario",
        title:    "Stock de Bodega",
        subtitle: "Existencias actuales por material y categoría, derivadas de las entradas y salidas registradas.",
        meta:     conStock.length ? `<span class="results-chip">${icon("boxes")} ${conStock.length} material(es) con stock</span>` : "",
      }) ?? ""}

      <div class="req-kpi-row">
        <div class="req-kpi success">
          <span class="req-kpi-icon">${icon("boxes")}</span>
          <div><span class="req-kpi-val">${conStock.length}</span><span class="req-kpi-label">Materiales con stock</span></div>
        </div>
        <div class="req-kpi">
          <span class="req-kpi-icon">${icon("tag")}</span>
          <div><span class="req-kpi-val">${categorias.length}</span><span class="req-kpi-label">Categorías</span></div>
        </div>
        ${agotados ? `
        <div class="req-kpi warning">
          <span class="req-kpi-icon">${icon("package-x")}</span>
          <div><span class="req-kpi-val">${agotados}</span><span class="req-kpi-label">Agotados</span></div>
        </div>` : ""}
      </div>

      <div class="table-wrap">
        <div class="table-filters">
          <input id="inv-buscar" type="text" class="filter-input"
            placeholder="Buscar material..." style="flex:2;min-width:16rem">
          <select id="inv-categoria" class="select-sm" style="flex:1;min-width:10rem">
            <option value="">Todas las categorías</option>
            ${(SGIReq.CATEGORIAS || []).filter(c => categorias.includes(c.value))
              .map(c => `<option value="${c.value}">${c.label}</option>`).join("")}
          </select>
          ${proyectos.length > 1 ? `
          <select id="inv-proyecto" class="select-sm" style="flex:1;min-width:10rem">
            <option value="">Todos los proyectos</option>
            ${proyectos.map(p => `<option value="${p.id_proyecto}">${p.proyecto}</option>`).join("")}
          </select>` : ""}
          <label class="inv-check">
            <input type="checkbox" id="inv-agotados" /> Mostrar agotados
          </label>
          <button class="btn btn-ghost" id="inv-pdf" title="Inventario físico imprimible">${icon("file-text")} PDF</button>
          <button class="btn btn-ghost" id="inv-excel" title="Exportar stock a Excel">${icon("file-spreadsheet")} Excel</button>
        </div>

        <table class="req-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Categoría</th>
              <th>Stock</th>
              <th>Proyecto</th>
              <th>Última entrada</th>
              <th>Última salida</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="inv-tbody"></tbody>
        </table>
      </div>
    </section>`;

  const tbody = document.getElementById("inv-tbody");

  function fila(s, idx) {
    const SGIReq = window.SGIReq || {};
    const cat = (SGIReq.CATEGORIAS || []).find(c => c.value === s.categoria) || { label: s.categoria || "—", icon: "box" };
    const sinStock = s.cantidad <= 0;
    return `
      <tr class="req-row ${sinStock ? "inv-row-agotado" : ""}">
        <td class="req-td-main">
          <div class="req-num-cell">
            <span class="req-cat-icon" title="${cat.label}">${icon(cat.icon)}</span>
            <div>
              <div class="rec-num">${s.descripcion}</div>
              <div class="rec-desc">${s.material}</div>
            </div>
          </div>
        </td>
        <td data-label="Categoría">${cat.label}</td>
        <td data-label="Stock" class="req-money ${sinStock ? "inv-stock-cero" : "inv-stock-ok"}">${fmtQty(s.cantidad)}<span class="inv-unidad">${s.unidad || "und"}</span></td>
        <td data-label="Proyecto">${s.proyecto || "—"}${s.sigla ? ` <span class="rec-sigla">(${s.sigla})</span>` : ""}</td>
        <td data-label="Última entrada">${fmtFecha(s.ultima_entrada)}</td>
        <td data-label="Última salida">${fmtFecha(s.ultima_salida)}</td>
        <td class="req-td-actions">
          <div class="req-actions">
            <button class="btn btn-ghost btn-sm btn-inv-kardex" data-idx="${idx}" title="Historial de movimientos">${icon("history")} Kardex</button>
          </div>
        </td>
      </tr>`;
  }

  let _visibles = [];

  function aplicarFiltros() {
    const q    = (document.getElementById("inv-buscar").value || "").trim();
    const cat  = document.getElementById("inv-categoria").value;
    const proy = document.getElementById("inv-proyecto")?.value || "";
    const verAgotados = document.getElementById("inv-agotados").checked;
    Object.assign(_f, { q, cat, proy, agotados: verAgotados });

    const visibles = _stock.filter(s => {
      if (!verAgotados && s.cantidad <= 0) return false;
      if (cat && s.categoria !== cat) return false;
      if (proy && String(s.id_proyecto) !== proy) return false;
      if (q) {
        if (window.SGISearch?.matches) {
          if (!SGISearch.matches(q, s.descripcion, s.material, s.categoria, s.proyecto)) return false;
        } else if (!`${s.descripcion} ${s.material} ${s.categoria || ""} ${s.proyecto || ""}`.toLowerCase().includes(q.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    // Grouped by category with a header row per section — the "por categoría"
    // reading of the story made literal.
    const orden = (window.SGIReq?.CATEGORIAS || []).map(c => c.value);
    _visibles = visibles.sort((a, b) =>
      (orden.indexOf(a.categoria) - orden.indexOf(b.categoria)) ||
      a.descripcion.localeCompare(b.descripcion)
    );

    if (_visibles.length) {
      const SGIReq = window.SGIReq || {};
      let html = "";
      let catActual = "__none__";
      _visibles.forEach((s, idx) => {
        if (s.categoria !== catActual) {
          catActual = s.categoria;
          const cat = (SGIReq.CATEGORIAS || []).find(c => c.value === s.categoria) || { label: s.categoria || "Sin categoría", icon: "box" };
          const n = _visibles.filter(x => x.categoria === s.categoria).length;
          html += `
            <tr class="inv-cat-row"><td colspan="7">
              ${icon(cat.icon)} ${cat.label}
              <span class="req-chip-items">${n} material${n === 1 ? "" : "es"}</span>
            </td></tr>`;
        }
        html += fila(s, idx);
      });
      tbody.innerHTML = html;
    } else {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="req-empty">
            <div class="req-empty-icon">${icon("boxes")}</div>
            <p class="req-empty-title">${_stock.length ? "Nada coincide con los filtros" : "La bodega está vacía"}</p>
            <p class="req-empty-sub">${_stock.length ? "Ajusta la búsqueda o los filtros." : "Cuando el almacenista registre recepciones, el stock aparecerá aquí."}</p>
          </div>
        </td></tr>`;
    }
    window.SGIUI?.hydrate();
  }

  document.getElementById("inv-buscar").value = _f.q;
  document.getElementById("inv-categoria").value = _f.cat;
  if (document.getElementById("inv-proyecto")) document.getElementById("inv-proyecto").value = _f.proy;
  document.getElementById("inv-agotados").checked = _f.agotados;

  document.getElementById("inv-buscar").addEventListener("input", aplicarFiltros);
  document.getElementById("inv-categoria").addEventListener("change", aplicarFiltros);
  document.getElementById("inv-proyecto")?.addEventListener("change", aplicarFiltros);
  document.getElementById("inv-agotados").addEventListener("change", aplicarFiltros);
  document.getElementById("inv-excel").addEventListener("click", async function () {
    this.disabled = true;
    try { await exportStockExcel(); }
    catch (e) { UI.toast(e.message || "No se pudo exportar.", "error"); }
    finally { this.disabled = false; }
  });
  document.getElementById("inv-pdf").addEventListener("click", async function () {
    this.disabled = true;
    try { await exportStockPDF(); }
    catch (e) { UI.toast(e.message || "No se pudo generar el PDF.", "error"); }
    finally { this.disabled = false; }
  });

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-inv-kardex");
    if (!btn) return;
    const s = _visibles[Number(btn.dataset.idx)];
    if (s) abrirKardex(s);
  });

  aplicarFiltros();
  window.SGIUI?.hydrate();
};

// ─────────────────────────────────────────────────────────────────────────────
// Kardex: historial de movimientos de una línea de stock con saldo corrido
// ─────────────────────────────────────────────────────────────────────────────
async function abrirKardex(s) {
  let movs;
  try {
    const params = new URLSearchParams({
      material:    s.material,
      unidad:      s.unidad || "",
      id_proyecto: s.id_proyecto != null ? String(s.id_proyecto) : "none",
    });
    movs = await API.get(`/inventario/movimientos?${params}`);
  } catch (e) {
    UI.toast(e.message || "No se pudo cargar el kardex.", "error");
    return;
  }

  // Running balance oldest→newest, displayed newest first.
  let saldo = 0;
  const conSaldo = (movs || []).map(m => {
    saldo += (m.tipo === "salida" ? -1 : 1) * m.cantidad;
    return { ...m, saldo };
  }).reverse();

  const filas = conSaldo.map(m => `
    <tr>
      <td>${new Date(m.created_at).toLocaleDateString("es-CO")} <span class="rec-desc">${new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span></td>
      <td><span class="badge ${m.tipo === "entrada" ? "badge-success" : "badge-warning"}">${m.tipo === "entrada" ? "Entrada" : "Salida"}</span></td>
      <td class="req-td-right ${m.tipo === "entrada" ? "inv-stock-ok" : "inv-stock-cero"}" style="font-weight:700">${m.tipo === "entrada" ? "+" : "−"}${fmtQty(m.cantidad)}</td>
      <td class="req-td-right" style="font-weight:700">${fmtQty(m.saldo)}</td>
      <td>${m.requerimiento || "—"}</td>
      <td>${m.registrado_por}</td>
    </tr>`).join("");

  UI.openModal(`Kardex · ${s.descripcion}`, `
    <div class="rec-modal">
      <div class="rec-modal-summary">
        <div class="rec-summary-item"><span class="lbl">Material</span><span class="val">${s.descripcion}</span></div>
        <div class="rec-summary-item"><span class="lbl">Proyecto</span><span class="val">${s.proyecto || "—"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Unidad de medida</span><span class="val">${s.unidad || "und"}</span></div>
        <div class="rec-summary-item"><span class="lbl">Movimientos</span><span class="val">${conSaldo.length}</span></div>
        <div class="rec-summary-item"><span class="lbl">Stock actual</span><span class="val ${s.cantidad > 0 ? "inv-stock-ok" : "inv-stock-cero"}" style="font-weight:800">${fmtQty(s.cantidad)}</span></div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Historial de movimientos</span>
        <table class="rec-items-table">
          <thead>
            <tr><th>Fecha</th><th>Movimiento</th><th class="req-td-right">Cantidad</th><th class="req-td-right">Saldo</th><th>Requerimiento</th><th>Registró</th></tr>
          </thead>
          <tbody>${filas || `<tr><td colspan="6" class="empty-row">Sin movimientos registrados.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="UI.closeModal()">Cerrar</button>
    </div>
  `);
  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF del inventario físico: existencias agrupadas por categoría, stock en
// color, campos de escritura para el conteo manual y bloque de firmas.
// ─────────────────────────────────────────────────────────────────────────────
async function exportStockPDF() {
  if (!_stock.length) return UI.toast("No hay stock para exportar.", "info");
  if (window.SGILibs) await window.SGILibs.ensureExport();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const SX  = window.SGIExport.pdf;
  const P   = SX.PALETTE;
  const SGIReq = window.SGIReq || {};

  const conStock  = _stock.filter(s => s.cantidad > 0);
  const orden     = (SGIReq.CATEGORIAS || []).map(c => c.value);
  const ordenados = [..._stock].sort((a, b) =>
    (orden.indexOf(a.categoria) - orden.indexOf(b.categoria)) ||
    a.descripcion.localeCompare(b.descripcion)
  );

  let y = SX.brand(doc);
  y = SX.title(doc, y + 2, {
    title:    "Inventario Físico de Bodega",
    subtitle: "Camina la bodega anotando el conteo real de cada material y la diferencia contra el sistema.",
  });

  // Compact one-line summary instead of KPI cards: on a counting form, vertical
  // space belongs to the table rows.
  const resumen = [
    ["Con stock",  String(conStock.length)],
    ["Agotados",   String(_stock.length - conStock.length)],
    ["Categorías", String(new Set(_stock.map(s => s.categoria).filter(Boolean)).size)],
    ["Corte del sistema", new Date().toLocaleDateString("es-CO")],
  ];
  y += 4;
  let x = SX.M_LEFT;
  doc.setFontSize(8.5);
  resumen.forEach(([label, value], i) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...P.muted);
    doc.text(`${label}: `, x, y);
    x += doc.getTextWidth(`${label}: `);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...P.dark);
    doc.text(value, x, y);
    x += doc.getTextWidth(value);
    if (i < resumen.length - 1) {
      doc.setTextColor(...P.divider);
      doc.text("   ·   ", x, y);
      x += doc.getTextWidth("   ·   ");
    }
  });
  y += 3;
  doc.setDrawColor(...P.border);
  doc.setLineWidth(0.2);
  doc.line(SX.M_LEFT, y, SX.pageWidth(doc) - SX.M_RIGHT, y);
  y += 4;

  // Body with an accent separator row per category; rowsMeta keeps the material
  // aligned with each body row (null = separator) for the styling hooks below.
  const body = [];
  const rowsMeta = [];
  let catActual = "__none__";
  for (const s of ordenados) {
    if (s.categoria !== catActual) {
      catActual = s.categoria;
      const cat = (SGIReq.CATEGORIAS || []).find(c => c.value === s.categoria) || { label: s.categoria || "Sin categoría" };
      const n = ordenados.filter(x => x.categoria === s.categoria).length;
      body.push([{
        content: `${cat.label.toUpperCase()}  ·  ${n} MATERIAL${n === 1 ? "" : "ES"}`,
        colSpan: 8,
        styles: {
          fillColor: P.primarySoft, textColor: P.primary, fontStyle: "bold",
          fontSize: 8.5, halign: "left", cellPadding: 2.6,
        },
      }]);
      rowsMeta.push(null);
    }
    body.push([
      s.descripcion,
      fmtQty(s.cantidad),
      s.unidad || "und",
      s.proyecto || "—",
      "",
      "",
      "",
    ]);
    rowsMeta.push(s);
  }

  const theme = SX.tableTheme();

  doc.autoTable({
    startY: y,
    head: [["Material", "Stock sistema", "Unidad", "Proyecto", "Conteo físico", "Diferencia", "Observaciones"]],
    body,
    ...theme,
    styles: { ...theme.styles, minCellHeight: 10, valign: "middle" },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 28, halign: "right" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 44 },
      4: { cellWidth: 34 },
      5: { cellWidth: 26 },
      6: { cellWidth: 49 },
    },
    didParseCell(data) {
      const s = rowsMeta[data.row.index];
      if (data.section !== "body") return;
      if (!s) {
        // Category strips stay compact.
        data.cell.styles.minCellHeight = 6;
        return;
      }
      if (data.column.index === 0) data.cell.styles.fontStyle = "bold";
      if (data.column.index === 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 9;
        data.cell.styles.textColor = s.cantidad > 0 ? [21, 128, 61] : [220, 38, 38];
      }
    },
    didDrawCell(data) {
      const s = rowsMeta[data.row.index];
      if (data.section !== "body" || !s) return;
      const { x, y: cy, width: w, height: h } = data.cell;

      // Comfortable boxed writing fields for the manual count.
      if (data.column.index === 4 || data.column.index === 5) {
        doc.setFillColor(246, 248, 250);
        doc.setDrawColor(...P.divider);
        doc.setLineWidth(0.2);
        doc.roundedRect(x + 2.5, cy + 1.8, w - 5, h - 3.6, 1, 1, "FD");
      }
      // Observaciones: a writing line for free text.
      if (data.column.index === 6) {
        doc.setDrawColor(...P.divider);
        doc.setLineWidth(0.2);
        doc.line(x + 3, cy + h - 3, x + w - 3, cy + h - 3);
      }
      // Negative stock = administrative mismatch: warning triangle so the
      // operario double-checks that reference.
      if (data.column.index === 1 && s.cantidad < 0) {
        const tx = x + 3.2, ty = cy + h / 2;
        doc.setFillColor(220, 38, 38);
        doc.triangle(tx, ty + 1.6, tx + 3.4, ty + 1.6, tx + 1.7, ty - 1.6, "F");
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("!", tx + 1.7, ty + 1.1, { align: "center" });
      }
    },
  });

  // Signature block: the physical count is an accountable act — who counted,
  // when, and who verified.
  let y2 = (doc.lastAutoTable?.finalY || y) + 14;
  if (y2 > SX.pageHeight(doc) - 32) {
    doc.addPage();
    y2 = 30;
  }
  const W = SX.pageWidth(doc);
  const colW = (W - SX.M_LEFT - SX.M_RIGHT - 24) / 3;
  ["Contado por (nombre y firma)", "Fecha del conteo", "Verificado por (nombre y firma)"].forEach((label, i) => {
    const x = SX.M_LEFT + i * (colW + 12);
    doc.setDrawColor(...P.dark);
    doc.setLineWidth(0.3);
    doc.line(x, y2, x + colW, y2);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...P.muted);
    doc.text(label, x + colW / 2, y2 + 4.5, { align: "center" });
  });

  SX.footer(doc);
  doc.save(`inventario_fisico_${new Date().toISOString().slice(0, 10)}.pdf`);
  UI.toast("PDF de inventario físico descargado.", "ok");
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel del stock
// ─────────────────────────────────────────────────────────────────────────────
async function exportStockExcel() {
  if (!_stock.length) return UI.toast("No hay stock para exportar.", "info");
  if (window.SGILibs) await window.SGILibs.ensureExport();

  const SX = window.SGIExport.xlsx;
  const wb = SX.setup();

  const conStock = _stock.filter(s => s.cantidad > 0);
  const ws = wb.addWorksheet("Stock", { tabColor: { argb: SX.C.primary } });
  ws.columns = [
    { key: "a", width: 36 }, { key: "b", width: 16 }, { key: "c", width: 14 },
    { key: "d", width: 10 }, { key: "e", width: 22 }, { key: "f", width: 16 },
    { key: "g", width: 16 },
  ];

  SX.masthead(ws, {
    title:     "Stock de Bodega",
    subtitle:  "Existencias por material y categoría (entradas − salidas del libro de inventario)",
    mergeCols: 7,
  });

  SX.kpiRow(ws, [
    { label: "Materiales con stock", value: conStock.length },
    { label: "Agotados",             value: _stock.length - conStock.length },
    { label: "Categorías",           value: new Set(_stock.map(s => s.categoria).filter(Boolean)).size },
  ]);

  SX.sectionHeader(ws, "Existencias", { mergeCols: 7 });
  const head = ws.addRow(["Material", "Categoría", "Stock", "Unidad", "Proyecto", "Última entrada", "Última salida"]);
  SX.styleHeader(head);

  _stock.forEach((s, i) => {
    const row = ws.addRow([
      s.descripcion,
      s.categoria || "—",
      Number(s.cantidad),
      s.unidad || "—",
      s.proyecto || "—",
      s.ultima_entrada ? new Date(s.ultima_entrada) : "—",
      s.ultima_salida ? new Date(s.ultima_salida) : "—",
    ]);
    SX.styleBody(row, i % 2 !== 0);
    row.getCell(3).font = {
      name: "Calibri", size: 11, bold: true,
      color: { argb: s.cantidad > 0 ? "FF15803D" : "FFDC2626" },
    };
    row.getCell(6).numFmt = "dd/mm/yyyy";
    row.getCell(7).numFmt = "dd/mm/yyyy";
  });

  await SX.download(wb, `stock_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  UI.toast("Excel de stock descargado.", "ok");
}

})();
