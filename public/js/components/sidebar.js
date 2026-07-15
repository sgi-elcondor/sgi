const SIDEBAR_GROUPS = [
  { label: "General", items: [
    { view: "dashboard", icon: "layout-dashboard", label: "Panel" },
  ]},
  { label: "Operacion", items: [
    { view: "el-proyecto", icon: "building-2", label: "El Proyecto" },
    { view: "proyectos",   icon: "building-2", label: "Proyectos" },
    { view: "lotes",       icon: "map",        label: "Lotes" },
    { view: "mapa-editor", icon: "pencil-ruler", label: "Editor de Mapa" },
    { view: "compradores", icon: "users",      label: "Compradores" },
    { view: "ventas",      icon: "briefcase",  label: "Ventas" },
    { view: "recepciones", icon: "package",    label: "Recepciones" },
    { view: "inventario",  icon: "boxes",      label: "Inventario" },
    { view: "requerimientos", icon: "clipboard-list", label: "Requerimientos" },
    { view: "aprobaciones",   icon: "clipboard-check", label: "Aprobaciones" },
    { view: "empresas-aliadas", icon: "building-2", label: "Empresas Aliadas" },
  ]},
  { label: "Finanzas", items: [
    { view: "cuotas",             icon: "calendar",      label: "Cuotas" },
    { view: "pagos",              icon: "wallet",        label: "Pagos" },
    { view: "comisionistas",      icon: "percent",       label: "Comisionistas" },
    { view: "facturas",           icon: "receipt",       label: "Facturas" },
    { view: "recibos",            icon: "file-text",     label: "Recibos" },
    { view: "bank-transactions",  icon: "landmark",      label: "Transacciones" },
    { view: "payment-validation", icon: "shield-check",  label: "Validar pagos" },
    { view: "gastos",             icon: "trending-down", label: "Gastos" },
    { view: "desembolsos",        icon: "banknote",      label: "Desembolsos" },
  ]},
  { label: "Mi cuenta", items: [
    { view: "dashboard",    icon: "home",     label: "Mi Lote" },
    { view: "mis-cuotas",   icon: "calendar", label: "Mis Cuotas" },
    { view: "mis-facturas", icon: "receipt",  label: "Mis Facturas" },
    { view: "mis-recibos",  icon: "wallet",   label: "Mis Pagos" },
  ]},
  { label: "Control", items: [
    { view: "reportes",  icon: "bar-chart-3",    label: "Reportes" },
    { view: "auditoria", icon: "shield-check",   label: "Auditoria" },
    { view: "respaldos", icon: "database-backup", label: "Respaldos" },
    { view: "personal",  icon: "users",          label: "Personal" },
    { view: "usuarios",  icon: "settings",       label: "Usuarios" },
    { view: "roles",     icon: "shield-check",   label: "Permisos" },
  ]},
  { label: "Juridico", items: [
    { view: "juridico", icon: "scale", label: "Seguimiento Juridico" },
  ]},
];

function renderSidebar(vistas, simulatedRol) {
  const nav = document.getElementById("sidebarNav");
  if (!nav) return;

  const allowed    = new Set(vistas || []);
  const rendered   = new Set();
  const isComprador = (simulatedRol || window.currentUser?.rol) === "comprador";
  let html = "";
  let firstGroup = true;

  SIDEBAR_GROUPS.forEach(function(group) {
    const visible = group.items.filter(function(item) {
      // A comprador always sees "Mis Facturas" (they hold the mis_facturas permission used
      // when requesting an invoice); it does not require a separate granted vista.
      const compFactura = isComprador && item.view === "mis-facturas";
      if (!allowed.has(item.view) && !compFactura) return false;
      if (rendered.has(item.view)) return false;
      if (isComprador && group.label === "General" && item.view === "dashboard") return false;
      return true;
    });
    if (!visible.length) return;
    visible.forEach(function(item) { rendered.add(item.view); });

    if (!firstGroup) html += '<div class="nav-divider"></div>';
    firstGroup = false;

    html += '<div class="nav-group"><span class="nav-group-title">' + group.label + '</span>';
    visible.forEach(function(item) {
      html +=
        '<button type="button" class="nav-item" data-view="' + item.view + '" data-label="' + item.label + '">' +
        '<span class="nav-icon"><i data-lucide="' + item.icon + '"></i></span>' +
        '<span>' + item.label + '</span>' +
        '</button>';
    });
    html += '</div>';
  });

  nav.innerHTML = html;

  nav.querySelectorAll(".nav-item").forEach(function(btn) {
    btn.addEventListener("click", function() {
      if (btn.dataset.view) window.navigate(btn.dataset.view);
    });
  });

  window.SGIUI?.hydrate();
  initNavTooltips();
}

function initNavTooltips() {
  var tip = document.getElementById("nav-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "nav-tooltip";
    document.body.appendChild(tip);
  }

  document.querySelectorAll(".nav-item").forEach(function(item) {
    item.addEventListener("mouseenter", function() {
      if (!document.body.classList.contains("sidebar-collapsed")) return;
      var label = item.dataset.label;
      if (!label) return;
      var rect = item.getBoundingClientRect();
      tip.textContent = label;
      tip.style.top  = Math.round(rect.top + rect.height / 2) + "px";
      tip.style.left = Math.round(rect.right + 12) + "px";
      tip.classList.add("visible");
    });
    item.addEventListener("mouseleave", function() {
      tip.classList.remove("visible");
    });
  });
}

function applySidebarState(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  const toggle = document.getElementById("sidebarToggle");
  if (!toggle) return;
  toggle.setAttribute("aria-pressed", String(collapsed));
  toggle.title = collapsed ? "Expandir barra lateral" : "Colapsar barra lateral";
  toggle.innerHTML = collapsed
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  window.SGIUI?.hydrate();
}

function initSidebarToggle() {
  const toggle = document.getElementById("sidebarToggle");
  if (!toggle) return;
  const STORAGE_KEY = "sgi_sidebar_collapsed";
  applySidebarState(localStorage.getItem(STORAGE_KEY) === "1");
  toggle.addEventListener("click", function() {
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    applySidebarState(collapsed);
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  });
}

(function setupMobileSidebarDrawer() {
  const MOBILE_QUERY = "(max-width: 57.5rem)";

  function isMobile() { return window.matchMedia(MOBILE_QUERY).matches; }

  function getElements() {
    return {
      btn:      document.getElementById("mobileMenuToggle"),
      backdrop: document.getElementById("mobileSidebarBackdrop"),
    };
  }

  function openSidebar() {
    if (!isMobile()) return;
    const { btn } = getElements();
    document.body.classList.add("sidebar-mobile-open");
    if (btn) { btn.setAttribute("aria-expanded", "true"); btn.setAttribute("aria-label", "Cerrar menú"); }
  }

  function closeSidebar() {
    const { btn } = getElements();
    document.body.classList.remove("sidebar-mobile-open");
    if (btn) { btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", "Abrir menú"); }
  }

  function init() {
    const { btn, backdrop } = getElements();

    if (btn) btn.addEventListener("click", function() {
      document.body.classList.contains("sidebar-mobile-open") ? closeSidebar() : openSidebar();
    });

    if (backdrop) backdrop.addEventListener("click", closeSidebar);

    document.addEventListener("click", function(event) {
      if (!isMobile()) return;
      if (event.target.closest(".sidebar .nav-item")) closeSidebar();
    });

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") closeSidebar();
    });

    window.addEventListener("resize", function() {
      if (!isMobile()) closeSidebar();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
