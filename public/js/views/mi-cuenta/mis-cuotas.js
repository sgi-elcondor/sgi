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

  // Point 13: comprador downloads a PDF of the payment plan from "Mis Cuotas".
  function _planCuotasPDF(venta) {
    const jsPDFCtor = window.jspdf?.jsPDF;
    if (!jsPDFCtor) { window.SGIUI?.toast("No se pudo generar el PDF.", "error"); return; }

    const doc    = new jsPDFCtor({ unit: "mm", format: "a4" });
    const PAGE_W = 210, M = 14;
    const proyecto = venta.lote?.proyecto?.nombre || "Inmueble";
    const lote     = venta.lote?.codigo_lote || "—";
    const u        = window.currentUser || {};
    const nombre   = `${u.nombres || ""} ${u.apellidos || ""}`.trim();

    let y = 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 106, 0);
    doc.text("El Cóndor S.A.S.", M, y);
    doc.setTextColor(17, 17, 17); doc.setFontSize(13); y += 8;
    doc.text("Plan de cuotas", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90); y += 7;
    doc.text(`${proyecto}  ·  Lote ${lote}${venta.lote?.manzana ? "  ·  Manzana " + venta.lote.manzana : ""}`, M, y); y += 5;
    if (nombre) { doc.text(`Comprador: ${nombre}`, M, y); y += 5; }
    doc.text(`Generado: ${new Date().toLocaleDateString("es-CO")}`, M, y); y += 8;

    const cols = [
      { x: M,       w: 12, label: "#",           align: "left"  },
      { x: M + 12,  w: 32, label: "Vencimiento", align: "left"  },
      { x: M + 44,  w: 38, label: "Valor",       align: "right" },
      { x: M + 82,  w: 38, label: "Pagado",      align: "right" },
      { x: M + 120, w: 34, label: "Pendiente",   align: "right" },
      { x: M + 158, w: 24, label: "Estado",      align: "left"  },
    ];
    const cellX = c => (c.align === "right" ? c.x + c.w : c.x);
    function drawHeader() {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
      cols.forEach(c => doc.text(c.label, cellX(c), y, { align: c.align }));
      y += 2; doc.setDrawColor(220, 220, 220); doc.line(M, y, PAGE_W - M, y); y += 4;
      doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
    }
    drawHeader();
    doc.setFontSize(8.5);

    let totVal = 0, totPag = 0;
    (venta.cuotas || []).forEach(c => {
      if (y > 272) { doc.addPage(); y = 18; drawHeader(); doc.setFontSize(8.5); }
      const tieneFrac = c.tiene_fracciones;
      const valor  = Number(tieneFrac ? (c.valor_total_cuota ?? c.valor_cuota) : c.valor_cuota) || 0;
      const pagado = Number(tieneFrac ? (c.total_pagado_cuota ?? c.valor_pagado) : c.valor_pagado) || 0;
      totVal += valor; totPag += pagado;
      const estado = c.estado === "pagada"
        ? (c.pagada_anticipada ? "Pagada ant." : "Pagada")
        : (c.dias_restantes < 0 ? "Vencida" : "Pendiente");
      const cells = [String(c.numero_cuota), fmtDateShort(c.fecha_vencimiento), fmt(valor), fmt(pagado), fmt(Math.max(0, valor - pagado)), estado];
      cols.forEach((col, i) => doc.text(cells[i], cellX(col), y, { align: col.align }));
      y += 5.5;
    });

    y += 2; doc.setDrawColor(220, 220, 220); doc.line(M, y, PAGE_W - M, y); y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(17, 17, 17);
    doc.text(`Total: ${fmt(totVal)}    Pagado: ${fmt(totPag)}    Pendiente: ${fmt(Math.max(0, totVal - totPag))}`, M, y);
    y += 5; doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
    doc.text(`${venta.cuotas_pagadas} de ${venta.total_cuotas} cuotas pagadas (${Math.min(100, venta.porcentaje_pagado || 0).toFixed(1)}%)`, M, y);

    doc.save(`plan_cuotas_lote_${lote}.pdf`);
  }

  async function abrirModalPago({ idVenta, idCuota, cuota, valorPagar, numeroFactura, onSuccess } = {}) {
    const iconSend    = window.SGIUI?.icon("send")          ?? "";
    const iconPhone   = window.SGIUI?.icon("smartphone")    ?? "";
    const iconCash    = window.SGIUI?.icon("banknote")      ?? "";
    const iconSwap    = window.SGIUI?.icon("arrow-left-right") ?? "";
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
              <div id="mp-baucher-empty">
                <div class="baucher-upload-icon">${iconUpload}</div>
                <div class="baucher-upload-label">Arrastra tu baucher aqui</div>
                <button type="button" class="btn btn-outline btn-sm baucher-upload-btn" id="mp-baucher-click">${iconUpload} Subir imagen</button>
              </div>
              <div id="mp-baucher-preview" style="display:none"></div>
            </div>
          </div>
          <div class="form-group">
            <label>Referencia / Numero de transaccion *</label>
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
      let currentObjectUrl = null;
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
        if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }

        const emptyEl  = document.getElementById("mp-baucher-empty");
        const preview  = document.getElementById("mp-baucher-preview");
        const isImage  = f.type.startsWith("image/");

        if (isImage) {
          currentObjectUrl = URL.createObjectURL(f);
          preview.innerHTML = `
            <div class="baucher-img-preview-wrap">
              <img src="${currentObjectUrl}" class="baucher-img-preview" alt="Vista previa del baucher" />
              <button type="button" class="baucher-img-remove" id="mp-baucher-remove">${iconX}</button>
            </div>
            <div class="baucher-preview-footer">
              <span class="baucher-preview-name">${iconFile} ${f.name}</span>
              <button type="button" class="btn btn-ghost btn-sm" id="mp-baucher-change">${iconUpload} Cambiar imagen</button>
            </div>`;
        } else {
          preview.innerHTML = `
            <div class="baucher-preview baucher-preview--file">
              <span class="baucher-preview-name">${iconFile} ${f.name}</span>
              <div style="display:flex;gap:0.5rem;flex-shrink:0">
                <button type="button" class="btn btn-ghost btn-sm" id="mp-baucher-change">${iconUpload} Cambiar archivo</button>
                <span class="baucher-preview-remove" id="mp-baucher-remove">${iconX}</span>
              </div>
            </div>`;
        }

        if (emptyEl) emptyEl.style.display = "none";
        preview.style.display = "block";
        baucherArea.classList.add("has-preview");
        window.SGIUI?.hydrate();

        document.getElementById("mp-baucher-remove")?.addEventListener("click", () => {
          baucherFile = null; uploadedUrl = null;
          if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
          preview.style.display = "none";
          preview.innerHTML = "";
          if (emptyEl) emptyEl.style.display = "";
          baucherArea.classList.remove("has-preview");
          baucherInput.value = "";
        });

        document.getElementById("mp-baucher-change")?.addEventListener("click", () => baucherInput.click());
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
        if (!ref)         { showError("Ingresa la referencia o numero de transaccion."); return; }

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
              const ct = res.headers.get("content-type") || "";
              let errMsg = `Error ${res.status} al subir el baucher`;
              if (ct.includes("json")) {
                const j = await res.json().catch(() => ({}));
                if (j.error) errMsg = j.error;
              }
              throw new Error(errMsg);
            }
            const uploadData = await res.json().catch(() => null);
            if (!uploadData?.url) throw new Error("El servidor no devolvio la URL del baucher");
            uploadedUrl = uploadData.url;
          }
          btn.textContent = "Registrando pago...";
          const fechaPago = datetimeV.includes("T") ? datetimeV : datetimeV + "T12:00:00";
          await onSubmit({ cuenta, fechaPago, ref: ref || undefined, uploadedUrl });
          UI.closeModal();
          if (typeof onSuccess === "function") onSuccess();
          window.SGIUI?.toast("Comprobante enviado. El equipo contable lo revisara pronto.", "success", "Pago registrado");
          const vk = window.currentViewKey;
          if (vk) setTimeout(() => navigate(vk), 400);
        } catch (err) {
          showError(err.message || "Error al enviar el comprobante.");
          btn.disabled = false; btn.textContent = "Enviar comprobante";
        }
      });
    }

    // ── Cuota payment ────────────────────────────────────────────────────────
    // RN-06: the comprador never emits a factura. The cuota must already have an active
    // one (proactive emission or an aux-resolved request). We pay the current saldo.
    const valorAPagar = Number(valorPagar ?? cuota?.valor_pendiente ?? cuota?.valor_cuota ?? 0);
    if (!valorAPagar || valorAPagar <= 0) {
      window.SGIUI?.toast("Esta cuota no tiene saldo pendiente.", "error");
      return;
    }

    UI.openModal("Registrar pago", `
      <div style="display:flex;flex-direction:column;gap:18px">
        <div style="background:var(--surface-2,#f0f4f8);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div>
            ${numeroFactura ? `<div style="font-size:.78rem;color:var(--text-muted)">${numeroFactura}</div>` : ""}
            <div style="font-size:.875rem;font-weight:600">Cuota #${cuota?.numero_cuota ?? idCuota}${cuota?.es_extraordinaria ? " · Extraordinaria" : ""}${cuota?.tiene_fracciones && cuota?.fraccion_actual ? ` · Subdivisión ${cuota.fraccion_actual}/${cuota.total_fracciones}` : ""}</div>
          </div>
          <strong style="font-size:1.05rem;white-space:nowrap;color:var(--accent,#ff6a00)">${fmt(valorAPagar)}</strong>
        </div>
        ${paymentFields}
      </div>`);

    _wireEvents(async ({ cuenta, fechaPago, ref, uploadedUrl }) => {
      await API.post("/pagos/comprador", {
        fecha_pago:           fechaPago,
        valor_pago:           valorAPagar,
        metodo_pago:          "transferencia",
        numero_cuenta_origen: cuenta,
        url_baucher:          uploadedUrl,
        referencia:           ref,
        id_venta:             idVenta || undefined,
        id_cuota_propuesta:   idCuota || undefined,
        tipo_pago:            "cuota",
      });
    });
  }

  // RN-06/RN-11: for a cuota without an active factura the comprador only manifests intent.
  async function solicitarPago(cuota, idVenta) {
    UI.openModal("Solicitar pago", `
      <div style="display:flex;flex-direction:column;gap:14px">
        <p style="font-size:.88rem;color:var(--text-muted);line-height:1.5">
          La factura la emite el equipo contable. Al solicitar, registramos tu intención de pagar la
          <strong>Cuota #${cuota.numero_cuota}</strong>${cuota.tiene_fracciones ? "" : ` por ${fmt(cuota.valor_cuota)}`}
          y la emitirán para que puedas pagarla.
        </p>
        <div class="form-group">
          <label>Nota (opcional)</label>
          <textarea id="sol-nota" rows="2" placeholder="Ej: Quiero adelantar esta cuota."></textarea>
        </div>
        <div class="form-actions">
          <button class="btn btn-ghost" onclick="UI.closeModal()">Cancelar</button>
          <button class="btn btn-primary" id="sol-enviar">Enviar solicitud</button>
        </div>
      </div>`);

    document.getElementById("sol-enviar")?.addEventListener("click", async () => {
      const nota = document.getElementById("sol-nota")?.value.trim() || undefined;
      const btn  = document.getElementById("sol-enviar");
      btn.disabled = true; btn.textContent = "Enviando...";
      try {
        await API.post("/facturas/solicitar", { id_cuota: cuota.id_cuota, nota });
        UI.closeModal();
        window.SGIUI?.toast("Solicitud enviada. El equipo contable emitirá tu factura.", "success", "Solicitud registrada");
      } catch (e) {
        btn.disabled = false; btn.textContent = "Enviar solicitud";
        window.SGIUI?.toast(e.message, "error", "Error");
      }
    });
  }
  window._solicitarPagoCuota = solicitarPago;

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
      if (c.estado === "pagada") return { text: c.pagada_anticipada ? "Pagada anticipadamente" : "Pagada", cls: "muted" };
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

      const cuotasHtml = cuotas.flatMap((c, i) => {
        const isCurrent = i === indexActual;
        const isPagada  = c.estado === "pagada";
        const isVencida = c.dias_restantes < 0 && !isPagada;
        const dl  = diasLabel(c);
        const pct = c.tiene_fracciones
          ? (c.valor_total_cuota > 0 ? Math.min(100, (c.total_pagado_cuota / c.valor_total_cuota) * 100) : 0)
          : (c.valor_cuota > 0 ? Math.min(100, (c.valor_pagado / c.valor_cuota) * 100) : 0);
        const enRevision = (c.valor_en_revision || 0) > 0;
        const pagoRechazado = !!c.pago_rechazado;
        let actionBtn = "";
        if (!isPagada) {
          if (enRevision) {
            actionBtn = `<button class="btn btn-sm" disabled style="opacity:.6;cursor:not-allowed;background:var(--surface-2);color:var(--text-muted);border:1px solid var(--border)">${window.SGIUI?.icon("clock") ?? ""} En revision</button>`;
          } else if (c.tiene_factura) {
            const esActual = isCurrent || pagoRechazado;
            actionBtn = `<button class="btn ${esActual ? "btn-primary" : "btn-ghost"} btn-sm btn-pagar-cuota" data-cuota-idx="${i}">${esActual ? "Pagar" : `${window.SGIUI?.icon("zap") ?? ""} Adelantar`}</button>`;
          } else {
            actionBtn = `<button class="btn btn-ghost btn-sm btn-solicitar-cuota" data-cuota-idx="${i}">${window.SGIUI?.icon("file-text") ?? ""} Solicitar pago</button>`;
          }
        }
        const fraccionBadge = c.tiene_fracciones && c.fraccion_actual
          ? `<span class="badge badge-muted" style="margin-left:6px">Subdivisión ${c.fraccion_actual}/${c.total_fracciones}</span>`
          : "";

        const fracPagadasCards = (!isPagada && c.fracciones_pagadas?.length > 0)
          ? c.fracciones_pagadas.map(fp => `
            <div class="cuota-card pagada">
              <div class="cuota-card-left">
                <div class="cuota-card-num">Cuota #${c.numero_cuota}<span class="badge badge-muted" style="margin-left:6px">Subdivisión ${fp.numero_fraccion}/${c.total_fracciones}</span></div>
                <div class="cuota-card-fecha">${fp.fecha_propuesta ? fmtDate(fp.fecha_propuesta) : fmtDate(c.fecha_vencimiento)}</div>
                <div class="cuota-card-dias muted">Pagada</div>
              </div>
              <div class="cuota-card-center">
                <div class="cuota-card-valor">${fmt(fp.valor_fraccion)}</div>
              </div>
              <div class="cuota-card-right">
                <span class="badge badge-success">Pagada</span>
              </div>
            </div>`)
          : [];

        const mainCard = `
          <div class="cuota-card ${isCurrent?"current":""} ${isPagada?"pagada":""} ${isVencida?"vencida":""}">
            <div class="cuota-card-left">
              <div class="cuota-card-num">Cuota #${c.numero_cuota}${c.es_extraordinaria?'<span class="badge badge-info" style="margin-left:6px">Extraordinaria</span>':""}${c.tipo==="inicial"?'<span class="badge badge-muted" style="margin-left:6px">Inicial</span>':""}${fraccionBadge}</div>
              <div class="cuota-card-fecha">${fmtDate(c.fecha_vencimiento)}</div>
              <div class="cuota-card-dias ${dl.cls}">${dl.text}</div>
            </div>
            <div class="cuota-card-center">
              ${c.tiene_fracciones && !isPagada ? `
                <div class="cuota-card-valor">${fmt(c.valor_cuota)}</div>
                <div class="cuota-card-pendiente">Pendiente: ${fmt(Math.max(0, c.valor_total_cuota - c.total_pagado_cuota))}</div>
                <div class="cuota-card-pendiente">Pagado: ${fmt(c.total_pagado_cuota)}</div>
                <div class="cuota-mini-progress"><div class="cuota-mini-progress-bar"><div class="cuota-mini-progress-fill" style="width:${pct}%"></div></div></div>
              ` : `
                <div class="cuota-card-valor">${fmt(c.valor_cuota)}</div>
                ${c.valor_pagado > 0 && !isPagada ? `
                  <div class="cuota-card-pendiente">Pagado: ${fmt(c.valor_pagado)}</div>
                  <div class="cuota-card-pendiente">Pendiente: ${fmt(c.valor_pendiente)}</div>
                  <div class="cuota-mini-progress"><div class="cuota-mini-progress-bar"><div class="cuota-mini-progress-fill" style="width:${pct}%"></div></div></div>` : ""}
              `}
              ${enRevision ? `<div class="cuota-card-revision">En revision: ${fmt(c.valor_en_revision)}</div>` : ""}
              ${pagoRechazado && !enRevision ? `<div class="cuota-card-rechazado">${window.SGIUI?.icon("x-circle") ?? ""} Comprobante rechazado — vuelve a registrar tu pago</div>` : ""}
            </div>
            <div class="cuota-card-right">
              ${isPagada
                ? (c.pagada_anticipada
                    ? '<span class="badge badge-info">Pagada anticipadamente</span>'
                    : '<span class="badge badge-success">Pagada</span>')
                : UI.badge(c.estado)}
              ${actionBtn}
            </div>
          </div>`;

        return [...fracPagadasCards, mainCard];
      }).join("");

      vc.innerHTML = `
        <section class="page-shell">
          ${window.SGIUI?.pageHeader({
            kicker: "Mis cuotas",
            title: `${venta.lote?.proyecto?.nombre || "Mi inmueble"}`,
            subtitle: `Lote ${venta.lote?.codigo_lote || "—"}${venta.lote?.manzana ? " · Manzana " + venta.lote.manzana : ""}`,
            actions: `<button class="btn btn-ghost btn-sm" id="btn-plan-pdf">${window.SGIUI?.icon("download") ?? ""} Descargar plan (PDF)</button>`,
            meta: `<span class="results-chip">${window.SGIUI?.icon("check-circle") ?? ""} ${venta.cuotas_pagadas} de ${venta.total_cuotas} cuotas pagadas</span>`,
          }) ?? ""}
          ${buildLoteSelector(idx)}
          <section class="table-wrap">
            <div style="padding:1rem 1.25rem">
              <div class="cuotas-progress-header">
                <span style="font-size:0.8125rem;color:var(--text-muted)">Progreso general</span>
                <strong>${Math.min(100, venta.porcentaje_pagado||0).toFixed(1)}%</strong>
              </div>
              <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.min(100,venta.porcentaje_pagado||0)}%"></div></div>
            </div>
          </section>
          <section class="cuotas-comprador">${cuotasHtml || `<p style="color:var(--text-muted);padding:1.25rem">No hay cuotas registradas.</p>`}</section>
        </section>`;

      window.SGIUI?.hydrate();

      document.getElementById("btn-plan-pdf")?.addEventListener("click", () => _planCuotasPDF(venta));

      vc.querySelectorAll(".lote-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedIdx = Number(btn.dataset.idx);
          render(selectedIdx);
        });
      });

      document.querySelectorAll(".btn-pagar-cuota").forEach(btn => {
        btn.addEventListener("click", () => {
          const cuota = cuotas[Number(btn.dataset.cuotaIdx)];
          abrirModalPago({ cuota, idVenta: venta.id_venta, idCuota: cuota.id_cuota, valorPagar: cuota.valor_pendiente });
        });
      });
      document.querySelectorAll(".btn-solicitar-cuota").forEach(btn => {
        btn.addEventListener("click", () => {
          const cuota = cuotas[Number(btn.dataset.cuotaIdx)];
          solicitarPago(cuota, venta.id_venta);
        });
      });
    }

    render(selectedIdx);
  };

  window._abrirModalPago = abrirModalPago;

})();