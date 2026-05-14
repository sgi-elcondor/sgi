(() => {
  function fmt(n) {
    return n != null
      ? Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
      : "—";
  }
  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d + "T12:00:00").toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" });
  }
  function fmtDateShort(d) {
    if (!d) return "—";
    return new Date(d + "T12:00:00").toLocaleDateString("es-CO");
  }

  async function abrirModalPago({ idVenta, idCuota, valorCuota, numeroCuota, soloAmortizacion = false }) {
    const modalBody = `
      <div style="display:flex;flex-direction:column;gap:20px">
        ${soloAmortizacion ? "" : `
        <div class="form-group">
          <label>Tipo de pago</label>
          <select id="mp-tipo">
            <option value="cuota">Cuota regular #${numeroCuota || "—"}</option>
            <option value="amortizacion">Amortizacion total (pago anticipado)</option>
          </select>
        </div>`}
        <div class="form-group">
          <label>Valor del abono *</label>
          <input type="number" id="mp-valor" min="1" value="${soloAmortizacion ? "" : (valorCuota || "")}" placeholder="Ej: 1500000" />
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:8px">Metodo de pago *</label>
          <div class="pago-method-tabs">
            <button type="button" class="pago-method-tab active" data-method="transferencia">
              ${window.SGIUI?.icon("smartphone") ?? ""} Electronico
            </button>
            <button type="button" class="pago-method-tab" data-method="efectivo">
              ${window.SGIUI?.icon("banknote") ?? ""} Efectivo
            </button>
            <button type="button" class="pago-method-tab" data-method="permuta">
              ${window.SGIUI?.icon("arrows-left-right") ?? ""} Permuta
            </button>
          </div>
        </div>
        <div id="mp-electronic-fields">
          <div style="display:flex;flex-direction:column;gap:16px">
            <div class="form-group">
              <label>Numero de cuenta / celular origen *</label>
              <input type="text" id="mp-cuenta" placeholder="Ej: 3001234567" />
            </div>
            <div class="form-group">
              <label>Fecha y hora de la transaccion *</label>
              <div class="datetime-row">
                <input type="datetime-local" id="mp-datetime" />
                <button type="button" class="btn btn-ghost btn-sm" id="mp-ahora">Justo ahora</button>
              </div>
            </div>
            <div class="form-group">
              <label>Comprobante de pago (baucher) *</label>
              <div class="baucher-upload-area" id="mp-baucher-area">
                <input type="file" id="mp-baucher-input" accept="image/jpeg,image/png,image/webp,application/pdf" />
                <div class="baucher-upload-icon">${window.SGIUI?.icon("upload-cloud") ?? ""}</div>
                <div class="baucher-upload-label">
                  Arrastra tu baucher aqui o <strong id="mp-baucher-click">haz clic para seleccionar</strong>
                </div>
                <div id="mp-baucher-preview" style="display:none"></div>
              </div>
            </div>
            <div class="form-group">
              <label>Referencia / Numero de transaccion (opcional)</label>
              <input type="text" id="mp-ref" placeholder="Ej: TRF-123456" />
            </div>
          </div>
        </div>
        <div id="mp-other-fields" style="display:none">
          <div class="info-method-box">
            ${window.SGIUI?.icon("info") ?? ""}
            <strong>Este tipo de pago se procesa presencialmente.</strong><br>
            El pago en efectivo y las permutas deben ser verificados por el auxiliar contable. Comunicate con la oficina.
          </div>
        </div>
        <div id="mp-error" class="form-error" style="display:none;margin-top:-4px"></div>
        <div class="form-actions">
          <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
          <button class="btn btn-primary" id="mp-submit">
            ${window.SGIUI?.icon("send") ?? ""} Enviar comprobante
          </button>
        </div>
      </div>`;

    UI.openModal(
      soloAmortizacion ? "Amortizacion total" : `Pagar cuota #${numeroCuota || ""}`,
      modalBody
    );
    window.SGIUI?.hydrate();

    let currentMethod = "transferencia";
    let baucherFile   = null;
    let uploadedUrl   = null;

    document.querySelectorAll(".pago-method-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pago-method-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentMethod = btn.dataset.method;
        const isElec = currentMethod === "transferencia";
        document.getElementById("mp-electronic-fields").style.display = isElec ? "block" : "none";
        document.getElementById("mp-other-fields").style.display       = isElec ? "none"  : "block";
        const submitBtn = document.getElementById("mp-submit");
        submitBtn.disabled    = !isElec;
        submitBtn.textContent = isElec ? "Enviar comprobante" : "Solo disponible por oficina";
      });
    });

    document.getElementById("mp-ahora")?.addEventListener("click", () => {
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      document.getElementById("mp-datetime").value =
        `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    });

    const baucherInput = document.getElementById("mp-baucher-input");
    const baucherArea  = document.getElementById("mp-baucher-area");
    document.getElementById("mp-baucher-click")?.addEventListener("click", () => baucherInput.click());
    baucherArea.addEventListener("dragover",  e => { e.preventDefault(); baucherArea.classList.add("dragover"); });
    baucherArea.addEventListener("dragleave", () => baucherArea.classList.remove("dragover"));
    baucherArea.addEventListener("drop", e => { e.preventDefault(); baucherArea.classList.remove("dragover"); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
    baucherInput.addEventListener("change", () => { if (baucherInput.files[0]) setFile(baucherInput.files[0]); });

    function setFile(f) {
      baucherFile = f; uploadedUrl = null;
      const preview = document.getElementById("mp-baucher-preview");
      preview.style.display = "flex";
      preview.innerHTML = `<span class="baucher-preview-name">${window.SGIUI?.icon("file") ?? ""} ${f.name}</span><span class="baucher-preview-remove" id="mp-baucher-remove">${window.SGIUI?.icon("x") ?? ""}</span>`;
      window.SGIUI?.hydrate();
      document.getElementById("mp-baucher-remove")?.addEventListener("click", () => {
        baucherFile = null; uploadedUrl = null;
        preview.style.display = "none"; baucherInput.value = "";
      });
    }

    document.getElementById("mp-submit")?.addEventListener("click", async () => {
      const errorEl = document.getElementById("mp-error");
      errorEl.style.display = "none";
      const valor     = Number(document.getElementById("mp-valor").value);
      const cuenta    = document.getElementById("mp-cuenta").value.trim();
      const datetimeV = document.getElementById("mp-datetime").value;
      const ref       = document.getElementById("mp-ref")?.value.trim();
      const tipoPago  = soloAmortizacion ? "amortizacion" : (document.getElementById("mp-tipo")?.value || "cuota");

      function showError(msg) { errorEl.textContent = msg; errorEl.style.display = "block"; }

      if (!valor || valor <= 0)  { showError("El valor del abono debe ser mayor a 0."); return; }
      if (!cuenta)               { showError("Ingresa el numero de cuenta o celular de origen."); return; }
      if (!datetimeV)            { showError("Selecciona la fecha y hora de la transaccion."); return; }
      if (!baucherFile)          { showError("Debes adjuntar el baucher de pago."); return; }

      const btn = document.getElementById("mp-submit");
      btn.disabled = true; btn.textContent = "Subiendo baucher...";

      try {
        if (!uploadedUrl) {
          const fd = new FormData();
          fd.append("baucher", baucherFile);
          const res = await fetch("/api/uploads/baucher", {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("fb_token") || ""}` },
            body: fd,
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Error al subir el baucher"); }
          uploadedUrl = (await res.json()).url;
        }

        btn.textContent = "Registrando pago...";
        const fechaPago = datetimeV.includes("T") ? datetimeV : datetimeV + "T12:00:00";

        await API.post("/pagos/comprador", {
          fecha_pago:           fechaPago,
          valor_pago:           valor,
          metodo_pago:          "transferencia",
          numero_cuenta_origen: cuenta,
          url_baucher:          uploadedUrl,
          referencia:           ref || undefined,
          id_venta:             idVenta  || undefined,
          id_cuota_propuesta:   idCuota  || undefined,
          tipo_pago:            tipoPago,
        });

        UI.closeModal();
        window.SGIUI?.toast("Comprobante enviado. El equipo contable lo revisara pronto.", "success", "Pago registrado");
        const vk = window.currentViewKey;
        if (vk) setTimeout(() => navigate(vk), 400);

      } catch (err) {
        showError(err.message || "Error al enviar el comprobante.");
        btn.disabled = false; btn.textContent = "Enviar comprobante";
      }
    });
  }

  // ── Comprador cuotas view ──────────────────────────────────────────────────
  window.compradorCuotasView = async function (container) {
    const vc = container || document.getElementById("viewContainer");
    vc.innerHTML = UI.loader();

    let ventas;
    try { ventas = await API.get("/ventas/mis-ventas"); }
    catch (e) { vc.innerHTML = `<p style="color:var(--danger);padding:20px">${e.message}</p>`; return; }

    if (!ventas.length) {
      vc.innerHTML = `<section class="page-shell">${window.SGIUI?.pageHeader({ kicker:"Mis cuotas", title:"Cuotas", subtitle:"Plan de pago de tu inmueble." }) ?? ""}
        <div class="no-venta-state">${window.SGIUI?.icon("home") ?? ""}<h3>No tienes ventas activas</h3><p>Cuando tengas una venta registrada, aqui veras tus cuotas.</p></div></section>`;
      window.SGIUI?.hydrate(); return;
    }

    const venta  = ventas[0];
    const cuotas = venta.cuotas || [];
    const indexActual = cuotas.findIndex(c => c.estado !== "pagada");

    function diasLabel(c) {
      const d = c.dias_restantes;
      if (c.estado === "pagada") return { text: "Pagada", cls: "muted" };
      if (d < 0)   return { text: `Vencida hace ${Math.abs(d)} dia${Math.abs(d)!==1?"s":""}`, cls: "danger" };
      if (d === 0) return { text: "Vence hoy", cls: "warning" };
      if (d <= 3)  return { text: `Vence en ${d} dia${d!==1?"s":""}`, cls: "warning" };
      return { text: fmtDateShort(c.fecha_vencimiento), cls: "success" };
    }

    const cuotasHtml = cuotas.map((c, idx) => {
      const isCurrent = idx === indexActual;
      const isPagada  = c.estado === "pagada";
      const isVencida = c.dias_restantes < 0 && !isPagada;
      const dl  = diasLabel(c);
      const pct = c.valor_cuota > 0 ? Math.min(100, (c.valor_pagado / c.valor_cuota) * 100) : 0;
      const canPay = isCurrent && !isPagada && c.tiene_factura;
      return `
        <div class="cuota-card ${isCurrent?"current":""} ${isPagada?"pagada":""} ${isVencida?"vencida":""}">
          <div class="cuota-card-left">
            <div class="cuota-card-num">Cuota #${c.numero_cuota}${c.es_extraordinaria?'<span class="badge badge-info" style="margin-left:6px">Extraordinaria</span>':""}${c.tipo==="inicial"?'<span class="badge badge-muted" style="margin-left:6px">Inicial</span>':""}</div>
            <div class="cuota-card-fecha">${fmtDate(c.fecha_vencimiento)}</div>
            <div class="cuota-card-dias ${dl.cls}">${dl.text}</div>
          </div>
          <div class="cuota-card-center">
            <div class="cuota-card-valor">${fmt(c.valor_cuota)}</div>
            ${c.valor_pagado > 0 && !isPagada ? `
              <div class="cuota-card-pendiente">Pagado: ${fmt(c.valor_pagado)}</div>
              <div class="cuota-card-pendiente">Pendiente: ${fmt(c.valor_pendiente)}</div>
              <div class="cuota-mini-progress"><div class="cuota-mini-progress-bar"><div class="cuota-mini-progress-fill" style="width:${pct}%"></div></div></div>` : ""}
            ${c.valor_en_revision > 0 ? `<div class="cuota-card-revision">En revision: ${fmt(c.valor_en_revision)}</div>` : ""}
          </div>
          <div class="cuota-card-right">
            ${isPagada ? '<span class="badge badge-success">Pagada</span>' : UI.badge(c.estado)}
            ${canPay
              ? `<button class="btn btn-primary btn-sm btn-pagar-cuota" data-id="${c.id_cuota}" data-venta="${venta.id_venta}" data-valor="${c.valor_pendiente || c.valor_cuota}" data-num="${c.numero_cuota}">Pagar</button>`
              : isCurrent && !isPagada
                ? `<span style="font-size:.75rem;color:var(--text-muted);text-align:center;line-height:1.4">Factura<br>pendiente</span>`
                : ""}
          </div>
        </div>`;
    }).join("");

    vc.innerHTML = `
      <section class="page-shell">
        ${window.SGIUI?.pageHeader({
          kicker: "Mis cuotas", title: "Plan de pago",
          subtitle: `${venta.lote?.proyecto?.nombre || ""} · Lote ${venta.lote?.codigo_lote || ""}`,
          actions: `<button class="btn btn-ghost" id="btn-amortizacion">${window.SGIUI?.icon("zap") ?? ""} Amortizacion total</button>`,
          meta: `<span class="results-chip">${window.SGIUI?.icon("check-circle") ?? ""} ${venta.cuotas_pagadas} de ${venta.total_cuotas} cuotas pagadas</span>`,
        }) ?? ""}
        <section class="table-wrap">
          <div style="padding:16px 20px">
            <div class="cuotas-progress-header">
              <span style="font-size:13px;color:var(--text-muted)">Progreso general</span>
              <strong>${(venta.porcentaje_pagado||0).toFixed(1)}%</strong>
            </div>
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.min(100,venta.porcentaje_pagado||0)}%"></div></div>
          </div>
        </section>
        <section class="cuotas-comprador">${cuotasHtml || `<p style="color:var(--text-muted);padding:20px">No hay cuotas registradas.</p>`}</section>
      </section>`;

    window.SGIUI?.hydrate();

    document.getElementById("btn-amortizacion")?.addEventListener("click", () =>
      abrirModalPago({ idVenta: venta.id_venta, soloAmortizacion: true })
    );
    document.querySelectorAll(".btn-pagar-cuota").forEach(btn => {
      btn.addEventListener("click", () => abrirModalPago({
        idVenta: Number(btn.dataset.venta), idCuota: Number(btn.dataset.id),
        valorCuota: Number(btn.dataset.valor), numeroCuota: Number(btn.dataset.num),
      }));
    });
  };

  // ── Comprador recibos view ─────────────────────────────────────────────────
  window.compradorRecibosView = async function (container) {
    const vc = container || document.getElementById("viewContainer");
    vc.innerHTML = UI.loader();

    let ventas, misPagos;
    try { [ventas, misPagos] = await Promise.all([API.get("/ventas/mis-ventas"), API.get("/pagos/mis-pagos")]); }
    catch (e) { vc.innerHTML = `<p style="color:var(--danger);padding:20px">${e.message}</p>`; return; }

    const venta     = ventas[0] || null;
    const pagos     = misPagos || [];
    const pendientes = pagos.filter(p => p.estado === "pendiente_revision");
    const aceptados  = pagos.filter(p => p.estado === "aceptado");
    const rechazados = pagos.filter(p => p.estado === "rechazado");

    function metodoBadge(m = "") {
      const map    = { transferencia:"info", efectivo:"success", cheque:"muted", permuta:"warning" };
      const labels = { transferencia:"Electronico", efectivo:"Efectivo", cheque:"Cheque", permuta:"Permuta" };
      return `<span class="badge badge-${map[m]||"muted"}">${labels[m]||m}</span>`;
    }
    function tipoBadge(t = "") {
      return t === "amortizacion" ? '<span class="badge badge-info">Amortizacion</span>' : '<span class="badge badge-muted">Cuota</span>';
    }
    function pagoCard(p, showRecibo = false) {
      const recibo = showRecibo && p.recibo_pago?.[0]?.recibo;
      return `<div class="pago-card">
        <div class="pago-card-left">
          <div>${metodoBadge(p.metodo_pago)} ${tipoBadge(p.tipo_pago)}</div>
          <div class="pago-card-meta">Fecha: ${fmtDateShort(p.fecha_pago?.split("T")[0])}</div>
          ${p.id_cuota_propuesta ? `<div class="pago-card-meta">Cuota #${p.id_cuota_propuesta}</div>` : ""}
          ${recibo ? `<div class="pago-card-recibo">${window.SGIUI?.icon("file-check") ?? ""} Recibo: ${recibo.numero_recibo}</div>` : ""}
          ${p.url_baucher ? `<a href="${p.url_baucher}" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:4px">${window.SGIUI?.icon("image") ?? ""} Ver baucher</a>` : ""}
        </div>
        <div class="pago-card-right">
          <div class="pago-card-valor">${fmt(p.valor_pago)}</div>
          ${UI.badge(p.estado)}
        </div>
      </div>`;
    }

    function seccion(titulo, icono, lista, showRecibo = false) {
      if (!lista.length) return "";
      return `<section class="table-wrap">
        <div class="table-header"><h3>${window.SGIUI?.icon(icono) ?? ""} ${titulo} (${lista.length})</h3></div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">${lista.map(p => pagoCard(p, showRecibo)).join("")}</div>
      </section>`;
    }

    vc.innerHTML = `
      <section class="page-shell">
        ${window.SGIUI?.pageHeader({
          kicker: "Mis pagos", title: "Pagos y recibos",
          subtitle: "Historial de tus comprobantes enviados y recibos emitidos.",
          actions: venta ? `<button class="btn btn-primary" id="btn-nuevo-pago-recibos">${window.SGIUI?.icon("plus") ?? ""} Nuevo pago</button>` : "",
          meta: `<span class="results-chip">${window.SGIUI?.icon("wallet") ?? ""} ${pagos.length} comprobante(s)</span>`,
        }) ?? ""}
        ${seccion("Pendientes de revision", "clock", pendientes)}
        ${seccion("Pagos aceptados", "check-circle", aceptados, true)}
        ${seccion("Pagos rechazados", "x-circle", rechazados)}
        ${!pagos.length ? `<section class="table-wrap"><div style="padding:40px">${window.SGIUI?.emptyState({ title:"Sin comprobantes", text:"Aun no has enviado ningun comprobante de pago.", actionLabel: venta?"Enviar primer pago":"", actionId: venta?"btn-empty-pago":"" }) ?? ""}</div></section>` : ""}
      </section>`;

    window.SGIUI?.hydrate();

    function abrirPago() {
      if (!venta) return;
      const ca = venta.cuota_actual;
      abrirModalPago({ idVenta: venta.id_venta, idCuota: ca?.id_cuota, valorCuota: ca?.valor_cuota, numeroCuota: ca?.numero_cuota });
    }
    document.getElementById("btn-nuevo-pago-recibos")?.addEventListener("click", abrirPago);
    document.getElementById("btn-empty-pago")?.addEventListener("click", abrirPago);
  };
})();
