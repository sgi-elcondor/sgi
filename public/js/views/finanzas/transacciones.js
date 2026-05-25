(function () {

// Bank transaction parsers registry
const BANK_PARSERS = { bancolombia: _parseBancolombia };
const BANK_LABELS  = { bancolombia: 'Bancolombia' };
const SPANISH_MONTHS = { ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12 };

function _parseBancolombiaDate(str) {
  const m = str.trim().match(/^(\d{1,2})\s+(\w{3,})\s+(\d{4})$/i);
  if (!m) return null;
  const month = SPANISH_MONTHS[m[2].toLowerCase().slice(0, 3)];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
}

function _parseBancolombiaAmount(str) {
  if (!str) return null;
  const s = str.trim();
  if (s === String.fromCharCode(0x2014) || s === '--' || s === '-') return null;
  const negative  = s.includes('-');
  const digits    = s.replace(/[^0-9,.]/g, '');
  const normalized = digits.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(normalized);
  if (isNaN(val)) return null;
  return negative ? -val : val;
}

function _parseBancolombia(rawText) {
  const rows = rawText.split(/\r?\n/);
  const results = [], errors = [];
  rows.forEach((row, idx) => {
    const trimmed = row.trim();
    if (!trimmed) return;
    const cells = trimmed.split('\t').map(c => c.trim()).filter(c => c !== '');
    if (!cells.length) return;
    if (cells[0].toLowerCase() === 'fecha') return;
    if (cells.length < 2) { errors.push(`Fila ${idx + 1}: muy pocas columnas`); return; }
    const date = _parseBancolombiaDate(cells[0]);
    if (!date) { errors.push(`Fila ${idx + 1}: fecha no reconocida - "${cells[0]}"`); return; }
    const value       = cells[cells.length - 1];
    const amount      = _parseBancolombiaAmount(value);
    const middle      = cells.slice(1, -1);
    const description = middle[0] || '';
    const reference   = middle.length > 1 ? middle.slice(1).join(' ') : null;
    results.push({ transaction_date: date, description, reference: reference || null, amount, _raw: trimmed });
  });
  return { results, errors };
}

function _fmtAmount(amount) {
  if (amount === null || amount === undefined) return '<span style="color:var(--text-muted)">--</span>';
  const abs = Math.abs(amount);
  const fmt = new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(abs);
  const sign = amount < 0 ? '-' : '+';
  const color= amount < 0 ? 'var(--danger)' : 'var(--success)';
  return `<span style="color:${color};font-weight:600">${sign} ${fmt}</span>`;
}

function _fmtDate(d) {
  if (!d) return '--';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}

let _btCurrentTab = 'list', _btImportBank = 'bancolombia', _btImportParsed = [];
let _btSearchTimer = null;

window.bankTransactionsView = async function() {
  const vc        = document.getElementById('viewContainer');
  const canCreate = AppState.can('bank_transactions', 'crear');
  vc.innerHTML    = UI.loader();
  _btCurrentTab = 'list'; _btImportParsed = [];

  vc.innerHTML = `
    <div class="bt-page">
      <div class="table-wrap">
        <div class="table-header">
          <h3>Transacciones Bancarias</h3>
          ${canCreate ? `<button class="btn btn-primary btn-sm" id="bt-tab-btn" onclick="btSwitchTab('import')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Importar</button>` : ""}
        </div>
        <div id="bt-filters" class="bt-filters">
          <select id="btf_bank" class="form-input" onchange="_btLoad()" style="min-width:140px">
            <option value="">Todos los bancos</option><option value="bancolombia">Bancolombia</option>
          </select>
          <input id="btf_from" type="date" class="form-input" onchange="_btLoad()">
          <input id="btf_to"   type="date" class="form-input" onchange="_btLoad()">
          <input id="btf_amin" type="number" class="form-input" onchange="_btLoad()" placeholder="Monto min" style="width:120px">
          <input id="btf_amax" type="number" class="form-input" onchange="_btLoad()" placeholder="Monto max" style="width:120px">
          <div class="bt-search-wrap">
            <input id="btf_search" type="text" class="form-input" placeholder="Buscar descripcion o referencia..." oninput="_btSearchDebounce()" style="min-width:220px">
          </div>
        </div>
        <div id="bt-list-panel">
          <table><thead><tr>
            <th>#</th><th>Banco</th><th>Fecha</th><th>Descripcion</th><th>Referencia</th>
            <th style="text-align:right">Monto</th><th>Pago</th><th>Acciones</th>
          </tr></thead>
          <tbody id="bt-tbody"><tr><td colspan="8" style="text-align:center;padding:16px">${UI.loader()}</td></tr></tbody>
          </table>
        </div>
        <div id="bt-import-panel" style="display:none;padding:0 0 24px">
          <div class="bt-import-inner">
            <div class="form-group" style="margin-bottom:14px">
              <label style="font-weight:600;margin-bottom:6px;display:block">Banco</label>
              <select id="bt_import_bank" class="form-input" onchange="btImportBankChange(this.value)" style="max-width:220px">
                <option value="bancolombia">Bancolombia</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-weight:600;margin-bottom:6px;display:block">Pega el historial de movimientos del banco</label>
              <p class="bt-hint">En Bancolombia: abre el detalle de movimientos, selecciona las filas de la tabla, copia (Ctrl+C) y pega aqui.</p>
              <textarea id="bt_import_text" class="bt-textarea" placeholder="Fecha&#9;Descripcion&#9;Referencia&#9;Valor" oninput="btParsePreview()"></textarea>
            </div>
            <div id="bt-parse-errors" style="display:none" class="bt-errors"></div>
            <div id="bt-preview-wrap" style="display:none">
              <h4 style="margin:18px 0 10px;font-size:14px;font-weight:600">Previsualizacion - <span id="bt-preview-count">0</span> filas</h4>
              <div class="bt-preview-scroll">
                <table class="bt-preview-table">
                  <thead><tr><th>#</th><th>Fecha</th><th>Descripcion</th><th>Referencia</th><th style="text-align:right">Monto</th></tr></thead>
                  <tbody id="bt-preview-tbody"></tbody>
                </table>
              </div>
              <div style="margin-top:16px;display:flex;gap:10px;align-items:center">
                <button class="btn btn-primary" id="bt-confirm-btn" onclick="btConfirmImport()">Confirmar e importar</button>
                <button class="btn btn-ghost" onclick="btClearImport()">Limpiar</button>
                <span id="bt-import-status" style="color:var(--text-muted);font-size:13px"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  await _btLoad();
};

window.btSwitchTab = function(tab) {
  _btCurrentTab = tab;
  const listP = document.getElementById('bt-list-panel');
  const impP  = document.getElementById('bt-import-panel');
  const filt  = document.getElementById('bt-filters');
  const btn   = document.getElementById('bt-tab-btn');
  if (tab === 'import') {
    listP.style.display = 'none'; impP.style.display = 'block'; filt.style.display = 'none';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Ver transacciones'; btn.setAttribute('onclick', "btSwitchTab('list')");
  } else {
    listP.style.display = 'block'; impP.style.display = 'none'; filt.style.display = 'flex';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Importar'; btn.setAttribute('onclick', "btSwitchTab('import')");
    _btLoad();
  }
};

window.btImportBankChange = function(val) { _btImportBank = val; btParsePreview(); };
window._btSearchDebounce  = function() { clearTimeout(_btSearchTimer); _btSearchTimer = setTimeout(_btLoad, 350); };

window._btLoad = async function() {
  const tbody = document.getElementById('bt-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px">${UI.loader()}</td></tr>`;
  const params = new URLSearchParams();
  const bank   = document.getElementById('btf_bank')?.value;
  const from   = document.getElementById('btf_from')?.value;
  const to     = document.getElementById('btf_to')?.value;
  const amin   = document.getElementById('btf_amin')?.value;
  const amax   = document.getElementById('btf_amax')?.value;
  const search = document.getElementById('btf_search')?.value.trim();
  if (bank)   params.set('bank', bank);
  if (from)   params.set('date_from', from);
  if (to)     params.set('date_to', to);
  if (amin)   params.set('amount_min', amin);
  if (amax)   params.set('amount_max', amax);
  if (search) params.set('search', search);
  const qs   = params.toString();
  const data = await API.get(`/bank-transactions${qs ? '?' + qs : ''}`).catch(e => {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--danger);padding:12px">${e.message}</td></tr>`;
    return null;
  });
  if (!data) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--text-muted)">Sin transacciones</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(tx => `
    <tr>
      <td>${tx.id_transaction}</td>
      <td style="text-transform:capitalize">${tx.bank}</td>
      <td style="white-space:nowrap">${_fmtDate(tx.transaction_date)}</td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${tx.description}">${tx.description}</td>
      <td style="color:var(--text-muted);font-size:12px">${tx.reference || '--'}</td>
      <td style="text-align:right">${_fmtAmount(tx.amount)}</td>
      <td>${tx.id_pago
        ? `<span style="font-size:11px;background:#d1fae5;color:var(--success);padding:2px 8px;border-radius:20px;white-space:nowrap">Pago #${tx.id_pago}</span>`
        : '<span style="color:var(--text-muted);font-size:12px">--</span>'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="btEditTx(${tx.id_transaction})">Editar</button>
          ${!tx.id_pago ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="btDeleteTx(${tx.id_transaction})">Eliminar</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
};

window.btParsePreview = function() {
  const text = document.getElementById('bt_import_text')?.value || '';
  const errWrap = document.getElementById('bt-parse-errors'), previewWrap = document.getElementById('bt-preview-wrap');
  if (!text.trim()) {
    errWrap.style.display = 'none'; previewWrap.style.display = 'none'; _btImportParsed = []; return;
  }
  const parser = BANK_PARSERS[_btImportBank];
  if (!parser) return;
  const { results, errors } = parser(text);
  _btImportParsed = results;
  errWrap.style.display = errors.length ? 'block' : 'none';
  if (errors.length) errWrap.innerHTML = errors.map(e => `<div>&#9888; ${e}</div>`).join('');
  if (!results.length) { previewWrap.style.display = 'none'; return; }
  previewWrap.style.display = 'block';
  document.getElementById('bt-preview-count').textContent = results.length;
  document.getElementById('bt-preview-tbody').innerHTML = results.map((r, i) => `
    <tr>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td style="white-space:nowrap">${_fmtDate(r.transaction_date)}</td>
      <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.description}">${r.description}</td>
      <td style="color:var(--text-muted);font-size:12px">${r.reference || '--'}</td>
      <td style="text-align:right">${_fmtAmount(r.amount)}</td>
    </tr>`).join('');
};

window.btClearImport = function() {
  const ta = document.getElementById('bt_import_text'); if (ta) ta.value = '';
  _btImportParsed = [];
  ['bt-parse-errors','bt-preview-wrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  const s = document.getElementById('bt-import-status'); if (s) s.textContent = '';
};

window.btConfirmImport = async function() {
  if (!_btImportParsed.length) return;
  const btn = document.getElementById('bt-confirm-btn'), status = document.getElementById('bt-import-status');
  btn.disabled = true; btn.textContent = 'Importando...';
  try {
    const data = await API.post('/bank-transactions/batch', { bank: _btImportBank, transactions: _btImportParsed });
    window.SGIUI?.toast(`${data.length} transacciones importadas`, 'success', 'Exito');
    btClearImport(); btSwitchTab('list');
  } catch(e) {
    if (status) status.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Confirmar e importar';
  }
};

window.btEditTx = async function(id) {
  const all = await API.get('/bank-transactions').catch(() => null);
  const tx  = all?.find(t => t.id_transaction === id);
  if (!tx) { window.SGIUI?.toast('Transaccion no encontrada', 'error', 'Error'); return; }
  UI.openModal('Editar Transaccion', `
    <div class="form-grid">
      <div class="form-group">
        <label>Fecha *</label>
        <input id="bte_date" type="date" value="${tx.transaction_date}">
      </div>
      <div class="form-group">
        <label>Monto</label>
        <input id="bte_amount" type="number" step="0.01" value="${tx.amount ?? ''}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Descripcion *</label>
        <input id="bte_desc" type="text" value="${tx.description}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Referencia</label>
        <input id="bte_ref" type="text" value="${tx.reference || ''}">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="btSaveTx(${id})">Guardar</button>
    </div>`);
};

window.btSaveTx = async function(id) {
  const date = document.getElementById('bte_date')?.value;
  const desc = document.getElementById('bte_desc')?.value.trim();
  const ref  = document.getElementById('bte_ref')?.value.trim();
  const amt  = document.getElementById('bte_amount')?.value;
  if (!date || !desc) { window.SGIUI?.toast('Fecha y descripcion son obligatorios', 'error', 'Error'); return; }
  try {
    await API.put(`/bank-transactions/${id}`, { transaction_date: date, description: desc, reference: ref || null, amount: amt !== '' ? parseFloat(amt) : null });
    UI.closeModal();
    window.SGIUI?.toast('Transaccion actualizada', 'success', 'Exito');
    _btLoad();
  } catch(e) { window.SGIUI?.toast(e.message, 'error', 'Error'); }
};

window.btDeleteTx = function(id) {
  UI.openModal('Eliminar transaccion', `
    <p style="margin-bottom:20px">Confirmas eliminar esta transaccion? Esta accion no se puede deshacer.</p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" style="background:var(--danger);border-color:var(--danger)" onclick="btDeleteTxConfirm(${id})">Eliminar</button>
    </div>`);
};

window.btDeleteTxConfirm = async function(id) {
  try {
    await API.delete(`/bank-transactions/${id}`);
    UI.closeModal();
    window.SGIUI?.toast('Transaccion eliminada', 'success', 'Exito');
    _btLoad();
  } catch(e) { window.SGIUI?.toast(e.message, 'error', 'Error'); }
};
})();