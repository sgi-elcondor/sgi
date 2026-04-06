const UI = {
  openModal(title, bodyHTML) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHTML;
    document.getElementById("modalOverlay").classList.add("open");
  },
  closeModal() { document.getElementById("modalOverlay").classList.remove("open"); },
  badge(estado) {
    const map = {
      activo:"success", activa:"success", disponible:"success", emitida:"success", ganada:"success",
      inactivo:"muted", finalizado:"muted", liquidada:"info", pagada:"info", entregado:"info",
      pre_mora:"warning", pendiente:"warning", no_ganada:"warning",
      en_mora:"danger", vencida:"danger", anulada:"danger", cancelada:"danger", devolucion:"danger"
    };
    return `<span class="badge badge-${map[estado]||"muted"}">${estado}</span>`;
  },
  fmt(n) { return n != null ? Number(n).toLocaleString("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }) : "—"; },
  date(d) { return d ? new Date(d).toLocaleDateString("es-CO") : "—"; },
  loader() { return `<div class="loader">Cargando...</div>`; },
  toast(msg, type="info") {
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;bottom:24px;right:24px;background:var(--surface2);border:1px solid var(--border);
      border-left:3px solid var(--${type==="error"?"danger":type==="ok"?"success":"accent"});
      padding:12px 20px;border-radius:8px;font-size:13px;z-index:999;color:var(--text);box-shadow:var(--shadow);`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
};
document.getElementById("modalClose").addEventListener("click", UI.closeModal);
document.getElementById("modalOverlay").addEventListener("click", e => { if (e.target.id === "modalOverlay") UI.closeModal(); });
