window.dashboardView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  try {
    const [panel, carteraHoy, comisiones] = await Promise.all([
      API.get("/reportes/panel"),
      API.get("/reportes/cartera-hoy"),
      API.get("/reportes/comisiones")
    ]);
    vc.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Ventas Activas</div><div class="stat-value">${panel.ventas_activas||0}</div></div>
        <div class="stat-card"><div class="stat-label">Pre-mora</div><div class="stat-value" style="color:var(--warning)">${panel.ventas_pre_mora||0}</div></div>
        <div class="stat-card"><div class="stat-label">En Mora</div><div class="stat-value" style="color:var(--danger)">${panel.ventas_en_mora||0}</div></div>
        <div class="stat-card"><div class="stat-label">Cuotas Vencen Hoy</div><div class="stat-value">${panel.cuotas_vencen_hoy||0}</div></div>
        <div class="stat-card"><div class="stat-label">Pagos Hoy</div><div class="stat-value">${panel.pagos_hoy||0}</div></div>
        <div class="stat-card"><div class="stat-label">Facturas Hoy</div><div class="stat-value">${panel.facturas_hoy||0}</div></div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Capital Financiado</div><div class="stat-value" style="font-size:20px">${UI.fmt(carteraHoy.capital_financiado_total)}</div></div>
        <div class="stat-card"><div class="stat-label">Capital Pagado</div><div class="stat-value" style="font-size:20px;color:var(--success)">${UI.fmt(carteraHoy.capital_pagado_total)}</div></div>
        <div class="stat-card"><div class="stat-label">Saldo Pendiente</div><div class="stat-value" style="font-size:20px;color:var(--warning)">${UI.fmt(carteraHoy.capital_pendiente_total)}</div></div>
        <div class="stat-card"><div class="stat-label">Capital en Mora</div><div class="stat-value" style="font-size:20px;color:var(--danger)">${UI.fmt(carteraHoy.capital_en_mora)}</div><div class="stat-sub">Ratio: ${((carteraHoy.ratio_mora||0)*100).toFixed(1)}%</div></div>
        <div class="stat-card"><div class="stat-label">Comisiones Causadas</div><div class="stat-value" style="font-size:20px">${UI.fmt(comisiones.comisiones_causadas)}</div></div>
        <div class="stat-card"><div class="stat-label">Comisiones Pendientes</div><div class="stat-value" style="font-size:20px;color:var(--warning)">${UI.fmt(comisiones.comisiones_pendientes)}</div></div>
      </div>`;
  } catch(e) { vc.innerHTML = `<p style="color:var(--danger)">Error: ${e.message}</p>`; }
};