(function () {

  // ── Formatters ───────────────────────────────────────────────────────────────

  const fmtM = (v = 0) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);

  const fmtN = (v = 0) => new Intl.NumberFormat("es-CO").format(v);

  const fmtPct = (v = 0) => `${(Number(v) * 100).toFixed(1)}%`;

  // ── Widget renderers ─────────────────────────────────────────────────────────

  function renderKpiOperacion(panel) {
    const items = [
      { label: "Ventas activas",    value: fmtN(panel.ventas_activas),    tone: "info",    icon: "briefcase" },
      { label: "Recaudo del mes",   value: fmtM(panel.recaudo_mes),       tone: "success", icon: "wallet" },
      { label: "Cuotas vencidas",   value: fmtN(panel.cuotas_vencidas),   tone: "warning", icon: "calendar-x" },
      { label: "En mora",           value: fmtN(panel.cuotas_en_mora),    tone: "danger",  icon: "alert-triangle" },
    ];
    return `
      <section class="dashboard-block">
        ${window.SGIUI.sectionHeader({ kicker: "Hoy", title: "Indicadores operativos" })}
        <div class="stats-grid stats-grid-primary">
          ${items.map(i => `
            <article class="kpi-card primary">
              <div class="kpi-top">
                <span class="kpi-label">${i.label}</span>
                <span class="kpi-indicator ${i.tone}"></span>
              </div>
              <div class="kpi-value">${i.value}</div>
            </article>
          `).join("")}
        </div>
      </section>`;
  }

  function renderKpiCartera(cartera) {
    const pct = cartera.capital_financiado_total > 0
      ? ((cartera.capital_pagado_total / cartera.capital_financiado_total) * 100).toFixed(1)
      : "0.0";
    const items = [
      { label: "Capital financiado",  value: fmtM(cartera.capital_financiado_total), tone: "info" },
      { label: "Capital pagado",      value: fmtM(cartera.capital_pagado_total),      tone: "success", meta: `${pct}% recuperado` },
      { label: "Saldo pendiente",     value: fmtM(cartera.capital_pendiente_total),   tone: "warning" },
      { label: "En mora",             value: fmtM(cartera.capital_en_mora),           tone: "danger",  meta: `Ratio: ${fmtPct(cartera.ratio_mora)}` },
    ];
    return `
      <section class="dashboard-block">
        ${window.SGIUI.sectionHeader({ kicker: "Finanzas", title: "Resumen de cartera" })}
        <div class="stats-grid stats-grid-secondary">
          ${items.map(i => `
            <article class="kpi-card secondary">
              <div class="kpi-top">
                <span class="kpi-label">${i.label}</span>
                <span class="kpi-indicator ${i.tone}"></span>
              </div>
              <div class="kpi-value">${i.value}</div>
              ${i.meta ? `<div class="kpi-meta">${i.meta}</div>` : ""}
            </article>
          `).join("")}
        </div>
      </section>`;
  }

  function renderKpiComisiones(com) {
    const items = [
      { label: "Comisiones causadas",   value: fmtM(com.comisiones_causadas),   tone: "info" },
      { label: "Pagadas",               value: fmtM(com.comisiones_pagadas),     tone: "success" },
      { label: "Pendientes",            value: fmtM(com.comisiones_pendientes),  tone: "warning" },
    ];
    return `
      <section class="dashboard-block">
        ${window.SGIUI.sectionHeader({ kicker: "Comisiones", title: "Estado de comisiones" })}
        <div class="stats-grid stats-grid-secondary" style="grid-template-columns:repeat(3,1fr)">
          ${items.map(i => `
            <article class="kpi-card secondary">
              <div class="kpi-top">
                <span class="kpi-label">${i.label}</span>
                <span class="kpi-indicator ${i.tone}"></span>
              </div>
              <div class="kpi-value">${i.value}</div>
            </article>
          `).join("")}
        </div>
      </section>`;
  }

  function renderAlertasJuridicas(alertas) {
    if (!alertas.length) return "";
    const byType = {};
    alertas.forEach(a => {
      const key = a.tipo_alerta || "otro";
      byType[key] = (byType[key] || 0) + 1;
    });
    const LABELS = {
      venta_sin_cuotas:   "Ventas sin cuotas",
      venta_sin_comprador:"Ventas sin comprador",
      lote_estado_invalido: "Estado de lote incompatible",
    };
    const rows = Object.entries(byType).map(([tipo, count]) => `
      <div class="focus-item">
        <span class="focus-label">${LABELS[tipo] || tipo.replace(/_/g, " ")}</span>
        <strong style="color:var(--danger)">${count}</strong>
      </div>`).join("");
    return `
      <section class="dashboard-block">
        ${window.SGIUI.sectionHeader({ kicker: "Juridico", title: "Alertas activas" })}
        <article class="panel-card">
          <div class="focus-list">${rows}</div>
          <div style="margin-top:1rem">
            <button class="btn btn-ghost btn-sm" onclick="window.navigate('juridico')">
              ${window.SGIUI.icon("scale")} Ver seguimiento juridico
            </button>
          </div>
        </article>
      </section>`;
  }

  // ── Widget registry ──────────────────────────────────────────────────────────

  const WIDGETS = [
    {
      resource: "dashboard", action: "ver_operacion",
      fetch:  () => API.get("/reportes/panel"),
      render: renderKpiOperacion,
    },
    {
      resource: "dashboard", action: "ver_cartera",
      fetch:  () => API.get("/reportes/cartera-hoy"),
      render: renderKpiCartera,
    },
    {
      resource: "dashboard", action: "ver_comisiones",
      fetch:  () => API.get("/reportes/comisiones"),
      render: renderKpiComisiones,
    },
    {
      resource: "dashboard", action: "ver_juridico",
      fetch:  () => API.get("/reportes/alertas"),
      render: renderAlertasJuridicas,
    },
  ];

  // ── Operational dashboard ────────────────────────────────────────────────────

  async function dashboardView(container) {
    const vc = container || document.getElementById("viewContainer");
    vc.innerHTML = UI.loader();

    const visible = WIDGETS.filter(w => AppState.can(w.resource, w.action));

    if (!visible.length) {
      vc.innerHTML = `<section class="page-shell">
        <div style="padding:2rem;color:var(--text-muted)">No hay widgets configurados para tu rol.</div>
      </section>`;
      return;
    }

    const results = await Promise.allSettled(visible.map(w => w.fetch()));

    const blocks = visible.map((w, i) => {
      const result = results[i];
      if (result.status === "rejected") return "";
      try { return w.render(result.value); }
      catch (_) { return ""; }
    }).join("");

    vc.innerHTML = `
      <section class="page-shell dashboard-page">
        ${window.SGIUI.pageHeader({
          kicker:   "Resumen operativo",
          title:    "Centro de operacion",
          subtitle: "Estado de ventas, cartera, pagos, cuotas y comisiones.",
        })}
        ${blocks}
      </section>`;

    window.SGIUI?.hydrate();
  }

  // ── Comprador dashboard ──────────────────────────────────────────────────────

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
      window.SGIUI?.hydrate();
      return;
    }

    const v          = ventas[0];
    const cuotaActual = v.cuota_actual;
    const pct        = Math.min(100, v.porcentaje_pagado || 0);
    const fmtC       = n => n != null ? Number(n).toLocaleString("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }) : "—";
    const fmtD       = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" }) : "—";

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
        tone="warning"; icn="clock";
        title=`Cuota proxima — vence en ${dias} dia${dias!==1?"s":""}`;
        text=`Tu cuota #${cuota.numero_cuota} por ${fmtC(cuota.valor_cuota)} vence muy pronto.`;
      } else if (dias<=7) {
        tone="info"; icn="calendar";
        title=`Cuota programada — ${dias} dias restantes`;
        text=`Cuota #${cuota.numero_cuota} · ${fmtC(cuota.valor_cuota)} · ${fmtD(cuota.fecha_vencimiento)}`;
      } else {
        tone="info"; icn="calendar-check";
        title=`Proxima cuota — ${dias} dias`;
        text=`Cuota #${cuota.numero_cuota} · ${fmtC(cuota.valor_cuota)} · ${fmtD(cuota.fecha_vencimiento)}`;
      }
      const btns = urgent
        ? `<div class="cuota-alert-actions"><button class="btn btn-primary btn-sm" id="dash-btn-pagar">Pagar ahora</button><button class="btn btn-ghost btn-sm" onclick="navigate('mis-cuotas')">Ver cuotas</button></div>`
        : `<div class="cuota-alert-actions"><button class="btn btn-ghost btn-sm" onclick="navigate('mis-cuotas')">Ver plan de pago</button></div>`;
      return `<div class="cuota-alert alert-${tone}">
        <div class="cuota-alert-icon">${window.SGIUI?.icon(icn)??""}</div>
        <div class="cuota-alert-body">
          <div class="cuota-alert-title">${title}</div>
          <div class="cuota-alert-text">${text}</div>
          ${btns}
        </div>
      </div>`;
    }

    vc.innerHTML = `
      <section class="page-shell comprador-dashboard">
        ${window.SGIUI?.pageHeader({kicker:"Mi cuenta",title:"Panel de comprador",subtitle:`Seguimiento · ${v.lote?.proyecto?.nombre||""}`})??""}
        ${buildAlerta(cuotaActual)}
        ${v.escritura_disponible ? `
          <div class="cuota-alert alert-success">
            <div class="cuota-alert-icon">${window.SGIUI?.icon("award")??""}</div>
            <div class="cuota-alert-body">
              <div class="cuota-alert-title">La escritura de tu inmueble esta disponible</div>
              <div class="cuota-alert-text">Has pagado el ${(v.porcentaje_pagado||0).toFixed(1)}% — superas el 30% requerido para escrituracion. Comunicate con la oficina.</div>
            </div>
          </div>` : ""}
        <div class="sale-hero">
          <div class="sale-hero-top"><div class="sale-hero-info">
            <div class="sale-hero-proyecto">${v.lote?.proyecto?.nombre||"Proyecto"}</div>
            <div class="sale-hero-lote">Lote ${v.lote?.codigo_lote||"—"}${v.lote?.manzana?" · Mz "+v.lote.manzana:""}</div>
            <div class="sale-hero-estado">${UI.badge(v.estado)}</div>
          </div></div>
          <div class="progress-block">
            <div class="progress-labels">
              <span class="progress-label-left">Avance de pago</span>
              <span class="progress-label-right">${(v.porcentaje_pagado||0).toFixed(1)}%</span>
            </div>
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

  // ── Entry point ──────────────────────────────────────────────────────────────

  window.dashboardView = function (container) {
    const vc = container || document.getElementById("viewContainer");
    if (AppState.can("mis_cuotas", "leer")) {
      compradorDashboardView(vc);
      return;
    }
    dashboardView(vc);
  };

})();
