let _repChartRecaudo  = null;
let _repChartCartera  = null;
let _repChartVentas   = null;
let _repChartVenc     = null;
let _repComisionesAll = [];

function _destroyRepCharts() {
  if (_repChartRecaudo) { _repChartRecaudo.destroy();  _repChartRecaudo  = null; }
  if (_repChartCartera) { _repChartCartera.destroy();  _repChartCartera  = null; }
  if (_repChartVentas)  { _repChartVentas.destroy();   _repChartVentas   = null; }
  if (_repChartVenc)    { _repChartVenc.destroy();     _repChartVenc     = null; }
}

window.reportesView = async function () {
  _destroyRepCharts();
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  try {
    const mesActual = new Date().toISOString().slice(0, 7);

    const [cuotasVenc, cuotasPend, pagos, todasVentas, cartera, recaudo, lotes, comisionesSummary, comisionesGerencia, proyeccion] = await Promise.all([
      API.get("/cuotas/vencidas").catch(() => []),
      API.get("/cuotas/pendientes").catch(() => []),
      API.get("/pagos").catch(() => []),
      API.get("/ventas").catch(() => []),
      API.get("/reportes/cartera").catch(() => []),
      API.get("/reportes/recaudo").catch(() => []),
      API.get("/lotes").catch(() => []),
      API.get("/reportes/comisiones").catch(() => null),
      API.get("/reportes/comisiones-gerencia").catch(() => []),
      API.get("/reportes/proyeccion-ingresos").catch(() => []),
    ]);

    _repComisionesAll = comisionesGerencia || [];

    const ventasActivas = todasVentas.filter(v => v.estado === "activa").length;
    const casosMora     = todasVentas.filter(v => ["en_mora", "pre_mora", "devolucion"].includes(v.estado)).length;

    // RN-10/RN-19: only receipt-backed accepted payments count as realized income.
    const pagosDeEsteMes  = pagos.filter(p => p.estado === "aceptado" && p.numero_recibo && String(p.fecha_pago || "").slice(0, 7) === mesActual);
    const totalRecaudado  = pagosDeEsteMes.reduce((s, p) => s + Number(p.valor_pago || 0), 0);

    const capitalPendiente = cuotasPend.reduce((s, c) => s + Number(c.valor_pendiente ?? c.valor_cuota ?? 0), 0);

    const cuotasVencidas = cuotasVenc.reduce((s, c) => s + Number(c.valor_pendiente ?? c.valor_cuota ?? 0), 0);
    const numCuotasVenc  = cuotasVenc.length;

    const vencMes      = cuotasVenc.filter(c => String(c.fecha_vencimiento || "").slice(0, 7) === mesActual);
    const totalVencMes = vencMes.reduce((s, c) => s + Number(c.valor_pendiente ?? c.valor_cuota ?? 0), 0);
    const base         = totalRecaudado + totalVencMes;
    const cumplimiento = base > 0 ? (totalRecaudado / base) * 100 : 0;

    const TONES = {
      success: { color: "var(--success)",    bg: "rgba(34,197,94,.08)"  },
      info:    { color: "var(--primary)",    bg: "rgba(59,130,246,.08)" },
      warning: { color: "var(--warning)",    bg: "rgba(234,179, 8,.08)" },
      danger:  { color: "var(--danger)",     bg: "rgba(239,68, 68,.08)" },
      muted:   { color: "var(--text-muted)", bg: "rgba(0,0,0,.04)"      },
    };

    const toneCumplimiento = cumplimiento >= 90 ? "success" : cumplimiento >= 65 ? "warning" : "danger";

    const ESTADO_ORDER  = ["disponible", "reservado", "vendido", "bloqueado"];
    const ESTADO_COLORS = {
      disponible: { bg: "rgba(34,197,94,.12)",   color: "var(--success)"    },
      reservado:  { bg: "rgba(234,179,8,.12)",    color: "var(--warning)"    },
      vendido:    { bg: "rgba(239,68,68,.12)",    color: "var(--danger)"     },
      bloqueado:  { bg: "rgba(107,114,128,.12)",  color: "var(--text-muted)" },
    };
    const proyMap = {};
    lotes.forEach(l => {
      const proy = l.proyecto?.nombre || "Sin proyecto";
      const est  = (l.estado || "sin_estado").toLowerCase();
      if (!proyMap[proy]) proyMap[proy] = { total: 0, estados: {} };
      proyMap[proy].total++;
      proyMap[proy].estados[est] = (proyMap[proy].estados[est] || 0) + 1;
    });
    const proyEntries = Object.entries(proyMap).sort((a, b) => b[1].total - a[1].total);

    const kpis = [
      {
        icon:  "trending-up",
        label: "Recaudado este mes",
        value: UI.fmt(totalRecaudado),
        meta:  (() => {
          const n = pagosDeEsteMes.length;
          return n > 0 ? `${n} pago${n > 1 ? "s" : ""} aceptado${n > 1 ? "s" : ""} en ${mesActual}` : `Sin pagos aceptados en ${mesActual}`;
        })(),
        tone: totalRecaudado > 0 ? "success" : "muted",
        nav:  "pagos",
      },
      {
        icon:  "briefcase",
        label: "Ventas activas",
        value: ventasActivas,
        meta:  ventasActivas === 1 ? "1 contrato vigente" : `${ventasActivas} contratos vigentes`,
        tone:  ventasActivas > 0 ? "info" : "muted",
        nav:   "ventas",
      },
      {
        icon:  "landmark",
        label: "Capital pendiente",
        value: UI.fmt(capitalPendiente),
        meta:  "Saldo total consolidado de cartera",
        tone:  "warning",
        nav:   "ventas",
      },
      {
        icon:  "percent",
        label: "Cumplimiento recaudo",
        value: `${cumplimiento.toFixed(1)}%`,
        meta:  "Recaudado vs facturado en el periodo",
        tone:  toneCumplimiento,
        nav:   "pagos",
      },
      {
        icon:  "calendar-x",
        label: "Cuotas vencidas",
        value: UI.fmt(cuotasVencidas),
        meta:  numCuotasVenc === 1 ? "1 cuota sin pagar" : `${numCuotasVenc} cuotas sin pagar`,
        tone:  numCuotasVenc > 0 ? "danger" : "success",
        nav:   "cuotas",
      },
      {
        icon:  "scale",
        label: "Casos mora / pre-mora",
        value: casosMora,
        meta:  casosMora === 0 ? "Sin ventas en mora o devolucion"
             : casosMora === 1 ? "1 venta en mora, pre-mora o devolucion"
             : `${casosMora} ventas en mora, pre-mora o devolucion`,
        tone:  casosMora > 0 ? "danger" : "success",
        nav:   "alertas",
      },
    ];

    const canPagos  = AppState.hasVista("pagos");
    const canVentas = AppState.hasVista("ventas");
    const canCuotas = AppState.hasVista("cuotas");

    const chartCards = [
      {
        id:    "repChartRecaudo",
        title: "Recaudo mensual",
        sub:   "Pagos aceptados en los ultimos 12 meses",
        nav:   canPagos ? "pagos" : null,
      },
      {
        id:    "repChartVentas",
        title: "Ventas por estado",
        sub:   "Distribucion actual del portafolio",
        nav:   canVentas ? "ventas" : null,
      },
      {
        id:    "repChartVenc",
        title: "Cartera vencida",
        sub:   "Cuotas sin pagar agrupadas por mes de vencimiento",
        nav:   canCuotas ? "cuotas" : null,
      },
      {
        id:    "repChartCartera",
        title: "Capital por proyecto",
        sub:   "Saldo pendiente de cartera activa por proyecto",
        nav:   canVentas ? "ventas" : null,
      },
    ];

    vc.innerHTML = `
      <section class="page-shell">
        <header class="rep-header">
          <div>
            <h2 class="rep-title">Reportes</h2>
            <p class="rep-sub">Resumen ejecutivo — estado operativo y financiero</p>
          </div>
          <span class="rep-date">${new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </header>

        <div class="rep-section-label">Inventario por proyecto</div>
        <div class="rep-proy-grid">
          ${proyEntries.map(([nombre, info]) => {
            const estadosOrdenados = [
              ...ESTADO_ORDER.filter(e => info.estados[e]),
              ...Object.keys(info.estados).filter(e => !ESTADO_ORDER.includes(e)),
            ];
            const barItems = estadosOrdenados.map(e => {
              const col = (ESTADO_COLORS[e] || ESTADO_COLORS.bloqueado).color;
              return `<div style="flex:${info.estados[e]};background:${col};opacity:.7;height:100%;border-radius:2px" title="${e}: ${info.estados[e]}"></div>`;
            }).join("");
            const badges = estadosOrdenados.map(e => {
              const { bg, color } = ESTADO_COLORS[e] || ESTADO_COLORS.bloqueado;
              return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:600;background:${bg};color:${color}">${info.estados[e]} ${e}</span>`;
            }).join("");
            const canNavLotes = AppState.hasVista("lotes");
            return `
              <article class="rep-proy-card${canNavLotes ? " rep-proy-card--link" : ""}" ${canNavLotes ? `onclick="window.navigate('lotes')"` : ""}>
                <div class="rep-proy-name">${nombre}</div>
                <div class="rep-proy-total">${info.total} lote${info.total !== 1 ? "s" : ""}</div>
                <div class="rep-proy-bar">${barItems}</div>
                <div class="rep-proy-badges">${badges}</div>
                ${canNavLotes ? '<div class="rep-kpi-hint" style="margin-top:.5rem"><i data-lucide="arrow-right" style="width:11px;height:11px"></i> Ver más</div>' : ""}
              </article>`;
          }).join("")}
        </div>

        <div class="rep-section-label">Resumen ejecutivo</div>
        <div class="rep-kpi-grid">
          ${kpis.map(k => {
            const t       = TONES[k.tone];
            const canNav  = k.nav && AppState.hasVista(k.nav);
            return `
              <article class="rep-kpi-card${canNav ? " rep-kpi-card--link" : ""}" ${canNav ? `onclick="window.navigate('${k.nav}')"` : ""}>
                <div class="rep-kpi-icon" style="background:${t.bg};color:${t.color}">
                  <i data-lucide="${k.icon}"></i>
                </div>
                <div class="rep-kpi-body">
                  <div class="rep-kpi-label">${k.label}</div>
                  <div class="rep-kpi-value" style="color:${t.color}">${k.value}</div>
                  <div class="rep-kpi-meta">${k.meta}</div>
                  ${canNav ? '<div class="rep-kpi-hint"><i data-lucide="arrow-right" style="width:11px;height:11px"></i> Ver más</div>' : ""}
                </div>
              </article>`;
          }).join("")}
        </div>

        <div class="rep-section-label">Analisis financiero</div>
        <div class="rep-charts-grid">
          ${chartCards.map(c => `
            <article class="rep-chart-card">
              <div class="rep-chart-header${c.nav ? " rep-chart-header--link" : ""}" ${c.nav ? `onclick="window.navigate('${c.nav}')"` : ""}>
                <div>
                  <div class="rep-chart-title">${c.title}</div>
                  <div class="rep-chart-sub">${c.sub}${c.nav ? " &mdash; <strong>Ver más</strong>" : ""}</div>
                </div>
                ${c.nav ? '<i data-lucide="arrow-right" style="color:var(--primary);width:16px;height:16px;flex-shrink:0"></i>' : ""}
              </div>
              <div class="rep-chart-body"><canvas id="${c.id}"></canvas></div>
            </article>`).join("")}
        </div>

        ${_renderSeccionProyeccion(proyeccion || [])}
        ${_renderSeccionComisiones(comisionesGerencia || [])}
      </section>
    `;

    window.SGIUI?.hydrate();
    setTimeout(() => _renderRepCharts(pagos, todasVentas, cuotasVenc, cuotasPend), 0);

  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:20px">${e.message}</p>`;
  }
};

