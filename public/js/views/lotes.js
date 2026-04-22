window.lotesView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();
  const data = await API.get("/lotes").catch(e => { vc.innerHTML=`<p style="color:var(--danger)">${e.message}</p>`; return null; });
  if (!data) return;

  const esAsesor = window.currentUser?.rol === "asesor_comercial";

  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.75rem;">
        <h3>Lotes</h3>
        <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
          <input id="filtro-lote-texto" type="text" placeholder="Buscar por código o proyecto…"
            style="padding:.4rem .8rem;border:1px solid var(--border);border-radius:8px;
                   font-size:.875rem;background:var(--surface);color:var(--text);width:220px;"
            oninput="filtrarLotes()" />
          <select id="filtro-lote-estado" onchange="filtrarLotes()"
            style="padding:.4rem .8rem;border:1px solid var(--border);border-radius:8px;
                   font-size:.875rem;background:var(--surface);color:var(--text);">
            ${esAsesor
              ? `<option value="disponible">Disponible</option><option value="vendido">Vendido</option><option value="">Todos</option>`
              : `<option value="">Todos los estados</option><option value="disponible">Disponible</option><option value="vendido">Vendido</option><option value="reservado">Reservado</option>`
            }
          </select>
          ${esAsesor ? "" : `<button class="btn btn-primary btn-sm" onclick="loteForm()">+ Nuevo</button>`}
        </div>
      </div>
      <table>
        <thead><tr><th>Código</th><th>Proyecto</th><th>Manzana</th><th>Nro.</th><th>Área m²</th><th>Precio Base</th><th>Estado</th></tr></thead>
        <tbody id="body-lotes"></tbody>
      </table>
    </div>`;

  window._lotesData = data;
  filtrarLotes();
};

window.filtrarLotes = function() {
  const texto  = document.getElementById("filtro-lote-texto")?.value.toLowerCase() ?? "";
  const estado = document.getElementById("filtro-lote-estado")?.value ?? "";
  const tbody  = document.getElementById("body-lotes");
  if (!tbody) return;

  const filtrados = (window._lotesData || []).filter(l => {
    const coincideTexto  = !texto  || l.codigo_lote?.toLowerCase().includes(texto) || l.proyecto?.nombre?.toLowerCase().includes(texto);
    const coincideEstado = !estado || l.estado === estado;
    return coincideTexto && coincideEstado;
  });

  tbody.innerHTML = filtrados.length
    ? filtrados.map(l => `<tr>
        <td>${l.codigo_lote}</td><td>${l.proyecto?.nombre||"—"}</td>
        <td>${l.manzana}</td><td>${l.numero_lote}</td>
        <td>${l.area_m2||"—"}</td><td>${UI.fmt(l.precio_base)}</td>
        <td>${UI.badge(l.estado)}</td>
      </tr>`).join("")
    : `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">Sin resultados</td></tr>`;
};

window.loteForm = async function() {
  const proyectos = await API.get("/proyectos");
  UI.openModal("Nuevo Lote", `
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1"><label>Proyecto *</label>
        <select id="f_proy">${proyectos.map(p=>`<option value="${p.id_proyecto}">${p.nombre}</option>`).join("")}</select>
      </div>
      <div class="form-group"><label>Código Lote *</label><input id="f_cod"/></div>
      <div class="form-group"><label>Manzana *</label><input id="f_man"/></div>
      <div class="form-group"><label>Número Lote *</label><input id="f_num"/></div>
      <div class="form-group"><label>Dimensiones *</label><input id="f_dim" placeholder="Ej: 10x20"/></div>
      <div class="form-group"><label>Área m²</label><input id="f_area" type="number"/></div>
      <div class="form-group"><label>Precio Base *</label><input id="f_precio" type="number"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Descripción</label><textarea id="f_desc" rows="2"></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarLote()">Guardar</button>
    </div>`);
};
window.guardarLote = async function() {
  const body = {
    id_proyecto: +document.getElementById("f_proy").value, codigo_lote: document.getElementById("f_cod").value,
    manzana: document.getElementById("f_man").value, numero_lote: document.getElementById("f_num").value,
    dimensiones: document.getElementById("f_dim").value, area_m2: document.getElementById("f_area").value||null,
    precio_base: +document.getElementById("f_precio").value, descripcion: document.getElementById("f_desc").value
  };
  try { await API.post("/lotes", body); UI.closeModal(); UI.toast("Lote creado","ok"); lotesView(); }
  catch(e) { UI.toast(e.message,"error"); }
};