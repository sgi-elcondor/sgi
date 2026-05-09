(function () {
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
        <div class="kpi-value">
          ${item.currency ? formatCurrency(item.value) : formatNumber(item.value)}
        </div>
        <div class="kpi-meta">${item.meta || ""}</div>
      </article>
    `;
  }

  function dashboardView(container) {
    const criticalKpis = [
      { label: "Ventas activas", value: 24, meta: "3 nuevas esta semana", tone: "info" },
      { label: "Cuotas vencen hoy", value: 9, meta: "Requieren seguimiento inmediato", tone: "warning" },
      { label: "En mora", value: 6, meta: "2 casos críticos", tone: "danger" },
      { label: "Pagos hoy", value: 12, meta: "8 aplicados, 4 pendientes", tone: "success" }
    ];

    const financeKpis = [
      { label: "Capital financiado", value: 1280000000, meta: "Total consolidado", tone: "info", currency: true },
      { label: "Capital pagado", value: 862000000, meta: "67.3% recuperado", tone: "success", currency: true },
      { label: "Saldo pendiente", value: 418000000, meta: "Cartera viva", tone: "warning", currency: true },
      { label: "Comisiones pendientes", value: 28400000, meta: "5 liquidaciones por revisar", tone: "danger", currency: true }
    ];

    const quickActions = [
      { icon: "wallet", title: "Registrar pago", desc: "Aplicar pagos recibidos y dejar trazabilidad." },
      { icon: "briefcase", title: "Nueva venta", desc: "Crear una venta nueva con comprador y lote." },
      { icon: "receipt", title: "Generar factura", desc: "Emitir soporte para pagos o ventas registradas." },
      { icon: "bar-chart-3", title: "Ver reportes", desc: "Consultar cartera, ventas y obligaciones." }
    ];

    const movements = [
      { title: "Pago aplicado", desc: "Lote A-12 · Comprador: Laura Ramírez", time: "Hace 10 min" },
      { title: "Factura generada", desc: "Venta VC-2026-014 · Proyecto Reserva Norte", time: "Hace 26 min" },
      { title: "Cambio auditado", desc: "Se actualizó el estado de una cuota a mora", time: "Hace 41 min" },
      { title: "Nueva venta registrada", desc: "Lote B-07 · Pendiente de aprobación", time: "Hace 1 h" }
    ];

    const upcomingInstallments = [
      { venta: "VC-2026-014", comprador: "Laura Ramírez", lote: "A-12", fecha: "08/04/2026", valor: 1850000, estado: "Hoy", badgeClass: "badge-warning" },
      { venta: "VC-2026-011", comprador: "Carlos Gómez", lote: "B-07", fecha: "09/04/2026", valor: 1320000, estado: "Mañana", badgeClass: "badge-info" },
      { venta: "VC-2026-009", comprador: "Diana López", lote: "C-03", fecha: "10/04/2026", valor: 2100000, estado: "Próxima", badgeClass: "badge-muted" }
    ];

    const html = `
      <section class="page-shell dashboard-page">
        ${window.SGIUI.pageHeader({
          kicker: "Resumen operativo",
          title: "Centro de operación",
          subtitle: "Visualiza el estado de ventas, cartera, pagos, cuotas y comisiones en una sola vista.",
          meta: `
            <span class="results-chip">
              ${window.SGIUI.icon("badge-check")} Vista general del día
            </span>
          `,
          actions: `
            <button class="btn btn-primary">${window.SGIUI.icon("wallet")} Registrar pago</button>
            <button class="btn btn-ghost">${window.SGIUI.icon("briefcase")} Nueva venta</button>
          `
        })}

        <section class="dashboard-block">
          ${window.SGIUI.sectionHeader({
            kicker: "Hoy",
            title: "Indicadores críticos"
          })}
          <div class="stats-grid stats-grid-primary">
            ${criticalKpis.map((item) => dashboardKpiCard(item, true)).join("")}
          </div>
        </section>

        <section class="dashboard-block">
          ${window.SGIUI.sectionHeader({
            kicker: "Finanzas",
            title: "Resumen de cartera"
          })}
          <div class="stats-grid stats-grid-secondary">
            ${financeKpis.map((item) => dashboardKpiCard(item)).join("")}
          </div>
        </section>

        <section class="dashboard-block">
          ${window.SGIUI.sectionHeader({
            kicker: "Acciones",
            title: "Tareas rápidas"
          })}
          <div class="dashboard-actions-grid">
            ${quickActions.map((item) => `
              <article class="action-card">
                <div class="action-card-icon">${window.SGIUI.icon(item.icon)}</div>
                <div class="action-card-title">${item.title}</div>
                <div class="action-card-desc">${item.desc}</div>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="dashboard-two-col">
          <article class="panel-card">
            ${window.SGIUI.sectionHeader({
              kicker: "Actividad",
              title: "Últimos movimientos"
            })}
            <div class="activity-list modern-activity-list">
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

          <article class="panel-card">
            ${window.SGIUI.sectionHeader({
              kicker: "Estado",
              title: "Enfoque del día"
            })}
            <div class="focus-list">
              <div class="focus-item">
                <span class="focus-label">Pagos pendientes por aplicar</span>
                <strong>4</strong>
              </div>
              <div class="focus-item">
                <span class="focus-label">Cuotas críticas</span>
                <strong>2</strong>
              </div>
              <div class="focus-item">
                <span class="focus-label">Ventas por aprobar</span>
                <strong>3</strong>
              </div>
              <div class="focus-item">
                <span class="focus-label">Facturas por emitir</span>
                <strong>5</strong>
              </div>
            </div>
          </article>
        </section>

        <section class="table-wrap dashboard-table">
          <div class="table-header">
            <h3>Cuotas próximas a vencer</h3>
            <button class="btn btn-sm btn-ghost">${window.SGIUI.icon("arrow-right")} Ver todas</button>
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

    if (container) {
      container.innerHTML = html;
      return;
    }

    return html;
  }

  window.dashboardView = dashboardView;
})();