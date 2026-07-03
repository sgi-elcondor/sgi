(function () {

  // ── Module state (shared between the master "Cuotas por Venta" list and the
  //    per-venta detail view, mirroring the pagos.js pattern) ────────────────────
  let _cuotas    = [];   // all pending cuotas (flat)
  let _cuotasMap = {};    // by id_cuota
  let _grupos    = [];    // grouped by venta
  let _activeGroupKey = null; // key of the venta shown in detail, or null on master
  let esAuxiliar    = false;
  let canPagar      = false;
  let mostrarAcciones = false;
  let canEliminar   = false;
  let _elimJustificacion = "";

  const EXPORT_ROLES = ["admin", "gerencia", "auxiliar_contable"];

  function groupKey(c) { return String(c.id_venta ?? c.codigo_venta ?? "none"); }

  function diasCell(dias) {
    if (dias > 0)   return `<span class="badge badge-danger">${dias} días atraso</span>`;
    if (dias === 0) return `<span class="badge badge-warning">Vence hoy</span>`;
    return `<span class="badge badge-success">En ${Math.abs(dias)} días</span>`;
  }

  function diasTexto(dias) {
    const d = Number(dias);
    if (d > 0)   return `${d} días de atraso`;
    if (d === 0) return "Vence hoy";
    return `Faltan ${Math.abs(d)} días`;
  }

  function accionesCuota(c) {
    const acciones = [];
    if (esAuxiliar && c.estado !== "pagada") {
      acciones.push(`<button class="btn btn-ghost btn-sm btn-cuota-editar" data-id="${c.id_cuota}">Editar</button>`);
      acciones.push(`<button class="btn btn-ghost btn-sm btn-cuota-fraccionar" data-id="${c.id_cuota}" title="Subdividir en parciales">Subdividir</button>`);
    }
    if (canPagar)
      acciones.push(`<button class="btn btn-primary btn-sm btn-cuota-pagar" data-id="${c.id_cuota}">Pagar</button>`);
    if (canEliminar && c.estado !== "pagada" && !c.tiene_fracciones)
      acciones.push(`<button class="btn btn-danger btn-sm btn-cuota-eliminar" data-id="${c.id_cuota}" title="Eliminar cuota">Eliminar</button>`);
    return acciones.join(" ");
  }

  // Detail row: a single cuota of the opened venta (proyecto/lote/comprador live in the header).
  function filaCuota(c) {
    const fracBadge = c.tiene_fracciones
      ? `<button class="badge badge-info btn-cuota-ver-fracciones" data-id="${c.id_cuota}"
           style="margin-left:.375rem;font-size:.7rem;cursor:pointer;border:none;padding:.2rem .45rem">
           Subdividida ↗
         </button>`
      : "";
    const accionesCell = mostrarAcciones
      ? `<td style="white-space:nowrap">${accionesCuota(c)}</td>`
      : "";
    return `<tr data-id="${c.id_cuota}">
      <td>${c.numero_cuota}${fracBadge}</td>
      <td>${UI.date(c.fecha_vencimiento)}</td>
      <td>${diasCell(c.dias_atraso)}</td>
      <td>${UI.fmt(c.valor_cuota)}</td>
      <td>${UI.fmt(c.valor_pendiente)}</td>
      <td>${UI.badge(c.estado)}</td>
      ${accionesCell}
    </tr>`;
  }

  // ── Master list: cuotas grouped by venta ──────────────────────────────────────

  window.cuotasView = async function() {
    const vc = document.getElementById("viewContainer");
    vc.innerHTML = UI.loader();

    const data = await API.get("/cuotas/pendientes").catch(e => {
      vc.innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
      return null;
    });
    if (!data) return;

    _activeGroupKey = null;
    esAuxiliar      = AppState.can('cuotas', 'editar_valores');
    canPagar        = AppState.can('pagos', 'crear');
    canEliminar     = esAuxiliar || AppState.can('cuotas', 'eliminar');
    mostrarAcciones = esAuxiliar || canPagar || canEliminar;
    const canExport = EXPORT_ROLES.includes(window.currentUser?.rol);

    _cuotas    = data;
    _cuotasMap = {};
    data.forEach(c => { _cuotasMap[c.id_cuota] = c; });

    const ventasMap = new Map();
    data.forEach(c => {
      const k = groupKey(c);
      if (!ventasMap.has(k)) {
        ventasMap.set(k, {
          id_venta:     c.id_venta,
          codigo_venta: c.codigo_venta,
          comprador:    c.comprador,
          documento:    c.documento,
          proyecto:     c.proyecto,
          codigo_lote:  c.codigo_lote,
          cuotas:       [],
        });
      }
      ventasMap.get(k).cuotas.push(c);
    });
    _grupos = [...ventasMap.values()].sort((a, b) => (b.id_venta || 0) - (a.id_venta || 0));

    const proyectos = [...new Set(data.map(c => c.proyecto))].filter(p => p && p !== "—").sort();
    const estados   = [...new Set(data.map(c => c.estado))].sort();

    const cuotasVencidas  = data.filter(c => Number(c.dias_atraso) > 0).length;
    const cuotasHoy       = data.filter(c => Number(c.dias_atraso) === 0).length;
    const cuotasPorCobrar = data.reduce((s, c) => s + Number(c.valor_pendiente || 0), 0);

    vc.innerHTML = `
      ${window.SGIUI.statCards([
        { label: "Cuotas",     value: data.length,             sub: "Pendientes" },
        { label: "Vencidas",   value: cuotasVencidas,          sub: "En atraso", tone: cuotasVencidas ? "danger" : "" },
        { label: "Vencen hoy", value: cuotasHoy,               sub: "Atención",  tone: cuotasHoy ? "warning" : "" },
        { label: "Por cobrar", value: window.SGIUI.fmtCompactMoney(cuotasPorCobrar), title: UI.fmt(cuotasPorCobrar), sub: "Saldo pendiente" },
      ])}
      <div class="table-wrap">
        <div class="table-header">
          <div class="table-header-titles">
            <h3>Cuotas por Venta</h3>
            <span class="count-chip" id="cuotas-count">${_grupos.length} venta${_grupos.length === 1 ? "" : "s"}</span>
          </div>
          ${canExport ? `<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
            <button class="btn btn-ghost btn-sm" id="cuotas-export-excel">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Exportar Excel
            </button>
            <button class="btn btn-ghost btn-sm" id="cuotas-export-pdf">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9" x2="10" y2="9"/></svg>
              Exportar PDF
            </button>
          </div>` : ""}
        </div>

        ${window.SGIUI.filterBar({
          fields: [
            { type: "select", id: "f-proyecto", label: "Proyecto",
              options: [{ value: "", label: "Todos los proyectos" }, ...proyectos.map(p => ({ value: p, label: p }))] },
            { type: "search", id: "f-buscar", label: "Buscar", placeholder: "Comprador, documento, lote o código de venta…", grow: true },
            { type: "select", id: "f-estado", label: "Estado",
              options: [{ value: "", label: "Todos los estados" }, ...estados.map(s => ({ value: s, label: s }))] },
          ],
          actions: `<label style="display:flex;align-items:center;gap:.375rem;font-size:.85rem;white-space:nowrap;cursor:pointer;user-select:none;padding-bottom:.4rem">
            <input type="checkbox" id="f-subdivididas" style="width:1rem;height:1rem;cursor:pointer"> Solo subdivididas
          </label>
          <button class="btn btn-ghost btn-sm" id="cuotas-limpiar">Limpiar</button>`,
        })}

        <div class="sticky-table-scroll">
          <table>
            <thead><tr>
              <th>Venta</th><th>Comprador</th><th>Proyecto / Lote</th>
              <th style="text-align:center">Cuotas</th>
              <th style="text-align:right">Pendiente</th>
              <th>Estado</th><th></th>
            </tr></thead>
            <tbody id="cuotas-grupos-tbody">${_grupos.map(filaVenta).join("")}</tbody>
          </table>
          <p id="cuotas-grupos-empty" style="display:none;text-align:center;color:var(--text-muted);padding:1.5rem">
            No hay ventas con cuotas pendientes que coincidan con los filtros.
          </p>
        </div>
      </div>`;

    const tbody = document.getElementById("cuotas-grupos-tbody");

    function aplicarFiltros() {
      const fProyecto     = document.getElementById("f-proyecto").value;
      const fBuscar       = document.getElementById("f-buscar").value;
      const fEstado       = document.getElementById("f-estado").value;
      const fSubdivididas = document.getElementById("f-subdivididas").checked;

      const visibles = _grupos.filter(g => {
        if (fProyecto && g.proyecto !== fProyecto) return false;
        if (!SGISearch.matches(fBuscar, g.comprador, g.documento, g.codigo_lote, g.proyecto, SGIUI.ventaCode(g))) return false;
        if (fEstado && !g.cuotas.some(c => c.estado === fEstado)) return false;
        if (fSubdivididas && !g.cuotas.some(c => c.tiene_fracciones)) return false;
        return true;
      });

      tbody.innerHTML = visibles.map(filaVenta).join("");
      document.getElementById("cuotas-grupos-empty").style.display = visibles.length ? "none" : "block";
      const cnt = document.getElementById("cuotas-count");
      if (cnt) cnt.textContent = `${visibles.length} venta${visibles.length === 1 ? "" : "s"}`;
    }

    ["f-proyecto", "f-estado"].forEach(id =>
      document.getElementById(id).addEventListener("change", aplicarFiltros)
    );
    document.getElementById("f-buscar").addEventListener("input", aplicarFiltros);
    document.getElementById("f-subdivididas").addEventListener("change", aplicarFiltros);
    document.getElementById("cuotas-limpiar").addEventListener("click", () => {
      ["f-proyecto", "f-buscar", "f-estado"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
      const sub = document.getElementById("f-subdivididas");
      if (sub) sub.checked = false;
      aplicarFiltros();
    });

    if (canExport) {
      document.getElementById("cuotas-export-excel")?.addEventListener("click", () => exportCuotasExcel(_cuotasVisibles()));
      document.getElementById("cuotas-export-pdf")?.addEventListener("click", () => exportCuotasPDF(_cuotasVisibles()));
    }

    tbody.addEventListener("click", e => {
      const btn = e.target.closest(".btn-ver-cuotas");
      if (!btn) return;
      const row = btn.closest("tr[data-grupo-key]");
      if (!row) return;
      const g = _grupos.find(x => groupKey({ id_venta: x.id_venta, codigo_venta: x.codigo_venta }) === row.dataset.grupoKey);
      if (g) window.cuotasDeVentaView(g);
    });
  };

  function filaVenta(g) {
    const pendiente = g.cuotas.reduce((s, c) => s + Number(c.valor_pendiente || 0), 0);
    const vencidas  = g.cuotas.filter(c => Number(c.dias_atraso) > 0).length;
    const estadoCell = vencidas
      ? `<span class="badge badge-danger">${vencidas} vencida${vencidas > 1 ? "s" : ""}</span>`
      : `<span class="badge badge-success">Al día</span>`;
    return `<tr data-grupo-key="${groupKey({ id_venta: g.id_venta, codigo_venta: g.codigo_venta })}" style="cursor:pointer">
      <td><strong>${SGIUI.ventaCode(g)}</strong></td>
      <td>${g.comprador}</td>
      <td>${g.proyecto !== "—" ? `${g.proyecto} · <strong>${g.codigo_lote}</strong>` : "—"}</td>
      <td style="text-align:center"><strong>${g.cuotas.length}</strong></td>
      <td style="text-align:right">${UI.fmt(pendiente)}</td>
      <td>${estadoCell}</td>
      <td><button class="btn btn-ghost btn-sm btn-ver-cuotas">Ver <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></td>
    </tr>`;
  }

  // ── Detail view: every pending cuota of one venta ─────────────────────────────

  window.cuotasDeVentaView = function(grupo) {
    _activeGroupKey = groupKey({ id_venta: grupo.id_venta, codigo_venta: grupo.codigo_venta });
    const vc = document.getElementById("viewContainer");

    const thAcciones = mostrarAcciones ? "<th>Acciones</th>" : "";
    const pendiente  = grupo.cuotas.reduce((s, c) => s + Number(c.valor_pendiente || 0), 0);

    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="cuotasView()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Volver</button>
            <h3>Cuotas &mdash; Venta ${SGIUI.ventaCode(grupo)}</h3>
          </div>
        </div>
        <div style="background:var(--surface-2,#f0f4f8);border-radius:8px;padding:12px 16px;margin-bottom:1rem;font-size:.88rem;display:flex;gap:24px;flex-wrap:wrap">
          <span><span style="color:var(--text-muted)">Cliente:</span> <strong>${grupo.comprador}</strong></span>
          <span><span style="color:var(--text-muted)">Proyecto:</span> <strong>${grupo.proyecto}</strong></span>
          <span><span style="color:var(--text-muted)">Lote:</span> <strong>${grupo.codigo_lote}</strong></span>
          <span><span style="color:var(--text-muted)">Saldo pendiente:</span> <strong>${UI.fmt(pendiente)}</strong></span>
        </div>
        <div class="sticky-table-scroll">
          <table>
            <thead><tr>
              <th>Nro.</th><th>Vencimiento</th><th>Días</th>
              <th>Valor</th><th>Pendiente</th><th>Estado</th>${thAcciones}
            </tr></thead>
            <tbody id="cuotas-detalle-tbody">${grupo.cuotas.map(filaCuota).join("")}</tbody>
          </table>
          ${!grupo.cuotas.length
            ? `<p style="text-align:center;color:var(--text-muted);padding:1.5rem">Sin cuotas pendientes para esta venta</p>`
            : ""}
        </div>
      </div>`;

    wireCuotaActions(document.getElementById("cuotas-detalle-tbody"));
  };

  // Re-render whichever view is active after a mutation (subdivision, etc.).
  function refreshActive() {
    if (_activeGroupKey) {
      const g = _grupos.find(x => groupKey({ id_venta: x.id_venta, codigo_venta: x.codigo_venta }) === _activeGroupKey);
      if (g) return window.cuotasDeVentaView(g);
    }
    window.cuotasView();
  }

  function wireCuotaActions(tbody) {
    if (!tbody) return;
    tbody.addEventListener("click", async e => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.id;

      if (btn.classList.contains("btn-cuota-ver-fracciones")) { verFracciones(_cuotasMap[id]); return; }
      if (btn.classList.contains("btn-cuota-pagar")) {
        const c = _cuotasMap[id];
        if (c) window.pagoForm(c.id_venta, c);
        return;
      }
      if (btn.classList.contains("btn-cuota-editar"))     { abrirModalReajustePlan(_cuotasMap[id]); return; }
      if (btn.classList.contains("btn-cuota-fraccionar")) { abrirModalFracciones(_cuotasMap[id]); return; }
      if (btn.classList.contains("btn-cuota-eliminar"))   { abrirModalEliminarCuota(_cuotasMap[id]); return; }
    });
  }

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

  async function abrirModalReajustePlan(cuotaCtx) {
    const idVenta = cuotaCtx?.id_venta;
    if (!idVenta) return window.SGIUI?.toast("No se pudo identificar la venta.", "error", "Error");

    UI.openModal(`Reajustar plan — Venta ${SGIUI.ventaCode(cuotaCtx)}`, UI.loader());

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
      const conPagos    = c.factura_con_pagos === true || Number(c.valor_pagado || 0) > 0;
      // An 'emitida' factura without receipts does NOT lock: on a value change it is
      // auto-annulled (§4.3) and the cuota is re-billed for approval.
      const valorLocked = pagada || c.tiene_fracciones === true || conPagos;
      const regenera    = !valorLocked && c.factura_activa === true;
      const hint        = pagada               ? "Pagada"
                        : c.tiene_fracciones    ? "Subdividida"
                        : conPagos              ? "Con pagos aplicados"
                        : regenera              ? "Factura se regenerará"
                        : "";
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
        const r = await API.patch(`/cuotas/venta/${idVenta}/valores`, { cambios, motivo });
        UI.closeModal();
        // §4.3: if a value change auto-annulled facturas, reopen the generation preview with
        // the new values/dates so the aux re-emits (approves) them.
        const n = Number(r?.facturas_anuladas || 0);
        if (n > 0 && typeof window.regenerarFacturasVenta === "function") {
          window.SGIUI?.toast(`Plan reajustado · ${n} factura${n !== 1 ? "s" : ""} anulada${n !== 1 ? "s" : ""} para regenerar.`, "success", "Listo");
          window.regenerarFacturasVenta(idVenta);
        } else {
          window.SGIUI?.toast("Plan de cuotas reajustado.", "success", "Listo");
          window.cuotasView();
        }
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
        if (_cuotasMap[idCuota]) _cuotasMap[idCuota].tiene_fracciones = false;
        window.SGIUI?.toast("Subdivisiones eliminadas.", "success", "Listo");
        refreshActive();
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
        if (_cuotasMap[idCuota]) _cuotasMap[idCuota].tiene_fracciones = true;
        window.SGIUI?.toast("Subdivisión guardada correctamente.", "success", "Listo");
        refreshActive();
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = "Guardar subdivisión"; }
        window.SGIUI?.toast(e.message || "Error al guardar.", "error", "Error");
      }
    };
  }

  // ── Eliminar cuota (ALR-01) ───────────────────────────────────────────────────

  function abrirModalEliminarCuota(cuota) {
    if (!cuota) return;
    const isAdmin = window.currentUser?.rol === 'admin';

    function updateCounter() {
      const len = (document.getElementById("elim-justificacion")?.value || "").trim().length;
      const counter = document.getElementById("elim-counter");
      const btn     = document.getElementById("btn-elim-continuar");
      if (counter) {
        counter.textContent = `${len} / 20 caracteres mínimo`;
        counter.style.color = len >= 20 ? "var(--success,#22c55e)" : "var(--text-muted)";
      }
      if (btn) btn.disabled = len < 20;
    }

    window._cqElimContinuar = function() {
      _elimJustificacion = (document.getElementById("elim-justificacion")?.value || "").trim();
      if (_elimJustificacion.length < 20) return;

      if (!isAdmin) {
        document.getElementById("modalBody").innerHTML = `
          <div style="background:var(--warning-soft,#fef9c3);border:1px solid var(--warning,#eab308);border-radius:.5rem;padding:.875rem 1rem;margin-bottom:1.25rem;font-size:.875rem">
            <strong>Autorización requerida</strong><br>
            Como auxiliar contable no puede ejecutar esta eliminación directamente.
            Comparta la justificación con un administrador y solicítele que la confirme desde su sesión.
          </div>
          <div style="background:var(--surface-2,#f0f4f8);border-radius:.5rem;padding:.75rem 1rem;font-size:.875rem;font-style:italic;margin-bottom:1.5rem">
            "${_elimJustificacion}"
          </div>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-ghost" onclick="UI.closeModal()">Cerrar</button>
          </div>`;
        return;
      }

      document.getElementById("modalBody").innerHTML = `
        <div style="background:var(--danger-soft,#fee2e2);border:1px solid var(--danger,#ef4444);border-radius:.5rem;padding:.75rem 1rem;margin-bottom:1.25rem;font-size:.85rem">
          <strong>Confirmar eliminación irreversible</strong><br>
          La cuota será eliminada permanentemente y el cambio quedará registrado en auditoría.
        </div>
        <div style="background:var(--surface-2,#f0f4f8);border-radius:.5rem;padding:.625rem .875rem;margin-bottom:1.25rem;font-size:.84rem">
          <strong>Cuota #${cuota.numero_cuota}</strong> · ${UI.fmt(cuota.valor_cuota)} · Vence ${UI.date(cuota.fecha_vencimiento)}<br>
          <span style="color:var(--text-muted);font-size:.8rem">${cuota.comprador || ""}</span>
        </div>
        <div style="font-size:.855rem;margin-bottom:1.5rem">
          <span style="color:var(--text-muted)">Justificación:</span><br>
          <em>${_elimJustificacion}</em>
        </div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
          <button id="btn-elim-ejecutar" class="btn btn-danger" onclick="_cqElimEjecutar(${cuota.id_cuota})">
            Eliminar definitivamente
          </button>
        </div>`;
    };

    window._cqElimEjecutar = async function(idCuota) {
      const btn = document.getElementById("btn-elim-ejecutar");
      if (btn) { btn.disabled = true; btn.textContent = "Eliminando..."; }
      try {
        await API.delete(`/cuotas/${idCuota}`, { justificacion: _elimJustificacion });
        UI.closeModal();
        window.SGIUI?.toast("Cuota eliminada correctamente.", "success", "Listo");
        delete _cuotasMap[idCuota];
        refreshActive();
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = "Eliminar definitivamente"; }
        window.SGIUI?.toast(e.message || "Error al eliminar la cuota.", "error", "Error");
      }
    };

    const politica = isAdmin
      ? "Como administrador puede confirmar y ejecutar la eliminación directamente."
      : "Como auxiliar contable puede iniciar la solicitud, pero <strong>un administrador debe confirmarla</strong> desde su sesión.";

    UI.openModal(`Eliminar cuota #${cuota.numero_cuota}`, `
      <div style="background:var(--warning-soft,#fef9c3);border:1px solid var(--warning,#eab308);border-radius:.5rem;padding:.75rem 1rem;margin-bottom:1.25rem;font-size:.85rem">
        <strong>Política de eliminación de cuotas</strong><br>
        Una cuota solo puede eliminarse cuando no tiene pagos, facturas activas ni subdivisiones.
        Esta operación es <strong>irreversible</strong>. ${politica}
      </div>
      <div style="background:var(--surface-2,#f0f4f8);border-radius:.5rem;padding:.625rem .875rem;margin-bottom:1.25rem;font-size:.84rem">
        <strong>Cuota #${cuota.numero_cuota}</strong> · ${UI.fmt(cuota.valor_cuota)} · Vence ${UI.date(cuota.fecha_vencimiento)}<br>
        <span style="color:var(--text-muted);font-size:.8rem">${cuota.comprador || ""}</span>
      </div>
      <label style="font-size:.85rem;font-weight:500;margin-bottom:.375rem;display:block">
        Justificación <span style="color:var(--danger)">*</span>
      </label>
      <textarea id="elim-justificacion" rows="3"
        placeholder="Describe el motivo de la eliminación (mín. 20 caracteres)"
        style="width:100%;padding:.5rem .75rem;border:1px solid var(--border);border-radius:.375rem;font-size:.875rem;resize:vertical;box-sizing:border-box"
        oninput="_cqElimCounter()"></textarea>
      <small id="elim-counter" style="color:var(--text-muted);font-size:.78rem;display:block;margin-top:.25rem">0 / 20 caracteres mínimo</small>
      <div style="display:flex;gap:.5rem;margin-top:1.25rem;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button id="btn-elim-continuar" class="btn btn-danger" disabled onclick="_cqElimContinuar()">
          ${isAdmin ? "Continuar" : "Solicitar autorización"}
        </button>
      </div>`);

    window._cqElimCounter = updateCounter;
  }

  // ── Exportación ───────────────────────────────────────────────────────────────

  // Pending cuotas matching the master list filters, flattened to the cuota grain.
  function _cuotasVisibles() {
    const fProyecto = document.getElementById("f-proyecto")?.value || "";
    const fBuscar   = document.getElementById("f-buscar")?.value || "";
    const fEstado   = document.getElementById("f-estado")?.value || "";
    const fSub      = document.getElementById("f-subdivididas")?.checked || false;
    return _cuotas.filter(c => {
      if (fProyecto && c.proyecto !== fProyecto) return false;
      if (fEstado && c.estado !== fEstado) return false;
      if (fSub && !c.tiene_fracciones) return false;
      if (!SGISearch.matches(fBuscar, c.comprador, c.documento, c.codigo_lote, c.proyecto, SGIUI.ventaCode(c))) return false;
      return true;
    });
  }

  async function exportCuotasExcel(rows) {
    if (window.SGILibs) await window.SGILibs.ensureExport();
    const SX = window.SGIExport.xlsx;
    const wb = SX.setup();

    const vencidas  = rows.filter(c => Number(c.dias_atraso) > 0).length;
    const venceHoy  = rows.filter(c => Number(c.dias_atraso) === 0).length;
    const porCobrar = rows.reduce((s, c) => s + Number(c.valor_pendiente || 0), 0);

    const ws = wb.addWorksheet("Cuotas", { tabColor: { argb: SX.C.primary } });
    ws.columns = [
      { width: 16 }, { width: 28 }, { width: 24 }, { width: 16 },
      { width: 16 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 },
    ];

    SX.masthead(ws, {
      title:     "Cuotas Pendientes",
      subtitle:  "Estado actual aplicando los filtros activos al momento de exportar",
      mergeCols: 9,
    });

    SX.kpiRow(ws, [
      { label: "Cuotas",     value: rows.length },
      { label: "Vencidas",   value: vencidas },
      { label: "Vencen hoy", value: venceHoy },
      { label: "Por cobrar", value: porCobrar, money: true },
    ]);

    ws.addRow([]).height = 4;
    const hRow = ws.addRow(["Venta", "Comprador", "Proyecto", "Lote", "Vencimiento", "Días", "Valor", "Pendiente", "Estado"]);
    SX.styleHeader(hRow);
    const headerRowNum = hRow.number;

    rows.forEach((c, i) => {
      const r = ws.addRow([
        SGIUI.ventaCode(c),
        c.comprador   || "—",
        c.proyecto    || "—",
        c.codigo_lote || "—",
        c.fecha_vencimiento ? UI.date(c.fecha_vencimiento) : "—",
        diasTexto(c.dias_atraso),
        Number(c.valor_cuota || 0),
        Number(c.valor_pendiente || 0),
        c.estado || "—",
      ]);
      SX.styleBody(r, i % 2 !== 0);
      r.getCell(7).numFmt = SX.NF.money;
      r.getCell(8).numFmt = SX.NF.money;
      r.getCell(7).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
      r.getCell(8).alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    });

    ws.views = [{ state: "frozen", ySplit: headerRowNum }];
    ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: 9 } };

    await SX.download(wb, `cuotas_sgi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportCuotasPDF(rows) {
    if (window.SGILibs) await window.SGILibs.ensureExport();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const SX  = window.SGIExport.pdf;

    const vencidas   = rows.filter(c => Number(c.dias_atraso) > 0).length;
    const venceHoy   = rows.filter(c => Number(c.dias_atraso) === 0).length;
    const porCobrar  = rows.reduce((s, c) => s + Number(c.valor_pendiente || 0), 0);
    const valorTotal = rows.reduce((s, c) => s + Number(c.valor_cuota || 0), 0);

    let y = SX.brand(doc);
    y = SX.title(doc, y + 2, {
      title:    "Cuotas Pendientes",
      subtitle: `${rows.length} cuota${rows.length === 1 ? "" : "s"} en la vista exportada`,
    });
    y = SX.kpiCards(doc, y + 2, [
      { label: "Cuotas",     value: String(rows.length), desc: "Pendientes en la vista" },
      { label: "Vencidas",   value: String(vencidas),    desc: "En atraso" },
      { label: "Vencen hoy", value: String(venceHoy),    desc: "Atención" },
      { label: "Por cobrar", value: UI.fmt(porCobrar),   desc: "Saldo pendiente" },
    ], { perRow: 4 });
    y = SX.section(doc, y + 6, { kicker: "Detalle", title: "Cuotas por cobrar" });

    doc.autoTable({
      startY: y,
      head: [["Venta", "Comprador", "Proyecto / Lote", "Vencimiento", "Días", "Valor", "Pendiente", "Estado"]],
      body: rows.map(c => [
        SGIUI.ventaCode(c),
        c.comprador || "—",
        `${c.proyecto || "—"}${c.codigo_lote ? " · " + c.codigo_lote : ""}`,
        UI.date(c.fecha_vencimiento),
        diasTexto(c.dias_atraso),
        UI.fmt(c.valor_cuota),
        UI.fmt(c.valor_pendiente),
        c.estado || "—",
      ]),
      foot: [[
        `Total · ${rows.length} cuota${rows.length === 1 ? "" : "s"}`,
        "", "", "", "",
        UI.fmt(valorTotal),
        UI.fmt(porCobrar),
        "",
      ]],
      showFoot: "lastPage",
      ...SX.tableTheme(),
      footStyles: SX.footStyles(),
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 46 },
        2: { cellWidth: 50 },
        3: { cellWidth: 26, halign: "center" },
        4: { cellWidth: 28, halign: "center" },
        5: { cellWidth: 30, halign: "right"  },
        6: { cellWidth: 30, halign: "right"  },
        7: { cellWidth: 24, halign: "center" },
      },
      ...SX.statusColumn(7, e => {
        const n = String(e).toLowerCase();
        if (n.includes("pagada"))    return "info";
        if (n.includes("vencida"))   return "danger";
        if (n.includes("pendiente")) return "warning";
        return "muted";
      }),
    });

    SX.footer(doc);
    doc.save(`cuotas_sgi_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

})();
