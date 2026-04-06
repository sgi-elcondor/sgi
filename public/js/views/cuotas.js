window.cuotasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/cuotas/vencidas").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header"><h3>Cuotas Vencidas</h3></div>
      <table>
        <thead><tr><th>Proyecto</th><th>Lote</th><th>Comprador</th><th>Nro.</th><th>Vencimiento</th><th>Días Atraso</th><th>Valor</th><th>Pendiente</th><th>Estado</th></tr></thead>
        <tbody>${data.map(c=>`<tr>
          <td>${c.proyecto}</td><td>${c.codigo_lote}</td><td>${c.comprador}</td>
          <td>${c.numero_cuota}</td><td>${UI.date(c.fecha_vencimiento)}</td>
          <td style="color:var(--danger)">${c.dias_atraso} días</td>
          <td>${UI.fmt(c.valor_cuota)}</td><td>${UI.fmt(c.valor_pendiente)}</td>
          <td>${UI.badge(c.estado)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
