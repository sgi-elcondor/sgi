let reportesChartFacturacion = null;
let reportesChartCartera = null;

function destruirGraficasReportes() {
  if (reportesChartFacturacion) {
    reportesChartFacturacion.destroy();
    reportesChartFacturacion = null;
  }

  if (reportesChartCartera) {
    reportesChartCartera.destroy();
    reportesChartCartera = null;
  }
}

function normalizarEstadoFinanciero(estado) {
  const raw = String(estado || "").trim().toLowerCase();

  if (!raw || raw === "undefined" || raw === "null") return "Sin estado";
  if (raw.includes("saludable")) return "Saludable";
  if (raw.includes("riesgo")) return "En riesgo";
  if (raw.includes("critico")) return "Crítico";

  return estado;
}

function colorEstadoFinanciero(estado) {
  const normalized = normalizarEstadoFinanciero(estado).toLowerCase();

  if (normalized.includes("saludable")) return "var(--success)";
  if (normalized.includes("riesgo")) return "var(--warning)";
  if (normalized.includes("critico")) return "var(--danger)";
  return "var(--text-muted)";
}

function formatearPeriodo(periodo) {
  if (!periodo) return "—";
  const value = String(periodo);

  if (value.length >= 7) {
    return value.slice(0, 7);
  }

  return value;
}

