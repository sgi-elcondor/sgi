(function () {

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

})();