function _renderRepCharts(pagos, todasVentas, cuotasVenc, cuotasPend) {
  if (typeof Chart === "undefined") return;

  const isDark     = document.documentElement.getAttribute("data-theme") === "dark";
  const tickColor  = isDark ? "#9ca3af" : "#72675d";
  const gridColor  = isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)";
  const fontFamily = "DM Sans, sans-serif";

  const fmtCOP = v => new Intl.NumberFormat("es-CO", {
    notation: "compact", compactDisplay: "short",
    style: "currency", currency: "COP", maximumFractionDigits: 1,
  }).format(v);

  const tooltipCOP = ctx => `${ctx.dataset.label || ""}: ${new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(ctx.raw || 0)}`;

  const moneyScales = () => ({
    x: { ticks: { color: tickColor, font: { family: fontFamily } }, grid: { color: gridColor } },
    y: { ticks: { color: tickColor, font: { family: fontFamily }, callback: fmtCOP }, grid: { color: gridColor } },
  });

  // ── Chart 1: Monthly revenue (last 12 months) ────────────────────
  const c1 = document.getElementById("repChartRecaudo");
  if (c1) {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    const byMonth = {};
    months.forEach(m => { byMonth[m] = 0; });
    (pagos || []).filter(p => p.estado === "aceptado" && p.numero_recibo).forEach(p => {
      const m = String(p.fecha_pago || "").slice(0, 7);
      if (Object.prototype.hasOwnProperty.call(byMonth, m)) byMonth[m] += Number(p.valor_pago || 0);
    });

    _repChartRecaudo = new Chart(c1, {
      type: "bar",
      data: {
        labels: months.map(m => {
          const [y, mo] = m.split("-");
          return new Date(+y, +mo - 1).toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
        }),
        datasets: [{
          label: "Recaudado",
          data: months.map(m => byMonth[m]),
          backgroundColor: "rgba(249,115,22,.78)",
          borderColor: "rgba(249,115,22,1)",
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: tooltipCOP } },
        },
        scales: moneyScales(),
      },
    });
  }

  // ── Chart 2: Ventas por estado ────────────────────────────────────
  const c2 = document.getElementById("repChartVentas");
  if (c2 && todasVentas?.length) {
    const ESTADO_META = {
      activa:     { label: "Activa",     color: "rgba(34,197,94,.85)"   },
      en_mora:    { label: "En mora",    color: "rgba(239,68,68,.85)"   },
      pre_mora:   { label: "Pre-mora",   color: "rgba(234,179,8,.85)"   },
      devolucion: { label: "Devolucion", color: "rgba(249,115,22,.85)"  },
      cancelada:  { label: "Cancelada",  color: "rgba(107,114,128,.85)" },
      pendiente:  { label: "Pendiente",  color: "rgba(59,130,246,.85)"  },
      completada: { label: "Completada", color: "rgba(99,102,241,.85)"  },
    };
    const EXTRA_PALETTE = [
      "rgba(20,184,166,.85)", "rgba(236,72,153,.85)", "rgba(168,85,247,.85)",
      "rgba(245,158,11,.85)", "rgba(14,165,233,.85)", "rgba(132,204,22,.85)",
    ];
    const conteo = {};
    todasVentas.forEach(v => {
      const e = v.estado || "otro";
      conteo[e] = (conteo[e] || 0) + 1;
    });
    const estados = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]);
    let extraIdx = 0;
    const colors = estados.map(e => {
      if (ESTADO_META[e]) return ESTADO_META[e].color;
      return EXTRA_PALETTE[extraIdx++ % EXTRA_PALETTE.length];
    });

    _repChartVentas = new Chart(c2, {
      type: "doughnut",
      data: {
        labels: estados.map(e => ESTADO_META[e]?.label || e),
        datasets: [{
          data: estados.map(e => conteo[e]),
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: isDark ? "#1f2937" : "#fff",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: tickColor, font: { family: fontFamily, size: 11 }, boxWidth: 12, padding: 10 },
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${ctx.raw} venta${ctx.raw !== 1 ? "s" : ""}`,
            },
          },
        },
      },
    });
  }

  // ── Chart 3: Cartera vencida por mes ─────────────────────────────
  const c3 = document.getElementById("repChartVenc");
  if (c3) {
    const vencByM = {};
    (cuotasVenc || []).forEach(c => {
      const m = String(c.fecha_vencimiento || "").slice(0, 7);
      if (m.length < 7) return;
      vencByM[m] = (vencByM[m] || 0) + Number(c.valor_cuota || 0);
    });
    const vMeses = Object.keys(vencByM).sort();

    _repChartVenc = new Chart(c3, {
      type: "bar",
      data: {
        labels: vMeses.map(m => {
          const [y, mo] = m.split("-");
          return new Date(+y, +mo - 1).toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
        }),
        datasets: [{
          label: "Vencido",
          data: vMeses.map(m => vencByM[m]),
          backgroundColor: "rgba(239,68,68,.72)",
          borderColor: "rgba(239,68,68,1)",
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: tooltipCOP } },
        },
        scales: moneyScales(),
      },
    });
  }

  // ── Chart 4: Capital pendiente por proyecto (desde cuotasPend) ───
  const c4 = document.getElementById("repChartCartera");
  if (c4) {
    const proyAgg = {};
    (cuotasPend || []).forEach(c => {
      const proy = c.proyecto && c.proyecto !== "—" ? c.proyecto : "Sin proyecto";
      proyAgg[proy] = (proyAgg[proy] || 0) + Number(c.valor_pendiente || c.valor_cuota || 0);
    });
    const sorted    = Object.entries(proyAgg).sort((a, b) => b[1] - a[1]);
    const proyectos = sorted.map(([p]) => p);
    const capitals  = sorted.map(([, v]) => v);

    _repChartCartera = new Chart(c4, {
      type: "bar",
      data: {
        labels: proyectos,
        datasets: [{
          label: "Capital pendiente",
          data: capitals,
          backgroundColor: isDark ? "rgba(99,102,241,.75)" : "rgba(30,30,30,.70)",
          borderColor:     isDark ? "rgba(99,102,241,1)"   : "rgba(30,30,30,1)",
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: tooltipCOP } },
        },
        scales: {
          x: { ticks: { color: tickColor, font: { family: fontFamily }, callback: fmtCOP }, grid: { color: gridColor } },
          y: { ticks: { color: tickColor, font: { family: fontFamily } }, grid: { display: false } },
        },
      },
    });
  }
}

function _renderSeccionProyeccion(rows) {
  if (!rows || !rows.length) return "";

  const today         = new Date().toISOString().slice(0, 7);
  const totalEsperado = rows.reduce((s, r) => s + r.total_esperado, 0);
  const totalCuotas   = rows.reduce((s, r) => s + r.cantidad_cuotas, 0);

  const STATUS = {
    vencido: { label: "Vencido",  color: "var(--danger)",  bg: "rgba(239,68,68,.12)"  },
    en_curso: { label: "En curso", color: "var(--warning)", bg: "rgba(234,179,8,.12)"  },
    proximo:  { label: "Proximo",  color: "var(--primary)", bg: "rgba(59,130,246,.12)" },
  };

  const rowsHTML = rows.map(r => {
    const key    = r.mes < today ? "vencido" : r.mes === today ? "en_curso" : "proximo";
    const status = STATUS[key];
    const [y, m] = r.mes.split("-");
    const label  = new Date(+y, +m - 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
    const faded  = r.total_esperado === 0 ? ' style="opacity:.5"' : "";

    return `<tr${faded}>
      <td style="white-space:nowrap">${label.charAt(0).toUpperCase() + label.slice(1)}</td>
      <td style="text-align:right">${r.cantidad_cuotas}</td>
      <td style="text-align:right;font-weight:${r.total_esperado > 0 ? "600" : "400"}">${UI.fmt(r.total_esperado)}</td>
      <td><span style="display:inline-block;padding:.15rem .55rem;border-radius:999px;font-size:.72rem;font-weight:600;background:${status.bg};color:${status.color}">${status.label}</span></td>
    </tr>`;
  }).join("");

  return `
    <div class="rep-section-label" style="margin-top:.5rem">Proyeccion de ingresos &mdash; proximos 12 meses</div>
    <div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
      <article class="rep-kpi-card" style="flex:1;min-width:12rem;align-items:flex-start">
        <div class="rep-kpi-icon" style="background:rgba(59,130,246,.08);color:var(--primary);flex-shrink:0">
          <i data-lucide="calendar-range"></i>
        </div>
        <div class="rep-kpi-body">
          <div class="rep-kpi-label">Total esperado</div>
          <div class="rep-kpi-value" style="color:var(--primary)">${UI.fmt(totalEsperado)}</div>
          <div class="rep-kpi-meta">en cuotas pendientes de los proximos 12 meses</div>
        </div>
      </article>
      <article class="rep-kpi-card" style="flex:1;min-width:12rem;align-items:flex-start">
        <div class="rep-kpi-icon" style="background:rgba(234,179,8,.08);color:var(--warning);flex-shrink:0">
          <i data-lucide="receipt"></i>
        </div>
        <div class="rep-kpi-body">
          <div class="rep-kpi-label">Cuotas pendientes</div>
          <div class="rep-kpi-value" style="color:var(--warning)">${totalCuotas}</div>
          <div class="rep-kpi-meta">distribuidas en el periodo de proyeccion</div>
        </div>
      </article>
    </div>
    <div class="table-wrap" style="margin-bottom:2rem">
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th style="text-align:right">Cuotas</th>
            <th style="text-align:right">Ingreso esperado</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>`;
}

function _renderSeccionComisiones(rows) {
  if (!rows.length) return "";

  const ganadas         = rows.filter(r => r.ganada);
  const pendientes      = rows.filter(r => !r.pagada);
  const pagadas         = rows.filter(r => r.pagada);
  const conMicropagos   = rows.filter(r => (r.total_micropagos || 0) > 0);
  const totalPendiente  = pendientes.reduce((s, r) => s + Number(r.valor_comision || 0), 0);
  const totalPagado     = pagadas.reduce((s, r) => s + Number(r.valor_comision || 0), 0);
  const totalMicropagos = rows.reduce((s, r) => s + Number(r.total_micropagos || 0), 0);

  const proyectos = [...new Set(
    rows.map(r => r.venta?.lote?.proyecto?.nombre || "").filter(Boolean)
  )].sort();

  const kpis = [
    { icon: "list",         color: "var(--primary)",        bg: "rgba(59,130,246,.08)",  label: "Total causadas",       value: rows.length,            meta: `${rows.length} comisiones registradas` },
    { icon: "trophy",       color: "var(--success)",        bg: "rgba(34,197,94,.08)",   label: "Ganadas",              value: ganadas.length,         meta: `de ${rows.length} comisiones` },
    { icon: "clock",        color: "var(--warning)",        bg: "rgba(234,179,8,.08)",   label: "Pendiente de pago",    value: UI.fmt(totalPendiente), meta: `${pendientes.length} sin liquidar` },
    { icon: "check-circle", color: "var(--success)",        bg: "rgba(34,197,94,.08)",   label: "Liquidadas",           value: UI.fmt(totalPagado),    meta: `${pagadas.length} pagada${pagadas.length !== 1 ? "s" : ""}` },
    { icon: "coins",        color: "var(--accent,#6366f1)", bg: "rgba(99,102,241,.08)",  label: "Pagado en micropagos", value: UI.fmt(totalMicropagos),meta: `en ${conMicropagos.length} comisi${conMicropagos.length !== 1 ? "ones" : "ón"}` },
  ];

  return `
    <div class="rep-section-label" style="margin-top:.5rem">Comisiones causadas</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(13.5rem,1fr));gap:1rem;margin-bottom:1.5rem">
      ${kpis.map(k => `
        <article class="rep-kpi-card" style="align-items:flex-start">
          <div class="rep-kpi-icon" style="background:${k.bg};color:${k.color};flex-shrink:0">
            <i data-lucide="${k.icon}"></i>
          </div>
          <div class="rep-kpi-body" style="min-width:0;flex:1">
            <div class="rep-kpi-label">${k.label}</div>
            <div style="font-size:1.25rem;font-weight:700;color:${k.color};line-height:1.25;margin:.15rem 0">${k.value}</div>
            <div class="rep-kpi-meta">${k.meta}</div>
          </div>
        </article>`).join("")}
    </div>

    <div style="display:flex;align-items:center;justify-content:flex-end;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap">
      <label style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:.35rem">
        <i data-lucide="filter" style="width:13px;height:13px"></i> Proyecto
      </label>
      <select id="rep_com_proy_filter" onchange="window._repFiltrarComisiones()"
        style="font-size:.82rem;padding:.3rem .6rem;border:1px solid var(--border);border-radius:.4rem;background:var(--surface);color:var(--text);min-width:10rem">
        <option value="">Todos los proyectos</option>
        ${proyectos.map(p => `<option value="${p}">${p}</option>`).join("")}
      </select>
    </div>

    <div class="table-wrap" style="margin-bottom:2rem">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Comisionista</th>
            <th>Venta</th>
            <th>Lote</th>
            <th>Proyecto</th>
            <th style="text-align:right">Valor comisi&oacute;n</th>
            <th style="text-align:right">Micropagos</th>
            <th>Estado</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody id="rep_com_tbody">
          ${_renderComisionesRows(rows)}
        </tbody>
      </table>
    </div>
  `;
}

function _renderComisionesRows(rows) {
  if (!rows.length) {
    return `<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:var(--text-muted)">Sin comisiones para mostrar</td></tr>`;
  }
  return rows.map(r => {
    const vid          = r.id_venta;
    const comisionista = r.usuario
      ? `${r.usuario.nombres} ${r.usuario.apellidos || ""}`.trim()
      : "—";
    const lote    = r.venta?.lote
      ? `${r.venta.lote.codigo_lote} M${r.venta.lote.manzana}-${r.venta.lote.numero_lote}`
      : "—";
    const proyecto = r.venta?.lote?.proyecto?.nombre || "—";
    const micro    = Number(r.total_micropagos || 0);
    const fecha    = r.pagada ? UI.date(r.fecha_pagado) : UI.date(r.fecha_ganada);

    const estadoBadge = r.pagada
      ? `<span style="display:inline-block;padding:.15rem .55rem;border-radius:999px;font-size:.72rem;font-weight:600;background:rgba(34,197,94,.12);color:var(--success)">Pagada</span>`
      : `<span style="display:inline-block;padding:.15rem .55rem;border-radius:999px;font-size:.72rem;font-weight:600;background:rgba(234,179,8,.12);color:var(--warning)">Pendiente</span>`;

    return `
      <tr style="cursor:pointer" onclick="window._toggleRepComisionRow(${vid})">
        <td style="width:1.5rem;text-align:center;color:var(--text-muted)">
          <span id="rep_chev_${vid}" style="display:inline-block;transition:transform .2s ease;font-size:.75rem">&#9660;</span>
        </td>
        <td>${comisionista}</td>
        <td>${r.venta?.codigo_venta || `#${r.venta?.id_venta || vid}`}</td>
        <td style="white-space:nowrap">${lote}</td>
        <td>${proyecto}</td>
        <td style="text-align:right;font-weight:600">${UI.fmt(r.valor_comision)}</td>
        <td style="text-align:right;color:${micro > 0 ? "var(--success)" : "var(--text-muted)"}">
          ${micro > 0 ? UI.fmt(micro) : "—"}
        </td>
        <td>${estadoBadge}</td>
        <td style="white-space:nowrap;color:var(--text-muted);font-size:.85rem">${fecha}</td>
      </tr>
      <tr id="rep_detail_${vid}" style="display:none">
        <td colspan="9" style="padding:0;border-top:none">
          <div style="padding:.85rem 1.25rem 1rem;background:var(--surface-2,var(--surface));border-top:1px dashed var(--border)">
            ${_renderComisionDetail(r)}
          </div>
        </td>
      </tr>`;
  }).join("");
}

function _renderComisionDetail(r) {
  const micros    = r.micropagos || [];
  const totalMicro = Number(r.total_micropagos || 0);
  const valorCom   = Number(r.valor_comision   || 0);
  const pendiente  = Math.max(0, valorCom - totalMicro);
  const pct        = valorCom > 0 ? Math.min(100, Math.round(totalMicro / valorCom * 100)) : 0;
  const compradores = (r.venta?.venta_comprador || [])
    .map(vc => `${vc.usuario?.nombres || ""} ${vc.usuario?.apellidos || ""}`.trim())
    .filter(Boolean).join(", ") || "—";

  const micropagosHTML = micros.length === 0
    ? `<div style="font-size:.82rem;color:var(--text-muted);padding:.25rem 0">Sin micropagos registrados</div>`
    : `<table style="width:100%;border-collapse:collapse;font-size:.82rem">
        <thead>
          <tr>
            <th style="text-align:left;font-size:.7rem;color:var(--text-muted);padding:.2rem .5rem .35rem 0;border-bottom:1px solid var(--border);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Fecha</th>
            <th style="text-align:right;font-size:.7rem;color:var(--text-muted);padding:.2rem .5rem .35rem;border-bottom:1px solid var(--border);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Valor</th>
            <th style="text-align:left;font-size:.7rem;color:var(--text-muted);padding:.2rem 0 .35rem .5rem;border-bottom:1px solid var(--border);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Nota / N&deg; pago</th>
          </tr>
        </thead>
        <tbody>
          ${micros.map(m => `
            <tr>
              <td style="padding:.3rem .5rem .3rem 0;white-space:nowrap;color:var(--text-muted)">${UI.date(m.fecha)}</td>
              <td style="padding:.3rem .5rem;text-align:right;font-weight:600;color:var(--success)">${UI.fmt(m.valor)}</td>
              <td style="padding:.3rem 0 .3rem .5rem;color:var(--text-muted)">
                ${m.nota ? `<span>${m.nota}</span>` : ""}
                ${m.numero_pago ? `<span style="font-size:.72rem;opacity:.7;margin-left:.35rem">${m.numero_pago}</span>` : ""}
                ${!m.nota && !m.numero_pago ? "—" : ""}
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div style="margin-top:.65rem;padding:.55rem .7rem;background:var(--surface);border-radius:.4rem;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text-muted);margin-bottom:.3rem">
          <span>Progreso micropagos</span><span style="font-weight:600">${pct}%</span>
        </div>
        <div style="background:var(--border);border-radius:.25rem;height:.35rem;overflow:hidden">
          <div style="width:${pct}%;background:var(--success);height:100%;border-radius:.25rem"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-muted);margin-top:.3rem">
          <span>Pagado: <strong>${UI.fmt(totalMicro)}</strong></span>
          <span>Pendiente: <strong style="color:${pendiente > 0 ? "var(--warning)" : "var(--success)"}">${UI.fmt(pendiente)}</strong></span>
        </div>
      </div>`;

  return `
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
      <div style="flex:1;min-width:14rem">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.5rem">Micropagos aplicados</div>
        ${micropagosHTML}
      </div>
      <div style="min-width:13rem;display:flex;flex-direction:column;gap:.3rem">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.2rem">Detalle comisi&oacute;n</div>
        ${[
          ["Valor comisión",   UI.fmt(r.valor_comision)],
          ["Ganada",           r.ganada ? `<span style="color:var(--success);font-weight:600">Sí</span>` : `<span style="color:var(--warning)">No aún</span>`],
          ["Fecha ganada",     r.fecha_ganada ? UI.date(r.fecha_ganada) : "—"],
          ["Pagada al comisionista", r.pagada ? `<span style="color:var(--success);font-weight:600">Sí — ${UI.date(r.fecha_pagado)}</span>` : "No"],
          ["Comprador(es)",    compradores],
          ["Fecha venta",      UI.date(r.venta?.fecha_venta)],
        ].map(([lbl, val]) => `
          <div style="display:flex;justify-content:space-between;gap:1rem;font-size:.82rem;padding:.18rem 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text-muted);white-space:nowrap">${lbl}</span>
            <span style="text-align:right">${val}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

window._toggleRepComisionRow = function(ventaId) {
  const detail  = document.getElementById(`rep_detail_${ventaId}`);
  const chevron = document.getElementById(`rep_chev_${ventaId}`);
  if (!detail) return;
  const isOpen = detail.style.display !== "none";
  detail.style.display = isOpen ? "none" : "table-row";
  if (chevron) chevron.style.transform = isOpen ? "rotate(0deg)" : "rotate(-90deg)";
};

window._repFiltrarComisiones = function() {
  const proyFilter = document.getElementById("rep_com_proy_filter")?.value || "";
  const rows = proyFilter
    ? _repComisionesAll.filter(r => (r.venta?.lote?.proyecto?.nombre || "") === proyFilter)
    : _repComisionesAll;
  const tbody = document.getElementById("rep_com_tbody");
  if (tbody) tbody.innerHTML = _renderComisionesRows(rows);
};

(() => {
  const s = document.createElement("style");
  s.textContent = `
    .rep-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.75rem;
      flex-wrap: wrap;
      gap: .5rem;
    }
    .rep-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin: 0 0 .2rem;
      color: var(--text);
    }
    .rep-sub {
      font-size: .82rem;
      color: var(--text-muted);
      margin: 0;
    }
    .rep-date {
      font-size: .78rem;
      color: var(--text-muted);
      text-transform: capitalize;
      margin-top: .2rem;
    }
    .rep-section-label {
      font-size: .7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--text-muted);
      margin-bottom: .75rem;
    }
    .rep-kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    @media (max-width: 900px) {
      .rep-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 560px) {
      .rep-kpi-grid { grid-template-columns: 1fr; }
    }
    .rep-kpi-card {
      display: flex;
      align-items: flex-start;
      gap: .875rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.1rem 1.25rem;
      transition: box-shadow .15s;
    }
    .rep-kpi-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.07); }
    .rep-kpi-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: 10px;
      flex-shrink: 0;
    }
    .rep-kpi-icon svg { width: 20px; height: 20px; }
    .rep-kpi-body {
      display: flex;
      flex-direction: column;
      gap: .15rem;
      min-width: 0;
    }
    .rep-kpi-label {
      font-size: .75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--text-muted);
    }
    .rep-kpi-value {
      font-size: 1.45rem;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rep-kpi-meta {
      font-size: .76rem;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .rep-proy-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: .875rem;
      margin-bottom: 2rem;
    }
    .rep-proy-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.1rem;
    }
    .rep-proy-card--link { cursor: pointer; }
    .rep-proy-card--link:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,.10);
      border-color: var(--primary);
      transform: translateY(-1px);
      transition: all .15s;
    }
    .rep-proy-name {
      font-size: .82rem;
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: .1rem;
    }
    .rep-proy-total {
      font-size: .72rem;
      color: var(--text-muted);
      margin-bottom: .6rem;
    }
    .rep-proy-bar {
      display: flex;
      gap: 2px;
      height: 6px;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: .6rem;
      background: var(--border);
    }
    .rep-proy-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .rep-kpi-hint {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: .72rem;
      color: var(--primary);
      margin-top: .3rem;
      font-weight: 500;
    }
    .rep-kpi-card--link { cursor: pointer; }
    .rep-kpi-card--link:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,.10);
      border-color: var(--primary);
      transform: translateY(-1px);
      transition: all .15s;
    }
    .rep-chart-header--link {
      cursor: pointer;
      transition: background .15s;
    }
    .rep-chart-header--link:hover { background: var(--surface2); }
    .rep-charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    @media (max-width: 820px) {
      .rep-charts-grid { grid-template-columns: 1fr; }
    }
    .rep-chart-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .rep-chart-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: .9rem 1.25rem .6rem;
      border-bottom: 1px solid var(--border);
    }
    .rep-chart-title {
      font-size: .9rem;
      font-weight: 600;
      color: var(--text);
    }
    .rep-chart-sub {
      font-size: .75rem;
      color: var(--text-muted);
      margin-top: .15rem;
    }
    .rep-chart-body {
      padding: 1rem 1.25rem 1.25rem;
      height: 240px;
      position: relative;
    }
  `;
  document.head.appendChild(s);
})();
