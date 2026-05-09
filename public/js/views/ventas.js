window.ventasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/ventas").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;

  const esAsesor = window.currentUser?.rol === "asesor_comercial";
  const botonNueva = esAsesor
    ? `<button class="btn btn-primary btn-sm" onclick="ventaFormSolicitud()">+ Solicitar Venta</button>`
    : `<button class="btn btn-primary btn-sm" onclick="ventaForm()">+ Nueva Venta</button>`;

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <h3>Ventas</h3>
        ${botonNueva}
      </div>
      ${esAsesor ? `<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;">
        ℹ️ Como asesor comercial puedes crear solicitudes de venta. Quedan en estado <b>pendiente de autorización</b> hasta que un operador o administrador las apruebe.
      </p>` : ""}
      <table>
        <thead><tr><th>#</th><th>Lote</th><th>Proyecto</th><th>Fecha</th><th>Valor Total</th><th>Cuota Inicial</th><th>Estado</th><th></th></tr></thead>
        <tbody>${data.map(v=>`<tr>
          <td>${v.id_venta}</td>
          <td>${v.lote?.codigo_lote||"—"}</td>
          <td>${v.lote?.proyecto?.nombre||"—"}</td>
          <td>${UI.date(v.fecha_venta)}</td>
          <td>${UI.fmt(v.valor_total)}</td>
          <td>${UI.fmt(v.cuota_inicial)}</td>
          <td>${UI.badge(v.estado)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="verVenta(${v.id_venta})">Ver</button></td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
};

window.verVenta = async function(id) {
  const v = await API.get(`/ventas/${id}`);
  UI.openModal(`Venta #${v.id_venta}`,`
    <p><b>Lote:</b> ${v.lote?.codigo_lote} — ${v.lote?.proyecto?.nombre}</p>
    <p><b>Estado:</b> ${UI.badge(v.estado)}</p>
    <p><b>Valor total:</b> ${UI.fmt(v.valor_total)}</p>
    <p><b>Cuota inicial:</b> ${UI.fmt(v.cuota_inicial)}</p>
    <p><b>Fecha:</b> ${UI.date(v.fecha_venta)}</p>
    <hr style="border-color:var(--border);margin:16px 0">
    <p><b>Compradores:</b></p>
    ${(v.venta_comprador||[]).map(c=>`<p style="padding-left:12px">· ${c.comprador?.nombres} ${c.comprador?.apellidos||""} — ${c.porcentaje}%</p>`).join("")||"<p style='color:var(--text-muted)'>Sin compradores</p>"}
    <p style="margin-top:12px"><b>Comisionista:</b> ${v.venta_comisionista?`${v.venta_comisionista.comisionista?.nombres} — ${UI.fmt(v.venta_comisionista.valor_comision)}`:"—"}</p>`);
};

// ─── Helpers internos ───

// Extrae proyectos únicos desde la lista de lotes disponibles,
// garantizando que proyecto y lote siempre vienen de la misma fuente.
function _proyectosDesdeIotes(lotes) {
  if (!Array.isArray(lotes) || lotes.length === 0) return [];
  const vistos = new Set();
  return lotes
    .filter(l => l.proyecto && !vistos.has(l.proyecto) && (vistos.add(l.proyecto), true))
    .map(l => ({ nombre: l.proyecto }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}


function _htmlFormVenta(proyectos, compradores, comisionistas) {
  return `
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1"><label>Proyecto *</label>
        <select id="f_proy" onchange="_filtrarLotesPorProyecto()">
          <option value="">— Seleccione proyecto —</option>
          ${proyectos.map(p=>`<option value="${p.nombre}" data-nombre="${p.nombre}">${p.nombre}</option>`).join("")}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Lote disponible *</label>
        <input type="text" id="f_lote_buscar" placeholder="Buscar por código de lote…"
               oninput="_buscarLote(this.value)" autocomplete="off"
               style="margin-bottom:4px" disabled/>
        <select id="f_lote" onchange="_mostrarInfoLote()">
          <option value="">— Primero seleccione un proyecto —</option>
        </select>
      </div>
      <div id="f_lote_info" style="grid-column:1/-1"></div>

      <div class="form-group"><label>Valor Total *</label><input id="f_vt" type="number" min="0"/></div>
      <div class="form-group"><label>Cuota Inicial</label><input id="f_ci" type="number" min="0" value="0"/></div>

      <div class="form-group"><label>Micro-cuotas de la inicial</label><input id="f_nci" type="number" min="1" value="1"/></div>
      <div class="form-group"><label>Fecha 1ª cuota inicial *</label><input id="f_fci" type="date"/></div>

      <div class="form-group"><label>N° Cuotas regulares *</label><input id="f_nc" type="number" min="1"/></div>
      <div class="form-group"><label>Fecha 1ª cuota regular *</label><input id="f_fc" type="date"/></div>

      <div class="form-group" style="grid-column:1/-1">
        <label style="display:flex;justify-content:space-between;align-items:center">
          Comprador *
          <button type="button" class="btn btn-ghost btn-sm" style="font-size:.78rem;padding:2px 8px"
                  onclick="_toggleNuevoComprador()">+ Nuevo</button>
        </label>
        <select id="f_comp">${compradores.map(c=>`<option value="${c.id_comprador}">${c.nombres} ${c.apellidos||""} (${c.documento})</option>`).join("")}</select>
        <div id="f_comp_nuevo" style="display:none;margin-top:8px;background:var(--surface-2,#f5f7fa);border-radius:6px;padding:10px 12px">
          <div class="form-grid" style="gap:8px">
            <div class="form-group"><label style="font-size:.8rem">Documento *</label><input id="fn_comp_doc" type="text"/></div>
            <div class="form-group"><label style="font-size:.8rem">Nombres *</label><input id="fn_comp_nom" type="text"/></div>
            <div class="form-group"><label style="font-size:.8rem">Apellidos</label><input id="fn_comp_ape" type="text"/></div>
            <div class="form-group"><label style="font-size:.8rem">Teléfono</label><input id="fn_comp_tel" type="text"/></div>
            <div class="form-group"><label style="font-size:.8rem">Email</label><input id="fn_comp_mail" type="email"/></div>
            <div class="form-group"><label style="font-size:.8rem">Tipo persona</label>
              <select id="fn_comp_tipo"><option value="natural">Natural</option><option value="juridica">Jurídica</option></select>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:6px">
            <button type="button" class="btn btn-primary btn-sm" onclick="_crearCompradorRapido()">Guardar comprador</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="_toggleNuevoComprador()">Cancelar</button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label style="display:flex;justify-content:space-between;align-items:center">
          Comisionista
          <button type="button" class="btn btn-ghost btn-sm" style="font-size:.78rem;padding:2px 8px"
                  onclick="_toggleNuevoComisionista()">+ Nuevo</button>
        </label>
        <select id="f_comi"><option value="">— Ninguno —</option>${comisionistas.map(c=>`<option value="${c.id_comisionista}">${c.nombres}</option>`).join("")}</select>
        <div id="f_comi_nuevo" style="display:none;margin-top:8px;background:var(--surface-2,#f5f7fa);border-radius:6px;padding:10px 12px">
          <div class="form-grid" style="gap:8px">
            <div class="form-group"><label style="font-size:.8rem">Documento *</label><input id="fn_comi_doc" type="text"/></div>
            <div class="form-group"><label style="font-size:.8rem">Nombres *</label><input id="fn_comi_nom" type="text"/></div>
            <div class="form-group"><label style="font-size:.8rem">Apellidos</label><input id="fn_comi_ape" type="text"/></div>
            <div class="form-group"><label style="font-size:.8rem">Teléfono</label><input id="fn_comi_tel" type="text"/></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:6px">
            <button type="button" class="btn btn-primary btn-sm" onclick="_crearComisionistaRapido()">Guardar comisionista</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="_toggleNuevoComisionista()">Cancelar</button>
          </div>
        </div>
      </div>
      <div class="form-group"><label>Comisión ($)</label><input id="f_pcom" type="number" min="0" value="0"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Observaciones</label><textarea id="f_obs" rows="2"></textarea></div>
    </div>`;
}

function _bodyVenta() {
  const idLote = +document.getElementById("f_lote").value;
  const idComi = document.getElementById("f_comi").value;
  return {
    id_lote:                   idLote,
    valor_total:               +document.getElementById("f_vt").value,
    cuota_inicial:             +document.getElementById("f_ci").value,
    numero_cuotas_inicial:     +document.getElementById("f_nci").value || 1,
    fecha_primera_cuota_inicial: document.getElementById("f_fci").value,
    numero_cuotas:             +document.getElementById("f_nc").value,
    fecha_primera_cuota:       document.getElementById("f_fc").value,
    observaciones:             document.getElementById("f_obs").value,
    compradores: [{ id_comprador: +document.getElementById("f_comp").value, porcentaje: 100 }],
    id_comisionista:           idComi ? +idComi : null,
    valor_comision:       +document.getElementById("f_pcom").value
  };
}

window._filtrarLotesPorProyecto = function() {
  const selProy  = document.getElementById("f_proy");
  const nombreProy = selProy.value;
  const lotes    = window._ventaLotes || [];
  const filtrados = nombreProy ? lotes.filter(l => l.proyecto === nombreProy) : [];

  // Guarda los lotes del proyecto para el buscador
  window._lotesProyecto = filtrados;

  const buscar = document.getElementById("f_lote_buscar");
  buscar.value = "";
  buscar.disabled = filtrados.length === 0;
  buscar.placeholder = filtrados.length
    ? "Buscar por código de lote…"
    : "— No hay lotes disponibles en este proyecto —";

  _poblarSelectLotes(filtrados);
  document.getElementById("f_lote_info").innerHTML = "";
};

function _poblarSelectLotes(lista) {
  const sel = document.getElementById("f_lote");
  sel.innerHTML = lista.length
    ? lista.map(l => `<option value="${l.id_lote}" data-lote='${JSON.stringify(l).replace(/'/g,"&#39;")}'>`
        + `${l.codigo_lote || ("Mz" + l.manzana + " Lt" + l.numero_lote)} — ${UI.fmt(l.precio_lista)}`
        + `</option>`).join("")
    : `<option value="">— Sin resultados —</option>`;
  if (lista.length === 1) _mostrarInfoLote();
}