function renderGraficasReportes(cartera, recaudo) {
  if (typeof Chart === "undefined") return;

  const canvasFacturacion = document.getElementById("chartFacturacionVsRecaudo");
  const canvasCartera = document.getElementById("chartCapitalPendiente");

  if (!canvasFacturacion || !canvasCartera) return;

  destruirGraficasReportes();

  const periodos = recaudo.map(r => formatearPeriodo(r.periodo));
  const facturado = recaudo.map(r => Number(r.total_facturado || 0));
  const recaudado = recaudo.map(r => Number(r.total_recaudado || 0));

  reportesChartFacturacion = new Chart(canvasFacturacion, {
    type: "bar",
    data: {
      labels: periodos,
      datasets: [
        {
          label: "Facturado",
          data: facturado,
          backgroundColor: "rgba(249, 115, 22, 0.78)",
          borderColor: "rgba(249, 115, 22, 1)",
          borderWidth: 1,
          borderRadius: 8
        },
        {
          label: "Recaudado",
          data: recaudado,
          backgroundColor: "rgba(29, 29, 29, 0.72)",
          borderColor: "rgba(29, 29, 29, 1)",
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#72675d",
            font: {
              family: "DM Sans",
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const label = context.dataset.label || "";
              const value = context.raw || 0;
              return `${label}: ${new Intl.NumberFormat("es-CO", {
                style: "currency",
                currency: "COP",
                maximumFractionDigits: 0
              }).format(value)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#72675d",
            font: {
              family: "DM Sans"
            }
          },
          grid: {
            color: "rgba(0,0,0,0.04)"
          }
        },
        y: {
          ticks: {
            color: "#72675d",
            font: {
              family: "DM Sans"
            },
            callback(value) {
              return new Intl.NumberFormat("es-CO", {
                notation: "compact",
                compactDisplay: "short"
              }).format(value);
            }
          },
          grid: {
            color: "rgba(0,0,0,0.05)"
          }
        }
      }
    }
  });

  const proyectos = cartera.map(c => c.proyecto);
  const capitalPendiente = cartera.map(c => Number(c.capital_pendiente || 0));

  reportesChartCartera = new Chart(canvasCartera, {
    type: "bar",
    data: {
      labels: proyectos,
      datasets: [
        {
          label: "Capital pendiente",
          data: capitalPendiente,
          backgroundColor: "rgba(249, 115, 22, 0.82)",
          borderColor: "rgba(249, 115, 22, 1)",
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.raw || 0;
              return new Intl.NumberFormat("es-CO", {
                style: "currency",
                currency: "COP",
                maximumFractionDigits: 0
              }).format(value);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#72675d",
            font: {
              family: "DM Sans"
            },
            callback(value) {
              return new Intl.NumberFormat("es-CO", {
                notation: "compact",
                compactDisplay: "short"
              }).format(value);
            }
          },
          grid: {
            color: "rgba(0,0,0,0.05)"
          }
        },
        y: {
          ticks: {
            color: "#72675d",
            font: {
              family: "DM Sans"
            }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

window.reportesView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  try {
    const [cartera, recaudo] = await Promise.all([
      API.get("/reportes/cartera"),
      API.get("/reportes/recaudo")
    ]);

    const totalCapitalPendiente = cartera.reduce(
      (acc, item) => acc + Number(item.capital_pendiente || 0),
      0
    );

    const totalVentasActivas = cartera.reduce(
      (acc, item) => acc + Number(item.ventas_activas || 0),
      0
    );

    const totalCuotasVencidas = cartera.reduce(
      (acc, item) => acc + Number(item.total_cuotas_vencidas || 0),
      0
    );

    const promedioCumplimiento = recaudo.length
      ? recaudo.reduce((acc, item) => acc + Number(item.indice_cumplimiento || 0), 0) / recaudo.length
      : 0;

    vc.innerHTML = `
      <section class="page-shell">
        <section class="stats-grid" style="margin-bottom: 8px;">
          <article class="stat-card">
            <div class="stat-label">Capital pendiente</div>
            <div class="stat-value">${UI.fmt(totalCapitalPendiente)}</div>
            <div class="stat-sub">Saldo consolidado de cartera</div>
          </article>

          <article class="stat-card">
            <div class="stat-label">Ventas activas</div>
            <div class="stat-value">${totalVentasActivas}</div>
            <div class="stat-sub">Operaciones actualmente vigentes</div>
          </article>

          <article class="stat-card">
            <div class="stat-label">Cuotas vencidas</div>
            <div class="stat-value">${UI.fmt(totalCuotasVencidas)}</div>
            <div class="stat-sub">Obligaciones pendientes de pago</div>
          </article>

          <article class="stat-card">
            <div class="stat-label">% cumplimiento promedio</div>
            <div class="stat-value">${(promedioCumplimiento * 100).toFixed(1)}%</div>
            <div class="stat-sub">Recaudo frente a facturación</div>
          </article>
        </section>

        <section class="reportes-grid" style="margin-bottom: 20px;">
          <article class="chart-card">
            <div class="chart-card-header">
              <h3 class="chart-card-title">Facturado vs Recaudado</h3>
              <p class="chart-card-subtitle">Comparativo histórico por período</p>
            </div>
            <div class="chart-card-body">
              <canvas id="chartFacturacionVsRecaudo"></canvas>
            </div>
          </article>

          <article class="chart-card">
            <div class="chart-card-header">
              <h3 class="chart-card-title">Capital pendiente por proyecto</h3>
              <p class="chart-card-subtitle">Concentración de cartera viva</p>
            </div>
            <div class="chart-card-body">
              <canvas id="chartCapitalPendiente"></canvas>
            </div>
          </article>
        </section>

        <div class="table-wrap" style="margin-bottom:20px">
          <div class="table-header">
            <h3>Cartera Consolidada por Proyecto</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Estado</th>
                <th>Ventas Activas</th>
                <th>Capital Pendiente</th>
                <th>Cuotas Vencidas</th>
              </tr>
            </thead>
            <tbody>
              ${cartera.map(c => `
                <tr>
                  <td>${c.proyecto}</td>
                  <td>
                    <span style="
                      display:inline-flex;
                      align-items:center;
                      padding:4px 10px;
                      border-radius:999px;
                      font-size:11px;
                      font-weight:600;
                      background:rgba(0,0,0,0.04);
                      color:${colorEstadoFinanciero(c.estado_financiero)};
                    ">
                      ${normalizarEstadoFinanciero(c.estado_financiero)}
                    </span>
                  </td>
                  <td>${c.ventas_activas}</td>
                  <td>${UI.fmt(c.capital_pendiente)}</td>
                  <td>${UI.fmt(c.total_cuotas_vencidas)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div class="table-wrap">
          <div class="table-header">
            <h3>Recaudo vs Facturación Histórico</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Facturado</th>
                <th>Recaudado</th>
                <th>Diferencia</th>
                <th>% Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              ${recaudo.map(r => `
                <tr>
                  <td>${r.periodo}</td>
                  <td>${UI.fmt(r.total_facturado)}</td>
                  <td>${UI.fmt(r.total_recaudado)}</td>
                  <td style="color:${Number(r.diferencia) > 0 ? "var(--danger)" : "var(--success)"}">
                    ${UI.fmt(r.diferencia)}
                  </td>
                  <td>${(Number(r.indice_cumplimiento || 0) * 100).toFixed(1)}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;

    setTimeout(() => {
      renderGraficasReportes(cartera, recaudo);
    }, 0);

  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
  }
};
