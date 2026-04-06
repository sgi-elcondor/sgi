window.pagosView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/pagos").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header"><h3>Pagos</h3><button class="btn btn-primary btn-sm" onclick="pagoForm()">+ Registrar Pago</button></div>
      <table>
        <thead><tr><th>#</th><th>Fecha</th><th>Valor</th><th>Método</th><th>Referencia</th><th>Excedente</th></tr></thead>
        <tbody>${data.map(p=>`<tr>
          <td>${p.id_pago}</td><td>${UI.date(p.fecha_pago)}</td>
          <td>${UI.fmt(p.valor_pago)}</td><td>${p.metodo_pago}</td>
          <td>${p.referencia||"—"}</td><td>${UI.badge(p.tipo_excedente)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};
window.pagoForm = function() {
  UI.openModal("Registrar Pago",`
    <div class="form-grid">
      <div class="form-group"><label>Fecha *</label><input id="f_fp" type="date"/></div>
      <div class="form-group"><label>Valor *</label><input id="f_vp" type="number"/></div>
      <div class="form-group"><label>Método *</label><select id="f_mp"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option></select></div>
      <div class="form-group"><label>Referencia</label><input id="f_ref"/></div>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-top:10px">Nota: después de crear el pago, asocie las cuotas desde la vista de cuotas.</p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarPago()">Guardar</button>
    </div>`);
};
window.guardarPago = async function() {
  const body = { fecha_pago: document.getElementById("f_fp").value, valor_pago: +document.getElementById("f_vp").value,
    metodo_pago: document.getElementById("f_mp").value, referencia: document.getElementById("f_ref").value };
  try { await API.post("/pagos", body); UI.closeModal(); UI.toast("Pago registrado","ok"); pagosView(); }
  catch(e) { UI.toast(e.message,"error"); }
};
