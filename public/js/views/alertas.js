window.alertasView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/reportes/alertas").catch(e => {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    return null;
  });
  if (!data) return;
  if (!data.length) {
    vc.innerHTML = `<p style="color:var(--success);padding:20px">Sin alertas juridicas activas.</p>`;
    return;
  }
  vc.innerHTML = data.map(a => `
    <div class="alert-item ${a.nivel_riesgo}">
      <div>
        <div class="alert-tag" style="color:${a.nivel_riesgo === "alto" ? "var(--danger)" : "var(--warning)"}">
          ${a.tipo_alerta.replace(/_/g, " ")} &middot; Venta #${a.id_venta} &middot; Riesgo ${a.nivel_riesgo}
        </div>
        <div class="alert-desc">${a.descripcion}</div>
      </div>
    </div>
  `).join("");
};

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
