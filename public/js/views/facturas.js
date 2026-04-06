window.facturasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/facturas").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header"><h3>Facturas</h3><button class="btn btn-primary btn-sm" onclick="facturaForm()">+ Nueva</button></div>
      <table><thead><tr><th>Nro.</th><th>Fecha</th><th>Valor</th><th>Estado</th><th>Observaciones</th><th></th></tr></thead>
        <tbody>${data.map(f=>`<tr>
          <td>${f.numero_factura}</td><td>${UI.date(f.fecha_emision)}</td>
          <td>${UI.fmt(f.valor_facturado)}</td><td>${UI.badge(f.estado)}</td>
          <td>${f.observaciones||"—"}</td>
          <td>${f.estado==="emitida"?`<button class="btn btn-danger btn-sm" onclick="anularFactura(${f.id_factura})">Anular</button>`:""}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
window.facturaForm = function() {
  UI.openModal("Nueva Factura",`
    <div class="form-grid">
      <div class="form-group"><label>Número *</label><input id="f_nf" type="number"/></div>
      <div class="form-group"><label>Fecha *</label><input id="f_fe" type="date"/></div>
      <div class="form-group"><label>Valor *</label><input id="f_vf" type="number"/></div>
      <div class="form-group"><label>ID Cuota (opcional)</label><input id="f_ic" type="number"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label><textarea id="f_obs" rows="2"></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarFactura()">Guardar</button>
    </div>`);
};
window.guardarFactura = async function() {
  const body = { numero_factura: +document.getElementById("f_nf").value, fecha_emision: document.getElementById("f_fe").value,
    valor_facturado: +document.getElementById("f_vf").value, observaciones: document.getElementById("f_obs").value,
    id_cuota: document.getElementById("f_ic").value ? +document.getElementById("f_ic").value : null };
  try { await API.post("/facturas", body); UI.closeModal(); UI.toast("Factura creada","ok"); facturasView(); }
  catch(e) { UI.toast(e.message,"error"); }
};
window.anularFactura = async function(id) {
  if (!confirm("¿Anular esta factura?")) return;
  try { await API.patch(`/facturas/${id}/anular`, {}); UI.toast("Factura anulada","ok"); facturasView(); }
  catch(e) { UI.toast(e.message,"error"); }
};
