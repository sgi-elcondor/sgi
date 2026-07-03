(function () {

const DOC_LABEL     = { cc: "C.C.", ce: "C.E.", ppt: "PPT", pasaporte: "Pasaporte" };
const DOC_FULL      = { cc: "Cédula de ciudadanía", ce: "Cédula de extranjería", ppt: "PPT", pasaporte: "Pasaporte" };
const PERSONA_LABEL = { natural: "Natural", juridica: "Jurídica" };
const EXPORT_ROLES  = ["admin", "gerencia", "auxiliar_contable"];

function accessLabel(c) {
  if (c.has_access)   return "Con acceso";
  if (c.linked_email) return "Sin ingresar";
  return "Sin cuenta";
}

let _mailTimer           = null;
let _selectedUserId      = null;
let _selectedUserBlocked = false;

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
  const canExport = EXPORT_ROLES.includes(window.currentUser?.rol);
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

  const exportBtns = canExport
    ? `<button class="btn btn-ghost btn-sm" id="btnCompExportExcel">
         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
         Exportar Excel
       </button>
       <button class="btn btn-ghost btn-sm" id="btnCompExportPDF">
         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9" x2="10" y2="9"/></svg>
         Exportar PDF
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
      <tr class="comprador-row" data-id="${c.id_usuario}" style="cursor:pointer" title="Ver lotes de este comprador">
        <td>
          <div class="comprador-cell">
            ${avatar}
            <div class="comprador-cell-info">
              <span class="comprador-cell-name">${nombre || "—"}</span>
              <span class="comprador-cell-mail">${c.email || "Sin correo"}</span>
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
        <td>${accessBadge(c)}</td>
        <td>${UI.badge(c.activo ? "activo" : "inactivo")}</td>
        ${accionesCell}
      </tr>`;
  }

  const conAcceso = data.filter(c => c.has_access).length;
  const inactivos = data.filter(c => !c.activo).length;

  vc.innerHTML = `
    ${window.SGIUI.statCards([
      { label: "Compradores", value: data.length,             sub: "Total registrados" },
      { label: "Con acceso",  value: conAcceso,               sub: "Cuenta activa en la plataforma" },
      { label: "Sin cuenta",  value: data.length - conAcceso, sub: "Aún sin acceso" },
      { label: "Inactivos",   value: inactivos,               sub: "Deshabilitados", tone: inactivos ? "danger" : "" },
    ])}
    <div class="table-wrap">
      <div class="table-header">
        <div class="table-header-titles">
          <h3>Compradores</h3>
          <span class="count-chip" id="comp-count">${data.length} registros</span>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
          ${exportBtns}
          ${nuevoBtn}
        </div>
      </div>

      <p style="margin:.15rem 0 .85rem;font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:.4rem">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Haz clic en un comprador para ver sus lotes y ventas asociados.
      </p>

      ${window.SGIUI.filterBar({ fields: [
        { type: "search", id: "cf-buscar", placeholder: "Buscar por nombre, documento o correo…", grow: true },
        { type: "select", id: "cf-persona", label: "Tipo de persona", options: [
          { value: "", label: "Todos los tipos" }, { value: "natural", label: "Natural" }, { value: "juridica", label: "Jurídica" },
        ] },
        { type: "select", id: "cf-tipodoc", label: "Documento", options: [
          { value: "", label: "Todo documento" }, { value: "cc", label: "Cédula de ciudadanía" },
          { value: "ce", label: "Cédula de extranjería" }, { value: "ppt", label: "PPT" }, { value: "pasaporte", label: "Pasaporte" },
        ] },
        { type: "select", id: "cf-estado", label: "Estado", options: [
          { value: "", label: "Todos los estados" }, { value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" },
        ] },
      ] })}

      <table>
        <thead>
          <tr>
            <th>Comprador</th>
            <th>Documento</th>
            <th>Tipo</th>
            <th>Teléfono</th>
            <th>Acceso</th>
            <th>Estado</th>
            ${canEdit ? "<th>Acciones</th>" : ""}
          </tr>
        </thead>
        <tbody id="comp-tbody"></tbody>
      </table>
    </div>`;

  const tbody = document.getElementById("comp-tbody");
  const count = document.getElementById("comp-count");

  let _visibles = data.slice();

  function aplicarFiltros() {
    const q       = norm(document.getElementById("cf-buscar").value);
    const persona = document.getElementById("cf-persona").value;
    const tipodoc = document.getElementById("cf-tipodoc").value;
    const estado  = document.getElementById("cf-estado").value;

    const visibles = data.filter(c => {
      if (persona && c.tipo_persona   !== persona) return false;
      if (tipodoc && c.tipo_documento !== tipodoc) return false;
      if (estado  && (c.activo ? "activo" : "inactivo") !== estado) return false;
      if (q && !norm(`${c.nombres} ${c.apellidos} ${c.documento} ${c.email}`).includes(q)) return false;
      return true;
    });
    _visibles = visibles;

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

  if (canExport) {
    document.getElementById("btnCompExportExcel")?.addEventListener("click", () => exportCompradoresExcel(_visibles));
    document.getElementById("btnCompExportPDF")?.addEventListener("click", () => exportCompradoresPDF(_visibles));
  }

  tbody.addEventListener("click", e => {
    const editBtn = e.target.closest(".btn-comprador-editar");
    if (editBtn) {
      const c = data.find(x => String(x.id_usuario) === editBtn.dataset.id);
      if (c) compradorForm(c);
      return;
    }
    const row = e.target.closest(".comprador-row");
    if (!row) return;
    const c = data.find(x => String(x.id_usuario) === row.dataset.id);
    if (c) verLotesComprador(c);
  });

  aplicarFiltros();
};

window.verLotesComprador = async function (c) {
  const vc = document.getElementById("viewContainer");
  if (!vc) return;

  const nombre = `${c.nombres || ""} ${c.apellidos || ""}`.trim() || c.email || "Comprador";
  vc.innerHTML = UI.loader();

  let ventas;
  try {
    ventas = await API.get("/ventas");
  } catch (e) {
    vc.innerHTML = `
      <div class="table-wrap" style="padding:1.5rem">
        <button class="btn btn-ghost btn-sm" onclick="compradoresView()">&larr; Volver a compradores</button>
        <p style="color:var(--danger);margin-top:1rem">${e.message}</p>
      </div>`;
    return;
  }

  const suyas = (ventas || []).filter(v =>
    (v.venta_comprador || []).some(x => Number(x.usuario?.id_usuario) === Number(c.id_usuario))
  );

  const filas = suyas.length
    ? suyas.map(v => {
        const lote = v.lote
          ? `${v.lote.codigo_lote} M${v.lote.manzana}-${v.lote.numero_lote}`
          : "—";
        return `
          <tr>
            <td>${v.id_venta}</td>
            <td>${v.lote?.proyecto?.nombre || "—"}</td>
            <td><strong>${lote}</strong></td>
            <td>${UI.fmt(v.valor_total)}</td>
            <td>${UI.badge(v.estado)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="verVenta(${v.id_venta})">Ver venta</button></td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="6" class="empty-row">Este comprador no tiene lotes asociados.</td></tr>`;

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <div class="table-header-titles">
          <button class="btn btn-ghost btn-sm" onclick="compradoresView()" style="margin-bottom:.5rem;align-self:flex-start">&larr; Volver a compradores</button>
          <h3>Lotes de ${nombre}</h3>
          <span class="count-chip">${suyas.length} ${suyas.length === 1 ? "lote" : "lotes"}</span>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Proyecto</th><th>Lote</th>
              <th>Valor</th><th>Estado</th><th>Acción</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>`;
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
           value="${escAttr(c.email)}"
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

  const estadoField = isEdit
    ? `<div class="form-group">
         <label>Estado de la cuenta</label>
         <select id="f_estado">
           <option value="activo"   ${c.activo === false ? "" : "selected"}>Activo</option>
           <option value="inactivo" ${c.activo === false ? "selected" : ""}>Inactivo</option>
         </select>
         <div class="form-note" style="margin-top:.25rem;color:var(--text-muted)">
           Un comprador inactivo no podrá ingresar a la plataforma.
         </div>
       </div>`
    : "";

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
          ${estadoField}
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

  const estadoEl = document.getElementById("f_estado");

  const body = {
    tipo_persona:   document.getElementById("f_tipo").value,
    tipo_documento: document.getElementById("f_tipodoc").value,
    documento,
    nombres,
    apellidos:  document.getElementById("f_ape").value.trim(),
    telefono:   document.getElementById("f_tel").value.trim(),
    mail,
  };

  if (estadoEl) body.estado = estadoEl.value;

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

async function exportCompradoresExcel(rows) {
  if (window.SGILibs) await window.SGILibs.ensureExport();
  const SX = window.SGIExport.xlsx;
  const wb = SX.setup();

  const conAcceso = rows.filter(c => c.has_access).length;
  const inactivos = rows.filter(c => !c.activo).length;
  const sinCuenta = rows.length - conAcceso;

  const ws = wb.addWorksheet("Compradores", { tabColor: { argb: SX.C.primary } });
  ws.columns = [
    { key: "nombre",    width: 30 },
    { key: "tipodoc",   width: 22 },
    { key: "documento", width: 18 },
    { key: "persona",   width: 14 },
    { key: "telefono",  width: 16 },
    { key: "email",     width: 32 },
    { key: "acceso",    width: 16 },
    { key: "estado",    width: 12 },
  ];

  SX.masthead(ws, {
    title:     "Directorio de Compradores",
    subtitle:  "Estado actual aplicando los filtros activos al momento de exportar",
    mergeCols: 8,
  });

  SX.kpiRow(ws, [
    { label: "Compradores", value: rows.length },
    { label: "Con acceso",  value: conAcceso },
    { label: "Sin cuenta",  value: sinCuenta },
    { label: "Inactivos",   value: inactivos },
  ]);

  ws.addRow([]).height = 4;
  const hRow = ws.addRow([
    "Comprador", "Tipo documento", "Documento", "Tipo persona",
    "Teléfono", "Correo", "Acceso", "Estado",
  ]);
  SX.styleHeader(hRow);
  const headerRowNum = hRow.number;

  rows.forEach((c, i) => {
    const nombre = `${c.nombres || ""} ${c.apellidos || ""}`.trim();
    const r = ws.addRow([
      nombre || "—",
      DOC_FULL[c.tipo_documento] || "—",
      c.documento || "—",
      PERSONA_LABEL[c.tipo_persona] || c.tipo_persona || "—",
      c.telefono || "—",
      c.email || "—",
      accessLabel(c),
      c.activo ? "Activo" : "Inactivo",
    ]);
    SX.styleBody(r, i % 2 !== 0);
  });

  ws.views = [{ state: "frozen", ySplit: headerRowNum }];
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to:   { row: headerRowNum, column: 8 },
  };

  await SX.download(wb, `compradores_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function exportCompradoresPDF(rows) {
  if (window.SGILibs) await window.SGILibs.ensureExport();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const SX  = window.SGIExport.pdf;

  const conAcceso = rows.filter(c => c.has_access).length;
  const inactivos = rows.filter(c => !c.activo).length;
  const sinCuenta = rows.length - conAcceso;

  let y = SX.brand(doc);

  y = SX.title(doc, y + 2, {
    title:    "Directorio de Compradores",
    subtitle: `${rows.length} comprador${rows.length === 1 ? "" : "es"} en la vista exportada`,
  });

  y = SX.kpiCards(doc, y + 2, [
    { label: "Compradores", value: String(rows.length), desc: "Total en la vista" },
    { label: "Con acceso",  value: String(conAcceso),   desc: "Cuenta activa" },
    { label: "Sin cuenta",  value: String(sinCuenta),   desc: "Aún sin acceso" },
    { label: "Inactivos",   value: String(inactivos),   desc: "Deshabilitados" },
  ], { perRow: 4 });

  y = SX.section(doc, y + 6, { kicker: "Detalle", title: "Listado de compradores" });

  doc.autoTable({
    startY: y,
    head: [["Comprador", "Documento", "Tipo", "Teléfono", "Correo", "Acceso", "Estado"]],
    body: rows.map(c => [
      `${c.nombres || ""} ${c.apellidos || ""}`.trim() || "—",
      `${DOC_LABEL[c.tipo_documento] || "—"} ${c.documento || ""}`.trim(),
      PERSONA_LABEL[c.tipo_persona] || c.tipo_persona || "—",
      c.telefono || "—",
      c.email || "—",
      accessLabel(c),
      c.activo ? "Activo" : "Inactivo",
    ]),
    ...SX.tableTheme(),
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 40 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 30 },
      4: { cellWidth: 55 },
      5: { cellWidth: 28, halign: "center" },
      6: { cellWidth: 24, halign: "center" },
    },
    ...SX.statusColumn(6, e => (e === "Activo" ? "success" : "muted")),
  });

  SX.footer(doc);
  doc.save(`compradores_sgi_${new Date().toISOString().slice(0, 10)}.pdf`);
}

})();
