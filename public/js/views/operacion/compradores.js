(function () {

const DOC_LABEL = { cc: "C.C.", ce: "C.E.", ppt: "PPT", pasaporte: "Pasaporte" };
const PERSONA_LABEL = { natural: "Natural", juridica: "Jurídica" };

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

window.compradoresView = async function () {
  const vc        = document.getElementById("viewContainer");
  const canCreate = AppState.can("compradores", "crear");
  const canEdit   = AppState.can("compradores", "actualizar");
  vc.innerHTML    = UI.loader();

  const data = await API.get("/compradores").catch(e => {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    return null;
  });
  if (!data) return;

  const colCount = canEdit ? 6 : 5;

  const nuevoBtn = canCreate
    ? `<button class="btn btn-primary btn-sm" onclick="compradorForm()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>`
    : "";

  function filaComprador(c) {
    const avatar = c.photo_url
      ? `<img src="${c.photo_url}" class="user-avatar-sm" alt="foto" />`
      : `<div class="user-avatar-icon">${(c.nombres || "?")[0].toUpperCase()}</div>`;
    const nombre = `${c.nombres || ""} ${c.apellidos || ""}`.trim();
    const accionesCell = canEdit
      ? `<td><button class="btn btn-ghost btn-sm btn-comprador-editar" data-id="${c.id_comprador}">Editar</button></td>`
      : "";
    return `
      <tr>
        <td>
          <div class="comprador-cell">
            ${avatar}
            <div class="comprador-cell-info">
              <span class="comprador-cell-name">${nombre || "—"}</span>
              <span class="comprador-cell-mail">${c.mail || "Sin correo"}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="doc-cell">
            <span class="doc-cell-type">${DOC_LABEL[c.tipo_documento] || "—"}</span>
            <span class="doc-cell-number">${c.documento || "—"}</span>
          </div>
        </td>
        <td><span class="chip-neutral">${PERSONA_LABEL[c.tipo_persona] || c.tipo_persona || "—"}</span></td>
        <td>${c.telefono || "—"}</td>
        <td>${UI.badge(c.estado)}</td>
        ${accionesCell}
      </tr>`;
  }

  const estados    = [...new Set(data.map(c => c.estado).filter(Boolean))].sort();
  const optsEstado = estados.map(s => `<option value="${s}">${s}</option>`).join("");

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <div class="table-header-titles">
          <h3>Compradores</h3>
          <span class="count-chip" id="comp-count">${data.length} registros</span>
        </div>
        ${nuevoBtn}
      </div>

      <div class="table-filters">
        <input id="cf-buscar" type="text" class="filter-input"
          placeholder="Buscar por nombre, documento o correo..." style="flex:2;min-width:15rem">
        <select id="cf-persona" class="select-sm" style="flex:1;min-width:9rem">
          <option value="">Todos los tipos</option>
          <option value="natural">Natural</option>
          <option value="juridica">Jurídica</option>
        </select>
        <select id="cf-tipodoc" class="select-sm" style="flex:1;min-width:9rem">
          <option value="">Todo documento</option>
          <option value="cc">Cédula de ciudadanía</option>
          <option value="ce">Cédula de extranjería</option>
          <option value="ppt">PPT</option>
          <option value="pasaporte">Pasaporte</option>
        </select>
        <select id="cf-estado" class="select-sm" style="flex:1;min-width:9rem">
          <option value="">Todos los estados</option>
          ${optsEstado}
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Comprador</th>
            <th>Documento</th>
            <th>Tipo</th>
            <th>Teléfono</th>
            <th>Estado</th>
            ${canEdit ? "<th>Acciones</th>" : ""}
          </tr>
        </thead>
        <tbody id="comp-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("comp-tbody");
  const count = document.getElementById("comp-count");

  function aplicarFiltros() {
    const q       = norm(document.getElementById("cf-buscar").value);
    const persona = document.getElementById("cf-persona").value;
    const tipodoc = document.getElementById("cf-tipodoc").value;
    const estado  = document.getElementById("cf-estado").value;

    const visibles = data.filter(c => {
      if (persona && c.tipo_persona   !== persona) return false;
      if (tipodoc && c.tipo_documento !== tipodoc) return false;
      if (estado  && c.estado         !== estado)  return false;
      if (q && !norm(`${c.nombres} ${c.apellidos} ${c.documento} ${c.mail}`).includes(q)) return false;
      return true;
    });

    if (visibles.length) {
      tbody.innerHTML = visibles.map(filaComprador).join("");
    } else {
      const msg = data.length
        ? "No hay compradores que coincidan con los filtros."
        : "No hay compradores registrados.";
      tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-row">${msg}</td></tr>`;
    }
    count.textContent = `${visibles.length} ${visibles.length === 1 ? "registro" : "registros"}`;
  }

  ["cf-persona", "cf-tipodoc", "cf-estado"].forEach(id =>
    document.getElementById(id).addEventListener("change", aplicarFiltros));
  document.getElementById("cf-buscar").addEventListener("input", aplicarFiltros);

  if (canEdit) {
    tbody.addEventListener("click", e => {
      const btn = e.target.closest(".btn-comprador-editar");
      if (!btn) return;
      const c = data.find(x => String(x.id_comprador) === btn.dataset.id);
      if (c) compradorForm(c);
    });
  }

  aplicarFiltros();
};

window.compradorForm = function (comprador) {
  const c      = comprador || {};
  const isEdit = !!c.id_comprador;
  const opt    = (val, current, label) =>
    `<option value="${val}" ${val === current ? "selected" : ""}>${label}</option>`;

  UI.openModal(isEdit ? "Editar Comprador" : "Nuevo Comprador", `
    <div class="modal-form">
      <div class="form-section">
        <span class="form-section-label">Identificación</span>
        <div class="form-grid">
          <div class="form-group">
            <label>Tipo de persona *</label>
            <select id="f_tipo">
              ${opt("natural",  c.tipo_persona, "Natural")}
              ${opt("juridica", c.tipo_persona, "Jurídica")}
            </select>
          </div>
          <div class="form-group">
            <label>Tipo de documento *</label>
            <select id="f_tipodoc">
              ${opt("cc",        c.tipo_documento, "Cédula de ciudadanía")}
              ${opt("ce",        c.tipo_documento, "Cédula de extranjería")}
              ${opt("ppt",       c.tipo_documento, "Permiso por Protección Temporal (PPT)")}
              ${opt("pasaporte", c.tipo_documento, "Pasaporte")}
            </select>
          </div>
          <div class="form-group"><label>Documento *</label><input id="f_doc" placeholder="Número de documento" value="${escAttr(c.documento)}" /></div>
          <div class="form-group"><label>Nombres *</label><input id="f_nom" placeholder="Nombres" value="${escAttr(c.nombres)}" /></div>
          <div class="form-group form-group--full"><label>Apellidos</label><input id="f_ape" placeholder="Apellidos" value="${escAttr(c.apellidos)}" /></div>
        </div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Contacto</span>
        <div class="form-grid">
          <div class="form-group"><label>Teléfono</label><input id="f_tel" placeholder="Número de teléfono" value="${escAttr(c.telefono)}" /></div>
          <div class="form-group"><label>Email</label><input id="f_mail" type="email" placeholder="correo@ejemplo.com" value="${escAttr(c.mail)}" /></div>
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarComprador(${isEdit ? c.id_comprador : ""})">${isEdit ? "Guardar cambios" : "Guardar"}</button>
    </div>`);
};

window.guardarComprador = async function (id) {
  const documento = document.getElementById("f_doc").value.trim();
  const nombres   = document.getElementById("f_nom").value.trim();

  if (!documento) return UI.toast("El documento es obligatorio", "error");
  if (!nombres)   return UI.toast("Los nombres son obligatorios", "error");

  const body = {
    tipo_persona:   document.getElementById("f_tipo").value,
    tipo_documento: document.getElementById("f_tipodoc").value,
    documento,
    nombres,
    apellidos: document.getElementById("f_ape").value.trim(),
    telefono:  document.getElementById("f_tel").value.trim(),
    mail:      document.getElementById("f_mail").value.trim(),
  };

  try {
    if (id) {
      await API.put(`/compradores/${id}`, body);
      UI.toast("Comprador actualizado", "ok");
    } else {
      await API.post("/compradores", body);
      UI.toast("Comprador creado", "ok");
    }
    UI.closeModal();
    compradoresView();
  } catch (e) {
    UI.toast(e.message, "error");
  }
};

})();
