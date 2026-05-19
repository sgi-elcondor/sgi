(function () {

window.cuotasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const data = await API.get("/cuotas/pendientes").catch(e => {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    return null;
  });
  if (!data) return;

  const esAuxiliar = AppState.can('cuotas', 'editar_valores');

  const cuotasMap = {};
  data.forEach(c => { cuotasMap[c.id_cuota] = c; });

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function filaVista(c) {
    const btnEditar = (esAuxiliar && c.estado !== "pagada")
      ? `<button class="btn btn-ghost btn-sm btn-cuota-editar" data-id="${c.id_cuota}">Editar</button>`
      : "";
    return `<tr data-id="${c.id_cuota}">
      <td>${c.proyecto}</td>
      <td>${c.codigo_lote}</td>
      <td>${c.comprador}</td>
      <td>${c.numero_cuota}</td>
      <td>${UI.date(c.fecha_vencimiento)}</td>
      <td>${c.dias_atraso > 0
        ? `<span style="color:var(--danger)">${c.dias_atraso} días atraso</span>`
        : c.dias_atraso === 0
          ? `<span style="color:var(--warning,#e8570c)">Hoy</span>`
          : `<span style="color:var(--success,#22c55e)">en ${Math.abs(c.dias_atraso)} días</span>`
      }</td>
      <td>${UI.fmt(c.valor_cuota)}</td>
      <td>${UI.fmt(c.valor_pendiente)}</td>
      <td>${UI.badge(c.estado)}</td>
      ${esAuxiliar ? `<td>${btnEditar}</td>` : ""}
    </tr>`;
  }

  function fmtMiles(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function filaEdicion(c) {
    return `<tr data-id="${c.id_cuota}">
      <td>${c.proyecto}</td>
      <td>${c.codigo_lote}</td>
      <td>${c.comprador}</td>
      <td>${c.numero_cuota}</td>
      <td><input type="date" class="cuota-input-fecha" value="${c.fecha_vencimiento}" style="width:140px"></td>
      <td>${c.dias_atraso > 0
        ? `<span style="color:var(--danger)">${c.dias_atraso} días</span>`
        : c.dias_atraso === 0
          ? `<span style="color:var(--warning,#e8570c)">Hoy</span>`
          : `<span style="color:var(--success,#22c55e)">en ${Math.abs(c.dias_atraso)} días</span>`
      }</td>
      <td><input type="text" inputmode="numeric" class="cuota-input-valor" value="${fmtMiles(c.valor_cuota)}" style="width:130px"></td>
      <td>${UI.fmt(c.valor_pendiente)}</td>
      <td>${UI.badge(c.estado)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-primary btn-sm btn-cuota-guardar" data-id="${c.id_cuota}">Guardar</button>
        <button class="btn btn-ghost btn-sm btn-cuota-cancelar" data-id="${c.id_cuota}" style="margin-left:4px">Cancelar</button>
      </td>
    </tr>`;
  }

  // Unique options for the filter selects
  const proyectos = [...new Set(data.map(c => c.proyecto))].sort();
  const estados   = [...new Set(data.map(c => c.estado))].sort();

  const optsProyecto = proyectos.map(p => `<option value="${p}">${p}</option>`).join("");
  const optsEstado   = estados.map(s => `<option value="${s}">${s}</option>`).join("");

  const thAcciones = esAuxiliar ? "<th>Acciones</th>" : "";
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header"><h3>Cuotas Pendientes</h3></div>

      <div class="table-filters"> 
        <select id="f-proyecto" class="select-sm" style="flex:1;min-width:150px;">
          <option value="">Todos los proyectos</option>
          ${optsProyecto}
        </select>
        <input id="f-lote" type="text" placeholder="Buscar lote..."
          style="flex:1;min-width:130px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px">
        <input id="f-comprador" type="text" placeholder="Buscar comprador..."
          style="flex:2;min-width:180px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px">
        <select id="f-estado" class="select-sm" style="flex:1;min-width:140px;">
          <option value="">Todos los estados</option>
          ${optsEstado}
        </select>
      </div>

      <table>
        <thead><tr>
          <th>Proyecto</th><th>Lote</th><th>Comprador</th><th>Nro.</th>
          <th>Vencimiento</th><th>Días</th><th>Valor</th><th>Pendiente</th>
          <th>Estado</th>${thAcciones}
        </tr></thead>
        <tbody id="cuotas-tbody">${data.map(filaVista).join("")}</tbody>
      </table>
      <p id="cuotas-empty" style="display:none;text-align:center;color:var(--text-muted);padding:24px">
        No hay cuotas que coincidan con los filtros.
      </p>
    </div>`;

  const tbody = document.getElementById("cuotas-tbody");

  function aplicarFiltros() {
    const fProyecto  = document.getElementById("f-proyecto").value;
    const fLote      = norm(document.getElementById("f-lote").value);
    const fComprador = norm(document.getElementById("f-comprador").value);
    const fEstado    = document.getElementById("f-estado").value;

    const visibles = data.filter(c => {
      if (fProyecto  && c.proyecto    !== fProyecto)                    return false;
      if (fLote      && !norm(c.codigo_lote).includes(fLote))           return false;
      if (fComprador && !norm(c.comprador).includes(fComprador))        return false;
      if (fEstado    && c.estado      !== fEstado)                      return false;
      return true;
    });

    tbody.innerHTML = visibles.map(filaVista).join("");
    document.getElementById("cuotas-empty").style.display = visibles.length ? "none" : "block";
  }

  ["f-proyecto", "f-estado"].forEach(id =>
    document.getElementById(id).addEventListener("change", aplicarFiltros)
  );
  ["f-lote", "f-comprador"].forEach(id =>
    document.getElementById(id).addEventListener("input", aplicarFiltros)
  );

  tbody.addEventListener("click", async e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id   = btn.dataset.id;
    const fila = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!fila) return;

    // ── Editar ──
    if (btn.classList.contains("btn-cuota-editar")) {
      fila.outerHTML = filaEdicion(cuotasMap[id]);
      const nuevaFila = tbody.querySelector(`tr[data-id="${id}"]`);
      const inputV = nuevaFila?.querySelector(".cuota-input-valor");
      if (inputV) {
        inputV.addEventListener("input", () => {
          const raw = inputV.value.replace(/\D/g, "");
          const cur = inputV.selectionStart;
          const prevLen = inputV.value.length;
          inputV.value = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          inputV.selectionStart = inputV.selectionEnd = cur + (inputV.value.length - prevLen);
        });
      }
      return;
    }

    // ── Cancelar ──
    if (btn.classList.contains("btn-cuota-cancelar")) {
      fila.outerHTML = filaVista(cuotasMap[id]);
      return;
    }

    // ── Guardar ──
    if (btn.classList.contains("btn-cuota-guardar")) {
      const inputFecha = fila.querySelector(".cuota-input-fecha");
      const inputValor = fila.querySelector(".cuota-input-valor");
      const nuevaFecha = inputFecha.value.trim();
      const nuevoValor = Number(inputValor.value.replace(/\./g, ""));

      if (!nuevaFecha || isNaN(Date.parse(nuevaFecha))) {
        window.SGIUI?.toast("La fecha de vencimiento no es válida.", "error", "Error");
        return;
      }
      if (!nuevoValor || nuevoValor <= 0) {
        window.SGIUI?.toast("El valor de la cuota debe ser mayor a 0.", "error", "Error");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Guardando...";

      try {
        await API.patch(`/cuotas/${id}/valores`, {
          valor_cuota:       nuevoValor,
          fecha_vencimiento: nuevaFecha,
        });

        const c = cuotasMap[id];
        c.valor_cuota       = nuevoValor;
        c.valor_pendiente   = nuevoValor;
        c.fecha_vencimiento = nuevaFecha;
        c.dias_atraso       = Math.floor((Date.now() - new Date(nuevaFecha).getTime()) / 86_400_000);

        fila.outerHTML = filaVista(c);
        window.SGIUI?.toast("Cuota actualizada correctamente.", "success", "Éxito");
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Guardar";
        window.SGIUI?.toast(err.message || "Error al guardar la cuota.", "error", "Error");
      }
    }
  });
};

})();