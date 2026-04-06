window.reportesView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const [cartera, recaudo] = await Promise.all([API.get("/reportes/cartera"), API.get("/reportes/recaudo")]);
  vc.innerHTML = `
    <div class="table-wrap" style="margin-bottom:20px">
      <div class="table-header"><h3>Cartera Consolidada por Proyecto</h3></div>
      <table><thead><tr><th>Proyecto</th><th>Estado</th><th>Ventas Activas</th><th>Capital Pendiente</th><th>Cuotas Vencidas</th></tr></thead>
        <tbody>${cartera.map(c=>`<tr>
          <td>${c.proyecto}</td><td>${UI.badge(c.estado_financiero)}</td>
          <td>${c.ventas_activas}</td><td>${UI.fmt(c.capital_pendiente)}</td>
          <td>${UI.fmt(c.total_cuotas_vencidas)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="table-wrap">
      <div class="table-header"><h3>Recaudo vs Facturación Histórico</h3></div>
      <table><thead><tr><th>Período</th><th>Facturado</th><th>Recaudado</th><th>Diferencia</th><th>% Cumplimiento</th></tr></thead>
        <tbody>${recaudo.map(r=>`<tr>
          <td>${r.periodo}</td><td>${UI.fmt(r.total_facturado)}</td><td>${UI.fmt(r.total_recaudado)}</td>
          <td style="color:${r.diferencia>0?"var(--danger)":"var(--success)"}">${UI.fmt(r.diferencia)}</td>
          <td>${(r.indice_cumplimiento*100).toFixed(1)}%</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
window.alertasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/reportes/alertas").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;
  if (!data.length) { vc.innerHTML=`<p style="color:var(--success);padding:20px">✓ Sin alertas jurídicas activas.</p>`; return; }
  vc.innerHTML = data.map(a=>`
    <div class="alert-item ${a.nivel_riesgo}">
      <div>
        <div class="alert-tag" style="color:${a.nivel_riesgo==="alto"?"var(--danger)":"var(--warning)"}">${a.tipo_alerta.replace(/_/g," ")} · Venta #${a.id_venta} · Riesgo ${a.nivel_riesgo}</div>
        <div class="alert-desc">${a.descripcion}</div>
      </div>
    </div>`).join("");
};
window.auditoriaView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/reportes/auditoria").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header"><h3>Log de Auditoría (últimos 200)</h3></div>
      <table><thead><tr><th>Tabla</th><th>Op.</th><th>ID Reg.</th><th>Campo</th><th>Antes</th><th>Después</th><th>Usuario</th><th>Fecha</th></tr></thead>
        <tbody>${data.map(a=>`<tr>
          <td>${a.tabla_afectada}</td><td>${UI.badge(a.operacion?.toLowerCase())}</td>
          <td>${a.id_registro}</td><td>${a.campo}</td>
          <td style="color:var(--text-muted)">${a.valor_anterior||"—"}</td>
          <td>${a.valor_nuevo||"—"}</td>
          <td>${a.usuario}</td>
          <td style="font-size:11px;color:var(--text-muted)">${new Date(a.fecha_cambio).toLocaleString("es-CO")}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
