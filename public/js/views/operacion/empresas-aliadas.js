(function () {

const TIPO_LABEL = {
  proveedor:   { label: "Proveedor",   cls: "badge-info"    },
  socio:       { label: "Socio",       cls: "badge-success" },
  contratista: { label: "Contratista", cls: "badge-warning" },
  otro:        { label: "Otro",        cls: "badge-muted"   },
};

const icon     = (name) => window.SGIUI?.icon(name) ?? "";
const fmtMoney = n => Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtDate  = d => d ? new Date(String(d).slice(0, 10) + "T12:00:00").toLocaleDateString("es-CO") : "—";

let _empresas = [];
const _filtros = { q: "", tipo: "", estado: "" };

function esc(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Mirror of the backend DIAN check-digit (empresas.service.js) for instant feedback.
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
function computeNitDv(nitBase) {
  const digits = String(nitBase).split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * (NIT_WEIGHTS[i] || 0);
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
}

window.empresasAliadasView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  try {
    _empresas = await API.get("/empresas-aliadas");
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }
  _empresas = _empresas || [];

  render(vc);
};

function render(vc) {
  const canCreate = AppState.can("empresas_aliadas", "crear");
  const canEdit   = AppState.can("empresas_aliadas", "actualizar");

  const activas      = _empresas.filter(e => e.activo).length;
  const proveedores  = _empresas.filter(e => e.tipo === "proveedor" && e.activo).length;

  vc.innerHTML = `
    <section class="page-shell">
      ${window.SGIUI?.pageHeader({
        kicker:   "Operación",
        title:    "Empresas Aliadas",
        subtitle: "Proveedores, socios y contratistas con su RUP y códigos identificadores, para asociarlos a gastos y requerimientos.",
        actions:  canCreate ? `<button class="btn btn-primary" id="btn-nueva-empresa">${icon("plus")} Registrar empresa</button>` : "",
        meta:     _empresas.length ? `<span class="results-chip">${icon("building-2")} ${_empresas.length} registrada(s)</span>` : "",
      }) ?? ""}

      <div class="req-kpi-row">
        <div class="req-kpi">
          <span class="req-kpi-icon">${icon("building-2")}</span>
          <div><span class="req-kpi-val">${_empresas.length}</span><span class="req-kpi-label">Registradas</span></div>
        </div>
        <div class="req-kpi success">
          <span class="req-kpi-icon">${icon("check-circle")}</span>
          <div><span class="req-kpi-val">${activas}</span><span class="req-kpi-label">Activas</span></div>
        </div>
        <div class="req-kpi accent">
          <span class="req-kpi-icon">${icon("truck")}</span>
          <div><span class="req-kpi-val">${proveedores}</span><span class="req-kpi-label">Proveedores activos</span></div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-filters">
          <input id="emp-buscar" type="text" class="filter-input"
            placeholder="Buscar por razón social, NIT o RUP..." style="flex:2;min-width:18rem">
          <select id="emp-tipo" class="select-sm" style="flex:1;min-width:9rem">
            <option value="">Todos los tipos</option>
            ${Object.entries(TIPO_LABEL).map(([v, t]) => `<option value="${v}">${t.label}</option>`).join("")}
          </select>
          <select id="emp-estado" class="select-sm" style="flex:1;min-width:8rem">
            <option value="">Todas</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
          </select>
        </div>

        <table class="req-table">
          <thead>
            <tr>
              <th>Razón social</th>
              <th>NIT</th>
              <th>RUP</th>
              <th>Códigos de actividad</th>
              <th>Contacto</th>
              <th>Tipo</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="emp-tbody"></tbody>
        </table>
      </div>
    </section>`;

  const tbody = document.getElementById("emp-tbody");

  function fila(e) {
    const tipo = TIPO_LABEL[e.tipo] || TIPO_LABEL.otro;
    const codigos = (e.codigos_actividad || []).slice(0, 3).map(c => `<span class="req-chip-items">${esc(c)}</span>`).join(" ")
      + ((e.codigos_actividad || []).length > 3 ? ` <span class="req-chip-items">+${e.codigos_actividad.length - 3}</span>` : "");
    return `
      <tr class="req-row ${e.activo ? "" : "emp-inactiva"}">
        <td class="req-td-main">
          <div class="rec-num">${esc(e.razon_social)}</div>
          ${e.ciudad ? `<div class="rec-desc">${esc(e.ciudad)}</div>` : ""}
        </td>
        <td data-label="NIT">${esc(e.nit)}</td>
        <td data-label="RUP">${esc(e.rup)}</td>
        <td data-label="Códigos">${codigos || "—"}</td>
        <td data-label="Contacto">
          ${e.contacto_nombre ? `<div>${esc(e.contacto_nombre)}</div>` : ""}
          ${e.contacto_telefono || e.contacto_email ? `<div class="rec-desc">${esc([e.contacto_telefono, e.contacto_email].filter(Boolean).join(" · "))}</div>` : (e.contacto_nombre ? "" : "—")}
        </td>
        <td data-label="Tipo">
          <span class="badge ${tipo.cls}">${tipo.label}</span>
          ${e.activo ? "" : `<span class="badge badge-danger" style="margin-left:.3rem">Inactiva</span>`}
        </td>
        <td class="req-td-actions">
          <div class="req-actions">
            <button class="btn btn-ghost btn-sm btn-emp-detalle" data-id="${e.id_empresa}">Historial</button>
            ${AppState.can("empresas_aliadas", "actualizar") ? `<button class="btn btn-ghost btn-sm btn-emp-editar" data-id="${e.id_empresa}" title="Editar">${icon("pencil")}</button>` : ""}
          </div>
        </td>
      </tr>`;
  }

  function aplicarFiltros() {
    const q      = (document.getElementById("emp-buscar").value || "").trim();
    const tipo   = document.getElementById("emp-tipo").value;
    const estado = document.getElementById("emp-estado").value;
    Object.assign(_filtros, { q, tipo, estado });

    const visibles = _empresas.filter(e => {
      if (tipo && e.tipo !== tipo) return false;
      if (estado === "activa"   && !e.activo) return false;
      if (estado === "inactiva" &&  e.activo) return false;
      if (q) {
        if (window.SGISearch?.matches) {
          if (!SGISearch.matches(q, e.razon_social, e.nit, e.rup, e.ciudad, e.contacto_nombre)) return false;
        } else if (!`${e.razon_social} ${e.nit} ${e.rup}`.toLowerCase().includes(q.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    if (visibles.length) {
      tbody.innerHTML = visibles.map(fila).join("");
    } else {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="req-empty">
            <div class="req-empty-icon">${icon("building-2")}</div>
            <p class="req-empty-title">${_empresas.length ? "Nada coincide con los filtros" : "Aún no hay empresas registradas"}</p>
            <p class="req-empty-sub">${_empresas.length ? "Ajusta la búsqueda o los filtros." : "Registra proveedores y socios para asociarlos a gastos y requerimientos."}</p>
          </div>
        </td></tr>`;
    }
    window.SGIUI?.hydrate();
  }

  document.getElementById("emp-buscar").value = _filtros.q;
  document.getElementById("emp-tipo").value   = _filtros.tipo;
  document.getElementById("emp-estado").value = _filtros.estado;
  document.getElementById("emp-buscar").addEventListener("input",  aplicarFiltros);
  document.getElementById("emp-tipo").addEventListener("change",   aplicarFiltros);
  document.getElementById("emp-estado").addEventListener("change", aplicarFiltros);

  document.getElementById("btn-nueva-empresa")?.addEventListener("click", () => abrirModalEmpresa(null));

  tbody.addEventListener("click", e => {
    const btn = e.target.closest(".btn-emp-detalle, .btn-emp-editar");
    if (!btn) return;
    const emp = _empresas.find(x => String(x.id_empresa) === btn.dataset.id);
    if (!emp) return;
    if (btn.classList.contains("btn-emp-editar")) abrirModalEmpresa(emp);
    else abrirHistorial(emp);
  });

  aplicarFiltros();
  window.SGIUI?.hydrate();
}

// ─────────────────────────────────────────────────────────────────────────────
// Registro / edición (ALI-01)
// ─────────────────────────────────────────────────────────────────────────────
function abrirModalEmpresa(emp) {
  const esEdicion = !!emp;

  UI.openModal(esEdicion ? `Editar · ${emp.razon_social}` : "Registrar empresa aliada", `
    <div class="rec-modal">
      <div class="form-section">
        <span class="form-section-label">Identificación</span>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Razón social *</label>
            <input id="emp-razon" type="text" placeholder="Ej: Ferretería El Tornillo S.A.S." value="${esc(emp?.razon_social)}">
          </div>
          <div class="form-group">
            <label>NIT *</label>
            <input id="emp-nit" type="text" placeholder="900123456-7" value="${esc(emp?.nit)}">
            <div id="emp-nit-hint" class="rec-hint" style="margin:.25rem 0 0"></div>
          </div>
          <div class="form-group">
            <label>RUP (n° de inscripción) *</label>
            <input id="emp-rup" type="text" inputmode="numeric" placeholder="Ej: 123456" value="${esc(emp?.rup)}">
          </div>
          <div class="form-group">
            <label>Tipo *</label>
            <select id="emp-tipo-sel">
              ${Object.entries(TIPO_LABEL).map(([v, t]) => `<option value="${v}" ${emp?.tipo === v ? "selected" : ""}>${t.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Códigos de actividad (UNSPSC/CIIU)</label>
            <input id="emp-codigos" type="text" placeholder="Separados por coma. Ej: 30111601, 4390"
              value="${esc((emp?.codigos_actividad || []).join(", "))}">
          </div>
        </div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Datos de contacto</span>
        <div class="form-grid">
          <div class="form-group"><label>Nombre de contacto</label><input id="emp-cont-nombre" type="text" value="${esc(emp?.contacto_nombre)}"></div>
          <div class="form-group"><label>Teléfono</label><input id="emp-cont-tel" type="text" value="${esc(emp?.contacto_telefono)}"></div>
          <div class="form-group"><label>Email</label><input id="emp-cont-email" type="email" value="${esc(emp?.contacto_email)}"></div>
          <div class="form-group"><label>Ciudad</label><input id="emp-ciudad" type="text" value="${esc(emp?.ciudad)}"></div>
          <div class="form-group form-group--full"><label>Dirección</label><input id="emp-direccion" type="text" value="${esc(emp?.direccion)}"></div>
          <div class="form-group form-group--full"><label>Notas</label><textarea id="emp-notas" rows="2">${esc(emp?.notas)}</textarea></div>
          ${esEdicion ? `
          <div class="form-group">
            <label>Estado</label>
            <select id="emp-activo">
              <option value="1" ${emp.activo ? "selected" : ""}>Activa</option>
              <option value="0" ${emp.activo ? "" : "selected"}>Inactiva</option>
            </select>
          </div>` : ""}
        </div>
      </div>

      <div id="emp-error" class="form-error" style="display:none"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="emp-submit">${esEdicion ? "Guardar cambios" : "Registrar empresa"}</button>
    </div>
  `);
  window.SGIUI?.hydrate();

  // Live NIT check-digit feedback (ALI-01: "el sistema valida el formato").
  const nitInput = document.getElementById("emp-nit");
  const nitHint  = document.getElementById("emp-nit-hint");
  nitInput.addEventListener("input", () => {
    const nit = nitInput.value.replace(/[.\s]/g, "");
    const m = nit.match(/^(\d{5,15})-(\d)$/);
    if (!m) { nitHint.textContent = ""; return; }
    const dvOk = computeNitDv(m[1]) === Number(m[2]);
    nitHint.innerHTML = dvOk
      ? `<span style="color:var(--success)">Dígito de verificación correcto.</span>`
      : `<span style="color:var(--danger)">DV incorrecto: para ${m[1]} debería ser ${computeNitDv(m[1])}.</span>`;
  });

  document.getElementById("emp-submit").addEventListener("click", () => guardarEmpresa(emp));
}

async function guardarEmpresa(emp) {
  const errorEl = document.getElementById("emp-error");
  errorEl.style.display = "none";
  function fallar(msg) { errorEl.textContent = msg; errorEl.style.display = "block"; }

  const razon   = document.getElementById("emp-razon").value.trim();
  const nit     = document.getElementById("emp-nit").value.trim();
  const rup     = document.getElementById("emp-rup").value.trim();
  const codigos = document.getElementById("emp-codigos").value.trim();

  if (razon.length < 3)       return fallar("La razón social es obligatoria.");
  if (!/^[\d.\s]+(-\d)?$/.test(nit)) return fallar("NIT inválido: usa solo dígitos, opcionalmente con dígito de verificación (ej: 900123456-7).");
  if (!/^\d{4,15}$/.test(rup))       return fallar("RUP inválido: se espera el número de inscripción (solo dígitos, entre 4 y 15).");

  const payload = {
    razon_social:      razon,
    nit,
    rup,
    codigos_actividad: codigos ? codigos.split(",").map(c => c.trim()).filter(Boolean) : [],
    tipo:              document.getElementById("emp-tipo-sel").value,
    contacto_nombre:   document.getElementById("emp-cont-nombre").value.trim() || null,
    contacto_telefono: document.getElementById("emp-cont-tel").value.trim() || null,
    contacto_email:    document.getElementById("emp-cont-email").value.trim() || null,
    ciudad:            document.getElementById("emp-ciudad").value.trim() || null,
    direccion:         document.getElementById("emp-direccion").value.trim() || null,
    notas:             document.getElementById("emp-notas").value.trim() || null,
  };
  if (emp) payload.activo = document.getElementById("emp-activo").value === "1";

  const btn = document.getElementById("emp-submit");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    if (emp) {
      await API.put(`/empresas-aliadas/${emp.id_empresa}`, payload);
      UI.toast(`${razon} actualizada.`, "ok");
    } else {
      await API.post("/empresas-aliadas", payload);
      UI.toast(`${razon} registrada como empresa aliada.`, "ok");
    }
    UI.closeModal();
    window.empresasAliadasView();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = emp ? "Guardar cambios" : "Registrar empresa";
    fallar(e.message || "No se pudo guardar la empresa.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Historial comercial (ALI-02)
// ─────────────────────────────────────────────────────────────────────────────
async function abrirHistorial(emp) {
  let det;
  try {
    det = await API.get(`/empresas-aliadas/${emp.id_empresa}`);
  } catch (e) {
    return UI.toast(e.message || "No se pudo cargar el historial.", "error");
  }

  const h = det.historial || { gastos: [], requerimientos: [], total_gastos: 0, operaciones: 0 };
  const tipo = TIPO_LABEL[det.tipo] || TIPO_LABEL.otro;

  const gastosHTML = h.gastos.length ? `
    <table class="rec-items-table">
      <thead><tr><th>Fecha</th><th>Descripción</th><th>Proyecto</th><th class="req-td-right">Valor</th></tr></thead>
      <tbody>
        ${h.gastos.map(g => `
          <tr>
            <td>${fmtDate(g.fecha)}</td>
            <td>${esc(g.descripcion)}</td>
            <td>${esc(g.proyecto || "—")}</td>
            <td class="req-td-right">${fmtMoney(g.valor)}</td>
          </tr>`).join("")}
      </tbody>
    </table>` : `<p class="rec-hint">Sin gastos vinculados.</p>`;

  const reqsHTML = h.requerimientos.length ? `
    <table class="rec-items-table">
      <thead><tr><th>N°</th><th>Descripción</th><th>Desembolso</th><th class="req-td-right">Pagado</th></tr></thead>
      <tbody>
        ${h.requerimientos.map(r => `
          <tr>
            <td>${esc(r.numero)}</td>
            <td>${esc(r.descripcion)}</td>
            <td>${fmtDate(r.fecha_desembolso)}</td>
            <td class="req-td-right">${fmtMoney(r.valor_desembolsado)}</td>
          </tr>`).join("")}
      </tbody>
    </table>` : `<p class="rec-hint">Sin requerimientos vinculados.</p>`;

  UI.openModal(`Historial · ${det.razon_social}`, `
    <div class="rec-modal">
      <div class="rec-modal-summary">
        <div class="rec-summary-item"><span class="lbl">NIT</span><span class="val">${esc(det.nit)}</span></div>
        <div class="rec-summary-item"><span class="lbl">RUP</span><span class="val">${esc(det.rup)}</span></div>
        <div class="rec-summary-item"><span class="lbl">Tipo</span><span class="val"><span class="badge ${tipo.cls}">${tipo.label}</span></span></div>
        <div class="rec-summary-item"><span class="lbl">Total en gastos</span><span class="val">${fmtMoney(h.total_gastos)}</span></div>
      </div>

      ${(det.codigos_actividad || []).length ? `
      <div class="form-section">
        <span class="form-section-label">Códigos de actividad</span>
        <div>${det.codigos_actividad.map(c => `<span class="req-chip-items">${esc(c)}</span>`).join(" ")}</div>
      </div>` : ""}

      <div class="form-section">
        <span class="form-section-label">Gastos vinculados (${h.gastos.length})</span>
        ${gastosHTML}
      </div>

      <div class="form-section">
        <span class="form-section-label">Requerimientos desembolsados (${h.requerimientos.length})</span>
        ${reqsHTML}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="UI.closeModal()">Cerrar</button>
    </div>
  `);
  window.SGIUI?.hydrate();
}

// Shared helper (ALI-02): wires a text input + datalist as an empresa
// autocomplete. Returns { getId } resolving the selected empresa id.
async function wireEmpresaAutocomplete(inputId, datalistId, preselectedId) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById(datalistId);
  if (!input || !list) return { getId: () => null };

  let empresas = [];
  try {
    empresas = await API.getCached("/empresas-aliadas?activas=1", { ttl: 60000 }) || [];
  } catch (_) { /* catalog unavailable: field stays free-text */ }

  list.innerHTML = empresas
    .map(e => `<option value="${esc(e.razon_social)} — NIT ${esc(e.nit)}"></option>`)
    .join("");

  if (preselectedId) {
    const pre = empresas.find(e => e.id_empresa === Number(preselectedId));
    if (pre) input.value = `${pre.razon_social} — NIT ${pre.nit}`;
  }

  return {
    getId() {
      const val = (input.value || "").trim();
      if (!val) return null;
      const match = empresas.find(e => `${e.razon_social} — NIT ${e.nit}` === val)
        || empresas.find(e => e.razon_social.toLowerCase() === val.toLowerCase())
        || empresas.find(e => e.nit === val);
      return match ? match.id_empresa : null;
    },
  };
}

window.SGIEmpresas = { wireEmpresaAutocomplete, computeNitDv };

})();
