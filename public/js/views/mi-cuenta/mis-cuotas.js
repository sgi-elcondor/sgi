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

  async function abrirModalPago({ idVenta, idCuota, soloAmortizacion = false }) {
    const iconSend    = window.SGIUI?.icon("send")          ?? "";
    const iconPhone   = window.SGIUI?.icon("smartphone")    ?? "";
    const iconCash    = window.SGIUI?.icon("banknote")      ?? "";
    const iconSwap    = window.SGIUI?.icon("arrows-left-right") ?? "";
    const iconInfo    = window.SGIUI?.icon("info")          ?? "";
    const iconUpload  = window.SGIUI?.icon("upload-cloud")  ?? "";
    const iconFile    = window.SGIUI?.icon("file")          ?? "";
    const iconX       = window.SGIUI?.icon("x")             ?? "";

    const paymentFields = `
      <div>
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:8px">Metodo de pago *</label>
        <div class="pago-method-tabs">
          <button type="button" class="pago-method-tab active" data-method="transferencia">${iconPhone} Electronico</button>
          <button type="button" class="pago-method-tab" data-method="efectivo">${iconCash} Efectivo</button>
          <button type="button" class="pago-method-tab" data-method="permuta">${iconSwap} Permuta</button>
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
              <div class="baucher-upload-icon">${iconUpload}</div>
              <div class="baucher-upload-label">Arrastra tu baucher aqui o <strong id="mp-baucher-click">haz clic para seleccionar</strong></div>
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
        <div class="info-method-box">${iconInfo} <strong>Este tipo de pago se procesa presencialmente.</strong><br>El pago en efectivo y las permutas deben ser verificados por el auxiliar contable. Comunicate con la oficina.</div>
      </div>
      <div id="mp-error" class="form-error" style="display:none;margin-top:-4px"></div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="mp-submit">${iconSend} Enviar comprobante</button>
      </div>`;

    function _wireEvents(onSubmit) {
      window.SGIUI?.hydrate();
      let baucherFile = null;
      let uploadedUrl = null;

      document.querySelectorAll(".pago-method-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".pago-method-tab").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const isElec = btn.dataset.method === "transferencia";
          document.getElementById("mp-electronic-fields").style.display = isElec ? "block" : "none";
          document.getElementById("mp-other-fields").style.display       = isElec ? "none"  : "block";
          const s = document.getElementById("mp-submit");
          s.disabled    = !isElec;
          s.textContent = isElec ? "Enviar comprobante" : "Solo disponible por oficina";
        });
      });

      document.getElementById("mp-ahora")?.addEventListener("click", () => {
        const n = new Date(), p = v => String(v).padStart(2, "0");
        document.getElementById("mp-datetime").value =
          `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`;
      });

      const baucherInput = document.getElementById("mp-baucher-input");
      const baucherArea  = document.getElementById("mp-baucher-area");
      document.getElementById("mp-baucher-click")?.addEventListener("click", () => baucherInput.click());
      baucherArea.addEventListener("dragover",  e => { e.preventDefault(); baucherArea.classList.add("dragover"); });
      baucherArea.addEventListener("dragleave", () => baucherArea.classList.remove("dragover"));
      baucherArea.addEventListener("drop", e => {
        e.preventDefault(); baucherArea.classList.remove("dragover");
        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
      });
      baucherInput.addEventListener("change", () => { if (baucherInput.files[0]) setFile(baucherInput.files[0]); });

      function setFile(f) {
        baucherFile = f; uploadedUrl = null;
        const preview = document.getElementById("mp-baucher-preview");
        preview.style.display = "flex";
        preview.innerHTML = `<span class="baucher-preview-name">${iconFile} ${f.name}</span><span class="baucher-preview-remove" id="mp-baucher-remove">${iconX}</span>`;
        window.SGIUI?.hydrate();
        document.getElementById("mp-baucher-remove")?.addEventListener("click", () => {
          baucherFile = null; uploadedUrl = null;
          preview.style.display = "none"; baucherInput.value = "";
        });
      }

      document.getElementById("mp-submit")?.addEventListener("click", async () => {
        const errorEl   = document.getElementById("mp-error");
        errorEl.style.display = "none";
        const cuenta    = document.getElementById("mp-cuenta").value.trim();
        const datetimeV = document.getElementById("mp-datetime").value;
        const ref       = document.getElementById("mp-ref")?.value.trim();
        function showError(msg) { errorEl.textContent = msg; errorEl.style.display = "block"; }
        if (!cuenta)      { showError("Ingresa el numero de cuenta o celular de origen."); return; }
        if (!datetimeV)   { showError("Selecciona la fecha y hora de la transaccion."); return; }
        if (!baucherFile) { showError("Debes adjuntar el baucher de pago."); return; }

        const btn = document.getElementById("mp-submit");
        btn.disabled = true; btn.textContent = "Subiendo baucher...";
        try {
          if (!uploadedUrl) {
            const fd = new FormData();
            fd.append("baucher", baucherFile);
            let uploadToken = localStorage.getItem("fb_token") || "";
            try {
              const fbUser = window._firebaseAuth?.currentUser;
              if (fbUser) uploadToken = await fbUser.getIdToken(false);
            } catch (_) {}
            const res = await fetch("/api/v1/uploads/baucher", {
              method: "POST",
              headers: { Authorization: `Bearer ${uploadToken}` },
              body: fd,
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || "Error al subir el baucher");
            }
            uploadedUrl = (await res.json()).url;
          }
          btn.textContent = "Registrando pago...";
          const fechaPago = datetimeV.includes("T") ? datetimeV : datetimeV + "T12:00:00";
          await onSubmit({ cuenta, fechaPago, ref: ref || undefined, uploadedUrl });
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

    // ── Amortizacion ──────────────────────────────────────────────────────────
    if (soloAmortizacion) {
      UI.openModal("Abono a capital", `
        <div style="display:flex;flex-direction:column;gap:18px">
          <div class="form-group">
            <label>Valor del abono *</label>
            <input type="number" id="mp-valor" min="1" placeholder="Ej: 5000000" />
          </div>
          ${paymentFields}
        </div>`);
      _wireEvents(async ({ cuenta, fechaPago, ref, uploadedUrl }) => {
        const valor = Number(document.getElementById("mp-valor").value);
        if (!valor || valor <= 0) throw new Error("El valor del abono debe ser mayor a 0.");
        await API.post("/pagos/comprador", {
          fecha_pago: fechaPago, valor_pago: valor, metodo_pago: "transferencia",
          numero_cuenta_origen: cuenta, url_baucher: uploadedUrl, referencia: ref,
          id_venta: idVenta || undefined, tipo_pago: "amortizacion",
        });
      });
      return;
    }

    // ── Factura selection ─────────────────────────────────────────────────────
    let facturas = [];
    try { facturas = await API.get("/facturas/mis-facturas"); } catch(e) {}

    if (!facturas.length) {
      UI.openModal("Sin facturas disponibles", `
        <div style="padding:8px 0 16px">
          <p style="color:var(--text-muted);line-height:1.6;font-size:.9rem">
            No tienes facturas disponibles para pagar en este momento.<br>
            El equipo contable debe generar la factura de tu cuota antes de que puedas registrar el pago.
          </p>
        </div>
        <div class="form-actions"><button class="btn btn-primary" onclick="UI.closeModal()">Entendido</button></div>`);
      return;
    }

    let selectedFactura = facturas.find(f => f.id_cuota === Number(idCuota)) || facturas[0];

    function _fmtFN(n) {
      if (!n) return "—";
      const s = String(n).padStart(9, "0");
      return /^\d{9}$/.test(s) ? `20${s.slice(0,2)}-${s.slice(2,6)}-${s.slice(6)}` : String(n);
    }

    const listHTML = facturas.map(f => {
      const sel = selectedFactura?.id_factura === f.id_factura;
      return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;border:2px solid ${sel ? "var(--accent,#ff6a00)" : "var(--border)"};background:${sel ? "var(--surface-2,#f0f4f8)" : "transparent"};transition:border-color .15s,background .15s" id="mp-fopt-${f.id_factura}">
        <input type="radio" name="mp-factura" value="${f.id_factura}" data-cuota="${f.id_cuota}" data-venta="${f.id_venta}" data-valor="${f.valor_facturado}" ${sel ? "checked" : ""} style="flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:600">Factura ${_fmtFN(f.numero_factura)}</div>
          <div style="font-size:.76rem;color:var(--text-muted)">Cuota #${f.numero_cuota} &bull; Vence ${new Date(f.fecha_vencimiento+"T12:00:00").toLocaleDateString("es-CO")} &bull; ${f.proyecto} &bull; ${f.codigo_lote}</div>
        </div>
        <span style="font-size:.9rem;font-weight:700;white-space:nowrap;color:var(--accent,#ff6a00)">${fmt(f.valor_facturado)}</span>
      </label>`;
    }).join("");

    UI.openModal("Registrar pago", `
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="form-group">
          <label>Factura a pagar *</label>
          <div id="mp-facturas-lista" style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px">
            ${listHTML}
          </div>
        </div>
        <div style="background:var(--surface-2,#f0f4f8);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--text-muted);font-size:.88rem">Valor a pagar:</span>
          <strong id="mp-valor-display" style="font-size:1.05rem">${fmt(selectedFactura?.valor_facturado)}</strong>
        </div>
        ${paymentFields}
      </div>`);

    document.getElementById("mp-facturas-lista")?.addEventListener("change", e => {
      if (e.target.type !== "radio") return;
      const f = facturas.find(f => f.id_factura === Number(e.target.value));
      if (!f) return;
      selectedFactura = f;
      document.querySelectorAll("#mp-facturas-lista label").forEach(l => {
        const radio = l.querySelector("input[type=radio]");
        const active = Number(radio?.value) === f.id_factura;
        l.style.borderColor = active ? "var(--accent,#ff6a00)" : "var(--border)";
        l.style.background  = active ? "var(--surface-2,#f0f4f8)" : "transparent";
      });
      document.getElementById("mp-valor-display").textContent = fmt(f.valor_facturado);
    });

    _wireEvents(async ({ cuenta, fechaPago, ref, uploadedUrl }) => {
      if (!selectedFactura) throw new Error("Selecciona una factura a pagar.");
      await API.post("/pagos/comprador", {
        fecha_pago:           fechaPago,
        valor_pago:           selectedFactura.valor_facturado,
        metodo_pago:          "transferencia",
        numero_cuenta_origen: cuenta,
        url_baucher:          uploadedUrl,
        referencia:           ref,
        id_venta:             selectedFactura.id_venta || undefined,
        id_cuota_propuesta:   selectedFactura.id_cuota || undefined,
        tipo_pago:            "cuota",
      });
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

    function buildLoteSelector(idx) {
      if (ventas.length <= 1) return "";
      return `<div class="lote-selector">
        ${ventas.map((vt, i) => {
          const label = `${vt.lote?.proyecto?.nombre || "Proyecto"} · Lote ${vt.lote?.codigo_lote || "—"}`;
          return `<button class="lote-tab ${i === idx ? "active" : ""}" data-idx="${i}">${label}</button>`;
        }).join("")}
      </div>`;
    }

    function diasLabel(c) {
      const d = c.dias_restantes;
      if (c.estado === "pagada") return { text: "Pagada", cls: "muted" };
      if (d < 0)   return { text: `Vencida hace ${Math.abs(d)} dia${Math.abs(d)!==1?"s":""}`, cls: "danger" };
      if (d === 0) return { text: "Vence hoy", cls: "warning" };
      if (d <= 3)  return { text: `Vence en ${d} dia${d!==1?"s":""}`, cls: "warning" };
      return { text: fmtDateShort(c.fecha_vencimiento), cls: "success" };
    }

    let selectedIdx = 0;

    function render(idx) {
      const venta = ventas[idx];
      const cuotas = venta.cuotas || [];
      const indexActual = cuotas.findIndex(c => c.estado !== "pagada");

      const cuotasHtml = cuotas.map((c, i) => {
        const isCurrent = i === indexActual;
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
            kicker: "Mis cuotas",
            title: `${venta.lote?.proyecto?.nombre || "Mi inmueble"}`,
            subtitle: `Lote ${venta.lote?.codigo_lote || "—"}${venta.lote?.manzana ? " · Manzana " + venta.lote.manzana : ""}`,
            actions: `<button class="btn btn-ghost" id="btn-amortizacion">${window.SGIUI?.icon("zap") ?? ""} Abono a capital</button>`,
            meta: `<span class="results-chip">${window.SGIUI?.icon("check-circle") ?? ""} ${venta.cuotas_pagadas} de ${venta.total_cuotas} cuotas pagadas</span>`,
          }) ?? ""}
          ${buildLoteSelector(idx)}
          <div class="flow-context-hint">
            ${window.SGIUI?.icon("info") ?? ""}
            <span>Para pagar una cuota, el equipo contable debe emitir su factura. Cuando este lista, aparece el boton <strong>Pagar</strong>.</span>
          </div>
          <section class="table-wrap">
            <div style="padding:1rem 1.25rem">
              <div class="cuotas-progress-header">
                <span style="font-size:0.8125rem;color:var(--text-muted)">Progreso general</span>
                <strong>${(venta.porcentaje_pagado||0).toFixed(1)}%</strong>
              </div>
              <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.min(100,venta.porcentaje_pagado||0)}%"></div></div>
            </div>
          </section>
          <section class="cuotas-comprador">${cuotasHtml || `<p style="color:var(--text-muted);padding:1.25rem">No hay cuotas registradas.</p>`}</section>
          <div style="padding:1rem 0.25rem;text-align:center">
            <button class="btn btn-ghost btn-sm" onclick="navigate('mis-facturas')">${window.SGIUI?.icon("receipt") ?? ""} Ver mis facturas</button>
          </div>
        </section>`;

      window.SGIUI?.hydrate();

      vc.querySelectorAll(".lote-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedIdx = Number(btn.dataset.idx);
          render(selectedIdx);
        });
      });

      document.getElementById("btn-amortizacion")?.addEventListener("click", () =>
        abrirModalPago({ idVenta: venta.id_venta, soloAmortizacion: true })
      );
      document.querySelectorAll(".btn-pagar-cuota").forEach(btn => {
        btn.addEventListener("click", () => abrirModalPago({
          idVenta: Number(btn.dataset.venta), idCuota: Number(btn.dataset.id),
          valorCuota: Number(btn.dataset.valor), numeroCuota: Number(btn.dataset.num),
        }));
      });
    }

    render(selectedIdx);
  };

  window._abrirModalPago = abrirModalPago;

})();