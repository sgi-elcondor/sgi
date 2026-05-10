window.pagosView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/pagos").catch(e => {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    return null;
  });
  if (!data) return;
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <h3>Pagos</h3>
        <button class="btn btn-primary btn-sm" onclick="pagoForm()">+ Registrar Pago</button>
      </div>
      <table>
        <thead><tr><th>#</th><th>Fecha</th><th>Valor</th><th>Método</th><th>Referencia</th><th>Excedente</th></tr></thead>
        <tbody>${data.map(p => `<tr>
          <td>${p.id_pago}</td>
          <td>${UI.date(p.fecha_pago)}</td>
          <td>${UI.fmt(p.valor_pago)}</td>
          <td>${p.metodo_pago}</td>
          <td>${p.referencia || "—"}</td>
          <td>${UI.badge(p.tipo_excedente)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};

window.pagoForm = async function() {
  let cuotas = [];
  try {
    cuotas = await API.get("/cuotas/pendientes");
  } catch(e) {
    cuotas = [];
  }

  const listaCuotas = cuotas.length
    ? cuotas.map(c => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer">
          <input type="checkbox" class="chk-cuota" data-id="${c.id_cuota}" data-valor="${c.valor_cuota}"
            style="width:16px;height:16px;flex-shrink:0;cursor:pointer">
          <span style="flex:1;font-size:13px;line-height:1.4">
            <strong>${c.codigo_lote}</strong> &mdash; ${c.comprador}
            <span style="display:block;color:var(--text-muted)">
              Cuota #${c.numero_cuota} &bull; Vence: ${UI.date(c.fecha_vencimiento)} &bull; ${UI.badge(c.estado)}
            </span>
          </span>
          <span style="font-weight:600;font-size:13px;white-space:nowrap">${UI.fmt(c.valor_cuota)}</span>
        </label>`)
      .join("")
    : `<p style="color:var(--text-muted);text-align:center;padding:24px 0">No hay cuotas pendientes de pago.</p>`;

  UI.openModal("Registrar Pago", `
    <div class="form-grid">
      <div class="form-group">
        <label>Fecha *</label>
        <input id="f_fp" type="date" value="${new Date().toISOString().split("T")[0]}">
      </div>
      <div class="form-group">
        <label>Método de pago *</label>
        <select id="f_mp">
          <option value="transferencia">Transferencia</option>
          <option value="efectivo">Efectivo</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Referencia</label>
        <input id="f_ref" placeholder="Nro. comprobante o transacción">
      </div>
    </div>

    <div style="margin-top:16px">
      <p style="font-weight:600;margin-bottom:8px">Cuotas a cubrir *</p>
      <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px 12px">
        ${listaCuotas}
      </div>
    </div>

    <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;
                padding:10px 0;border-top:1px solid var(--border)">
      <span style="color:var(--text-muted)">Total a pagar:</span>
      <strong id="f_total" style="font-size:18px">$ 0</strong>
    </div>

    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button id="f_btn_guardar" class="btn btn-primary" onclick="guardarPago()">Guardar</button>
    </div>
  `);

  document.querySelectorAll(".chk-cuota").forEach(chk => {
    chk.addEventListener("change", () => {
      const total = Array.from(document.querySelectorAll(".chk-cuota:checked"))
        .reduce((s, el) => s + Number(el.dataset.valor), 0);
      const el = document.getElementById("f_total");
      if (el) el.textContent = UI.fmt(total);
    });
  });
};

window.guardarPago = async function() {
  const fecha_pago  = document.getElementById("f_fp").value;
  const metodo_pago = document.getElementById("f_mp").value;
  const referencia  = document.getElementById("f_ref").value.trim();
  const seleccionadas = Array.from(document.querySelectorAll(".chk-cuota:checked"));

  if (!fecha_pago) {
    window.SGIUI?.toast("La fecha es requerida.", "error", "Error");
    return;
  }
  if (seleccionadas.length === 0) {
    window.SGIUI?.toast("Seleccione al menos una cuota.", "error", "Error");
    return;
  }

  const cuotas = seleccionadas.map(chk => ({
    id_cuota:       Number(chk.dataset.id),
    valor_aplicado: Number(chk.dataset.valor),
  }));

  const btn = document.getElementById("f_btn_guardar");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }

  try {
    await API.post("/pagos", { fecha_pago, metodo_pago, referencia: referencia || null, cuotas });
    UI.closeModal();
    window.SGIUI?.toast("Pago registrado. Recibo generado automáticamente.", "success", "Éxito");
    pagosView();
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = "Guardar"; }
    window.SGIUI?.toast(e.message || "Error al registrar el pago.", "error", "Error");
  }
};
