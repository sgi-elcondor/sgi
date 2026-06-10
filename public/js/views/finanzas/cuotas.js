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

    // ── Editar (reajuste de plan con cuadre) ──
    if (btn.classList.contains("btn-cuota-editar")) {
      abrirModalReajustePlan(cuotasMap[id]);
      return;
    }

    // ── Subdividir ──
    if (btn.classList.contains("btn-cuota-fraccionar")) {
      abrirModalFracciones(cuotasMap[id]);
      return;
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

  // ── Reajuste de plan con cuadre manual (A/RN-17) ──────────────────────────────
  // Editar valores no cambia la deuda total: Σcuotas debe seguir = valor financiado.

  async function abrirModalReajustePlan(cuotaCtx) {
    const idVenta = cuotaCtx?.id_venta;
    if (!idVenta) return window.SGIUI?.toast("No se pudo identificar la venta.", "error", "Error");

    UI.openModal(`Reajustar plan — Venta #${idVenta}`, UI.loader());

    let venta;
    try { venta = await API.get(`/ventas/${idVenta}`); }
    catch (e) {
      document.getElementById("modalBody").innerHTML = `<p style="color:var(--danger);padding:1rem">${e.message}</p>`;
      return;
    }

    const cuotasV    = (venta.cuota || []).slice().sort((a, b) => a.numero_cuota - b.numero_cuota);
    const financiado = Math.max(0, Number(venta.valor_total || 0) - Number(venta.total_permutas || 0));
    const tol        = Math.max(1, cuotasV.length);

    const rows = cuotasV.map(c => {
      const pagada      = c.pagada === true || c.estado === "pagada";
      const valorLocked = pagada || c.tiene_fracciones === true || c.factura_activa === true;
      const hint        = pagada               ? "Pagada"
                        : c.tiene_fracciones    ? "Subdividida"
                        : c.factura_activa      ? "Con factura activa"
                        : Number(c.valor_pagado || 0) > 0 ? `mín ${UI.fmt(c.valor_pagado)}` : "";
      return {
        id_cuota:   c.id_cuota,
        numero:     c.numero_cuota,
        pagada,
        valorLocked,
        hint,
        valor:      Number(c.valor_cuota),
        fecha:      c.fecha_vencimiento,
        orig_valor: Number(c.valor_cuota),
        orig_fecha: c.fecha_vencimiento,
      };
    });

    const sumTotal = () => rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);
    const balanced = () => Math.abs(financiado - sumTotal()) <= tol;

    function summaryHTML() {
      const diff  = financiado - sumTotal();
      const ok    = Math.abs(diff) <= tol;
      const color = ok ? "var(--success,#22c55e)" : "var(--danger,#ef4444)";
      const msg   = ok ? "✓ El plan cuadra"
                  : diff > 0 ? `Faltan ${UI.fmt(diff)} por repartir`
                  :            `Sobran ${UI.fmt(-diff)}`;
      return `Suma de cuotas: <b>${UI.fmt(sumTotal())}</b> de <b>${UI.fmt(financiado)}</b> (financiado)
        &nbsp;—&nbsp;<span style="color:${color};font-weight:600">${msg}</span>`;
    }

    function refreshState() {
      const s = document.getElementById("rp-summary");
      if (s) s.innerHTML = summaryHTML();
      const motivo = (document.getElementById("rp-motivo")?.value || "").trim();
      const mc = document.getElementById("rp-motivo-counter");
      if (mc) {
        mc.textContent = `${motivo.length} / 20 caracteres mínimo`;
        mc.style.color = motivo.length >= 20 ? "var(--success,#22c55e)" : "var(--text-muted)";
      }
      const btn = document.getElementById("rp-guardar");
      if (btn) btn.disabled = !balanced() || motivo.length < 20;
    }

    const rowsHTML = () => rows.map((r, i) => {
      const fechaCell = r.pagada
        ? `<td style="padding:.35rem">${UI.date(r.fecha)}</td>`
        : `<td style="padding:.35rem"><input type="date" class="rp-fecha" data-idx="${i}" value="${r.fecha || ""}" style="width:148px"></td>`;
      const valorCell = r.valorLocked
        ? `<td style="padding:.35rem;text-align:right;font-weight:600">${UI.fmt(r.valor)}</td>`
        : `<td style="padding:.35rem"><input type="text" inputmode="numeric" class="rp-valor" data-idx="${i}" value="${MoneyInput.format(r.valor)}" style="width:140px;text-align:right"></td>`;
      return `<tr${r.pagada ? ' style="opacity:.55"' : ""}>
        <td style="padding:.35rem;text-align:center">${r.numero}</td>
        ${fechaCell}
        ${valorCell}
        <td style="padding:.35rem;text-align:center;font-size:.74rem;color:var(--text-muted)">${r.hint || "—"}</td>
      </tr>`;
    }).join("");

    document.getElementById("modalBody").innerHTML = `
      <div style="margin-bottom:.75rem;padding:.625rem .875rem;background:var(--surface-2,#f0f4f8);border-radius:.5rem;font-size:.84rem;line-height:1.6">
        Editar valores <b>no cambia la deuda total</b>. La suma de las cuotas debe seguir siendo
        <b>${UI.fmt(financiado)}</b> (valor financiado): reparte la diferencia entre las cuotas no pagadas.
      </div>
      <div style="max-height:42vh;overflow-y:auto;border:1px solid var(--border);border-radius:.5rem">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead>
            <tr style="font-size:.72rem;color:var(--text-muted);position:sticky;top:0;background:var(--surface)">
              <th style="padding:.4rem;text-align:center">Cuota</th>
              <th style="padding:.4rem;text-align:left">Vencimiento</th>
              <th style="padding:.4rem;text-align:right">Valor</th>
              <th style="padding:.4rem;text-align:center"></th>
            </tr>
          </thead>
          <tbody id="rp-rows">${rowsHTML()}</tbody>
        </table>
      </div>
      <div id="rp-summary" style="padding:.5rem .75rem;background:var(--surface-2,#f0f4f8);border-radius:.375rem;font-size:.85rem;margin:.75rem 0">${summaryHTML()}</div>
      <div class="form-group">
        <label style="font-weight:600">Motivo del reajuste *</label>
        <textarea id="rp-motivo" rows="2" placeholder="Describe por qué se reajusta el plan (mín. 20 caracteres)" style="resize:vertical"></textarea>
        <small id="rp-motivo-counter" style="color:var(--text-muted);font-size:.78rem">0 / 20 caracteres mínimo</small>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:.5rem">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="rp-guardar" disabled>Guardar reajuste</button>
      </div>`;

    document.querySelectorAll("#rp-rows .rp-valor").forEach(inp => {
      const i = Number(inp.dataset.idx);
      MoneyInput.init(inp, {
        dependsOn: () => financiado,
        onChange: () => { rows[i].valor = MoneyInput.parse(inp.value); refreshState(); },
      });
    });
    document.querySelectorAll("#rp-rows .rp-fecha").forEach(inp => {
      const i = Number(inp.dataset.idx);
      inp.addEventListener("input", () => { rows[i].fecha = inp.value; });
    });
    document.getElementById("rp-motivo")?.addEventListener("input", refreshState);
    refreshState();

    document.getElementById("rp-guardar")?.addEventListener("click", async () => {
      const motivo = (document.getElementById("rp-motivo")?.value || "").trim();
      if (!balanced() || motivo.length < 20) return;

      const cambios = rows
        .filter(r => !r.pagada && ((!r.valorLocked && Number(r.valor) !== r.orig_valor) || r.fecha !== r.orig_fecha))
        .map(r => {
          const ch = { id_cuota: r.id_cuota };
          if (!r.valorLocked && Number(r.valor) !== r.orig_valor) ch.valor_cuota = Number(r.valor);
          if (r.fecha !== r.orig_fecha) ch.fecha_vencimiento = r.fecha;
          return ch;
        });
      if (!cambios.length) { window.SGIUI?.toast("No se detectaron cambios.", "warning", "Aviso"); return; }

      const btn = document.getElementById("rp-guardar");
      btn.disabled = true; btn.textContent = "Guardando...";
      try {
        await API.patch(`/cuotas/venta/${idVenta}/valores`, { cambios, motivo });
        UI.closeModal();
        window.SGIUI?.toast("Plan de cuotas reajustado.", "success", "Listo");
        window.cuotasView();
      } catch (e) {
        btn.disabled = false; btn.textContent = "Guardar reajuste";
        window.SGIUI?.toast(e.message || "Error al guardar.", "error", "Error");
      }
    });
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
