(function () {

window.auditoriaView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const data = await API.get("/reportes/auditoria").catch(e => {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    return null;
  });
  if (!data) return;

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header"><h3>Log de Auditoria (ultimos 200)</h3></div>
      <table>
        <thead>
          <tr>
            <th>Tabla</th>
            <th>Op.</th>
            <th>ID Reg.</th>
            <th>Campo</th>
            <th>Antes</th>
            <th>Despues</th>
            <th>Usuario</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(a => `
            <tr>
              <td>${a.tabla_afectada}</td>
              <td>${UI.badge(a.operacion?.toLowerCase())}</td>
              <td>${a.id_registro}</td>
              <td>${a.campo}</td>
              <td style="color:var(--text-muted)">${a.valor_anterior || "—"}</td>
              <td>${a.valor_nuevo || "—"}</td>
              <td>${a.usuario}</td>
              <td style="font-size:11px;color:var(--text-muted)">
                ${new Date(a.fecha_cambio).toLocaleString("es-CO")}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
};

})();