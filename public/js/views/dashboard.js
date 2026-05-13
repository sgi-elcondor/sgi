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

  async function compradorDashboardView(vc) {
    vc.innerHTML = UI.loader();
    let ventas;
    try { ventas = await API.get("/ventas/mis-ventas"); }
    catch (e) { vc.innerHTML = `<p style="color:var(--danger);padding:20px">${e.message}</p>`; return; }

    if (!ventas || !ventas.length) {
      vc.innerHTML = `<section class="page-shell comprador-dashboard">
        ${window.SGIUI?.pageHeader({ kicker:"Mi cuenta", title:"Panel de comprador", subtitle:"Bienvenido al portal de seguimiento de tu inmueble." }) ?? ""}
        <div class="no-venta-state">${window.SGIUI?.icon("home") ?? ""}
          <h3>No tienes ventas registradas</h3>
          <p>Cuando se registre tu venta, aqui aparecera la informacion de tu inmueble.</p>
        </div></section>`;
      window.SGIUI?.hydrate(); return;
    }

    const v = ventas[0];
    const cuotaActual = v.cuota_actual;
    const pct = Math.min(100, v.porcentaje_pagado || 0);
    const fmtC = n => n != null ? Number(n).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}) : "—";
    const fmtD = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-CO",{year:"numeric",month:"long",day:"numeric"}) : "—";

    function buildAlerta(cuota) {
      if (!cuota) return "";
      const dias = cuota.dias_restantes;
      let tone, icn, title, text, urgent = false;
      if (dias < 0) {
        const abs = Math.abs(dias);
        tone="danger"; icn="alert-triangle"; urgent=true;
        title=`Cuota vencida hace ${abs} dia${abs!==1?"s":""}`;
        text=`Tu cuota #${cuota.numero_cuota} por ${fmtC(cuota.valor_cuota)} vencio el ${fmtD(cuota.fecha_vencimiento)}. Realiza el pago de inmediato para cumplir con tu contrato.`;
      } else if (dias===0) {
        tone="warning"; icn="clock"; urgent=true;
        title="Tu cuota vence hoy";
        text=`La cuota #${cuota.numero_cuota} por ${fmtC(cuota.valor_cuota)} vence hoy. Realiza el pago antes de que finalice el dia.`;
      } else if (dias<=3) {
        tone="warning"; icn="clock"; urgent=false;
        title=`Cuota proxima — vence en ${dias} dia${dias!==1?"s":""}`;
        text=`Tu cuota #${cuota.numero_cuota} por ${fmtC(cuota.valor_cuota)} vence muy pronto.`;
      } else if (dias<=7) {
        tone="info"; icn="calendar"; urgent=false;
        title=`Cuota programada — ${dias} dias restantes`;
        text=`Cuota #${cuota.numero_cuota} · ${fmtC(cuota.valor_cuota)} · ${fmtD(cuota.fecha_vencimiento)}`;
      } else {
        tone="info"; icn="calendar-check"; urgent=false;
        title=`Proxima cuota — ${dias} dias`;
        text=`Cuota #${cuota.numero_cuota} · ${fmtC(cuota.valor_cuota)} · ${fmtD(cuota.fecha_vencimiento)}`;
      }
      const btns = urgent
        ? `<div class="cuota-alert-actions"><button class="btn btn-primary btn-sm" id="dash-btn-pagar">Pagar ahora</button><button class="btn btn-ghost btn-sm" onclick="navigate('mis-cuotas')">Ver cuotas</button></div>`
        : `<div class="cuota-alert-actions"><button class="btn btn-ghost btn-sm" onclick="navigate('mis-cuotas')">Ver plan de pago</button></div>`;
      return `<div class="cuota-alert alert-${tone}"><div class="cuota-alert-icon">${window.SGIUI?.icon(icn)??""}
        </div><div class="cuota-alert-body"><div class="cuota-alert-title">${title}</div>
        <div class="cuota-alert-text">${text}</div>${btns}</div></div>`;
    }

    vc.innerHTML = `
      <section class="page-shell comprador-dashboard">
        ${window.SGIUI?.pageHeader({kicker:"Mi cuenta",title:"Panel de comprador",subtitle:`Seguimiento · ${v.lote?.proyecto?.nombre||""}`})??""}
        ${buildAlerta(cuotaActual)}
        ${v.escritura_disponible?`
          <div class="cuota-alert alert-success">
            <div class="cuota-alert-icon">${window.SGIUI?.icon("award")??""}</div>
            <div class="cuota-alert-body">
              <div class="cuota-alert-title">La escritura de tu inmueble esta disponible</div>
              <div class="cuota-alert-text">Has pagado el ${(v.porcentaje_pagado||0).toFixed(1)}% — superas el 30% requerido para escrituracion. Comunicate con la oficina.</div>
            </div>
          </div>`:""}
        <div class="sale-hero">
          <div class="sale-hero-top"><div class="sale-hero-info">
            <div class="sale-hero-proyecto">${v.lote?.proyecto?.nombre||"Proyecto"}</div>
            <div class="sale-hero-lote">Lote ${v.lote?.codigo_lote||"—"}${v.lote?.manzana?" · Mz "+v.lote.manzana:""}</div>
            <div class="sale-hero-estado">${UI.badge(v.estado)}</div>
          </div></div>
          <div class="progress-block">
            <div class="progress-labels"><span class="progress-label-left">Avance de pago</span><span class="progress-label-right">${(v.porcentaje_pagado||0).toFixed(1)}%</span></div>
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="finance-grid">
            <div class="finance-item"><div class="finance-item-label">Valor total</div><div class="finance-item-value">${fmtC(v.valor_total)}</div></div>
            <div class="finance-item"><div class="finance-item-label">Pagado</div><div class="finance-item-value success">${fmtC(v.total_pagado)}</div></div>
            <div class="finance-item"><div class="finance-item-label">Saldo a diferir</div><div class="finance-item-value warning">${fmtC(v.saldo_pendiente)}</div></div>
            <div class="finance-item"><div class="finance-item-label">Cuotas</div><div class="finance-item-value accent">${v.cuotas_pagadas} / ${v.total_cuotas}</div></div>
          </div>
        </div>
        <div class="comprador-actions">
          <button class="btn btn-primary" id="dash-btn-pagar-cuota">${window.SGIUI?.icon("wallet")??""} Pagar cuota</button>
          <button class="btn btn-ghost" onclick="navigate('mis-cuotas')">${window.SGIUI?.icon("calendar")??""} Ver cuotas</button>
          <button class="btn btn-ghost" onclick="navigate('mis-recibos')">${window.SGIUI?.icon("file-text")??""} Mis pagos</button>
        </div>
      </section>`;

    window.SGIUI?.hydrate();
    const onPagar = () => navigate("mis-cuotas");
    document.getElementById("dash-btn-pagar")?.addEventListener("click", onPagar);
    document.getElementById("dash-btn-pagar-cuota")?.addEventListener("click", onPagar);
  }

  function dashboardViewWrapped(container) {
    const vc  = container || document.getElementById("viewContainer");
    const rol = window.currentUser?.rol;
    if (rol === "comprador") { compradorDashboardView(vc); return; }
    return dashboardView(container);
  }

  window.dashboardView = dashboardViewWrapped;
})();

