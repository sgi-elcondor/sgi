const supabase  = require("../config/supabase");
const cuotasSvc = require("../services/cuotas.service");
const auditoria = require("../services/auditoria.service");
const SCHEMA    = "condor";

exports.getAll = async (req, res) => {
  const { estado, mes, proyecto, cliente } = req.query;
  const rolUsuario = req.usuario?.rol || "";
  const ESTADOS_JURIDICO = ["pre_mora", "en_mora"];
  const restringirJuridico = rolUsuario === "juridico";

  let q = supabase.schema(SCHEMA).from("venta")
    .select(`*, lote(codigo_lote, manzana, numero_lote, proyecto(nombre)),
      venta_comprador(porcentaje, usuario:id_usuario(nombres, apellidos, documento)),
      venta_comisionista(valor_comision, usuario:id_usuario(nombres, apellidos))`)
    .order("fecha_venta", { ascending: false });

  if (restringirJuridico) {
    const estadoSolicitado = estado && ESTADOS_JURIDICO.includes(estado) ? estado : null;
    if (estadoSolicitado) {
      q = q.eq("estado", estadoSolicitado);
    } else {
      q = q.in("estado", ESTADOS_JURIDICO);
    }
  } else if (estado) {
    q = q.eq("estado", estado);
  }

  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [anio, m] = mes.split("-").map(Number);
    const ultimo = new Date(anio, m, 0).getDate();

    q = q
      .gte("fecha_venta", `${mes}-01`)
      .lte("fecha_venta", `${mes}-${String(ultimo).padStart(2, "0")}`);
  }

  const { data, error } = await q;

  if (error) return res.status(500).json({ error: error.message });

  let result = data || [];

  // Filtros en memoria por campos anidados
  if (proyecto) {
    const pn = proyecto.toLowerCase();

    result = result.filter(v =>
      (v.lote?.proyecto?.nombre || "").toLowerCase().includes(pn)
    );
  }

  if (cliente) {
    const cn = cliente
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

    result = result.filter(v =>
      (v.venta_comprador || []).some(vc => {
        const full = `${vc.usuario?.nombres || ""} ${vc.usuario?.apellidos || ""} ${vc.usuario?.documento || ""}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "");

        return full.includes(cn);
      })
    );
  }

  res.json(result);
};

exports.getById = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "ID de venta inválido" });
  }

  const { data, error } = await supabase.schema(SCHEMA).from("venta")
    .select(`*, lote(*, proyecto(nombre)),
      venta_comprador(*, usuario:id_usuario(*)),
      venta_comisionista(*, usuario:id_usuario(*)),
      cuota(*)`)
    .eq("id_venta", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });

  res.json(data);
};



// Validaciones de negocio antes de crear la venta
function validarCamposVenta({
  id_lote,
  valor_total,
  cuota_inicial,
  valor_comision,
  numero_cuotas,
  numero_cuotas_inicial,
  fecha_primera_cuota,
  fecha_primera_cuota_inicial,
  compradores,
  permutas,
  microcuotas
}) {
  const vt  = Number(valor_total);
  const ci  = Number(cuota_inicial) || 0;
  const vc  = Number(valor_comision) || 0;
  const nc  = parseInt(numero_cuotas, 10) || 0;
  const nci = parseInt(numero_cuotas_inicial, 10) || 0;

  if (!id_lote || isNaN(Number(id_lote)) || Number(id_lote) <= 0) {
    return "Debe seleccionar un lote válido";
  }

  if (!vt || vt <= 0) {
    return "El valor total debe ser mayor a cero";
  }

  if (ci < 0) {
    return "La cuota inicial no puede ser negativa";
  }

  if (ci > vt) {
    return "La cuota inicial no puede superar el valor total";
  }

  if (vc < 0) {
    return "El valor de comisión no puede ser negativo";
  }

  if (!Array.isArray(compradores) || compradores.length === 0) {
    return "Debe asociar al menos un comprador a la venta";
  }

  for (const c of compradores) {
    if (!c.id_usuario || isNaN(Number(c.id_usuario)) || Number(c.id_usuario) <= 0) {
      return "Uno de los compradores no es válido";
    }

    const porcentaje = Number(c.porcentaje);

    if (!porcentaje || porcentaje <= 0 || porcentaje > 100) {
      return "El porcentaje de participación de cada comprador debe estar entre 1 y 100";
    }
  }

  const sumaPorcentajes = compradores.reduce(
    (s, c) => s + (Number(c.porcentaje) || 0),
    0
  );

  if (Math.abs(sumaPorcentajes - 100) > 0.01) {
    return "La suma de porcentajes de los compradores debe ser igual al 100%";
  }

  let totalPermutas = 0;

  if (Array.isArray(permutas)) {
    for (const p of permutas) {
      if (Number(p.valor) < 0) {
        return "Los valores de permuta no pueden ser negativos";
      }

      totalPermutas += Number(p.valor) || 0;
    }

    if (totalPermutas >= vt) {
      return "El total de permutas no puede igualar o superar el valor total";
    }
  }

  const saldoFinanciado = Math.max(0, vt - ci - totalPermutas);

  if (saldoFinanciado > 0) {
    if (!nc || nc <= 0) {
      return "Debe indicar el número de cuotas regulares";
    }

    if (!fecha_primera_cuota || isNaN(Date.parse(fecha_primera_cuota))) {
      return "Debe indicar una fecha válida para la primera cuota regular";
    }
  }

  if (ci > 0) {
    if (!nci || nci <= 0) {
      return "Debe indicar el número de micro-cuotas de la cuota inicial";
    }

    const primeraFechaMicrocuota =
      fecha_primera_cuota_inicial ||
      (Array.isArray(microcuotas) && microcuotas[0]?.fecha);

    if (!primeraFechaMicrocuota || isNaN(Date.parse(primeraFechaMicrocuota))) {
      return "Debe indicar la fecha de la primera micro-cuota inicial";
    }

    if (Array.isArray(microcuotas) && microcuotas.length > 0) {
      const algunaConValor = microcuotas.some(mc => Number(mc.valor) > 0);

      if (algunaConValor) {
        const sumaMicrocuotas = microcuotas.reduce(
          (s, mc) => s + (Number(mc.valor) || 0),
          0
        );

        if (Math.abs(sumaMicrocuotas - ci) > 1) {
          return `Las micro-cuotas suman ${sumaMicrocuotas}, pero la cuota inicial es ${ci}`;
        }
      }
    }
  }

  return null;
}

const { generarPlanDePago, limpiarVentaCreada } = cuotasSvc;

async function crearVenta(req, res, estadoFijo) {
  const {
    id_lote,
    valor_total,
    cuota_inicial,
    estado,
    observaciones,
    compradores,
    id_comisionista,
    valor_comision,
    numero_cuotas_inicial,
    fecha_primera_cuota_inicial,
    numero_cuotas,
    fecha_primera_cuota,
    permutas,
    microcuotas,
    fecha_venta,
    escriturado,
    fecha_escritura
  } = req.body;

  const errValidacion = validarCamposVenta({
    id_lote,
    valor_total,
    cuota_inicial,
    valor_comision,
    numero_cuotas,
    numero_cuotas_inicial,
    fecha_primera_cuota,
    fecha_primera_cuota_inicial,
    compradores,
    permutas,
    microcuotas
  });

  if (errValidacion) {
    return res.status(422).json({ error: errValidacion });
  }

  // Verifica que el lote no tenga una venta activa o pendiente
  const { data: ventaExistente, error: eVentaExistente } = await supabase
    .schema(SCHEMA)
    .from("venta")
    .select("id_venta")
    .eq("id_lote", id_lote)
    .neq("estado", "cancelada")
    .limit(1)
    .maybeSingle();

  if (eVentaExistente) {
    return res.status(500).json({
      error: "Error al validar disponibilidad del lote: " + eVentaExistente.message
    });
  }

  if (ventaExistente) {
    return res.status(409).json({
      error: "El lote ya tiene una venta activa o pendiente de autorización"
    });
  }

  const totalPermutas = Array.isArray(permutas)
    ? permutas.reduce((s, p) => s + (Number(p.valor) || 0), 0)
    : 0;

  const detallePermutas = Array.isArray(permutas) && permutas.length > 0
    ? JSON.stringify(
        permutas
          .filter(p => Number(p.valor) > 0 || String(p.descripcion || "").trim())
          .map(p => ({
            descripcion: String(p.descripcion || "").trim(),
            valor: Number(p.valor) || 0
          }))
      )
    : null;

  const estadoVenta = estadoFijo || estado || "activa";

  const { data: venta, error: eventa } = await supabase
    .schema(SCHEMA)
    .from("venta")
    .insert([{
      id_lote:          Number(id_lote),
      valor_total:      Number(valor_total),
      cuota_inicial:    Number(cuota_inicial) || 0,
      estado:           estadoVenta,
      observaciones:    observaciones || null,
      total_permutas:   totalPermutas > 0 ? totalPermutas : null,
      detalle_permutas: detallePermutas,
      fecha_venta:      fecha_venta || null,
      escriturado:      escriturado === true || escriturado === "true" ? true : false,
      fecha_escritura:  (escriturado && fecha_escritura) ? fecha_escritura : null
    }])
    .select()
    .single();

  if (eventa) {
    return res.status(400).json({ error: eventa.message });
  }

  // Compradores
  if (Array.isArray(compradores) && compradores.length > 0) {
    const rows = compradores.map(c => ({
      id_venta:   venta.id_venta,
      id_usuario: Number(c.id_usuario),
      porcentaje: Number(c.porcentaje) || 100
    }));

    const { error: ec } = await supabase
      .schema(SCHEMA)
      .from("venta_comprador")
      .insert(rows);

    if (ec) {
      await limpiarVentaCreada(venta.id_venta);

      return res.status(400).json({
        error: "Error al asociar comprador(es): " + ec.message
      });
    }
  }

  // Comisionista
  if (id_comisionista) {
    const { error: eco } = await supabase
      .schema(SCHEMA)
      .from("venta_comisionista")
      .insert([{
        id_venta:      venta.id_venta,
        id_usuario:    Number(id_comisionista),
        valor_comision: Number(valor_comision) || 0
      }]);

    if (eco) {
      await limpiarVentaCreada(venta.id_venta);

      return res.status(400).json({
        error: "Error al asociar comisionista: " + eco.message
      });
    }
  }

  // Plan de pago
  let cuotasGeneradas = 0;

  try {
    cuotasGeneradas = await generarPlanDePago(venta.id_venta, {
      cuota_inicial,
      valor_total,
      numero_cuotas_inicial,
      fecha_primera_cuota_inicial,
      numero_cuotas,
      fecha_primera_cuota,
      microcuotas,
      totalPermutas
    });
  } catch (err) {
    await limpiarVentaCreada(venta.id_venta);

    return res.status(400).json({
      error: "Error al generar el plan de pago: " + err.message
    });
  }

  res.status(201).json({
    ...venta,
    cuotas_generadas: cuotasGeneradas
  });
}

exports.updateFinanciero = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "ID de venta inválido" });
  }

  const { valor_total, cuota_inicial, observaciones } = req.body;

  if (valor_total !== undefined && (isNaN(Number(valor_total)) || Number(valor_total) <= 0)) {
    return res.status(422).json({ error: "El valor total debe ser mayor a cero" });
  }

  if (cuota_inicial !== undefined && cuota_inicial !== null && Number(cuota_inicial) < 0) {
    return res.status(422).json({ error: "La cuota inicial no puede ser negativa" });
  }

  const { data: actual, error: eRead } = await supabase
    .schema(SCHEMA)
    .from("venta")
    .select("valor_total, cuota_inicial, observaciones")
    .eq("id_venta", id)
    .single();

  if (eRead || !actual) {
    return res.status(404).json({ error: "Venta no encontrada" });
  }

  const vtFinal = valor_total !== undefined
    ? Number(valor_total)
    : Number(actual.valor_total);

  const ciFinal = cuota_inicial !== undefined
    ? Number(cuota_inicial)
    : Number(actual.cuota_inicial);

  if (ciFinal > vtFinal) {
    return res.status(422).json({
      error: "La cuota inicial no puede superar el valor total"
    });
  }

  const updates = {};
  const auditRows = [];

  const CAMPOS = [
    ["valor_total",    valor_total,    actual.valor_total],
    ["cuota_inicial",  cuota_inicial,  actual.cuota_inicial],
    ["observaciones",  observaciones,  actual.observaciones],
  ];

  for (const [campo, nuevo, anterior] of CAMPOS) {
    if (nuevo === undefined) continue;

    const ant = anterior != null ? String(anterior) : null;
    const nvo = nuevo != null ? String(nuevo) : null;

    if (ant !== nvo) {
      updates[campo] = nuevo;

      auditRows.push({
        tabla_afectada: "venta",
        id_registro:    id,
        campo,
        valor_anterior: ant,
        valor_nuevo:    nvo,
        usuario_db:     req.usuario?.email || "sistema",
        motivo:         observaciones || null,
      });
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(200).json({ message: "Sin cambios" });
  }

  if (auditRows.length > 0) {
    const { error: eAudit } = await supabase
      .schema(SCHEMA)
      .from("auditoria")
      .insert(auditRows);

    if (eAudit) {
      return res.status(500).json({
        error: "Error al registrar auditoría: " + eAudit.message
      });
    }
  }

  const { data, error: eUpd } = await supabase
    .schema(SCHEMA)
    .from("venta")
    .update(updates)
    .eq("id_venta", id)
    .select()
    .single();

  if (eUpd) return res.status(400).json({ error: eUpd.message });

  res.json(data);
};

exports.create = (req, res) => crearVenta(req, res, null);

exports.createSolicitud = (req, res) => crearVenta(req, res, "pendiente_autorizacion");

exports.getEstadoFinanciero = async (req, res) => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from("venta")
      .select(`
        id_venta,
        fecha_venta,
        estado,
        valor_total,
        cuota_inicial,
        total_permutas,
        escriturado,
        fecha_escritura,
        lote:id_lote (
          codigo_lote,
          manzana,
          numero_lote,
          proyecto:id_proyecto (
            nombre
          )
        ),
        venta_comprador (
          porcentaje,
          usuario:id_usuario (
            nombres,
            apellidos,
            documento
          )
        ),
        cuota (
          id_cuota,
          numero_cuota,
          tipo,
          fecha_vencimiento,
          valor_cuota,
          estado,
          cuota_pago (
            valor_aplicado,
            pago:id_pago (
              id_pago,
              fecha_pago,
              estado
            )
          )
        )
      `)
      .order("id_venta", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const resultado = (data || []).map((venta) => {
      const cuotas = venta.cuota || [];
      const compradorPrincipal = venta.venta_comprador?.[0]?.usuario || null;

      const pagosAplicados = [];

      let totalPagado = 0;

      cuotas.forEach((cuota) => {
        const pagosCuota = cuota.cuota_pago || [];

        let pagadoEnCuota = 0;

        pagosCuota.forEach((cp) => {
          const estadoPago = cp.pago?.estado;

          const pagoValido =
            !estadoPago ||
            estadoPago === "aceptado" ||
            estadoPago === "pagado";

          if (!pagoValido) return;

          const valorAplicado = Number(cp.valor_aplicado) || 0;

          pagadoEnCuota += valorAplicado;

          pagosAplicados.push({
            valor: valorAplicado,
            fecha: cp.pago?.fecha_pago || cuota.fecha_vencimiento,
          });
        });

        if (pagadoEnCuota === 0 && ["pagada", "pagado"].includes(cuota.estado)) {
          pagadoEnCuota = Number(cuota.valor_cuota) || 0;

          pagosAplicados.push({
            valor: pagadoEnCuota,
            fecha: cuota.fecha_vencimiento,          });
        }

        totalPagado += pagadoEnCuota;
      });

      const valorTotal = Number(venta.valor_total) || 0;
      const porcentajePagado = valorTotal > 0
        ? Number(((totalPagado / valorTotal) * 100).toFixed(2))
        : 0;

      const pagosOrdenados = pagosAplicados
        .filter((p) => p.fecha)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      let acumulado = 0;
      let fechaCruce30 = null;

      for (const pago of pagosOrdenados) {
        acumulado += Number(pago.valor) || 0;

        if (valorTotal > 0 && acumulado >= valorTotal * 0.3) {
          fechaCruce30 = pago.fecha;
          break;
        }
      }

      const nombreComprador = compradorPrincipal
        ? `${compradorPrincipal.nombres || ""} ${compradorPrincipal.apellidos || ""}`.trim()
        : "—";

      return {
        id_venta: venta.id_venta,
        fecha_venta: venta.fecha_venta,
        estado: venta.estado,

        comprador: nombreComprador,
        documento_comprador: compradorPrincipal?.documento || "",

        proyecto: venta.lote?.proyecto?.nombre || "—",
        codigo_lote: venta.lote?.codigo_lote || "—",
        manzana: venta.lote?.manzana || "—",
        numero_lote: venta.lote?.numero_lote || "—",

        valor_total: valorTotal,
        cuota_inicial: Number(venta.cuota_inicial) || 0,
        total_permutas: Number(venta.total_permutas) || 0,
        total_pagado: totalPagado,
        porcentaje_pagado: porcentajePagado,

        escriturado: venta.escriturado === true,
        fecha_escritura: venta.fecha_escritura || null,

        fecha_cruce_30: fechaCruce30,
      };
    });

    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message || "Error al consultar estado financiero de ventas" });
  }
};


exports.getMisVentas = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  if (!id_usuario) return res.status(400).json({ error: "Sin usuario vinculado" });

  const { data, error } = await supabase.schema(SCHEMA)
    .from("venta_comprador")
    .select(`
      porcentaje,
      venta:id_venta (
        id_venta, valor_total, cuota_inicial, estado, fecha_venta,
        observaciones, total_permutas,
        lote:id_lote (
          codigo_lote, manzana, numero_lote,
          proyecto:id_proyecto (nombre)
        ),
        pago (
          id_pago, estado, id_cuota_propuesta, valor_pago
        ),
        cuota (
          id_cuota, numero_cuota, tipo,
          fecha_vencimiento, valor_cuota, estado,
          cuota_fraccion ( id_fraccion, numero_fraccion, valor_fraccion, fecha_propuesta ),
          cuota_pago (
            valor_aplicado,
            pago:id_pago ( estado, tipo_pago )
          ),
          cuota_factura (
            id_fraccion,
            factura:id_factura ( id_factura, estado )
          )
        )
      )
    `)
    .eq("id_usuario", id_usuario);

  if (error) return res.status(500).json({ error: error.message });

  const hoy = new Date();

  const result = (data || []).map(vc => {
    const v = vc.venta;
    if (!v) return null;

    const pagosRechazados = new Set(
      (v.pago || [])
        .filter(p => p.estado === 'rechazado' && p.id_cuota_propuesta)
        .map(p => p.id_cuota_propuesta)
    );

    const cuotas = (v.cuota || []).sort((a, b) => a.numero_cuota - b.numero_cuota);

   const totalPagadoRegular = cuotas.reduce((sum, c) => {
   const aplicadoAceptado = (c.cuota_pago || [])
    .filter(cp =>
      cp.pago?.estado === "aceptado" &&
      cp.pago?.tipo_pago !== "abono_extraordinario"
    )
    .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);

  return sum + aplicadoAceptado;
}, 0);

const totalAbonadoExtraordinario = cuotas.reduce((sum, c) => {
  const aplicadoExtraordinario = (c.cuota_pago || [])
    .filter(cp =>
      cp.pago?.estado === "aceptado" &&
      cp.pago?.tipo_pago === "abono_extraordinario"
    )
    .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);

  return sum + aplicadoExtraordinario;
}, 0);

const totalPagado = totalPagadoRegular + totalAbonadoExtraordinario;

const valorTotal          = Number(v.valor_total);
const saldoPendiente      = Math.max(0, valorTotal - totalPagado);
const saldoPendienteReal  = Math.max(0, valorTotal - totalPagado);
const porcentajePagado    = valorTotal > 0 ? Math.min(100, (totalPagado / valorTotal) * 100) : 0;

 

    const cuotaActual = cuotas.find(c => c.estado !== "pagada") || null;

    let diasCuotaActual = null;
    if (cuotaActual) {
      const venc = new Date(cuotaActual.fecha_vencimiento + "T12:00:00");
      diasCuotaActual = Math.floor((venc - hoy) / 86_400_000);
    }

return {
  id_venta:                     v.id_venta,
  estado:                       v.estado,
  fecha_venta:                  v.fecha_venta,
  valor_total:                  valorTotal,
  cuota_inicial:                v.cuota_inicial,
  total_permutas:               v.total_permutas,
  porcentaje_propiedad:         vc.porcentaje,
  lote:                         v.lote,
  total_cuotas:                 cuotas.length,
  cuotas_pagadas:               cuotas.filter(c => c.estado === "pagada").length,

  total_pagado:                 totalPagado,
  total_abonado_extraordinario: totalAbonadoExtraordinario,
  saldo_pendiente:              saldoPendiente,
  saldo_pendiente_real:         saldoPendienteReal,
  porcentaje_pagado:            Math.round(porcentajePagado * 10) / 10,
  escritura_disponible:         porcentajePagado >= 30,

  cuota_actual: cuotaActual ? {
    id_cuota:          cuotaActual.id_cuota,
    numero_cuota:      cuotaActual.numero_cuota,
    fecha_vencimiento: cuotaActual.fecha_vencimiento,
    valor_cuota:       cuotaActual.valor_cuota,
    dias_restantes:    diasCuotaActual,
  } : null,
      cuotas: cuotas.map(c => {
        const pagadoAceptado = (c.cuota_pago || [])
          .filter(cp => cp.pago?.estado === "aceptado")
          .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);
        const pagadoPendiente = (v.pago || [])
          .filter(p => p.estado === "pendiente_revision" && p.id_cuota_propuesta === c.id_cuota)
          .reduce((s, p) => s + Number(p.valor_pago || 0), 0);
        const dias = Math.floor((new Date(c.fecha_vencimiento + "T12:00:00") - hoy) / 86_400_000);

        const fracciones = (c.cuota_fraccion || []).sort((a, b) => a.numero_fraccion - b.numero_fraccion);
        let acumuladoFrac = 0;
        const fraccionesCompletadas = new Set();
        for (const f of fracciones) {
          acumuladoFrac += Number(f.valor_fraccion);
          if (pagadoAceptado >= acumuladoFrac) fraccionesCompletadas.add(f.id_fraccion);
        }
        const fraccionPendiente = fracciones.find(f => !fraccionesCompletadas.has(f.id_fraccion)) || null;

        const valorAMostrar = fraccionPendiente
          ? Number(fraccionPendiente.valor_fraccion)
          : Number(c.valor_cuota);

        const idxFracPendiente = fraccionPendiente ? fracciones.indexOf(fraccionPendiente) : -1;
        const acumuladoAntesFracActual = idxFracPendiente > 0
          ? fracciones.slice(0, idxFracPendiente).reduce((s, f) => s + Number(f.valor_fraccion), 0)
          : 0;
        const pagadoEnFracActual = Math.max(0, pagadoAceptado - acumuladoAntesFracActual);

        return {
          id_cuota:          c.id_cuota,
          numero_cuota:      c.numero_cuota,
          tipo:              c.tipo,
          fecha_vencimiento: fraccionPendiente?.fecha_propuesta || c.fecha_vencimiento,
          valor_cuota:       valorAMostrar,
          estado:            c.estado,
          valor_pagado:      fraccionPendiente ? pagadoEnFracActual : pagadoAceptado,
          valor_pendiente:   Math.max(0, valorAMostrar - (fraccionPendiente ? pagadoEnFracActual : pagadoAceptado)),
          valor_en_revision: pagadoPendiente,
          pago_rechazado:    pagosRechazados.has(c.id_cuota),
          dias_restantes:    dias,
          tiene_factura:     (c.cuota_factura || []).some(cf => cf.factura?.estado === "emitida"),
          tiene_fracciones:   fracciones.length > 0,
          fraccion_actual:    fraccionPendiente?.numero_fraccion ?? null,
          total_fracciones:   fracciones.length || null,
          valor_total_cuota:  fracciones.length > 0 ? Number(c.valor_cuota) : null,
          total_pagado_cuota: fracciones.length > 0 ? pagadoAceptado : null,
          fracciones_pagadas: fracciones
            .filter(f => fraccionesCompletadas.has(f.id_fraccion))
            .map(f => ({ numero_fraccion: f.numero_fraccion, valor_fraccion: Number(f.valor_fraccion), fecha_propuesta: f.fecha_propuesta || null })),
        };
      }),
    };
  }).filter(Boolean);

  res.json(result);
};
