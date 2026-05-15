const supabase = require("../config/supabase");
const SCHEMA   = "condor";

exports.getAll = async (req, res) => {
  const { estado, mes, proyecto, cliente } = req.query;

  let q = supabase.schema(SCHEMA).from("venta")
    .select(`*, lote(codigo_lote, manzana, numero_lote, proyecto(nombre)),
      venta_comprador(porcentaje, comprador(nombres, apellidos, documento)),
      venta_comisionista(valor_comision, comisionista(nombres, apellidos))`)
    .order("fecha_venta", { ascending: false });

  if (estado) q = q.eq("estado", estado);

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
        const full = `${vc.comprador?.nombres || ""} ${vc.comprador?.apellidos || ""} ${vc.comprador?.documento || ""}`
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
      venta_comprador(*, comprador(*)),
      venta_comisionista(*, comisionista(*)),
      cuota(*)`)
    .eq("id_venta", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });

  res.json(data);
};

// Suma N meses a una fecha en formato YYYY-MM-DD.
// Clampea el día al último del mes destino.
// Ejemplo: 31 enero + 1 mes = 28 febrero, no 3 marzo.
function sumarMeses(fechaStr, meses) {
  const d = new Date(fechaStr + "T12:00:00");

  if (isNaN(d.getTime())) {
    throw new Error(`Fecha inválida: "${fechaStr}"`);
  }

  const dia = d.getDate();

  d.setDate(1);
  d.setMonth(d.getMonth() + meses);

  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  d.setDate(Math.min(dia, ultimoDia));

  return d.toISOString().split("T")[0];
}

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
    if (!c.id_comprador || isNaN(Number(c.id_comprador)) || Number(c.id_comprador) <= 0) {
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

// Genera y persiste las cuotas del plan de pago para una venta
async function generarPlanDePago(idVenta, {
  cuota_inicial,
  valor_total,
  numero_cuotas_inicial,
  fecha_primera_cuota_inicial,
  numero_cuotas,
  fecha_primera_cuota,
  microcuotas,
  totalPermutas
}) {
  const filas = [];

  const ci  = Number(cuota_inicial) || 0;
  const nci = Math.max(1, parseInt(numero_cuotas_inicial, 10) || 1);
  const tp  = Number(totalPermutas) || 0;

  let offset = 0;

  // Micro-cuotas de la cuota inicial
  if (ci > 0) {
    const base = Math.floor(ci / nci);

    for (let i = 0; i < nci; i++) {
      const mc = Array.isArray(microcuotas) ? microcuotas[i] : null;

      const valor = Number(mc?.valor) > 0
        ? Number(mc.valor)
        : i === nci - 1
          ? ci - base * (nci - 1)
          : base;

      const fecha = mc?.fecha || sumarMeses(fecha_primera_cuota_inicial, i);

      filas.push({
        id_venta:          idVenta,
        numero_cuota:      i + 1,
        tipo:              "inicial",
        fecha_vencimiento: fecha,
        valor_cuota:       valor,
        estado:            "pendiente",
        es_extraordinaria: false
      });
    }

    offset = nci;
  }

  // Cuotas regulares. El saldo descuenta cuota inicial y permutas.
  const saldo = Math.max(0, Number(valor_total) - ci - tp);
  const nc = parseInt(numero_cuotas, 10) || 0;

  if (saldo > 0 && nc > 0) {
    const base = Math.floor(saldo / nc);

    for (let i = 0; i < nc; i++) {
      filas.push({
        id_venta:          idVenta,
        numero_cuota:      offset + i + 1,
        tipo:              "regular",
        fecha_vencimiento: sumarMeses(fecha_primera_cuota, i),
        valor_cuota:       i === nc - 1 ? saldo - base * (nc - 1) : base,
        estado:            "pendiente",
        es_extraordinaria: false
      });
    }
  }

  if (filas.length === 0) return 0;

  const { error } = await supabase
    .schema(SCHEMA)
    .from("cuota")
    .insert(filas);

  if (error) throw error;

  return filas.length;
}

async function limpiarVentaCreada(idVenta) {
  if (!idVenta) return;

  await supabase.schema(SCHEMA).from("cuota")
    .delete()
    .eq("id_venta", idVenta);

  await supabase.schema(SCHEMA).from("venta_comisionista")
    .delete()
    .eq("id_venta", idVenta);

  await supabase.schema(SCHEMA).from("venta_comprador")
    .delete()
    .eq("id_venta", idVenta);

  await supabase.schema(SCHEMA).from("venta")
    .delete()
    .eq("id_venta", idVenta);
}

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
      id_venta:     venta.id_venta,
      id_comprador: Number(c.id_comprador),
      porcentaje:   Number(c.porcentaje) || 100
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
        id_venta:         venta.id_venta,
        id_comisionista:  Number(id_comisionista),
        valor_comision:   Number(valor_comision) || 0
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
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("v_aux_ventas_estado_financiero")
    .select("*");

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
};


exports.getMisVentas = async (req, res) => {
  const id_comprador = req.usuario.id_comprador;
  if (!id_comprador) return res.status(400).json({ error: "Sin comprador vinculado a este usuario" });

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
        cuota (
          id_cuota, numero_cuota, tipo,
          fecha_vencimiento, valor_cuota, estado,
          cuota_pago (
            valor_aplicado,
            pago:id_pago ( estado )
          ),
          cuota_factura (
            factura:id_factura ( id_factura, estado )
          )
        )
      )
    `)
    .eq("id_comprador", id_comprador);

  if (error) return res.status(500).json({ error: error.message });

  const hoy = new Date();

  const result = (data || []).map(vc => {
    const v = vc.venta;
    if (!v) return null;

    const cuotas = (v.cuota || []).sort((a, b) => a.numero_cuota - b.numero_cuota);

    const totalPagado = cuotas.reduce((sum, c) => {
      const aplicadoAceptado = (c.cuota_pago || [])
        .filter(cp => cp.pago?.estado === "aceptado")
        .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);
      return sum + aplicadoAceptado;
    }, 0);

    const valorTotal      = Number(v.valor_total);
    const saldoPendiente  = Math.max(0, valorTotal - totalPagado);
    const porcentajePagado = valorTotal > 0 ? (totalPagado / valorTotal) * 100 : 0;

    const cuotaActual = cuotas.find(c => c.estado !== "pagada") || null;

    let diasCuotaActual = null;
    if (cuotaActual) {
      const venc = new Date(cuotaActual.fecha_vencimiento + "T12:00:00");
      diasCuotaActual = Math.floor((venc - hoy) / 86_400_000);
    }

    return {
      id_venta:            v.id_venta,
      estado:              v.estado,
      fecha_venta:         v.fecha_venta,
      valor_total:         valorTotal,
      cuota_inicial:       v.cuota_inicial,
      total_permutas:      v.total_permutas,
      porcentaje_propiedad: vc.porcentaje,
      lote:                v.lote,
      total_cuotas:        cuotas.length,
      cuotas_pagadas:      cuotas.filter(c => c.estado === "pagada").length,
      total_pagado:        totalPagado,
      saldo_pendiente:     saldoPendiente,
      porcentaje_pagado:   Math.round(porcentajePagado * 10) / 10,
      escritura_disponible: porcentajePagado >= 30,
      cuota_actual:        cuotaActual ? {
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
        const pagadoPendiente = (c.cuota_pago || [])
          .filter(cp => cp.pago?.estado === "pendiente_revision")
          .reduce((s, cp) => s + Number(cp.valor_aplicado), 0);
        const dias = Math.floor((new Date(c.fecha_vencimiento + "T12:00:00") - hoy) / 86_400_000);
        return {
          id_cuota:          c.id_cuota,
          numero_cuota:      c.numero_cuota,
          tipo:              c.tipo,
          fecha_vencimiento: c.fecha_vencimiento,
          valor_cuota:       Number(c.valor_cuota),
          estado:            c.estado,
          valor_pagado:      pagadoAceptado,
          valor_pendiente:   Math.max(0, Number(c.valor_cuota) - pagadoAceptado),
          valor_en_revision: pagadoPendiente,
          dias_restantes:    dias,
          tiene_factura:     (c.cuota_factura || []).some(cf => cf.factura?.estado === "emitida"),
        };
      }),
    };
  }).filter(Boolean);

  res.json(result);
};