window._buscarLote = function(texto) {
  const lotes = window._lotesProyecto || [];
  const q = texto.toLowerCase().trim();
  const filtrados = q
    ? lotes.filter(l => (l.codigo_lote || `Mz${l.manzana}Lt${l.numero_lote}`).toLowerCase().includes(q))
    : lotes;
  _poblarSelectLotes(filtrados);
  document.getElementById("f_lote_info").innerHTML = "";
};

window._mostrarInfoLote = function() {
  const sel = document.getElementById("f_lote");
  const opt = sel.options[sel.selectedIndex];
  const info = document.getElementById("f_lote_info");
  if (!opt || !opt.dataset.lote) { info.innerHTML = ""; return; }
  const l = JSON.parse(opt.dataset.lote);
  info.innerHTML = `
    <div style="background:var(--surface-2,#f0f4f8);border-radius:6px;padding:8px 14px;font-size:.85rem;display:flex;gap:20px;flex-wrap:wrap;margin-bottom:4px">
      <span><b>Manzana:</b> ${l.manzana||"—"}</span>
      <span><b>N° Lote:</b> ${l.numero_lote||"—"}</span>
      <span><b>Área:</b> ${l.area_m2 ? l.area_m2+" m²" : "—"}</span>
      <span><b>Precio lista:</b> ${UI.fmt(l.precio_lista)}</span>
    </div>`;
};

