(function () {

window.cuotasView = async function() {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const data = await API.get("/cuotas/pendientes").catch(e => {
    vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    return null;
  });
  if (!data) return;

  const esAuxiliar      = AppState.can('cuotas', 'editar_valores');
  const canPagar        = AppState.can('pagos', 'crear');
  const mostrarAcciones = esAuxiliar || canPagar;

  const cuotasMap = {};
  data.forEach(c => { cuotasMap[c.id_cuota] = c; });
  let motivoPendiente = "";

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function diasCell(dias) {
    if (dias > 0)   return `<span class="badge badge-danger">${dias} días atraso</span>`;
    if (dias === 0) return `<span class="badge badge-warning">Vence hoy</span>`;
    return `<span class="badge badge-success">En ${Math.abs(dias)} días</span>`;
  }

  function filaVista(c) {
    const acciones = [];
    if (esAuxiliar && c.estado !== "pagada") {
      acciones.push(`<button class="btn btn-ghost btn-sm btn-cuota-editar" data-id="${c.id_cuota}">Editar</button>`);
      acciones.push(`<button class="btn btn-ghost btn-sm btn-cuota-fraccionar" data-id="${c.id_cuota}" title="Subdividir en parciales">Subdividir</button>`);
    }
    if (canPagar)
      acciones.push(`<button class="btn btn-primary btn-sm btn-cuota-pagar" data-id="${c.id_cuota}">Pagar</button>`);
    const accionesCell = mostrarAcciones
      ? `<td style="white-space:nowrap">${acciones.join(" ")}</td>`
      : "";
    const fracBadge = c.tiene_fracciones
      ? `<button class="badge badge-info btn-cuota-ver-fracciones" data-id="${c.id_cuota}"
           style="margin-left:.375rem;font-size:.7rem;cursor:pointer;border:none;padding:.2rem .45rem">
           Subdividida ↗
         </button>`
      : "";
    return `<tr data-id="${c.id_cuota}">
      <td>${c.proyecto}</td>
      <td>${c.codigo_lote}</td>
      <td>${c.comprador}</td>
      <td>${c.numero_cuota}${fracBadge}</td>
      <td>${UI.date(c.fecha_vencimiento)}</td>
      <td>${diasCell(c.dias_atraso)}</td>
      <td>${UI.fmt(c.valor_cuota)}</td>
      <td>${UI.fmt(c.valor_pendiente)}</td>
      <td>${UI.badge(c.estado)}</td>
      ${accionesCell}
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
      <td>${diasCell(c.dias_atraso)}</td>
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

  const thAcciones = mostrarAcciones ? "<th>Acciones</th>" : "";
  vc.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <div class="table-header-titles">
          <h3>Cuotas Pendientes</h3>
          <span class="count-chip" id="cuotas-count">${data.length} ${data.length === 1 ? "cuota" : "cuotas"}</span>
        </div>
      </div>

      <div class="table-filters">
        <select id="f-proyecto" class="select-sm" style="flex:1;min-width:9.5rem">
          <option value="">Todos los proyectos</option>
          ${optsProyecto}
        </select>
        <input id="f-lote" type="text" class="filter-input" placeholder="Buscar lote..."
          style="flex:1;min-width:8rem">
        <input id="f-comprador" type="text" class="filter-input" placeholder="Buscar comprador..."
          style="flex:2;min-width:11rem">
        <select id="f-estado" class="select-sm" style="flex:1;min-width:8.75rem">
          <option value="">Todos los estados</option>
          ${optsEstado}
        </select>
        <label style="display:flex;align-items:center;gap:.375rem;font-size:.85rem;white-space:nowrap;cursor:pointer;user-select:none">
          <input type="checkbox" id="f-subdivididas" style="width:1rem;height:1rem;cursor:pointer">
          Solo subdivididas
        </label>
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

  const tbody     = document.getElementById("cuotas-tbody");
  const countChip = document.getElementById("cuotas-count");

  function aplicarFiltros() {
    const fProyecto     = document.getElementById("f-proyecto").value;
    const fLote         = norm(document.getElementById("f-lote").value);
    const fComprador    = norm(document.getElementById("f-comprador").value);
    const fEstado       = document.getElementById("f-estado").value;
    const fSubdivididas = document.getElementById("f-subdivididas").checked;

    const visibles = data.filter(c => {
      if (fProyecto     && c.proyecto    !== fProyecto)                    return false;
      if (fLote         && !norm(c.codigo_lote).includes(fLote))           return false;
      if (fComprador    && !norm(c.comprador).includes(fComprador))        return false;
      if (fEstado       && c.estado      !== fEstado)                      return false;
      if (fSubdivididas && !c.tiene_fracciones)                            return false;
      return true;
    });

    tbody.innerHTML = visibles.map(filaVista).join("");
    document.getElementById("cuotas-empty").style.display = visibles.length ? "none" : "block";
    countChip.textContent = `${visibles.length} ${visibles.length === 1 ? "cuota" : "cuotas"}`;
  }

  ["f-proyecto", "f-estado"].forEach(id =>
    document.getElementById(id).addEventListener("change", aplicarFiltros)
  );
  ["f-lote", "f-comprador"].forEach(id =>
    document.getElementById(id).addEventListener("input", aplicarFiltros)
  );
  document.getElementById("f-subdivididas").addEventListener("change", aplicarFiltros);

  tbody.addEventListener("click", async e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;

    // ── Ver fracciones ──
    if (btn.classList.contains("btn-cuota-ver-fracciones")) {
      verFracciones(cuotasMap[id]);
      return;
    }

    // ── Pagar ──
    if (btn.classList.contains("btn-cuota-pagar")) {
      const c = cuotasMap[id];
      if (c) window.pagoForm(c.id_venta, c);
      return;
    }

    const fila = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!fila) return;

    // ── Editar ──
    if (btn.classList.contains("btn-cuota-editar")) {
      abrirModalJustificacion(cuotasMap[id], fila);
      return;
    }

    // ── Subdividir ──
    if (btn.classList.contains("btn-cuota-fraccionar")) {
      abrirModalFracciones(cuotasMap[id]);
      return;
    }

    // ── Cancelar ──
    if (btn.classList.contains("btn-cuota-cancelar")) {
      fila.outerHTML = filaVista(cuotasMap[id]);
      motivoPendiente = "";
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

      const c = cuotasMap[id];
      const valorCambio = nuevoValor !== Number(c.valor_cuota);
      const fechaCambio = nuevaFecha !== c.fecha_vencimiento;

      if (!valorCambio && !fechaCambio) {
        window.SGIUI?.toast("No se detectaron cambios.", "warning", "Aviso");
        fila.outerHTML = filaVista(c);
        motivoPendiente = "";
        return;
      }

      const diffRows = [
        valorCambio ? `<tr>
          <td style="padding:4px 12px 4px 0;color:var(--text-muted)">Valor</td>
          <td style="padding:4px 12px 4px 0">${UI.fmt(c.valor_cuota)}</td>
          <td style="padding:4px 0;font-weight:700;color:var(--primary,#ff6a00)">${UI.fmt(nuevoValor)}</td>
        </tr>` : "",
        fechaCambio ? `<tr>
          <td style="padding:4px 12px 4px 0;color:var(--text-muted)">Vencimiento</td>
          <td style="padding:4px 12px 4px 0">${UI.date(c.fecha_vencimiento)}</td>
          <td style="padding:4px 0;font-weight:700;color:var(--primary,#ff6a00)">${UI.date(nuevaFecha)}</td>
        </tr>` : "",
      ].join("");

      UI.openModal("Confirmar edición de cuota", `
        <div style="background:var(--surface-2,#f0f4f8);border-radius:.5rem;padding:.625rem 1rem;margin-bottom:1rem;font-size:.84rem">
          <b>Cuota #${c.numero_cuota}</b> · ${c.proyecto} · Lote ${c.codigo_lote}<br>
          <span style="color:var(--text-muted);font-size:.8rem">${c.comprador}</span>
        </div>
        <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.04em;font-weight:600">Cambios a aplicar</p>
        <table style="font-size:.88rem;border-collapse:collapse;margin-bottom:1.25rem;width:100%">
          <thead>
            <tr style="font-size:.75rem;color:var(--text-muted)">
              <th style="padding:0 12px 6px 0;text-align:left;font-weight:500">Campo</th>
              <th style="padding:0 12px 6px 0;text-align:left;font-weight:500">Antes</th>
              <th style="padding:0 0 6px;text-align:left;font-weight:500">Después</th>
            </tr>
          </thead>
          <tbody>${diffRows}</tbody>
        </table>
        <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:.375rem;padding:.625rem .875rem;font-size:.84rem;margin-bottom:1.25rem">
          <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)">Motivo registrado en auditoría</span><br>
          <span>${motivoPendiente}</span>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost" onclick="UI.closeModal()">← Volver</button>
          <button class="btn btn-primary" onclick="_confirmarGuardarCuota()">✓ Confirmar cambio</button>
        </div>
      `);

      window._confirmarGuardarCuota = async function() {
        UI.closeModal();
        try {
          await API.patch(`/cuotas/${id}/valores`, {
            valor_cuota:       nuevoValor,
            fecha_vencimiento: nuevaFecha,
            motivo:            motivoPendiente,
          });
          c.valor_cuota       = nuevoValor;
          c.valor_pendiente   = nuevoValor;
          c.fecha_vencimiento = nuevaFecha;
          c.dias_atraso       = Math.floor((Date.now() - new Date(nuevaFecha).getTime()) / 86_400_000);
          const filaActual = tbody.querySelector(`tr[data-id="${id}"]`);
          if (filaActual) filaActual.outerHTML = filaVista(c);
          motivoPendiente = "";
          window.SGIUI?.toast("Cuota actualizada correctamente.", "success", "Éxito");
        } catch (err) {
          window.SGIUI?.toast(err.message || "Error al guardar la cuota.", "error", "Error");
        }
      };
    }
  });

  // ── Ver fracciones (read-only) ────────────────────────────────────────────────

  async function verFracciones(cuota) {
    UI.openModal(`Subdivisiones — Cuota #${cuota.numero_cuota}`, UI.loader());

    let fracs = [];
    try { fracs = await API.get(`/cuotas/${cuota.id_cuota}/fracciones`); } catch (_) {}

    const filas = fracs.map(f => `
      <tr>
        <td style="text-align:center">${f.numero_fraccion}</td>
        <td style="text-align:right;font-weight:600">${UI.fmt(f.valor_fraccion)}</td>
        <td style="text-align:center">${f.fecha_propuesta ? UI.date(f.fecha_propuesta) : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td style="color:var(--text-muted);font-size:.83rem">${f.notas || '—'}</td>
      </tr>`).join("");

    const total = fracs.reduce((s, f) => s + Number(f.valor_fraccion), 0);

    window._editarFraccionesDesdeVista = function() {
      UI.closeModal();
      setTimeout(() => abrirModalFracciones(cuota), 150);
    };

    document.getElementById("modalBody").innerHTML = `
      <div style="background:var(--surface-2,#f0f4f8);border-radius:.5rem;padding:.625rem .875rem;margin-bottom:1rem;font-size:.84rem">
        <b>Cuota #${cuota.numero_cuota}</b> · ${UI.fmt(cuota.valor_cuota)} · ${cuota.proyecto} · Lote ${cuota.codigo_lote}<br>
        <span style="color:var(--text-muted);font-size:.8rem">${cuota.comprador}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:.88rem">
        <thead>
          <tr style="font-size:.75rem;color:var(--text-muted);border-bottom:1px solid var(--border)">
            <th style="padding:0 .75rem .5rem 0;text-align:center;font-weight:500">Nro.</th>
            <th style="padding:0 .75rem .5rem 0;text-align:right;font-weight:500">Valor</th>
            <th style="padding:0 .75rem .5rem 0;text-align:center;font-weight:500">Fecha propuesta</th>
            <th style="padding:0 0 .5rem;text-align:left;font-weight:500">Notas</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr style="border-top:1px solid var(--border);font-weight:600">
            <td style="padding:.5rem .75rem 0 0;text-align:center">Total</td>
            <td style="padding:.5rem .75rem 0 0;text-align:right">${UI.fmt(total)}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
      <div style="display:flex;gap:.5rem;margin-top:1.25rem">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cerrar</button>
        ${esAuxiliar && cuota.estado !== 'pagada' ? `
          <button class="btn btn-primary" onclick="_editarFraccionesDesdeVista()">
            Editar subdivisión
          </button>` : ''}
      </div>`;
  }

  // ── Edit justification modal ──────────────────────────────────────────────────

  function abrirModalJustificacion(cuota, fila) {
    UI.openModal("Editar cuota — Justificación requerida", `
      <div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:.5rem;padding:.75rem 1rem;margin-bottom:1rem;font-size:.84rem;line-height:1.5">
        La edición de cuotas es una operación <b>excepcional</b>. Aplica solo para corregir
        errores de registro. El cambio quedará registrado en auditoría con tu usuario.
      </div>
      <div style="background:var(--surface-2,#f0f4f8);border-radius:.5rem;padding:.625rem .875rem;margin-bottom:1rem;font-size:.84rem">
        <b>Cuota #${cuota.numero_cuota}</b> · ${UI.fmt(cuota.valor_cuota)} · ${cuota.proyecto} · Lote ${cuota.codigo_lote}<br>
        <span style="color:var(--text-muted);font-size:.8rem">${cuota.comprador}</span>
      </div>
      <div class="form-group">
        <label style="font-weight:600">Motivo del cambio *</label>
        <textarea id="motivo-edicion" rows="3"
          placeholder="Describe claramente por qué debes editar esta cuota (mín. 20 caracteres)"
          oninput="_motivoEdicionInput(this)"
          style="resize:vertical;font-size:.88rem;margin-top:.25rem"></textarea>
        <small id="motivo-counter" style="color:var(--text-muted);font-size:.78rem;display:block;margin-top:.25rem">0 / 20 caracteres mínimo</small>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:1rem">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-continuar-edicion" disabled
                onclick="_continuarEdicion()">Continuar →</button>
      </div>
    `);

    window._motivoEdicionInput = function(el) {
      const len = el.value.trim().length;
      const counter = document.getElementById("motivo-counter");
      if (counter) {
        counter.textContent = `${len} / 20 caracteres mínimo`;
        counter.style.color = len >= 20 ? "var(--success,#22c55e)" : "var(--text-muted)";
      }
      const continuar = document.getElementById("btn-continuar-edicion");
      if (continuar) continuar.disabled = len < 20;
    };

    window._continuarEdicion = function() {
      const motivo = document.getElementById("motivo-edicion").value.trim();
      if (motivo.length < 20) return;
      motivoPendiente = motivo;
      UI.closeModal();

      fila.outerHTML = filaEdicion(cuota);
      const nuevaFila = tbody.querySelector(`tr[data-id="${cuota.id_cuota}"]`);
      const inputV = nuevaFila?.querySelector(".cuota-input-valor");
      if (inputV) MoneyInput.init(inputV, {
        dependsOn: () => Number(cuota.valor_cuota),
      });
    };
  }

  // ── Subdivision modal ─────────────────────────────────────────────────────────

  async function abrirModalFracciones(cuota) {
    UI.openModal(`Subdividir cuota #${cuota.numero_cuota} — ${UI.fmt(cuota.valor_cuota)}`, UI.loader());

    let existing = [];
    try { existing = await API.get(`/cuotas/${cuota.id_cuota}/fracciones`); } catch (_) {}

    const target = Number(cuota.valor_cuota);
    const fracs = existing.length > 0
      ? existing.map(f => ({ valor: Number(f.valor_fraccion), fecha: f.fecha_propuesta || "", notas: f.notas || "" }))
      : [{ valor: target, fecha: "", notas: "" }];
    const hasExisting = existing.length > 0;

    function getTotal() { return fracs.reduce((s, f) => s + (Number(f.valor) || 0), 0); }

    function buildSummaryHTML() {
      const total = getTotal();
      const diff  = target - total;
      const ok    = Math.abs(diff) <= 1;
      const color = ok ? "var(--success,#22c55e)" : "var(--danger,#ef4444)";
      const msg   = ok  ? "✓ Suma correcta"
                  : diff > 0 ? `Faltan ${UI.fmt(diff)}`
                  :             `Excede en ${UI.fmt(-diff)}`;
      return `Total asignado: <b>${UI.fmt(total)}</b> de <b>${UI.fmt(target)}</b>
        &nbsp;—&nbsp;<span style="color:${color};font-weight:600">${msg}</span>`;
    }

    function updateSummary() {
      const el = document.getElementById("fracs-summary");
      if (el) el.innerHTML = buildSummaryHTML();
      const btn = document.getElementById("btn-guardar-fracs");
      if (btn) btn.disabled = Math.abs(getTotal() - target) > 1;
    }

    function fmtF(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

    function buildRowsHTML() {
      return fracs.map((f, i) => `
        <div class="fracs-row" data-frac="${i}" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap">
          <span style="flex-shrink:0;width:1.5rem;line-height:2rem;font-size:.75rem;font-weight:600;color:var(--text-muted);text-align:right">${i + 1}</span>
          <input type="text" inputmode="numeric" placeholder="Valor o % (ej: 0.25)"
                 value="${f.valor > 0 ? fmtF(f.valor) : ""}" class="frac-input-valor"
                 style="flex:1;min-width:7.5rem" data-idx="${i}"/>
          <button type="button"
                  title="Completar con el valor faltante"
                  onclick="_cqFracCompletar(${i})"
                  style="flex-shrink:0;padding:0 .5rem;height:2rem;border:1px dashed var(--border);border-radius:.375rem;background:transparent;color:var(--text-muted);font-size:.8rem;cursor:pointer;white-space:nowrap"
                  onmouseover="this.style.borderColor='var(--primary,#ff6a00)';this.style.color='var(--primary,#ff6a00)'"
                  onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">=</button>
          <input type="date" value="${f.fecha || ""}" class="frac-input-fecha"
                 style="flex:1;min-width:8.75rem" data-idx="${i}"
                 oninput="_cqFracFechaInput(this,${i})"/>
          <input type="text" placeholder="Nota (opcional)"
                 value="${(f.notas || "").replace(/"/g, "&quot;")}"
                 class="frac-input-notas" style="flex:2;min-width:8.75rem" data-idx="${i}"
                 oninput="_cqFracNotasInput(this,${i})"/>
          ${fracs.length > 1 ? `
            <button type="button" class="btn btn-ghost btn-sm"
                    style="padding:2px 8px;flex-shrink:0;color:var(--danger)"
                    onclick="_cqFracEliminar(${i})">✕</button>` : ""}
        </div>`).join("");
    }

    function initFracInputs() {
      document.getElementById("fracs-lista")?.querySelectorAll(".frac-input-valor").forEach((inp, i) => {
        MoneyInput.init(inp, {
          dependsOn: () => target,
          onChange: () => { fracs[i].valor = MoneyInput.parse(inp.value); updateSummary(); },
        });
      });
    }

    function renderFracs() {
      const lista = document.getElementById("fracs-lista");
      if (!lista) return;
      lista.innerHTML = buildRowsHTML();
      initFracInputs();
      updateSummary();
    }

    document.getElementById("modalBody").innerHTML = `
      <div style="margin-bottom:.75rem;padding:.625rem .875rem;background:var(--surface-2,#f0f4f8);border-radius:.5rem;font-size:.84rem;line-height:1.6">
        <b>Cuota #${cuota.numero_cuota}</b> · ${UI.fmt(target)} · ${cuota.proyecto} · Lote ${cuota.codigo_lote}<br>
        <span style="color:var(--text-muted)">
          Subdividir <b>no</b> modifica el saldo real. Solo organiza cómo se recibirá el cobro.
        </span>
      </div>

      <div id="fracs-lista" style="margin-bottom:.25rem">${buildRowsHTML()}</div>

      <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:.75rem"
              onclick="_cqFracAgregar()">+ Agregar fracción</button>

      <div id="fracs-summary" style="padding:.5rem .75rem;background:var(--surface-2,#f0f4f8);
           border-radius:.375rem;font-size:.85rem;margin-bottom:.875rem">
        ${buildSummaryHTML()}
      </div>

      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        ${hasExisting ? `
          <button class="btn btn-ghost" style="color:var(--danger)"
                  onclick="_cqFracEliminarTodas(${cuota.id_cuota})">Eliminar subdivisión</button>` : ""}
        <button class="btn btn-primary" id="btn-guardar-fracs"
                ${Math.abs(getTotal() - target) > 1 ? "disabled" : ""}
                onclick="_cqFracGuardar(${cuota.id_cuota})">
          Guardar subdivisión
        </button>
      </div>`;

    initFracInputs();
    updateSummary();

    window._cqFracFechaInput  = (el, idx) => { fracs[idx].fecha = el.value; };
    window._cqFracNotasInput  = (el, idx) => { fracs[idx].notas = el.value; };

    window._cqFracCompletar = function(idx) {
      const otrosTotal = fracs.reduce((s, f, i) => i === idx ? s : s + (Number(f.valor) || 0), 0);
      const resto = target - otrosTotal;
      if (resto <= 0) {
        window.SGIUI?.toast("No hay valor faltante para completar.", "warning", "Aviso");
        return;
      }
      fracs[idx].valor = resto;
      const input = document.querySelector(`.frac-input-valor[data-idx="${idx}"]`);
      if (input) {
        input.value = fmtF(resto);
        input.dispatchEvent(new Event("input"));
      }
      updateSummary();
    };

    window._cqFracAgregar = function() {
      fracs.push({ valor: 0, fecha: "", notas: "" });
      renderFracs();
    };

    window._cqFracEliminar = function(idx) {
      fracs.splice(idx, 1);
      renderFracs();
    };

    window._cqFracEliminarTodas = async function(idCuota) {
      if (!confirm("¿Eliminar todas las subdivisiones de esta cuota?")) return;
      try {
        await API.delete(`/cuotas/${idCuota}/fracciones`);
        UI.closeModal();
        cuotasMap[idCuota].tiene_fracciones = false;
        const fila = tbody.querySelector(`tr[data-id="${idCuota}"]`);
        if (fila) fila.outerHTML = filaVista(cuotasMap[idCuota]);
        window.SGIUI?.toast("Subdivisiones eliminadas.", "success", "Listo");
      } catch (e) {
        window.SGIUI?.toast(e.message || "Error al eliminar.", "error", "Error");
      }
    };

    window._cqFracGuardar = async function(idCuota) {
      const btn = document.getElementById("btn-guardar-fracs");
      if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
      try {
        await API.post(`/cuotas/${idCuota}/fracciones`, {
          fracciones: fracs.map(f => ({
            valor_fraccion:  Number(f.valor),
            fecha_propuesta: f.fecha || undefined,
            notas:           f.notas?.trim() || undefined,
          })),
        });
        UI.closeModal();
        cuotasMap[idCuota].tiene_fracciones = true;
        const fila = tbody.querySelector(`tr[data-id="${idCuota}"]`);
        if (fila) fila.outerHTML = filaVista(cuotasMap[idCuota]);
        window.SGIUI?.toast("Subdivisión guardada correctamente.", "success", "Listo");
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = "Guardar subdivisión"; }
        window.SGIUI?.toast(e.message || "Error al guardar.", "error", "Error");
      }
    };
  }
};

})();
