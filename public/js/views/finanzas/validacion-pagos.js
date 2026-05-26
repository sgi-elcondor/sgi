(function () {

function _pvFmt(amount) {
  if (amount === null || amount === undefined) return '--';
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(Math.abs(amount));
}
function _pvDate(d) {
  if (!d) return '--';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}
function _pvScoreBadge(score, manual) {
  if (manual) return `<span class="pv-score-badge" style="background:#6366f1">Revision manual</span>`;
  let color = '#ef4444', label = 'Baja';
  if (score >= 80) { color = '#22c55e'; label = 'Alta'; }
  else if (score >= 50) { color = '#e8570c'; label = 'Media'; }
  return `<span class="pv-score-badge" style="background:${color}">${label} (${score})</span>`;
}
function _pvMatchIcon(m) {
  if (m === 'exact')   return '<span class="pv-match exact" title="Coincidencia exacta">&#10003;&#10003;</span>';
  if (m === 'partial') return '<span class="pv-match partial" title="Coincidencia parcial">~</span>';
  return '<span class="pv-match none" title="Sin coincidencia">&#10005;</span>';
}

window.paymentValidationView = async function() {
  const vc       = document.getElementById('viewContainer');
  const canWrite = AppState.can('validacion_pagos', 'crear');
  vc.innerHTML   = UI.loader();
  const matches  = await API.get('/pagos/contrast').catch(e => {
    vc.innerHTML = `<p style="color:var(--danger);padding:20px">${e.message}</p>`; return null;
  });
  if (!matches) return;
  if (!matches.length) {
    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header"><h3>Validacion de Pagos</h3></div>
        <div style="padding:32px;text-align:center;color:var(--text-muted)">
          <p style="font-size:16px">No hay coincidencias pendientes de validar.</p>
          <p style="font-size:13px;margin-top:8px">No hay comprobantes enviados por compradores pendientes de revision.</p>
        </div>
      </div>`;
    return;
  }
  vc.innerHTML = `
    <div class="pv-page">
      <div class="table-wrap" style="margin-bottom:0;border-radius:16px 16px 0 0">
        <div class="table-header">
          <div>
            <h3>Validacion de Pagos</h3>
            <p style="color:var(--text-muted);font-size:13px;margin:2px 0 0">${matches.length} coincidencia(s) encontrada(s)</p>
          </div>
          ${canWrite ? `<button class="btn btn-primary" onclick="pvAcceptSelected()">Aceptar pagos seleccionados</button>` : ""}
        </div>
      </div>
      <div class="pv-cards" id="pv-cards-container">${matches.map((m, i) => _pvCard(m, i)).join('')}</div>
      ${canWrite ? `
      <div class="pv-footer">
        <button class="btn btn-primary btn-lg" onclick="pvAcceptSelected()">Aceptar pagos seleccionados</button>
        <span id="pv-accept-count" style="color:var(--text-muted);font-size:13px"></span>
      </div>` : ""}
    </div>`;
  _pvUpdateCount();
};

function _pvCard(m, i) {
  const { pago, transaction, score, amount_match, reference_match, date_diff_human, manual } = m;
  const hasBaucher = !!pago.url_baucher;
  const baucher = hasBaucher ? `
    <div class="pv-field" style="grid-column:1/-1;margin-top:8px">
      <span class="pv-label">Baucher</span>
      <a href="${pago.url_baucher}" target="_blank" class="btn btn-ghost btn-sm" style="margin-top:4px">Ver baucher</a>
    </div>
    <div class="pv-baucher-preview" style="margin-top:10px">
      <img src="${pago.url_baucher}" alt="Baucher" class="pv-baucher-img"
        onerror="this.style.display='none'" onclick="pvZoomBaucher('${pago.url_baucher}')">
    </div>` : '';

  const compradorNombre = pago.usuario
    ? `${pago.usuario.nombres || ''} ${pago.usuario.apellidos || ''}`.trim()
    : null;
  const loteInfo = pago.venta?.lote
    ? `${pago.venta.lote.proyecto?.nombre || ''} · ${pago.venta.lote.codigo_lote || ''}`
    : null;

  const txSide = manual ? `
    <div class="pv-side pv-side-transaction" style="justify-content:center;align-items:center;display:flex;flex-direction:column;gap:12px;opacity:.7">
      <div style="font-size:2rem">&#128269;</div>
      <div style="text-align:center;font-size:.85rem;color:var(--text-muted);line-height:1.5">
        Sin cruce bancario automatico.<br>Verifica el baucher adjunto<br>y aprueba manualmente.
      </div>
    </div>` : `
    <div class="pv-side pv-side-transaction">
      <div class="pv-side-title">Transaccion bancaria</div>
      <div class="pv-field"><span class="pv-label">ID</span><span class="pv-value">#${transaction.id_transaction}</span></div>
      <div class="pv-field"><span class="pv-label">Fecha</span><span class="pv-value">${_pvDate(transaction.transaction_date)}</span></div>
      <div class="pv-field ${amount_match ? 'pv-highlight-ok' : ''}"><span class="pv-label">Monto</span><span class="pv-value pv-money">${_pvFmt(transaction.amount)}</span></div>
      <div class="pv-field ${reference_match !== 'none' ? 'pv-highlight-ok' : ''}"><span class="pv-label">Referencia</span><span class="pv-value">${transaction.reference || '<em style="color:var(--text-muted)">sin referencia</em>'}</span></div>
      <div class="pv-field"><span class="pv-label">Descripcion</span><span class="pv-value">${transaction.description}</span></div>
      <div class="pv-field"><span class="pv-label">Banco</span><span class="pv-value" style="text-transform:capitalize">${transaction.bank}</span></div>
    </div>`;

  return `
    <div class="pv-card" id="pv-card-${i}">
      <div class="pv-card-header">
        ${_pvScoreBadge(score, manual)}
        <div class="pv-indicators">
          ${manual ? `
            ${compradorNombre ? `<span class="pv-ind-item" style="font-weight:600">${compradorNombre}</span>` : ''}
            ${loteInfo ? `<span class="pv-ind-item" style="color:var(--text-muted)">${loteInfo}</span>` : ''}
          ` : `
            <span class="pv-ind-item">Monto: ${amount_match
              ? '<span class="pv-match exact" title="Montos iguales">&#10003;</span>'
              : '<span class="pv-match none" title="Montos diferentes">&#10005;</span>'}</span>
            <span class="pv-ind-item">Referencia: ${_pvMatchIcon(reference_match)}</span>
            <span class="pv-ind-item" style="color:var(--text-muted)">Diferencia de fecha: <strong>${date_diff_human || '--'}</strong></span>
          `}
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          ${AppState.can('validacion_pagos', 'crear') ? `<button class="btn btn-sm btn-danger" onclick="pvRejectOne(${pago.id_pago})">Rechazar</button>` : ''}
          <label class="pv-checkbox-wrap">
            <input type="checkbox" class="pv-accept-chk" id="pv-chk-${i}"
              data-pago="${pago.id_pago}" data-tx="${transaction ? transaction.id_transaction : ''}"
              onchange="_pvUpdateCount()">
            <span class="pv-chk-label">Aceptar</span>
          </label>
        </div>
      </div>
      <div class="pv-card-body">
        <div class="pv-side pv-side-payment">
          <div class="pv-side-title">Pago del comprador</div>
          ${compradorNombre ? `<div class="pv-field"><span class="pv-label">Comprador</span><span class="pv-value">${compradorNombre}</span></div>` : ''}
          <div class="pv-field"><span class="pv-label">ID pago</span><span class="pv-value">#${pago.id_pago}</span></div>
          <div class="pv-field"><span class="pv-label">Fecha reporte</span><span class="pv-value">${_pvDate(pago.fecha_pago)}</span></div>
          <div class="pv-field ${amount_match ? 'pv-highlight-ok' : ''}"><span class="pv-label">Valor</span><span class="pv-value pv-money">${_pvFmt(pago.valor_pago)}</span></div>
          <div class="pv-field ${reference_match !== 'none' ? 'pv-highlight-ok' : ''}"><span class="pv-label">Referencia</span><span class="pv-value">${pago.referencia || '<em style="color:var(--text-muted)">sin referencia</em>'}</span></div>
          <div class="pv-field"><span class="pv-label">Metodo</span><span class="pv-value">${pago.metodo_pago}</span></div>
          <div class="pv-field"><span class="pv-label">Cuenta origen</span><span class="pv-value">${pago.numero_cuenta_origen || '--'}</span></div>
          ${baucher}
        </div>
        <div class="pv-divider">
          <div class="pv-divider-line"></div>
          <span class="pv-divider-icon">&#8644;</span>
          <div class="pv-divider-line"></div>
        </div>
        ${txSide}
      </div>
    </div>`;
}

window._pvUpdateCount = function() {
  const checked = document.querySelectorAll('.pv-accept-chk:checked').length;
  const total   = document.querySelectorAll('.pv-accept-chk').length;
  const el = document.getElementById('pv-accept-count');
  if (el) el.textContent = `${checked} de ${total} seleccionados`;
};

window.pvZoomBaucher = function(url) {
  UI.openModal('Baucher de pago', `
    <div style="text-align:center">
      <img src="${url}" alt="Baucher" style="max-width:100%;max-height:70vh;border-radius:8px">
    </div>
    <div class="form-actions">
      <a href="${url}" target="_blank" class="btn btn-ghost">Abrir en nueva pestana</a>
      <button class="btn btn-primary" onclick="UI.closeModal()">Cerrar</button>
    </div>`);
};

window.pvAcceptSelected = async function() {
  const checked = Array.from(document.querySelectorAll('.pv-accept-chk:checked'));
  if (!checked.length) { window.SGIUI?.toast('No hay pagos seleccionados', 'error', 'Sin seleccion'); return; }
  const validations = checked.map(chk => ({
    id_pago:        Number(chk.dataset.pago),
    id_transaction: chk.dataset.tx ? Number(chk.dataset.tx) : null,
  }));
  const btn = document.querySelector('.pv-footer .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }
  try {
    const results        = await API.patch('/pagos/accept-batch', { validations });
    const ok             = results.filter(r => r.ok).length;
    const failed         = results.filter(r => !r.ok);
    const comisionesCausadas = results.filter(r => r.ok && r.comision_causada).length;

    if (failed.length) {
      window.SGIUI?.toast(`${ok} aceptados, ${failed.length} fallidos`, 'error', 'Resultado parcial');
      if (btn) { btn.disabled = false; btn.textContent = 'Aceptar pagos seleccionados'; }
      return;
    }

    // Generate recibos as explicit step so any DB error surfaces immediately
    if (btn) btn.textContent = 'Generando recibos...';
    const rr = await API.post('/recibos/generar-pendientes', {}).catch(e => ({ generados: 0, primer_error: e.message }));

    if (rr.primer_error) {
      window.SGIUI?.toast(`Pago aceptado pero error al generar recibo: ${rr.primer_error}`, 'error', 'Error de recibo');
    } else if (rr.generados > 0) {
      window.SGIUI?.toast(`${ok} pago(s) aceptado(s) · ${rr.generados} recibo(s) generado(s)`, 'success', 'Listo');
    } else {
      window.SGIUI?.toast(`${ok} pago(s) aceptado(s)`, 'success', 'Pagos aprobados');
    }

    if (comisionesCausadas > 0) {
      setTimeout(() => {
        window.SGIUI?.toast(
          `${comisionesCausadas} comisión(es) causada(s) al alcanzar el 30% del valor de venta`,
          'info',
          'Comisiones activadas'
        );
      }, 800);
    }

    window.navigate('recibos', false);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Aceptar pagos seleccionados'; }
    window.SGIUI?.toast(e.message, 'error', 'Error');
  }
};
window.pvRejectOne = function(idPago) {
  UI.openModal('Rechazar pago', `
    <div style="display:flex;flex-direction:column;gap:16px">
      <p style="color:var(--text-muted);font-size:0.875rem">
        El comprador recibirá una notificación y podrá volver a registrar su comprobante.
      </p>
      <div class="form-group">
        <label>Motivo del rechazo (opcional)</label>
        <input id="pv-reject-motivo" type="text" placeholder="Ej: Monto incorrecto, baucher ilegible…" />
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-danger" id="pv-reject-confirm">Rechazar pago</button>
      </div>
    </div>`);

  document.getElementById('pv-reject-confirm')?.addEventListener('click', async () => {
    const motivo = document.getElementById('pv-reject-motivo')?.value.trim() || null;
    const btn = document.getElementById('pv-reject-confirm');
    btn.disabled = true; btn.textContent = 'Rechazando...';
    try {
      await API.patch('/pagos/reject-batch', { pagos: [{ id_pago: idPago, motivo }] });
      UI.closeModal();
      window.SGIUI?.toast('Pago rechazado. El comprador puede volver a registrarlo.', 'success', 'Pago rechazado');
      paymentValidationView();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Rechazar pago';
      window.SGIUI?.toast(e.message, 'error', 'Error');
    }
  });
};

})();