// ─── Creación rápida de comprador / comisionista desde el formulario de venta ───

window._toggleNuevoComprador = function() {
  const div = document.getElementById("f_comp_nuevo");
  div.style.display = div.style.display === "none" ? "block" : "none";
};

window._toggleNuevoComisionista = function() {
  const div = document.getElementById("f_comi_nuevo");
  div.style.display = div.style.display === "none" ? "block" : "none";
};

window._crearCompradorRapido = async function() {
  const doc  = document.getElementById("fn_comp_doc").value.trim();
  const nom  = document.getElementById("fn_comp_nom").value.trim();
  if (!doc || !nom) return UI.toast("Documento y nombres son obligatorios", "error");

  try {
    const nuevo = await API.post("/compradores", {
      documento:    doc,
      nombres:      nom,
      apellidos:    document.getElementById("fn_comp_ape").value.trim(),
      telefono:     document.getElementById("fn_comp_tel").value.trim(),
      mail:         document.getElementById("fn_comp_mail").value.trim(),
      tipo_persona: document.getElementById("fn_comp_tipo").value,
    });

    // Agrega la nueva opción y la selecciona
    const sel = document.getElementById("f_comp");
    const opt = new Option(`${nuevo.nombres} ${nuevo.apellidos||""} (${nuevo.documento})`, nuevo.id_comprador, true, true);
    sel.add(opt);

    _toggleNuevoComprador();
    UI.toast("Comprador creado y seleccionado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

window._crearComisionistaRapido = async function() {
  const doc = document.getElementById("fn_comi_doc").value.trim();
  const nom = document.getElementById("fn_comi_nom").value.trim();
  if (!doc || !nom) return UI.toast("Documento y nombres son obligatorios", "error");

  try {
    const nuevo = await API.post("/comisionistas", {
      documento: doc,
      nombres:   nom,
      apellidos: document.getElementById("fn_comi_ape").value.trim(),
      telefono:  document.getElementById("fn_comi_tel").value.trim(),
    });

    // Agrega la nueva opción y la selecciona
    const sel = document.getElementById("f_comi");
    const opt = new Option(`${nuevo.nombres}`, nuevo.id_comisionista, true, true);
    sel.add(opt);

    _toggleNuevoComisionista();
    UI.toast("Comisionista creado y seleccionado", "ok");
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Formulario estándar (admin / operador) ───
window.ventaForm = async function() {
  let lotes, compradores, comisionistas;
  try {
    [lotes, compradores, comisionistas] = await Promise.all([
      API.get("/lotes/disponibles"), API.get("/compradores"), API.get("/comisionistas")
    ]);
  } catch(e) {
    UI.toast("Error al cargar datos del formulario: " + e.message, "error");
    console.error("[ventaForm]", e);
    return;
  }

  window._ventaLotes = lotes || [];
  const proyectos = _proyectosDesdeIotes(window._ventaLotes);

  if (proyectos.length === 0) {
    console.warn("[ventaForm] lotes disponibles recibidos:", lotes);
  }

  UI.openModal("Nueva Venta", _htmlFormVenta(proyectos, compradores || [], comisionistas || []) + `
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarVenta()">Crear Venta</button>
    </div>`);
};

window.guardarVenta = async function() {
  const body = _bodyVenta();
  if (!body.id_lote)            return UI.toast("Seleccione un lote", "error");
  if (!body.valor_total)        return UI.toast("Ingrese el valor total", "error");
  if (!body.numero_cuotas)      return UI.toast("Ingrese el número de cuotas regulares", "error");
  if (!body.fecha_primera_cuota) return UI.toast("Ingrese la fecha de la primera cuota regular", "error");
  if (body.cuota_inicial > 0 && !body.fecha_primera_cuota_inicial)
    return UI.toast("Ingrese la fecha de la primera cuota inicial", "error");

  try {
    await API.post("/ventas", body);
    UI.closeModal();
    UI.toast("Venta creada", "ok");
    ventasView();
  } catch(e) { UI.toast(e.message, "error"); }
};

// ─── Formulario de solicitud (asesor_comercial) ───
window.ventaFormSolicitud = async function() {
  let lotes, compradores, comisionistas;
  try {
    [lotes, compradores, comisionistas] = await Promise.all([
      API.get("/lotes/disponibles"), API.get("/compradores"), API.get("/comisionistas")
    ]);
  } catch(e) {
    UI.toast("Error al cargar datos del formulario: " + e.message, "error");
    console.error("[ventaFormSolicitud]", e);
    return;
  }

  window._ventaLotes = lotes || [];
  const proyectos = _proyectosDesdeIotes(window._ventaLotes);

  UI.openModal("Solicitar Venta (pendiente de autorización)", `
    <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem;">
      Esta solicitud quedará en estado <b>pendiente</b> y deberá ser aprobada por un administrador u operador antes de activarse.
    </p>
    ` + _htmlFormVenta(proyectos, compradores, comisionistas) + `
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarSolicitudVenta()">Enviar Solicitud</button>
    </div>`);
};

window.guardarSolicitudVenta = async function() {
  const body = _bodyVenta();
  if (!body.id_lote)            return UI.toast("Seleccione un lote", "error");
  if (!body.valor_total)        return UI.toast("Ingrese el valor total", "error");
  if (!body.numero_cuotas)      return UI.toast("Ingrese el número de cuotas regulares", "error");
  if (!body.fecha_primera_cuota) return UI.toast("Ingrese la fecha de la primera cuota regular", "error");
  if (body.cuota_inicial > 0 && !body.fecha_primera_cuota_inicial)
    return UI.toast("Ingrese la fecha de la primera cuota inicial", "error");

  try {
    await API.post("/ventas/solicitud", body);
    UI.closeModal();
    UI.toast("Solicitud enviada — pendiente de autorización", "ok");
    ventasView();
  } catch(e) { UI.toast(e.message, "error"); }
};
