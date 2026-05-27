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





  // ── New widget renderers ─────────────────────────────────────────────────────

  function renderWidgetError(msg) {
    return `
      <section class="dashboard-block">
        <article class="panel-card">
          <div style="display:flex;align-items:center;gap:0.75rem;color:var(--danger)">
            ${window.SGIUI.icon("alert-triangle")}
            <span>Error al cargar: ${msg}</span>
          </div>
        </article>
      </section>`;
  }

  function renderCuotasPendientes(cuotas) {
    const all = Array.isArray(cuotas) ? cuotas : [];

    const byVencimiento = (a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);

    const proximasAll = all.filter(c => c.dias_atraso <= 0).sort(byVencimiento);
    const vencidas    = all.filter(c => c.dias_atraso > 0).sort(byVencimiento).slice(0, 10);

    const q1   = proximasAll.filter(c => c.rango_pago === "primera_quincena").slice(0, 10);
    const q2   = proximasAll.filter(c => c.rango_pago === "segunda_quincena").slice(0, 10);
    const qSin = proximasAll.filter(c => !c.rango_pago || c.rango_pago === "otro").slice(0, 10);

    const fmtFecha = d => d
      ? new Date(`${d}T12:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

    const diasLabel = c => {
      if (c.dias_atraso === 0) return `<span style="color:var(--warning);font-size:.8125rem;font-weight:600">Vence hoy</span>`;
      if (c.dias_atraso < 0)  return `<span style="color:var(--text-muted);font-size:.8125rem">${Math.abs(c.dias_atraso)}d restantes</span>`;
      return `<span style="color:var(--danger);font-size:.8125rem;font-weight:600">${c.dias_atraso}d vencida</span>`;
    };

    const TH = label => `<th style="padding:.625rem 1rem;font-weight:600;color:var(--text-muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">${label}</th>`;

    const buildTable = rows => `
      <article class="panel-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:.875rem">
          <thead>
            <tr style="background:var(--surface-2,var(--bg-alt));text-align:left">
              ${TH("#")}${TH("Comprador")}${TH("Lote")}${TH("Valor")}${TH("Vencimiento")}${TH("Días")}
              <th style="padding:.625rem 1rem"></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((c, idx) => `
              <tr style="border-top:1px solid var(--border);${idx % 2 === 1 ? "background:var(--surface-1,var(--bg-alt))" : ""}">
                <td style="padding:.75rem 1rem;color:var(--text-muted)">${c.numero_cuota}</td>
                <td style="padding:.75rem 1rem;font-weight:500">${c.comprador}</td>
                <td style="padding:.75rem 1rem;color:var(--text-muted);font-size:.8125rem">${c.codigo_lote} · ${c.proyecto}</td>
                <td style="padding:.75rem 1rem;font-weight:600">${fmtM(c.valor_cuota)}</td>
                <td style="padding:.75rem 1rem">${fmtFecha(c.fecha_vencimiento)}</td>
                <td style="padding:.75rem 1rem">${diasLabel(c)}</td>
                <td style="padding:.75rem 1rem">
                  <button class="btn btn-ghost btn-sm" onclick="window._abrirVentaDesdeDashboard(${c.id_venta})">
                    Ver venta
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>`;

    const emptyCard = msg => `<article class="panel-card"><p style="color:var(--text-muted)">${msg}</p></article>`;

    const countPill = (n, color) =>
      `<span style="font-size:.75rem;font-weight:600;padding:.2rem .7rem;border-radius:99px;background:rgba(var(--${color}-rgb),.12);color:var(--${color})">${n} cuota${n !== 1 ? "s" : ""}</span>`;

    const subHeader = (label, color, n) => `
      <div style="display:flex;align-items:center;gap:.625rem;padding:.75rem 1rem .5rem;">
        <span style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${color}">${label}</span>
        ${countPill(n, color === "var(--info)" ? "info" : color === "var(--accent)" ? "accent" : "neutral")}
      </div>`;

    const totalProximas = q1.length + q2.length + qSin.length;

    const proximasSection = totalProximas === 0  
      ? emptyCard("No hay cuotas próximas a vencer.")
      : `
        ${q1.length ? `
          <div style="margin-bottom:.75rem">
            ${subHeader("Quincena 1 · 1–15", "var(--info)", q1.length)}
            ${buildTable(q1)}
          </div>` : ""}
        ${q2.length ? `
          <div style="margin-bottom:.75rem">
            ${subHeader("Quincena 2 · 16–30", "var(--accent)", q2.length)}
            ${buildTable(q2)}
          </div>` : ""}
        ${qSin.length ? `
          <div>
            ${subHeader("Sin quincena asignada", "var(--text-muted)", qSin.length)}
            ${buildTable(qSin)}
          </div>` : ""}`;

    return `
      <section class="dashboard-block">
        ${window.SGIUI.sectionHeader({ kicker: "Próximas a vencer", title: "Cuotas por vencer", actions: totalProximas ? countPill(totalProximas, "accent") : "" })}
        ${proximasSection}
      </section>
      <section class="dashboard-block">
        ${window.SGIUI.sectionHeader({ kicker: "Vencidas sin pagar", title: "Cuotas en mora", actions: vencidas.length ? countPill(vencidas.length, "danger") : "" })}
        ${vencidas.length ? buildTable(vencidas) : emptyCard("No hay cuotas vencidas pendientes.")}
      </section>`;
  }

  function renderUltimosMovimientos(movimientos) {
    const OPERATIONAL_TABLES = ["cuota", "pago", "venta", "factura", "recibo", "comprador"];

    const TABLE_LABELS = {
      cuota: "Cuota", pago: "Pago", venta: "Venta",
      factura: "Factura", recibo: "Recibo", comprador: "Comprador",
    };

    const FIELD_LABELS = {
      numero_cuota:      "Número de cuota",
      valor_cuota:       "Valor de cuota",
      fecha_vencimiento: "Fecha de vencimiento",
      es_extraordinaria: "Cuota extraordinaria",
      estado:            "Estado",
      fecha_pago:        "Fecha de pago",
      metodo_pago:       "Método de pago",
      valor_total:       "Valor total",
      fecha_venta:       "Fecha de venta",
    };

    const KEY_INSERT_CAMPOS = ["fecha_vencimiento", "numero_cuota", "estado", "valor_cuota", "valor_total"];

    const fmtTs = ts => {
      if (!ts) return "—";
      const d    = new Date(ts);
      const fecha = d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
      const hora  = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
      return `${fecha} · ${hora}`;
    };

    const fmtValue = v => {
      if (!v || v === "null") return null;
      if (v === "true")  return "Sí";
      if (v === "false") return "No";
      if (/^\d{4}-\d{2}-\d{2}$/.test(v))
        return new Date(`${v}T12:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
      if (v.startsWith("{")) {
        try {
          const obj = JSON.parse(v);
          const parts = [];
          if (obj.valor != null) parts.push(fmtM(Number(obj.valor)));
          if (obj.metodo)        parts.push(String(obj.metodo).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
          if (obj.tipo)          parts.push(String(obj.tipo).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
          if (parts.length) return parts.join(" · ");
          return Object.entries(obj).map(([k, val]) => `${k}: ${val}`).join(" · ");
        } catch (_) {}
      }
      const n = Number(v);
      if (!isNaN(n) && n > 999) return fmtM(n);
      return v;
    };

    const dotColor = tabla => {
      if (tabla === "pago")  return "var(--success)";
      if (tabla === "cuota") return "var(--accent)";
      if (tabla === "venta") return "var(--info)";
      return "var(--text-muted)";
    };

    const labelCampo = campo =>
      FIELD_LABELS[campo] || (campo || "—").replace(/_/g, " ");

    const fmtUsuario = u => (!u || u === "postgres") ? "Sistema" : u;

    // Group changes of the same record within the same minute into one event
    const groups = new Map();
    (Array.isArray(movimientos) ? movimientos : [])
      .filter(m => OPERATIONAL_TABLES.includes((m.tabla_afectada || "").toLowerCase()))
      .forEach(m => {
        const key = `${m.tabla_afectada}|${m.id_registro}|${(m.fecha_cambio || "").slice(0, 16)}`;
        if (!groups.has(key)) {
          groups.set(key, {
            tabla_afectada: m.tabla_afectada,
            operacion:      m.operacion,
            fecha_cambio:   m.fecha_cambio,
            usuario:        m.usuario,
            comprador:      m.comprador,
            codigo_lote:    m.codigo_lote,
            proyecto:       m.proyecto,
            campos:         [],
          });
        }
        groups.get(key).campos.push({
          campo:          m.campo,
          valor_anterior: m.valor_anterior,
          valor_nuevo:    m.valor_nuevo,
        });
      });

    const getNumero = g => {
      const c = g.campos.find(f => f.campo === 'numero_cuota');
      return c ? Number(c.valor_nuevo) : Infinity;
    };

    const getTipo = g => {
      const c = g.campos.find(f => f.campo === 'tipo');
      return c?.valor_nuevo || '';
    };

    const items = [...groups.values()]
      .sort((a, b) => {
        const timeDiff = new Date(b.fecha_cambio) - new Date(a.fecha_cambio);
        if (timeDiff !== 0) return timeDiff;
        const aInicial = getTipo(a) === 'inicial';
        const bInicial = getTipo(b) === 'inicial';
        if (aInicial && !bInicial) return -1;
        if (!aInicial && bInicial) return 1;
        return getNumero(a) - getNumero(b);
      })
      .slice(0, 5);

    if (!items.length) return `
      <section class="dashboard-block">
        ${window.SGIUI.sectionHeader({ kicker: "Actividad reciente", title: "Últimos movimientos" })}
        <article class="panel-card"><p>Sin movimientos recientes.</p></article>
      </section>`;

    const OP_LABELS_BY_TABLE = {
      cuota:     { INSERT: "registrada",  UPDATE: "actualizada",  DELETE: "eliminada"  },
      pago:      { INSERT: "registrado",  UPDATE: "actualizado",  DELETE: "eliminado"  },
      venta:     { INSERT: "registrada",  UPDATE: "actualizada",  DELETE: "eliminada"  },
      factura:   { INSERT: "generada",    UPDATE: "actualizada",  DELETE: "eliminada"  },
      recibo:    { INSERT: "generado",    UPDATE: "actualizado",  DELETE: "eliminado"  },
      comprador: { INSERT: "registrado",  UPDATE: "actualizado",  DELETE: "eliminado"  },
    };

    const OP_COLOR = { INSERT: "var(--success)", UPDATE: "var(--accent)", DELETE: "var(--danger)" };

    const renderContent = g => {
      if (g.operacion === "INSERT") {
        const relevant = g.campos
          .filter(c => KEY_INSERT_CAMPOS.includes(c.campo) && c.valor_nuevo != null)
          .sort((a, b) => KEY_INSERT_CAMPOS.indexOf(a.campo) - KEY_INSERT_CAMPOS.indexOf(b.campo));
        if (!relevant.length) return "";
        return `
          <div class="mov-insert-grid">
            ${relevant.map(c => `
              <div class="mov-insert-field">
                <span class="mov-insert-label">${labelCampo(c.campo)}</span>
                <span class="mov-pill success">${fmtValue(c.valor_nuevo) || c.valor_nuevo}</span>
              </div>
            `).join("")}
          </div>`;
      }
      return g.campos.map(c => {
        const a = fmtValue(c.valor_anterior);
        const n = fmtValue(c.valor_nuevo);
        return `
          <div class="mov-update-row">
            <span class="mov-insert-label">${labelCampo(c.campo)}</span>
            <div class="mov-change">
              ${a ? `<span class="mov-pill danger">${a}</span>${window.SGIUI.icon("arrow-right")}` : ""}
              <span class="mov-pill success">${n || "—"}</span>
            </div>
          </div>`;
      }).join("");
    };

    return `
      <section class="dashboard-block">
        ${window.SGIUI.sectionHeader({ kicker: "Actividad reciente", title: "Últimos movimientos", actions: `<span style="font-size:.75rem;font-weight:500;color:var(--text-muted)">Últimas ${items.length}</span>` })}
        <article class="panel-card" style="padding:1rem">
          <div class="activity-list">
            ${items.map(g => {
              const tablaLabel = TABLE_LABELS[g.tabla_afectada] || g.tabla_afectada;
              const opLabel    = (OP_LABELS_BY_TABLE[g.tabla_afectada] || {})[g.operacion] || "cambiado";
              const opColor    = OP_COLOR[g.operacion] || "var(--text-muted)";
              const ctx        = g.comprador
                ? [g.comprador, g.codigo_lote, g.proyecto].filter(Boolean).join(" · ")
                : "";
              return `
                <div class="activity-item">
                  <span class="activity-dot" style="background:${dotColor(g.tabla_afectada)};flex-shrink:0;align-self:flex-start;margin-top:.3rem"></span>
                  <div style="flex:1;min-width:0">
                    <div class="mov-item-header">
                      <span class="mov-campo">
                        <span style="color:${opColor}">${tablaLabel}</span>
                        <span style="color:var(--text-muted);font-weight:400"> ${opLabel}</span>
                      </span>
                      <span class="activity-time">${fmtTs(g.fecha_cambio)}</span>
                    </div>
                    ${ctx ? `<span class="mov-tabla-chip" style="display:block;margin-bottom:.4rem">${ctx}</span>` : ""}
                    ${renderContent(g)}
                    <span class="mov-user" style="margin-top:.25rem;display:block">${fmtUsuario(g.usuario)}</span>
                  </div>
                </div>`;
            }).join("")}
          </div>
        </article>
      </section>`;
  }

    //  KPI de mora y alerta de escritura 30% ───────────────────────────

  function _estadoNormalizado(v) {
    return String(v?.estado || "").trim().toLowerCase();
  }

  function _estaEscriturado(v) {
    return v?.escriturado === true || v?.escriturado === "true" || !!v?.fecha_escritura;
  }

  function _porcentajePagado(v) {
    return Number(v?.porcentaje_pagado || 0);
  }

  function _cruzo30Reciente(fecha) {
    if (!fecha) return false;

    const fechaCruce = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(fechaCruce.getTime())) return false;

    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0);

    const diffDias = Math.floor((hoy - fechaCruce) / 86_400_000);

    return diffDias >= 0 && diffDias <= 7;
  }

  function _badgeEscritura(v) {
    const reciente = _cruzo30Reciente(v.fecha_cruce_30);

    return reciente
      ? `<span class="badge" style="background:rgba(var(--success-rgb,34,197,94),.12);color:var(--success,#22c55e);border:1px solid rgba(var(--success-rgb,34,197,94),.22)">Nuevo</span>`
      : `<span class="badge" style="background:rgba(var(--accent-rgb),.12);color:var(--accent);border:1px solid rgba(var(--accent-rgb),.24)">Pendiente</span>`;
  }

function renderMoraEscritura(ventas = []) {
  const lista = Array.isArray(ventas) ? ventas : [];

  const listasParaEscritura = lista
    .filter(v => _porcentajePagado(v) >= 30 && !_estaEscriturado(v))
    .sort((a, b) => _porcentajePagado(b) - _porcentajePagado(a))
    .slice(0, 6);

  const rows = listasParaEscritura.length
    ? listasParaEscritura.map(v => {
      const pct = _porcentajePagado(v);
      const reciente = _cruzo30Reciente(v.fecha_cruce_30);

      return `
        <article class="escritura-card">
          <div class="escritura-card-top">
            <div class="escritura-avatar">
              ${(v.comprador || "C").trim().charAt(0).toUpperCase()}
            </div>

            <div class="escritura-main">
              <div class="escritura-title-row">
                <h4>${v.comprador || "Comprador sin nombre"}</h4>
                <span class="escritura-badge ${reciente ? "is-new" : "is-pending"}">
                  ${reciente ? "Nuevo" : "Pendiente"}
                </span>
              </div>

              <p>
                Lote <strong>${v.codigo_lote || "—"}</strong>
                ${v.proyecto ? ` · ${v.proyecto}` : ""}
              </p>
            </div>
          </div>

          <div class="escritura-progress-head">
            <span>Avance de pago</span>
            <strong>${pct.toFixed(1)}%</strong>
          </div>

          <div class="escritura-progress">
            <div style="width:${Math.min(100, Math.max(0, pct)).toFixed(1)}%"></div>
          </div>

          <div class="escritura-meta">
            ${v.fecha_cruce_30
              ? `Alcanzó el 30% el ${UI.date(v.fecha_cruce_30)}`
              : "Cumple requisito de pago"
            }
          </div>

          <div class="escritura-actions">
            <button class="btn btn-ghost btn-sm" onclick="window._abrirVentaDesdeDashboard(${v.id_venta})">
              Ver venta
            </button>
          </div>
        </article>
      `;
    }).join("")
    : `
      <div class="escritura-empty">
        <div class="escritura-empty-icon">
          ${window.SGIUI.icon("file-check")}
        </div>
        <strong>No hay ventas listas para escritura</strong>
        <span>Cuando una venta alcance el 30% de pago y siga sin escriturar, aparecerá aquí.</span>
      </div>
    `;

  return `
    <section class="dashboard-block">
      ${window.SGIUI.sectionHeader({
        kicker: "Escrituración",
        title: "Listas para escritura"
      })}

      <article class="panel-card escritura-panel">
        <div class="escritura-panel-head">
          <div>
            <span class="section-kicker">Requisito 30%</span>
            <h3 class="section-title">Ventas pendientes por escriturar</h3>
          </div>

          <span class="results-chip">${fmtN(listasParaEscritura.length)} venta(s)</span>
        </div>

        <div class="escritura-grid">
          ${rows}
        </div>
      </article>
    </section>
  `;
}

  window._abrirVentaDesdeDashboard = function(idVenta) {
    if (!idVenta) return;

    if (typeof window.navigate === "function") {
      window.navigate("ventas");
    }

    setTimeout(() => {
      if (typeof window.verVenta === "function") {
        window.verVenta(idVenta);
      }
    }, 250);
  };
  // ── Widget registry ──────────────────────────────────────────────────────────

    const WIDGETS = [
    {
      resource: "dashboard", action: "ver_operacion",
      fetch:  () => API.get("/reportes/panel"),
      render: renderKpiOperacion,
    },
    {
      resource: "dashboard", action: "ver_operacion",
      fetch:  () => API.get("/ventas/estado-financiero"),
      render: renderMoraEscritura,
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
    {
      resource: "cuotas", action: "leer",
      fetch:  () => API.get("/cuotas/pendientes"),
      render: renderCuotasPendientes,
    },
    {
      resource: "dashboard", action: "ver_operacion",
      fetch:  () => API.get("/reportes/auditoria"),
      render: renderUltimosMovimientos,
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

    const slotId = i => `dash-slot-${i}`;

    vc.innerHTML = `
      <section class="page-shell dashboard-page">
        ${window.SGIUI.pageHeader({
          kicker:   "Resumen operativo",
          title:    "Centro de operacion",
          subtitle: "Estado de ventas, cartera, pagos, cuotas y comisiones.",
        })}
        ${visible.map((_, i) => `
          <div id="${slotId(i)}">
            <section class="dashboard-block">
              <div style="padding:1.5rem;color:var(--text-muted)">Cargando...</div>
            </section>
          </div>
        `).join("")}
      </section>`;

    let settled = 0;
    visible.forEach((w, i) => {
      const slot = document.getElementById(slotId(i));
      w.fetch()
        .then(data => {
          if (!slot) return;
          try { slot.innerHTML = w.render(data); }
          catch (_) { slot.innerHTML = renderWidgetError("No se pudo procesar la respuesta."); }
        })
        .catch(err => {
          if (slot) slot.innerHTML = renderWidgetError(err?.message || "Error de conexión");
        })
        .finally(() => {
          settled++;
          if (settled === visible.length) window.SGIUI?.hydrate();
        });
    });
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

    const fmtC = n => n != null ? Number(n).toLocaleString("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }) : "—";
    const fmtD = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" }) : "—";

    function buildLoteSelector(idx) {
      if (ventas.length <= 1) return "";
      return `<div class="lote-selector">
        ${ventas.map((vt, i) => {
          const label = `${vt.lote?.proyecto?.nombre || "Proyecto"} · Lote ${vt.lote?.codigo_lote || "—"}`;
          return `<button class="lote-tab ${i === idx ? "active" : ""}" data-idx="${i}">${label}</button>`;
        }).join("")}
      </div>`;
    }

    function buildAlerta(cuota) {
      if (!cuota) return `
        <div class="cuota-alert alert-success">
          <div class="cuota-alert-icon">${window.SGIUI?.icon("check-circle") ?? ""}</div>
          <div class="cuota-alert-body">
            <div class="cuota-alert-title">Al dia con tus pagos</div>
            <div class="cuota-alert-text">Todas tus cuotas estan al dia. Puedes revisar tu historial completo en Mis Pagos.</div>
            <div class="cuota-alert-actions"><button class="btn btn-ghost btn-sm" onclick="navigate('mis-recibos')">Ver Mis Pagos</button></div>
          </div>
        </div>`;
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

    let selectedIdx = 0;

    function render(idx) {
      const v = ventas[idx];
      const cuotaActual = v.cuota_actual;
      const pct = Math.min(100, v.porcentaje_pagado || 0);
      const totalAbonoExtraordinario = Number(v.total_abonado_extraordinario || 0);
      const saldoPendienteReal = Number(v.saldo_pendiente_real ?? v.saldo_pendiente ?? 0);

      vc.innerHTML = `
        <section class="page-shell comprador-dashboard">
          ${window.SGIUI?.pageHeader({
            kicker: "Mi cuenta",
            title: `${v.lote?.proyecto?.nombre || "Mi inmueble"}`,
            subtitle: `Lote ${v.lote?.codigo_lote || "—"}${v.lote?.manzana ? " · Manzana " + v.lote.manzana : ""}`,
          }) ?? ""}
          ${buildLoteSelector(idx)}
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
              <div class="sale-hero-proyecto">${v.lote?.proyecto?.nombre || "Proyecto"}</div>
              <div class="sale-hero-lote">Lote ${v.lote?.codigo_lote || "—"}${v.lote?.manzana ? " · Mz " + v.lote.manzana : ""}</div>
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
              <div class="finance-item"><div class="finance-item-label">Pagado total</div><div class="finance-item-value success">${fmtC(v.total_pagado)}</div></div>
              ${totalAbonoExtraordinario > 0 ? `<div class="finance-item"><div class="finance-item-label">Abono al total</div><div class="finance-item-value success">${fmtC(totalAbonoExtraordinario)}</div></div>` : ""}
              <div class="finance-item"><div class="finance-item-label">Saldo pendiente real</div><div class="finance-item-value warning">${fmtC(saldoPendienteReal)}</div></div>
              <div class="finance-item"><div class="finance-item-label">Cuotas</div><div class="finance-item-value accent">${v.cuotas_pagadas} / ${v.total_cuotas}</div></div>
            </div>
          </div>
          <div class="comprador-actions">
            <button class="btn btn-primary" id="dash-btn-pagar-cuota">${window.SGIUI?.icon("wallet") ?? ""} Pagar cuota</button>
            <button class="btn btn-ghost" onclick="navigate('mis-cuotas')">${window.SGIUI?.icon("calendar") ?? ""} Ver cuotas</button>
            <button class="btn btn-ghost" onclick="navigate('mis-recibos')">${window.SGIUI?.icon("file-text") ?? ""} Mis pagos</button>
          </div>
        </section>`;


      window.SGIUI?.hydrate();

      vc.querySelectorAll(".lote-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedIdx = Number(btn.dataset.idx);
          render(selectedIdx);
        });
      });

      const onPagar = () => navigate("mis-cuotas");
      document.getElementById("dash-btn-pagar")?.addEventListener("click", onPagar);
      document.getElementById("dash-btn-pagar-cuota")?.addEventListener("click", onPagar);
    }

    render(selectedIdx);
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
