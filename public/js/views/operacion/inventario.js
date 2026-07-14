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
            </tr>
          </thead>
          <tbody id="inv-tbody"></tbody>
        </table>
      </div>
    </section>`;

  const tbody = document.getElementById("inv-tbody");

  function fila(s) {
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
        <td data-label="Stock" class="req-money ${sinStock ? "inv-stock-cero" : "inv-stock-ok"}">${fmtQty(s.cantidad)} ${s.unidad || ""}</td>
        <td data-label="Proyecto">${s.proyecto || "—"}${s.sigla ? ` <span class="rec-sigla">(${s.sigla})</span>` : ""}</td>
        <td data-label="Última entrada">${fmtFecha(s.ultima_entrada)}</td>
        <td data-label="Última salida">${fmtFecha(s.ultima_salida)}</td>
      </tr>`;
  }

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

    if (visibles.length) {
      tbody.innerHTML = visibles.map(fila).join("");
    } else {
      tbody.innerHTML = `
        <tr><td colspan="6">
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

  aplicarFiltros();
  window.SGIUI?.hydrate();
};

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
