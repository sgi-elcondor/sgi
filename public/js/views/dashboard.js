// /js/views/dashboard.js

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);

const formatNumber = (value = 0) =>
  new Intl.NumberFormat("es-CO").format(value);

function dashboardKpiCard(item, primary = false) {
  return `
    <article class="kpi-card ${primary ? "primary" : "secondary"}">
      <div class="kpi-top">
        <span class="kpi-label">${item.label}</span>
        <span class="kpi-indicator ${item.tone}"></span>
      </div>
      <div class="kpi-value">${item.currency ? formatCurrency(item.value) : formatNumber(item.value)}</div>
      <div class="kpi-meta">${item.meta || ""}</div>
    </article>
  `;
}

function renderDashboard() {
  const criticalKpis = [
    {
      label: "Ventas activas",
      value: 24,
      meta: "3 nuevas esta semana",
      tone: "info"
    },
    {
      label: "Cuotas vencen hoy",
      value: 9,
      meta: "Requieren seguimiento inmediato",
      tone: "warning"
    },
    {
      label: "En mora",
      value: 6,
      meta: "2 casos críticos",
      tone: "danger"
    },
    {
      label: "Pagos hoy",
      value: 12,
      meta: "8 aplicados, 4 pendientes",
      tone: "success"
    }
  ];

  const financeKpis = [
    {
      label: "Capital financiado",
      value: 1280000000,
      meta: "Total consolidado",
      tone: "info",
      currency: true
    },
    {
      label: "Capital pagado",
      value: 862000000,
      meta: "67.3% recuperado",
      tone: "success",
      currency: true
    },
    {
      label: "Saldo pendiente",
      value: 418000000,
      meta: "Cartera viva",
      tone: "warning",
      currency: true
    },
    {
      label: "Comisiones pendientes",
      value: 28400000,
      meta: "5 liquidaciones por revisar",
      tone: "danger",
      currency: true
    }
  ];

  const tasks = [
    {
      title: "Aplicar pagos recibidos",
      desc: "4 pagos están en cola para validación y aplicación.",
      badge: "Alta",
      badgeClass: "badge-danger"
    },
    {
      title: "Cuotas con vencimiento hoy",
      desc: "9 cuotas deben revisarse antes del cierre del día.",
      badge: "Media",
      badgeClass: "badge-warning"
    },
    {
      title: "Ventas pendientes de aprobación",
      desc: "3 ventas creadas por asesor comercial requieren revisión.",
      badge: "Media",
      badgeClass: "badge-info"
    },
    {
      title: "Liquidar comisiones",
      desc: "2 comisionistas alcanzaron el umbral de causación.",
      badge: "Baja",
      badgeClass: "badge-muted"
    }
  ];

  const movements = [
    {
      title: "Pago aplicado",
      desc: "Lote A-12 · Comprador: Laura Ramírez",
      time: "Hace 10 min"
    },
    {
      title: "Factura generada",
      desc: "Venta VC-2026-014 · Proyecto Reserva Norte",
      time: "Hace 26 min"
    },
    {
      title: "Cambio auditado",
      desc: "Se actualizó el estado de una cuota a mora",
      time: "Hace 41 min"
    },
    {
      title: "Nueva venta registrada",
      desc: "Lote B-07 · Pendiente de aprobación",
      time: "Hace 1 h"
    }
  ];

  const upcomingInstallments = [
    {
      venta: "VC-2026-014",
      comprador: "Laura Ramírez",
      lote: "A-12",
      fecha: "08/04/2026",
      valor: 1850000,
      estado: "Hoy",
      badgeClass: "badge-warning"
    },
    {
      venta: "VC-2026-011",
      comprador: "Carlos Gómez",
      lote: "B-07",
      fecha: "09/04/2026",
      valor: 1320000,
      estado: "Mañana",
      badgeClass: "badge-info"
    },
    {
      venta: "VC-2026-009",
      comprador: "Diana López",
      lote: "C-03",
      fecha: "10/04/2026",
      valor: 2100000,
      estado: "Próxima",
      badgeClass: "badge-muted"
    },
    {
      venta: "VC-2026-006",
      comprador: "Andrés Suárez",
      lote: "D-15",
      fecha: "10/04/2026",
      valor: 1740000,
      estado: "Próxima",
      badgeClass: "badge-muted"
    }
  ];

  return `
    <section class="dashboard-shell">
      <section class="dashboard-hero">
        <div class="dashboard-hero-copy">
          <span class="hero-eyebrow">Resumen operativo</span>
          <h2 class="hero-title">Centro de operación</h2>
          <p class="hero-text">
            Visualiza el estado de ventas, cartera, pagos, cuotas y comisiones en una sola vista.
          </p>
        </div>

        <div class="dashboard-hero-panel">
          <div class="hero-role">
            <span class="hero-role-label">Rol activo</span>
            <strong>Auxiliar contable</strong>
          </div>

          <div class="hero-actions">
            <button class="btn btn-primary">Registrar pago</button>
            <button class="btn btn-ghost">Nueva venta</button>
          </div>
        </div>
      </section>

      <section class="dashboard-block">
        <div class="section-head">
          <div>
            <span class="section-kicker">Hoy</span>
            <h3 class="section-title">Indicadores críticos</h3>
          </div>
        </div>

        <div class="stats-grid stats-grid-primary">
          ${criticalKpis.map((item) => dashboardKpiCard(item, true)).join("")}
        </div>
      </section>

      <section class="dashboard-block">
        <div class="section-head">
          <div>
            <span class="section-kicker">Finanzas</span>
            <h3 class="section-title">Resumen de cartera</h3>
          </div>
        </div>

        <div class="stats-grid stats-grid-secondary">
          ${financeKpis.map((item) => dashboardKpiCard(item, false)).join("")}
        </div>
      </section>

      <section class="dashboard-two-col">
        <article class="panel-card">
          <div class="section-head">
            <div>
              <span class="section-kicker">Pendientes</span>
              <h3 class="section-title">Acciones del día</h3>
            </div>
          </div>

          <div class="task-list">
            ${tasks.map((task) => `
              <div class="task-item">
                <div class="task-main">
                  <div class="task-title">${task.title}</div>
                  <div class="task-desc">${task.desc}</div>
                </div>
                <span class="badge ${task.badgeClass}">${task.badge}</span>
              </div>
            `).join("")}
          </div>
        </article>

        <article class="panel-card">
          <div class="section-head">
            <div>
              <span class="section-kicker">Actividad</span>
              <h3 class="section-title">Últimos movimientos</h3>
            </div>
          </div>

          <div class="activity-list">
            ${movements.map((item) => `
              <div class="activity-item">
                <div class="activity-dot"></div>
                <div class="activity-main">
                  <div class="activity-title">${item.title}</div>
                  <div class="activity-desc">${item.desc}</div>
                </div>
                <div class="activity-time">${item.time}</div>
              </div>
            `).join("")}
          </div>
        </article>
      </section>

      <section class="table-wrap dashboard-table">
        <div class="table-header">
          <h3>Cuotas próximas a vencer</h3>
          <button class="btn btn-sm btn-ghost">Ver todas</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Venta</th>
              <th>Comprador</th>
              <th>Lote</th>
              <th>Fecha</th>
              <th>Valor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${upcomingInstallments.map((row) => `
              <tr>
                <td><strong>${row.venta}</strong></td>
                <td>${row.comprador}</td>
                <td>${row.lote}</td>
                <td>${row.fecha}</td>
                <td>${formatCurrency(row.valor)}</td>
                <td><span class="badge ${row.badgeClass}">${row.estado}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    </section>
  `;
}

function dashboardView() {
  return renderDashboard();
}

window.dashboardView = dashboardView;