(function () {

const DOC_LABEL     = { cc: "C.C.", ce: "C.E.", ppt: "PPT", pasaporte: "Pasaporte" };
const PERSONA_LABEL = { natural: "Natural", juridica: "Jurídica" };
const RANGO_LABEL   = { primera_quincena: "Q1 · 1–15", segunda_quincena: "Q2 · 16–30", otro: "Otro" };

let _mailTimer           = null;
let _selectedUserId      = null;
let _selectedUserBlocked = false;

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function rangoBadge(rango) {
  if (!rango) return `<span class="chip-neutral" style="font-size:.7rem;padding:.15rem .5rem">—</span>`;
  const color = rango === "primera_quincena" ? "var(--info)" : rango === "segunda_quincena" ? "var(--accent)" : "var(--text-muted)";
  return `<span style="font-size:.7rem;font-weight:600;padding:.15rem .55rem;border-radius:99px;background:${color}1a;color:${color};border:1px solid ${color}33">${RANGO_LABEL[rango] || rango}</span>`;
}

function accessBadge(c) {
  if (c.has_access)
    return `<span class="badge badge-success comprador-access-badge">Con acceso</span>`;
  if (c.linked_email)
    return `<span class="badge badge-warning comprador-access-badge">Sin ingresar</span>`;
  return `<span class="badge badge-muted comprador-access-badge">Sin cuenta</span>`;
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

  const colCount = canEdit ? 7 : 6;

  const nuevoBtn = canCreate
    ? `<button class="btn btn-primary btn-sm" onclick="compradorForm()">
         <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
           <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
         </svg> Nuevo
       </button>`
    : "";

  function filaComprador(c) {
    const avatar = c.photo_url
      ? `<img src="${c.photo_url}" class="user-avatar-sm" alt="foto" />`
      : `<div class="user-avatar-icon">${(c.nombres || "?")[0].toUpperCase()}</div>`;
    const nombre = `${c.nombres || ""} ${c.apellidos || ""}`.trim();
    const accionesCell = canEdit
      ? `<td><button class="btn btn-ghost btn-sm btn-comprador-editar" data-id="${c.id_usuario}">Editar</button></td>`
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
            ${accessBadge(c)}
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
        <td>${rangoBadge(c.rango_pago)}</td>
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
        <select id="cf-rango" class="select-sm" style="flex:1;min-width:10rem">
          <option value="">Todas las quincenas</option>
          <option value="primera_quincena">Q1 · 1–15</option>
          <option value="segunda_quincena">Q2 · 16–30</option>
          <option value="otro">Otro</option>
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
            <th>Quincena</th>
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
    const rango   = document.getElementById("cf-rango").value;
    const estado  = document.getElementById("cf-estado").value;

    const visibles = data.filter(c => {
      if (persona && c.tipo_persona   !== persona) return false;
      if (tipodoc && c.tipo_documento !== tipodoc) return false;
      if (rango   && c.rango_pago     !== rango)   return false;
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

  ["cf-persona", "cf-tipodoc", "cf-rango", "cf-estado"].forEach(id =>
    document.getElementById(id).addEventListener("change", aplicarFiltros));
  document.getElementById("cf-buscar").addEventListener("input", aplicarFiltros);

  if (canEdit) {
    tbody.addEventListener("click", e => {
      const btn = e.target.closest(".btn-comprador-editar");
      if (!btn) return;
      const c = data.find(x => String(x.id_usuario) === btn.dataset.id);
      if (c) compradorForm(c);
    });
  }

  aplicarFiltros();
};

window.compradorForm = function (comprador) {
  _mailTimer           = null;
  _selectedUserId      = null;
  _selectedUserBlocked = false;

  const c      = comprador || {};
  const isEdit = !!c.id_usuario;
  const opt    = (val, current, label) =>
    `<option value="${val}" ${val === current ? "selected" : ""}>${label}</option>`;

  const linkedAccountInfo = isEdit
    ? (c.linked_email
        ? `<div class="form-note" style="margin-top:.25rem;display:flex;align-items:center;gap:.5rem;">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2.5"
                  stroke-linecap="round" stroke-linejoin="round">
               <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
             </svg>
             Cuenta: <strong>${escAttr(c.linked_email)}</strong>
             ${c.has_access
               ? `<span class="badge badge-success" style="margin-left:.25rem">Con acceso</span>`
               : `<span class="badge badge-warning" style="margin-left:.25rem">Sin ingresar</span>`}
           </div>`
        : `<div class="form-note" style="margin-top:.25rem;color:var(--text-muted)">Sin cuenta de plataforma asociada.</div>`)
    : "";

  const mailField = isEdit
    ? `<div class="form-group form-group--full">
         <label>Email${c.linked_email ? ` <span style="color:var(--text-muted);font-size:.7rem;font-weight:400">(correo de acceso)</span>` : ""}</label>
         <input id="f_mail" type="email" placeholder="correo@ejemplo.com"
           value="${escAttr(c.mail)}"
           ${c.linked_email ? `readonly style="background:var(--surface-2);color:var(--text-muted);cursor:not-allowed"` : ""} />
         ${linkedAccountInfo}
       </div>`
    : `<div class="form-group form-group--full" style="position:relative">
         <label>Email * <span style="color:var(--text-muted);font-size:.7rem;font-weight:400">(requerido para acceso a la plataforma)</span></label>
         <input id="f_mail" type="email" placeholder="correo@ejemplo.com"
           autocomplete="off" oninput="onCompradorMailInput()" />
         <div id="f_mail_suggestions" class="user-search-dropdown" style="display:none;"></div>
         <div id="f_mail_preview" style="display:none;margin-top:.375rem;"></div>
       </div>`;

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
          <div class="form-group">
            <label>Documento *</label>
            <input id="f_doc" placeholder="Número de documento" value="${escAttr(c.documento)}" />
          </div>
          <div class="form-group">
            <label>Nombres *</label>
            <input id="f_nom" placeholder="Nombres" value="${escAttr(c.nombres)}" />
          </div>
          <div class="form-group form-group--full">
            <label>Apellidos</label>
            <input id="f_ape" placeholder="Apellidos" value="${escAttr(c.apellidos)}" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <span class="form-section-label">Contacto y acceso</span>
        <div class="form-grid">
          <div class="form-group">
            <label>Teléfono</label>
            <input id="f_tel" placeholder="Número de teléfono" value="${escAttr(c.telefono)}" />
          </div>
          <div class="form-group">
            <label>Quincena de pago</label>
            <select id="f_rango">
              ${opt("", c.rango_pago, "Sin asignar")}
              ${opt("primera_quincena", c.rango_pago, "Primera quincena (1–15)")}
              ${opt("segunda_quincena", c.rango_pago, "Segunda quincena (16–30)")}
              ${opt("otro", c.rango_pago, "Otro")}
            </select>
          </div>
          ${mailField}
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarComprador(${isEdit ? c.id_usuario : ""})">${isEdit ? "Guardar cambios" : "Guardar"}</button>
    </div>`);
};

window.onCompradorMailInput = function () {
  clearTimeout(_mailTimer);
  _selectedUserId      = null;
  _selectedUserBlocked = false;

  const val          = (document.getElementById("f_mail")?.value || "").trim();
  const suggestionsEl = document.getElementById("f_mail_suggestions");
  const previewEl     = document.getElementById("f_mail_preview");

  if (previewEl) previewEl.style.display = "none";

  if (val.length < 3) {
    if (suggestionsEl) suggestionsEl.style.display = "none";
    return;
  }

  _mailTimer = setTimeout(async () => {
    if (!suggestionsEl) return;
    suggestionsEl.innerHTML = `<div class="user-search-msg">Buscando...</div>`;
    suggestionsEl.style.display = "block";

    try {
      const results = await API.get(`/compradores/buscar-usuario?q=${encodeURIComponent(val)}`);

      if (!results.length) {
        suggestionsEl.innerHTML =
          `<div class="user-search-msg">
             No hay usuarios registrados con ese correo. Se creará una cuenta nueva al guardar.
           </div>`;
        return;
      }

      suggestionsEl.innerHTML = results.map(u =>
        `<div class="user-search-item"
              data-uid="${u.id_usuario}"
              data-email="${escAttr(u.email)}"
              data-blocked="${!!u.is_comprador}"
              onclick="seleccionarUsuarioParaComprador(this)">
           <span style="pointer-events:none">${escAttr(u.email)}</span>
           ${u.is_comprador
             ? `<span class="badge badge-warning" style="pointer-events:none">Ya tiene comprador</span>`
             : `<span class="badge badge-success" style="pointer-events:none">Disponible</span>`}
         </div>`
      ).join("");
    } catch (_) {
      suggestionsEl.innerHTML =
        `<div class="user-search-msg" style="color:var(--danger)">Error al buscar usuarios.</div>`;
    }
  }, 400);
};

window.seleccionarUsuarioParaComprador = function (el) {
  const idUsuario      = parseInt(el.dataset.uid);
  const email          = el.dataset.email;
  const tieneComprador = el.dataset.blocked === "true";

  _selectedUserId      = idUsuario;
  _selectedUserBlocked = tieneComprador;

  const mailInput     = document.getElementById("f_mail");
  const suggestionsEl = document.getElementById("f_mail_suggestions");
  const previewEl     = document.getElementById("f_mail_preview");

  if (mailInput)     mailInput.value = email;
  if (suggestionsEl) suggestionsEl.style.display = "none";
  if (!previewEl)    return;

  previewEl.style.display = "block";
  previewEl.innerHTML = tieneComprador
    ? `<div class="form-error" style="margin-top:0">Este usuario ya tiene un perfil de comprador vinculado.</div>`
    : `<div class="form-note" style="margin-top:0;border-color:rgba(var(--success-rgb),.3);background:rgba(var(--success-rgb),.06);color:var(--success)">
         Usuario registrado encontrado — se vinculará automáticamente al guardar.
       </div>`;
};

window.guardarComprador = async function (id) {
  const documento = document.getElementById("f_doc").value.trim();
  const nombres   = document.getElementById("f_nom").value.trim();
  const mail      = document.getElementById("f_mail").value.trim();

  if (!documento) return UI.toast("El documento es obligatorio", "error");
  if (!nombres)   return UI.toast("Los nombres son obligatorios", "error");
  if (!id && !mail) return UI.toast("El correo es obligatorio para registrar un comprador", "error");
  if (!id && _selectedUserBlocked)
    return UI.toast("Ese usuario ya tiene un comprador vinculado. Usa un correo diferente.", "error");

  const body = {
    tipo_persona:   document.getElementById("f_tipo").value,
    tipo_documento: document.getElementById("f_tipodoc").value,
    documento,
    nombres,
    apellidos:  document.getElementById("f_ape").value.trim(),
    telefono:   document.getElementById("f_tel").value.trim(),
    mail,
    rango_pago: document.getElementById("f_rango").value || null,
  };

  try {
    if (id) {
      await API.put(`/compradores/${id}`, body);
      UI.toast("Comprador actualizado", "ok");
      UI.closeModal();
      compradoresView();
    } else {
      const result = await API.post("/compradores", body);
      UI.toast("Comprador creado", "ok");
      UI.closeModal();
      if (result.access_link) {
        mostrarEnlaceAcceso(result.access_link, mail);
      } else {
        compradoresView();
      }
    }
  } catch (e) {
    UI.toast(e.message, "error");
  }
};

function mostrarEnlaceAcceso(link, email) {
  UI.openModal("Enlace de primer acceso", `
    <p style="margin:0 0 .875rem;font-size:.875rem;color:var(--text-muted)">
      Comparte este enlace con <strong style="color:var(--text)">${escAttr(email)}</strong>
      para que establezca su contraseña e ingrese a la plataforma.
    </p>
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.625rem">
      <input id="access-link-input" type="text" value="${escAttr(link)}" readonly
        style="flex:1;padding:.5625rem .75rem;border:1px solid var(--border);
               border-radius:.75rem;background:var(--surface-2);color:var(--text-muted);
               font-size:.75rem;font-family:monospace;outline:none;" />
      <button class="btn btn-primary btn-sm" onclick="copiarEnlaceAcceso()" style="flex-shrink:0">Copiar</button>
    </div>
    <p style="margin:0 0 .5rem;font-size:.75rem;color:var(--warning);display:flex;align-items:center;gap:.375rem">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Este enlace expira en 1 hora. Compártelo de inmediato.
    </p>
    <p style="margin:0;font-size:.75rem;color:var(--text-muted)">
      Después de establecer su contraseña, el comprador debe ingresar en:
      <strong>${window.location.origin}</strong>
    </p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal(); compradoresView()">Cerrar</button>
    </div>`);
}

window.copiarEnlaceAcceso = function () {
  const input = document.getElementById("access-link-input");
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => UI.toast("Enlace copiado", "ok"));
};

})();
