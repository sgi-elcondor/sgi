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
    content.innerHTML = '<p class="pv-empty">Cargando…</p>';
    let proyectos, lotes, asesores;
    try {
      [proyectos, lotes, asesores] = await Promise.all([
        getJSON("/api/v1/public/proyectos"),
        getJSON("/api/v1/public/lotes"),
        getJSON("/api/v1/public/asesores"),
      ]);
    } catch (e) {
      content.innerHTML = `<p class="pv-empty" style="color:var(--danger,#dc2626)">${esc(e.message)}</p>`;
      return;
    }

    const lotesPorProyecto = {};
    (lotes || []).forEach((l) => {
      (lotesPorProyecto[l.id_proyecto] = lotesPorProyecto[l.id_proyecto] || []).push(l);
    });

    let selectedIdx = 0;

    function render(pidx) {
      const proyecto    = (proyectos || [])[pidx];
      const disponibles = proyecto ? (lotesPorProyecto[proyecto.id_proyecto] || []) : [];

      const selector = (proyectos || []).length > 1
        ? `<div class="lote-selector">${proyectos.map((p, i) =>
            `<button class="lote-tab ${i === pidx ? "active" : ""}" data-pidx="${i}">${esc(p.nombre)}</button>`
          ).join("")}</div>`
        : "";

      const lotesHtml = disponibles.length
        ? disponibles.map((l) => `
            <div class="lote-disponible-card">
              <div class="lote-disponible-code">${esc(l.codigo_lote)}</div>
              <div class="lote-disponible-meta">${[
                l.manzana ? "Mz " + esc(l.manzana) : "",
                l.area_m2 ? esc(l.area_m2) + " m²" : "",
                l.dimensiones ? esc(l.dimensiones) : "",
              ].filter(Boolean).join(" · ")}</div>
              <div class="lote-disponible-precio">${fmtM(l.precio_base)}</div>
            </div>`).join("")
        : `<p class="pv-empty">No hay lotes disponibles en este proyecto por ahora.</p>`;

      const asesoresHtml = (asesores || []).length
        ? `<div class="pv-asesores-grid">${asesores.map(asesorCard).join("")}</div>`
        : `<p class="pv-empty">Pronto publicaremos nuestros asesores comerciales.</p>`;

      content.innerHTML = `
        ${selector}
        ${proyecto?.descripcion ? `<p class="proyecto-descripcion">${esc(proyecto.descripcion)}</p>` : ""}
        ${proyecto?.ubicacion ? `<p class="pv-empty" style="margin-top:-.25rem">📍 ${esc(proyecto.ubicacion)}</p>` : ""}

        <section class="table-wrap" style="margin-top:1rem">
          <div class="table-header"><h3>Lotes disponibles (${disponibles.length})</h3></div>
          <div class="lotes-disponibles-grid">${lotesHtml}</div>
        </section>

        <section class="table-wrap" style="margin-top:1rem">
          <div class="table-header"><h3>Asesores comerciales</h3></div>
          <div style="padding:1rem">${asesoresHtml}</div>
        </section>`;

      content.querySelectorAll("[data-pidx]").forEach((btn) => {
        btn.addEventListener("click", () => { selectedIdx = Number(btn.dataset.pidx); render(selectedIdx); });
      });
    }

    if (!proyectos || !proyectos.length) {
      content.innerHTML = `<p class="pv-empty">Pronto publicaremos nuestros proyectos.</p>`;
    } else {
      render(selectedIdx);
    }
  }

  function asesorCard(a) {
    const nombre   = `${a.nombres || ""} ${a.apellidos || ""}`.trim() || "Asesor comercial";
    const initials = (nombre.split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase();
    const avatar   = a.photo_url
      ? `<img class="pv-asesor-avatar" src="${esc(a.photo_url)}" alt="${esc(nombre)}">`
      : `<div class="pv-asesor-avatar">${esc(initials)}</div>`;
    const contacto = [
      a.telefono ? `<a href="tel:${esc(a.telefono)}">${esc(a.telefono)}</a>` : "",
      a.email    ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>`    : "",
    ].filter(Boolean).join("<br>");
    return `
      <div class="pv-asesor-card">
        ${avatar}
        <div style="min-width:0">
          <div class="pv-asesor-name">${esc(nombre)}</div>
          <div class="pv-asesor-contact">${contacto || "Contáctanos para más información"}</div>
        </div>
      </div>`;
  }

  load();
})();
