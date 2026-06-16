(function () {

const ESTADO_PROCESO_OPTIONS = [
  "Notificacion enviada",
  "En negociacion",
  "Proceso coactivo",
  "Acuerdo de pago",
  "Demanda radicada",
  "Resolucion pendiente",
  "Cerrado",
];

window.juridicoView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  function renderShell() {
    vc.innerHTML = `
      <div class="table-wrap">
        <div class="table-header">
          <div>
            <h3>Seguimiento Juridico</h3>
            <p style="font-size:.82rem;color:var(--text-muted);margin:.25rem 0 0">
              Gestion legal de ventas problematicas: registro y seguimiento de observaciones del proceso.
              Para consultar la lista operativa de ventas, usa la vista <strong>Ventas</strong>.
            </p>
          </div>
        </div>
        <div id="jur_body" style="padding:0 1rem 1rem"></div>
      </div>
    `;
  }

  async function renderCartera() {
    const body = document.getElementById("jur_body");
    body.innerHTML = UI.loader();

    const data = await API.get("/juridico/cartera").catch(e => {
      body.innerHTML = `<p style="color:var(--danger);padding:12px">${e.message}</p>`;
      return null;
    });
    if (!data) return;

    if (!data.length) {
      body.innerHTML = `<p style="color:var(--success);padding:20px">Sin casos juridicos activos.</p>`;
      return;
    }

    const estadoBadge = est => {
      const map = { en_mora: "danger", pre_mora: "warning", devolucion: "info", cancelada: "default" };
      const cls = map[est] || "default";
      return `<span class="badge badge-${cls}">${(est || "").replace(/_/g, " ")}</span>`;
    };

    body.innerHTML = `
      <table id="jur_cartera_table">
        <thead><tr>
          <th>Venta</th>
          <th>Proyecto / Lote</th>
          <th>Comprador</th>
          <th>Estado</th>
          <th>Dias mora</th>
          <th>Saldo</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${data.map(v => {
            const id = v.id_venta ?? v.idVenta ?? v.venta_id ?? v.id;
            const btn = id != null
              ? `<button class="btn btn-primary btn-sm" data-action="ver" data-id="${id}">Gestionar</button>`
              : `<button class="btn btn-ghost btn-sm" disabled title="Sin id_venta en la respuesta">Sin ID</button>`;
            return `
              <tr>
                <td>${id != null ? `<strong>${SGIUI.ventaCode(v)}</strong>` : "—"}</td>
                <td style="font-size:.82rem">${v.proyecto ?? v.nombre_proyecto ?? "—"} / ${v.codigo_lote ?? v.lote ?? "—"}</td>
                <td style="font-size:.82rem">${v.comprador ?? v.cliente ?? v.nombres ?? "—"}</td>
                <td>${estadoBadge(v.estado ?? v.estado_venta)}</td>
                <td style="color:var(--danger);font-weight:600">${v.dias_mora != null ? v.dias_mora : "—"}</td>
                <td>${UI.fmt(v.saldo ?? v.saldo_pendiente)}</td>
                <td>${btn}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

    document.getElementById("jur_cartera_table")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest('button[data-action="ver"]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      if (!Number.isInteger(id) || id <= 0) return;
      abrirModalDetalle(id);
    });
  }

  function getCuotasVencidas(venta) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return (venta.cuota || [])
      .filter(c => {
        // RN-16: derived paid flag from receipts, not the stored estado.
        if (c.pagada) return false;
        const f = c.fecha_vencimiento ? new Date(c.fecha_vencimiento + "T12:00:00") : null;
        return f && f < hoy;
      })
      .sort((a, b) => a.numero_cuota - b.numero_cuota);
  }

  async function abrirModalDetalle(idVenta) {
    const overlay = document.getElementById("modalOverlay");
    const titleEl = document.getElementById("modalTitle");
    const bodyEl  = document.getElementById("modalBody");
    if (!overlay || !titleEl || !bodyEl) return;

    titleEl.textContent = `Venta #${idVenta}`;
    bodyEl.innerHTML = UI.loader();
    overlay.classList.add("open");

    const [venta, observaciones] = await Promise.all([
      API.get(`/ventas/${idVenta}`).catch(() => null),
      API.get(`/juridico/${idVenta}/observaciones`).catch(() => []),
    ]);

    if (!venta) {
      bodyEl.innerHTML = `<p style="color:var(--danger);padding:1rem">No se pudo cargar la venta.</p>`;
      return;
    }

    titleEl.innerHTML = `Venta ${SGIUI.ventaCode(venta)} &mdash; ${UI.badge(venta.estado)}`;

    const compradoresHtml = (() => {
      const comps = venta.venta_comprador || [];
      if (!comps.length) return `<p style="color:var(--text-muted)">Sin compradores.</p>`;
      return comps.map(vc => {
        const c = vc.usuario || {};
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

    const cuotasVencidas = getCuotasVencidas(venta);
    const totalVencido   = cuotasVencidas.reduce((s, c) => s + Number(c.valor_pendiente ?? c.valor_cuota ?? 0), 0);

    const pdfButton = (() => {
      if (venta.estado === "pre_mora") {
        return `<button class="btn btn-warning btn-sm" id="jur_btn_pdf" data-tipo="pre_mora">
          Generar notificacion de pago (PDF)
        </button>`;
      }
      if (venta.estado === "en_mora") {
        return `<button class="btn btn-danger btn-sm" id="jur_btn_pdf" data-tipo="en_mora">
          Generar requerimiento formal de pago (PDF)
        </button>`;
      }
      return "";
    })();

    bodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1rem">
        <div>
          <p style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:.5rem">Datos de la venta</p>
          <p style="font-size:.9rem;margin:.15rem 0">Fecha: ${UI.date(venta.fecha_venta)}</p>
          <p style="font-size:.9rem;margin:.15rem 0">Valor total: <strong>${UI.fmt(venta.valor_total)}</strong></p>
          <p style="font-size:.9rem;margin:.15rem 0">Cuota inicial: ${UI.fmt(venta.cuota_inicial)}</p>
          <p style="font-size:.9rem;margin:.15rem 0">Cuotas vencidas: <strong style="color:var(--danger)">${cuotasVencidas.length}</strong></p>
          <p style="font-size:.9rem;margin:.15rem 0">Total vencido: <strong style="color:var(--danger)">${UI.fmt(totalVencido)}</strong></p>
        </div>
        <div>
          <p style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:.5rem">Compradores</p>
          ${compradoresHtml}
        </div>
      </div>

      ${pdfButton ? `<div style="border-top:1px solid var(--border);padding-top:1rem;margin-bottom:1rem">
        <p style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:.5rem">Documento legal</p>
        ${pdfButton}
      </div>` : ""}

      <div style="border-top:1px solid var(--border);padding-top:1rem">
        <p style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:.75rem">Observaciones juridicas</p>
        <div id="jur_obs_list">${obsHtml(observaciones)}</div>

        <div style="margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem">
          <p style="font-size:.85rem;font-weight:600;margin-bottom:.75rem">Registrar nueva observacion</p>
          <div style="display:grid;gap:.75rem">
            <div>
              <label style="font-size:.82rem;font-weight:500;display:block;margin-bottom:.3rem">Estado del proceso legal</label>
              <select id="jur_estado_proceso" class="form-select" style="width:100%;max-width:340px">
                <option value="">— Sin estado especifico —</option>
                ${ESTADO_PROCESO_OPTIONS.map(e => `<option value="${e}">${e}</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:500;display:block;margin-bottom:.3rem">Descripcion <span style="color:var(--danger)">*</span></label>
              <textarea id="jur_descripcion" rows="3" placeholder="Describe la situacion juridica actual..."
                style="width:100%;padding:.5rem .75rem;border:1px solid var(--border);border-radius:8px;font-size:.88rem;resize:vertical;box-sizing:border-box;background:var(--surface);color:var(--text)"></textarea>
            </div>
            <div id="jur_obs_error" style="display:none;color:var(--danger);font-size:.85rem"></div>
            <div style="display:flex;gap:.5rem;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" onclick="UI.closeModal()">Cerrar</button>
              <button class="btn btn-primary btn-sm" id="jur_btn_obs">Guardar observacion</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("jur_btn_obs")?.addEventListener("click", async () => {
      const descripcion    = document.getElementById("jur_descripcion").value.trim();
      const estado_proceso = document.getElementById("jur_estado_proceso").value;
      const errorEl        = document.getElementById("jur_obs_error");
      const btn            = document.getElementById("jur_btn_obs");

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

    document.getElementById("jur_btn_pdf")?.addEventListener("click", (ev) => {
      const tipo = ev.currentTarget.dataset.tipo;
      generarPDF(venta, cuotasVencidas, totalVencido, tipo);
    });
  }

  function generarPDF(venta, cuotasVencidas, totalVencido, tipo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const SX  = window.SGIExport.pdf;

    const esMora = tipo === "en_mora";
    const compradorPrincipal = (venta.venta_comprador || [])[0]?.usuario || {};
    const nombreComprador = `${compradorPrincipal.nombres || ""} ${compradorPrincipal.apellidos || ""}`.trim() || "—";
    const docComprador    = compradorPrincipal.documento || "—";
    const telComprador    = compradorPrincipal.telefono  || "—";
    const emailComprador  = compradorPrincipal.email     || "—";
    const lote      = venta.lote || {};
    const proyecto  = lote.proyecto?.nombre || "—";
    const codigoLote = lote.codigo_lote || `${lote.manzana ?? ""}-${lote.numero_lote ?? ""}` || "—";

    let y = SX.brand(doc);

    y = SX.title(doc, y + 2, {
      title:    esMora ? "REQUERIMIENTO FORMAL DE PAGO" : "Notificacion de Pago Pendiente",
      subtitle: esMora
        ? `Documento de cobranza emitido conforme al contrato de venta del lote ${codigoLote} en el proyecto ${proyecto}.`
        : `Recordatorio cordial sobre cuotas pendientes del lote ${codigoLote} en el proyecto ${proyecto}.`,
    });

    y = SX.section(doc, y + 2, { kicker: "Destinatario", title: "Datos del Comprador" });
    doc.autoTable({
      startY: y,
      body: [
        ["Nombre completo", nombreComprador],
        ["Documento",       docComprador],
        ["Telefono",        telComprador],
        ["Correo",          emailComprador],
      ],
      theme: "plain",
      styles: { fontSize: 9, cellPadding: { top: 2, right: 4, bottom: 2, left: 0 }, font: "helvetica" },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 45 },
        1: { textColor: [30, 41, 59] },
      },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;

    y = SX.section(doc, y + 2, { kicker: "Inmueble", title: "Identificacion del Lote" });
    doc.autoTable({
      startY: y,
      body: [
        ["Proyecto",      proyecto],
        ["Codigo lote",   codigoLote],
        ["Manzana / Lote", `${lote.manzana ?? "—"} / ${lote.numero_lote ?? "—"}`],
        ["Venta",          SGIUI.ventaCode(venta)],
        ["Fecha de venta", UI.date(venta.fecha_venta)],
        ["Valor total",    UI.fmt(venta.valor_total)],
      ],
      theme: "plain",
      styles: { fontSize: 9, cellPadding: { top: 2, right: 4, bottom: 2, left: 0 }, font: "helvetica" },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 45 },
        1: { textColor: [30, 41, 59] },
      },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;

    y = SX.section(doc, y + 2, { kicker: "Pendientes", title: "Cuotas Vencidas" });
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    doc.autoTable({
      startY: y,
      head: [["#", "Tipo", "Vencimiento", "Dias atraso", "Valor"]],
      body: cuotasVencidas.map(c => {
        const f    = new Date(c.fecha_vencimiento + "T12:00:00");
        const dias = Math.floor((hoy - f) / 86_400_000);
        return [
          String(c.numero_cuota),
          c.tipo || "—",
          UI.date(c.fecha_vencimiento),
          String(dias),
          UI.fmt(c.valor_cuota),
        ];
      }),
      ...SX.tableTheme(),
      columnStyles: {
        0: { halign: "center", cellWidth: 14 },
        2: { halign: "center", cellWidth: 32 },
        3: { halign: "center", cellWidth: 24 },
        4: { halign: "right",  cellWidth: 40 },
      },
    });
    y = doc.lastAutoTable.finalY + 6;

    y = SX.kpiCards(doc, y, [
      { label: "Cuotas vencidas", value: String(cuotasVencidas.length), desc: "Pendientes de pago a la fecha" },
      { label: "Total adeudado",  value: UI.fmt(totalVencido),          desc: "Suma de cuotas en mora" },
    ], { perRow: 2 });

    y = SX.section(doc, y + 6, { kicker: esMora ? "Requerimiento" : "Mensaje", title: esMora ? "Pago Inmediato" : "Recordatorio" });

    const W = doc.internal.pageSize.getWidth();
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    const cuerpo = esMora
      ? [
          `Estimado(a) ${nombreComprador}:`,
          ``,
          `Por medio del presente documento, El Condor S.A.S. le REQUIERE FORMALMENTE el pago inmediato de las cuotas vencidas relacionadas en la tabla anterior, correspondientes al lote ${codigoLote} del proyecto ${proyecto}, por un valor total de ${UI.fmt(totalVencido)}.`,
          ``,
          `Conforme al contrato de venta suscrito, su obligacion se encuentra en estado de MORA. Por tal motivo, le concedemos un plazo de CINCO (5) DIAS HABILES contados a partir de la fecha de recepcion del presente, para que se acerque a nuestras oficinas y converse con el auxiliar contable a cargo, a fin de regularizar su situacion o pactar un acuerdo de pago.`,
          ``,
          `De no atender este requerimiento dentro del plazo establecido, la empresa se vera en la obligacion de iniciar las acciones legales y de cobranza correspondientes, sin perjuicio de los intereses moratorios y demas costos asociados que se generen.`,
          ``,
          `Atentamente,`,
          ``,
          `Area Juridica`,
          `El Condor S.A.S.`,
        ]
      : [
          `Estimado(a) ${nombreComprador}:`,
          ``,
          `Le saludamos cordialmente desde El Condor S.A.S. El motivo de la presente es recordarle que, a la fecha, su venta correspondiente al lote ${codigoLote} del proyecto ${proyecto} presenta ${cuotasVencidas.length} cuota(s) pendiente(s) por un valor total de ${UI.fmt(totalVencido)}.`,
          ``,
          `Le invitamos a regularizar esta situacion lo antes posible para evitar que su venta entre en estado de mora formal. Puede acercarse a nuestras oficinas en horario de atencion y consultar con el auxiliar contable la forma mas conveniente de ponerse al dia.`,
          ``,
          `Si ya realizo el pago, le agradecemos hacer caso omiso a esta comunicacion.`,
          ``,
          `Quedamos atentos a su pronta respuesta.`,
          ``,
          `Cordialmente,`,
          ``,
          `Area Juridica`,
          `El Condor S.A.S.`,
        ];

    for (const linea of cuerpo) {
      if (y > 270) { doc.addPage(); y = 30; }
      const lines = doc.splitTextToSize(linea || " ", W - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4.6;
    }

    y += 10;
    if (y > 250) { doc.addPage(); y = 30; }
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(20, y, 90, y);
    doc.line(W - 90, y, W - 20, y);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Firma comprador", 20, y + 4);
    doc.text("Firma representante El Condor", W - 90, y + 4);

    const slug = `${esMora ? "requerimiento" : "notificacion"}_venta_${venta.id_venta}_${new Date().toISOString().slice(0, 10)}`;
    doc.save(`${slug}.pdf`);
  }

  renderShell();
  renderCartera();
};

})();
