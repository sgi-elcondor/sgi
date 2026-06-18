// Public showcase page. No authentication: talks only to /api/v1/public/* (no token).
(function () {
  "use strict";

  const content = document.getElementById("pv-content");

  const fmtM = (n) => n != null && n !== ""
    ? Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    : "Consultar";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo cargar la información.");
    return res.json();
  }

  async function load() {
    content.innerHTML = `<div class="pv-empty">Cargando…</div>`;
    let proyectos, lotes, asesores;
    try {
      [proyectos, lotes, asesores] = await Promise.all([
        getJSON("/api/v1/public/proyectos"),
        getJSON("/api/v1/public/lotes"),
        getJSON("/api/v1/public/asesores"),
      ]);
    } catch (e) {
      content.innerHTML = `<div class="pv-empty" style="color:var(--danger,#dc2626)">${esc(e.message)}</div>`;
      return;
    }

    const lotesPorProyecto = {};
    (lotes || []).forEach((l) => {
      (lotesPorProyecto[l.id_proyecto] = lotesPorProyecto[l.id_proyecto] || []).push(l);
    });

    const advisorsHtml = (asesores || []).length
      ? `<div class="pv-advisors">${asesores.map(asesorCard).join("")}</div>`
      : `<div class="pv-empty">Pronto publicaremos nuestros asesores comerciales.</div>`;

    let selectedIdx = 0;

    function render(pidx) {
      const proyecto    = (proyectos || [])[pidx];
      const disponibles = proyecto ? (lotesPorProyecto[proyecto.id_proyecto] || []) : [];

      const chips = (proyectos || []).map((p, i) =>
        `<button class="pv-chip ${i === pidx ? "active" : ""}" data-pidx="${i}">${esc(p.nombre)}</button>`
      ).join("");

      const lotsHtml = disponibles.length
        ? `<div class="pv-lots">${disponibles.map((l) => `
            <div class="pv-lot">
              <div class="pv-lot-code">${esc(l.codigo_lote)}</div>
              <div class="pv-lot-meta">${[
                l.manzana ? "Mz " + esc(l.manzana) : "",
                l.area_m2 ? esc(l.area_m2) + " m²" : "",
                l.dimensiones ? esc(l.dimensiones) : "",
              ].filter(Boolean).join(" · ") || "&nbsp;"}</div>
              <div class="pv-lot-price">${fmtM(l.precio_base)}</div>
            </div>`).join("")}</div>`
        : `<div class="pv-empty">No hay lotes disponibles en este proyecto por ahora.</div>`;

      content.innerHTML = `
        ${chips ? `<div class="pv-chips">${chips}</div>` : ""}
        ${proyecto?.descripcion ? `<p class="pv-proj-desc">${esc(proyecto.descripcion)}</p>` : ""}
        ${proyecto?.ubicacion ? `<p class="pv-proj-loc">📍 ${esc(proyecto.ubicacion)}</p>` : ""}

        <section class="pv-section">
          <div class="pv-section-head"><h2>Lotes disponibles</h2><span class="pv-count">${disponibles.length}</span></div>
          ${lotsHtml}
        </section>

        <section class="pv-section">
          <div class="pv-section-head"><h2>Asesores comerciales</h2></div>
          ${advisorsHtml}
        </section>`;

      content.querySelectorAll("[data-pidx]").forEach((btn) => {
        btn.addEventListener("click", () => { selectedIdx = Number(btn.dataset.pidx); render(selectedIdx); });
      });
    }

    if (!proyectos || !proyectos.length) {
      content.innerHTML = `<div class="pv-empty">Pronto publicaremos nuestros proyectos.</div>`;
    } else {
      render(selectedIdx);
    }
  }

  function asesorCard(a) {
    const nombre   = `${a.nombres || ""} ${a.apellidos || ""}`.trim() || "Asesor comercial";
    const initials = (nombre.split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase();
    const avatar   = a.photo_url
      ? `<img class="pv-avatar" src="${esc(a.photo_url)}" alt="${esc(nombre)}">`
      : `<div class="pv-avatar">${esc(initials)}</div>`;
    const contacto = [
      a.telefono ? `<a href="tel:${esc(a.telefono)}">${esc(a.telefono)}</a>` : "",
      a.email    ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>`    : "",
    ].filter(Boolean).join("<br>");
    return `
      <div class="pv-advisor">
        ${avatar}
        <div style="min-width:0">
          <div class="pv-advisor-name">${esc(nombre)}</div>
          <div class="pv-advisor-contact">${contacto || "Contáctanos para más información"}</div>
        </div>
      </div>`;
  }

  load();
})();
