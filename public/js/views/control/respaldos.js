window.respaldosView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  let data;
  try {
    data = await API.get("/respaldos");
  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:1.25rem">${e.message}</p>`;
    return;
  }
  if (!Array.isArray(data)) data = [];

  const TABLA_LABELS = {
    proyecto: "Proyectos", lote: "Lotes", venta: "Ventas",
    venta_comprador: "Compradores de venta", venta_comisionista: "Comisiones",
    cuota: "Cuotas", cuota_fraccion: "Fracciones de cuota", cuota_pago: "Aplicación de pagos",
    cuota_factura: "Factura de cuota", pago: "Pagos", recibo: "Recibos",
    recibo_pago: "Recibo de pago", factura: "Facturas", bank_transaction: "Transacciones bancarias",
    pago_comision: "Micropagos de comisión", observacion_juridica: "Jurídico",
    gasto: "Gastos", requerimiento: "Requerimientos", requerimiento_item: "Ítems de requerimiento",
    recepcion: "Recepciones", recepcion_item: "Ítems de recepción",
    inventario_movimiento: "Inventario", usuarios: "Usuarios",
  };

  const TIPO_LABELS   = { completo: "Completo", parcial: "Parcial" };
  const ESTADO_LABELS = { completado: "Completado", fallido: "Fallido", purgado: "Purgado" };
  const ORIGEN_LABELS = { automatico: "Automático", manual: "Manual" };

  function fmtBytes(bytes) {
    if (!bytes && bytes !== 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let val = Number(bytes), i = 0;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function estadoBadge(estado) {
    const cls = estado === "completado" ? "success" : estado === "fallido" ? "danger" : "warning";
    return `<span class="badge badge-${cls}">${ESTADO_LABELS[estado] || estado}</span>`;
  }

  function tipoBadge(tipo) {
    const cls = tipo === "completo" ? "warning" : "info";
    return `<span class="badge badge-${cls}">${TIPO_LABELS[tipo] || tipo}</span>`;
  }

  // ── Modal: elegir alcance y confirmar ──────────────────────────────────────
  function pedirAlcance(respaldo) {
    return new Promise(resolve => {
      let ov = document.getElementById("respaldoRestoreOverlay");
      if (!ov) {
        ov = document.createElement("div");
        ov.id = "respaldoRestoreOverlay";
        ov.className = "confirm-overlay";
        document.body.appendChild(ov);
      }

      const opciones = Object.entries(TABLA_LABELS)
        .map(([val, label]) => `<option value="${val}">${label}</option>`).join("");

      ov.innerHTML = `
        <div class="confirm-dialog" role="alertdialog" aria-modal="true">
          <div class="confirm-icon"><i data-lucide="database-backup"></i></div>
          <h3 class="confirm-title">Restaurar respaldo</h3>
          <p class="confirm-message">Elige qué quieres restaurar del respaldo del
            ${new Date(respaldo.fecha).toLocaleString("es-CO")}.</p>
          <select class="form-control" id="rr-alcance" style="margin:.75rem 0;">
            <option value="ALL">⚠ Todo el sistema (restauración total)</option>
            ${opciones}
          </select>
          <div id="rr-warning" style="display:none;">
            <p style="color:var(--danger); font-size:.85rem; margin:.5rem 0;">
              Esto reemplaza TODOS los datos actuales por los del respaldo. Es irreversible.
              Escribe <strong>RESTAURAR</strong> para continuar.
            </p>
            <input class="form-control" id="rr-confirm-text" type="text" placeholder="RESTAURAR"
              style="margin-bottom:.5rem;" />
          </div>
          <div class="confirm-actions">
            <button class="btn btn-ghost" data-rr="cancel">Cancelar</button>
            <button class="btn btn-danger" data-rr="ok">Continuar</button>
          </div>
        </div>`;
      ov.classList.add("show");
      window.SGIUI?.hydrate?.();

      const select      = document.getElementById("rr-alcance");
      const warning      = document.getElementById("rr-warning");
      const confirmText  = document.getElementById("rr-confirm-text");

      const syncWarning = () => { warning.style.display = select.value === "ALL" ? "block" : "none"; };
      syncWarning();
      select.addEventListener("change", syncWarning);

      const cleanup = () => {
        ov.classList.remove("show");
        ov.removeEventListener("click", onClick);
      };

      const onClick = e => {
        const action = e.target.closest("[data-rr]")?.dataset.rr;
        if (action === "ok") {
          const alcance = select.value;
          if (alcance === "ALL" && confirmText.value.trim().toUpperCase() !== "RESTAURAR") {
            confirmText.focus();
            return;
          }
          cleanup();
          resolve(alcance);
        } else if (action === "cancel") {
          cleanup();
          resolve(null);
        }
      };
      ov.addEventListener("click", onClick);
    });
  }

  // ── Polling del estado de una restauración en curso ────────────────────────
  function seguirRestauracion(idRestauracion) {
    const timer = setInterval(async () => {
      let r;
      try { r = await API.get(`/respaldos/restauraciones/${idRestauracion}`); }
      catch (_) { return; }
      if (!r || r.estado === "en_progreso") return;

      clearInterval(timer);
      UI.toast(
        r.estado === "completado" ? "Restauración completada." : `Restauración fallida: ${r.detalle || "error desconocido"}`,
        r.estado === "completado" ? "success" : "error"
      );
      window.respaldosView();
    }, 5000);
  }

  async function onRestaurar(respaldo) {
    const alcance = await pedirAlcance(respaldo);
    if (!alcance) return;

    const stepUp = await window.solicitarStepUp("restaurar un respaldo");
    if (!stepUp) return;

    try {
      const res = await API.post(`/respaldos/${respaldo.id_respaldo}/restaurar`, { alcance, ...stepUp });
      UI.toast("Restauración iniciada. Esto puede tardar varios minutos.", "info");
      seguirRestauracion(res.id_restauracion);
    } catch (e) {
      UI.toast("No se pudo iniciar la restauración: " + e.message, "error");
    }
  }

  async function onDescargar(respaldo) {
    try {
      const { url } = await API.get(`/respaldos/${respaldo.id_respaldo}/descargar`);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      UI.toast("No se pudo generar el enlace de descarga: " + e.message, "error");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    vc.innerHTML = `
      <section class="page-shell">
        ${window.SGIUI?.pageHeader({
          kicker:   "Control",
          title:    "Respaldos",
          subtitle: "Copias de seguridad automáticas del sistema y restauración ante incidentes",
        }) ?? ""}

        <div class="table-wrap">
          <div class="table-header">
            <h3><i data-lucide="database-backup"></i> Respaldos disponibles
              <span class="results-chip">${data.length}</span>
            </h3>
          </div>
          ${!data.length
            ? `<div class="audit-empty"><p>Todavía no hay respaldos generados.</p></div>`
            : `<div class="audit-table-wrap">
                <table class="audit-table">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Tipo</th><th>Alcance</th><th>Tamaño</th>
                      <th>Origen</th><th>Estado</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.map(r => `
                      <tr data-id="${r.id_respaldo}">
                        <td>${new Date(r.fecha).toLocaleString("es-CO")}</td>
                        <td>${tipoBadge(r.tipo)}</td>
                        <td>${r.alcance ? (TABLA_LABELS[r.alcance] || r.alcance) : "Schema completo"}</td>
                        <td>${fmtBytes(r.tamano_bytes)}</td>
                        <td>${ORIGEN_LABELS[r.origen] || r.origen}</td>
                        <td>${estadoBadge(r.estado)}</td>
                        <td style="white-space:nowrap;">
                          ${r.estado === "completado" ? `
                            <button class="btn btn-ghost btn-sm" data-action="descargar" data-id="${r.id_respaldo}">
                              <i data-lucide="download"></i></button>
                            <button class="btn btn-danger btn-sm" data-action="restaurar" data-id="${r.id_respaldo}">
                              <i data-lucide="rotate-ccw"></i> Restaurar</button>` : ""}
                        </td>
                      </tr>`).join("")}
                  </tbody>
                </table>
              </div>`}
        </div>
      </section>`;

    window.SGIUI?.hydrate();

    vc.querySelectorAll('[data-action="restaurar"]').forEach(btn => {
      btn.addEventListener("click", () => {
        const respaldo = data.find(r => String(r.id_respaldo) === btn.dataset.id);
        if (respaldo) onRestaurar(respaldo);
      });
    });
    vc.querySelectorAll('[data-action="descargar"]').forEach(btn => {
      btn.addEventListener("click", () => {
        const respaldo = data.find(r => String(r.id_respaldo) === btn.dataset.id);
        if (respaldo) onDescargar(respaldo);
      });
    });
  }

  render();
};
