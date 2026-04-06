window.recibosView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/recibos").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header"><h3>Recibos</h3><button class="btn btn-primary btn-sm" onclick="reciboForm()">+ Nuevo</button></div>
      <table><thead><tr><th>Nro.</th><th>Fecha</th><th>Emitido Por</th><th>Observaciones</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td>${r.numero_recibo}</td><td>${UI.date(r.fecha_emision)}</td>
          <td>${r.emitido_por||"—"}</td><td>${r.observaciones||"—"}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
window.reciboForm = function() {
  UI.openModal("Nuevo Recibo",`
    <div class="form-grid">
      <div class="form-group"><label>Número *</label><input id="f_nr" type="number"/></div>
      <div class="form-group"><label>Emitido Por</label><input id="f_ep"/></div>
      <div class="form-group"><label>ID Pago (opcional)</label><input id="f_ip" type="number"/></div>
      <div class="form-group"><label>ID Comprador (opcional)</label><input id="f_ic" type="number"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label><textarea id="f_obs" rows="2"></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarRecibo()">Guardar</button>
    </div>`);
};
window.guardarRecibo = async function() {
  const body = { numero_recibo: +document.getElementById("f_nr").value, emitido_por: document.getElementById("f_ep").value,
    observaciones: document.getElementById("f_obs").value,
    id_pago: document.getElementById("f_ip").value ? +document.getElementById("f_ip").value : null,
    id_comprador: document.getElementById("f_ic").value ? +document.getElementById("f_ic").value : null };
  try { await API.post("/recibos", body); UI.closeModal(); UI.toast("Recibo creado","ok"); recibosView(); }
  catch(e) { UI.toast(e.message,"error"); }
};
