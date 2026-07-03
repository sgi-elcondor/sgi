/* Mobile table stacking: turns listing tables into label/value cards on phones.
   It only enhances the main listing tables (those inside .table-wrap or
   .sticky-table-scroll) so inline summary tables inside modals stay untouched.
   Each <td> gets a data-label copied from its column header; the actual card
   layout lives in responsive.css. A MutationObserver re-applies labels after any
   re-render (filters, pagination, detail views, modals) without touching the
   render code of every view. Mark a table or a wrapper with .no-stack to opt out. */
(function () {
  "use strict";

  const MIN_COLS = 2;
  const TABLE_SELECTOR = ".table-wrap table, .sticky-table-scroll table, table.stackable";

  function headerLabels(table) {
    const head = table.tHead;
    if (!head || !head.rows.length) return null;
    const row = head.rows[head.rows.length - 1];
    if (!row || row.cells.length < MIN_COLS) return null;
    return Array.from(row.cells).map((th) => th.textContent.trim());
  }

  function labelTable(table) {
    if (table.classList.contains("no-stack") || table.closest(".no-stack")) return;
    const labels = headerLabels(table);
    if (!labels) return;

    table.classList.add("stackable");

    for (const body of table.tBodies) {
      for (const row of body.rows) {
        if (row.cells.length === 1 && row.cells[0].colSpan > 1) continue;
        let col = 0;
        for (const cell of row.cells) {
          if (cell.colSpan > 1) { col += cell.colSpan; continue; }
          if (!cell.hasAttribute("data-label")) {
            cell.setAttribute("data-label", labels[col] || "");
          }
          col += 1;
        }
      }
    }
  }

  function enhance() {
    document.querySelectorAll(TABLE_SELECTOR).forEach(labelTable);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  }

  function init() {
    enhance();
    const observer = new MutationObserver(schedule);
    ["viewContainer", "modalBody"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { childList: true, subtree: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
