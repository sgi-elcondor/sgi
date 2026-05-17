(function () {

window.juridicoView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  const TABS = ["cartera", "vencidas", "compradores"];
  let activeTab = "cartera";
  let cartData  = null;
  let selectedVentaId = null;

  function renderShell() {
    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header">
          <h3>Seguimiento Juridico</h3>
          <div class="tab-bar" id="jur_tabs">
            <button class="tab-btn active" data-tab="cartera">Cartera Juridica</button>
            <button class="tab-btn" data-tab="vencidas">Cuotas Vencidas</button>
            <button class="tab-btn" data-tab="compradores">Compradores</button>
          </div>
        </div>
        <div id="jur_body" style="padding:0 1rem 1rem"></div>
      </div>
      <div id="jur_detail_panel" style="display:none"></div>
    `;
    document.querySelectorAll("#jur_tabs .tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#jur_tabs .tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeTab = btn.dataset.tab;
        selectedVentaId = null;
        document.getElementById("jur_detail_panel").style.display = "none";
        loadTab(activeTab);
      });
    });
  }

  async function loadTab(tab) {
    const body = document.getElementById("jur_body");
    body.innerHTML = UI.loader();
    if (tab === "cartera")     await renderCartera(body);
    if (tab === "vencidas")    await renderVencidas(body);
    if (tab === "compradores") await renderCompradores(body);
  }

  async function renderCartera(body) {
    const data = await API.get("/juridico/cartera").catch(e => {
      body.innerHTML = `<p style="color:var(--danger);padding:12px">${e.message}</p>`;
      return null;
    });
    if (!data) return;
    cartData = data;

    if (!data.length) {
      body.innerHTML = `<p style="color:var(--success);padding:20px">Sin casos juridicos activos.</p>`;
      return;
    }

    const estadoBadge = est => {
      const map = { mora: "danger", pre_mora: "warning", devolucion: "info", cancelada: "default" };
      const cls = map[est] || "default";
      return `<span class="badge badge-${cls}">${(est || "").replace(/_/g, " ")}</span>`;
    };

    body.innerHTML = `
      <table>
        <thead><tr>
          <th>#</th>
          <th>Proyecto / Lote</th>
          <th>Comprador</th>
          <th>Estado</th>
          <th>Dias mora</th>
          <th>Valor total</th>
          <th>Saldo</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${data.map(v => `
            <tr>
              <td>${v.id_venta ?? "—"}</td>
              <td style="font-size:.82rem">${v.proyecto ?? v.nombre_proyecto ?? "—"} / ${v.codigo_lote ?? v.lote ?? "—"}</td>
              <td style="font-size:.82rem">${v.comprador ?? v.cliente ?? v.nombres ?? "—"}</td>
              <td>${estadoBadge(v.estado ?? v.estado_venta)}</td>
              <td style="color:var(--danger);font-weight:600">${v.dias_mora != null ? v.dias_mora : "—"}</td>
              <td>${UI.fmt(v.valor_total)}</td>
              <td>${UI.fmt(v.saldo ?? v.saldo_pendiente)}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="window._jurVerDetalle(${v.id_venta})">Ver</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  async function renderVencidas(body) {
    const data = await API.get("/cuotas/vencidas").catch(e => {
      body.innerHTML = `<p style="color:var(--danger);padding:12px">${e.message}</p>`;
      return null;
    });
    if (!data) return;

    if (!data.length) {
      body.innerHTML = `<p style="color:var(--success);padding:20px">Sin cuotas vencidas.</p>`;
      return;
    }

    body.innerHTML = `
      <table>
        <thead><tr>
          <th>Proyecto</th>
          <th>Lote</th>
          <th>Comprador</th>
          <th>Cuota #</th>
          <th>Vencimiento</th>
          <th>Dias atraso</th>
          <th>Valor</th>
        </tr></thead>
        <tbody>
          ${data.map(c => `
            <tr>
              <td>${c.proyecto ?? "—"}</td>
              <td>${c.codigo_lote ?? "—"}</td>
              <td style="font-size:.82rem">${c.comprador ?? "—"}</td>
              <td>${c.numero_cuota}</td>
              <td>${UI.date(c.fecha_vencimiento)}</td>
              <td style="color:var(--danger);font-weight:600">${c.dias_atraso ?? "—"}</td>
              <td>${UI.fmt(c.valor_cuota)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  async function renderCompradores(body) {
    const data = await API.get("/compradores").catch(e => {
      body.innerHTML = `<p style="color:var(--danger);padding:12px">${e.message}</p>`;
      return null;
    });
    if (!data) return;

    if (!data.length) {
      body.innerHTML = `<p style="color:var(--text-muted);padding:20px">Sin compradores registrados.</p>`;
      return;
    }

    body.innerHTML = `
      <table>
        <thead><tr>
          <th>Nombre</th>
          <th>Documento</th>
          <th>Telefono</th>
          <th>Email</th>
        </tr></thead>
        <tbody>
          ${data.map(c => `
            <tr>
              <td>${c.nombres ?? ""} ${c.apellidos ?? ""}</td>
              <td>${c.documento ?? "—"}</td>
              <td>${c.telefono ?? "—"}</td>
              <td style="font-size:.82rem">${c.email ?? "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  window._jurVerDetalle = async function (idVenta) {
    selectedVentaId = idVenta;
    const panel = document.getElementById("jur_detail_panel");
    panel.style.display = "block";
    panel.innerHTML = `<div class="table-wrap" style="margin-top:1.5rem">${UI.loader()}</div>`;

    const [venta, observaciones] = await Promise.all([
      API.get(`/ventas/${idVenta}`).catch(() => null),
      API.get(`/juridico/${idVenta}/observaciones`).catch(() => []),
    ]);

    if (!venta) {
      panel.innerHTML = `<div class="table-wrap" style="margin-top:1.5rem;padding:1rem"><p style="color:var(--danger)">No se pudo cargar la venta.</p></div>`;
      return;
    }

    const cuotasHtml = (() => {
      const cuotas = (venta.cuota || []).sort((a, b) => a.numero_cuota - b.numero_cuota);
      if (!cuotas.length) return `<p style="color:var(--text-muted)">Sin cuotas registradas.</p>`;
      return `<table>
        <thead><tr><th>#</th><th>Tipo</th><th>Vencimiento</th><th>Valor</th><th>Estado</th></tr></thead>
        <tbody>
          ${cuotas.map(c => `
            <tr>
              <td>${c.numero_cuota}</td>
              <td>${c.tipo ?? "—"}</td>
              <td>${UI.date(c.fecha_vencimiento)}</td>
              <td>${UI.fmt(c.valor_cuota)}</td>
              <td>${UI.badge(c.estado)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
    })();

    const compradoresHtml = (() => {
      const comps = venta.venta_comprador || [];
      if (!comps.length) return `<p style="color:var(--text-muted)">Sin compradores.</p>`;
      return comps.map(vc => {
        const c = vc.comprador || {};
        return `<div style="margin-bottom:.5rem;font-size:.9rem">
          <strong>${c.nombres ?? ""} ${c.apellidos ?? ""}</strong>
          &nbsp;·&nbsp; CC ${c.documento ?? "—"}
          &nbsp;·&nbsp; ${c.telefono ?? "sin telefono"}
          &nbsp;·&nbsp; ${vc.porcentaje ?? 100}% propiedad
        </div>`;
      }).join("");
    })();

    const obsHtml = (obs) => {
      if (!obs.length) return `<p style="color:var(--text-muted);font-size:.88rem">Sin observaciones registradas.</p>`;
      return obs.map(o => `
        <div style="border-left:3px solid var(--primary);padding:.5rem .75rem;margin-bottom:.75rem;background:var(--surface2);border-radius:0 6px 6px 0">
          <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">
            ${new Date(o.fecha_registro).toLocaleString("es-CO")} &middot; ${o.usuario_db ?? "—"}
            ${o.estado_proceso ? `&middot; <strong>${o.estado_proceso}</strong>` : ""}
          </div>
          <div style="font-size:.9rem">${o.descripcion}</div>
        </div>
      `).join("");
    };

    panel.innerHTML = `
      <div class="table-wrap" style="margin-top:1.5rem">
        <div class="table-header">
          <h3>Venta #${venta.id_venta} &mdash; ${UI.badge(venta.estado)}</h3>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('jur_detail_panel').style.display='none'">Cerrar</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;padding:1rem">
          <div>
            <p style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:.5rem">Datos de la venta</p>
            <p style="font-size:.9rem">Fecha: ${UI.date(venta.fecha_venta)}</p>
            <p style="font-size:.9rem">Valor total: <strong>${UI.fmt(venta.valor_total)}</strong></p>
            <p style="font-size:.9rem">Cuota inicial: ${UI.fmt(venta.cuota_inicial)}</p>
            ${venta.observaciones ? `<p style="font-size:.85rem;color:var(--text-muted)">Obs: ${venta.observaciones}</p>` : ""}
          </div>
          <div>
            <p style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:.5rem">Compradores</p>
            ${compradoresHtml}
          </div>
        </div>

        <div style="padding:0 1rem 1rem">
          <p style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:.5rem">Plan de pagos</p>
          ${cuotasHtml}
        </div>

        <div style="padding:0 1rem 1rem">
          <p style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:.75rem">Observaciones juridicas</p>
          <div id="jur_obs_list">${obsHtml(observaciones)}</div>

          <div style="margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem">
            <p style="font-size:.85rem;font-weight:600;margin-bottom:.75rem">Registrar nueva observacion</p>
            <div style="display:grid;gap:.75rem">
              <div>
                <label style="font-size:.82rem;font-weight:500;display:block;margin-bottom:.3rem">Estado del proceso legal</label>
                <select id="jur_estado_proceso" class="form-select" style="width:100%;max-width:340px">
                  <option value="">— Sin estado especifico —</option>
                  <option value="Notificacion enviada">Notificacion enviada</option>
                  <option value="En negociacion">En negociacion</option>
                  <option value="Proceso coactivo">Proceso coactivo</option>
                  <option value="Acuerdo de pago">Acuerdo de pago</option>
                  <option value="Demanda radicada">Demanda radicada</option>
                  <option value="Resolucion pendiente">Resolucion pendiente</option>
                  <option value="Cerrado">Cerrado</option>
                </select>
              </div>
              <div>
                <label style="font-size:.82rem;font-weight:500;display:block;margin-bottom:.3rem">Descripcion <span style="color:var(--danger)">*</span></label>
                <textarea id="jur_descripcion" rows="3" placeholder="Describe la situacion juridica actual..."
                  style="width:100%;padding:.5rem .75rem;border:1px solid var(--border);border-radius:8px;font-size:.88rem;resize:vertical;box-sizing:border-box;background:var(--surface);color:var(--text)"></textarea>
              </div>
              <div id="jur_obs_error" style="display:none;color:var(--danger);font-size:.85rem"></div>
              <div>
                <button class="btn btn-primary btn-sm" id="jur_btn_obs">Guardar observacion</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("jur_btn_obs").addEventListener("click", async () => {
      const descripcion     = document.getElementById("jur_descripcion").value.trim();
      const estado_proceso  = document.getElementById("jur_estado_proceso").value;
      const errorEl         = document.getElementById("jur_obs_error");
      const btn             = document.getElementById("jur_btn_obs");

      errorEl.style.display = "none";
      if (!descripcion) {
        errorEl.textContent = "La descripcion es obligatoria.";
        errorEl.style.display = "block";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Guardando...";

      try {
        await API.post("/juridico/observaciones", { id_venta: idVenta, descripcion, estado_proceso: estado_proceso || undefined });
        const nuevasObs = await API.get(`/juridico/${idVenta}/observaciones`);
        document.getElementById("jur_obs_list").innerHTML = obsHtml(nuevasObs);
        document.getElementById("jur_descripcion").value = "";
        document.getElementById("jur_estado_proceso").value = "";
      } catch (e) {
        errorEl.textContent = e.message || "Error al guardar.";
        errorEl.style.display = "block";
      } finally {
        btn.disabled = false;
        btn.textContent = "Guardar observacion";
      }
    });
  };

  renderShell();
  loadTab("cartera");
};

})();