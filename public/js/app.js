const VIEWS = {
  dashboard:     { fn: "dashboardView",     title: "Dashboard" },
  proyectos:     { fn: "proyectosView",     title: "Proyectos" },
  lotes:         { fn: "lotesView",         title: "Lotes" },
  compradores:   { fn: "compradoresView",   title: "Compradores" },
  ventas:        { fn: "ventasView",        title: "Ventas" },
  cuotas:        { fn: "cuotasView",        title: "Cuotas Vencidas" },
  pagos:         { fn: "pagosView",         title: "Pagos" },
  comisionistas: { fn: "comisionistasView", title: "Comisionistas" },
  facturas:      { fn: "facturasView",      title: "Facturas" },
  recibos:       { fn: "recibosView",       title: "Recibos" },
  reportes:      { fn: "reportesView",      title: "Reportes" },
  alertas:       { fn: "alertasView",       title: "Alertas Jurídicas" },
  auditoria:     { fn: "auditoriaView",     title: "Auditoría" },
};

function navigate(viewKey) {
  const view = VIEWS[viewKey];
  if (!view) return;
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === viewKey));
  document.getElementById("viewTitle").textContent = view.title;
  window[view.fn]?.();
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => navigate(btn.dataset.view));
});

document.getElementById("todayDate").textContent = new Date().toLocaleDateString("es-CO", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

navigate("dashboard");
