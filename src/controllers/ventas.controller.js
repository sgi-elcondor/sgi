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
    const ultimo = new Date(anio, m, 0).getDate(); // último día del mes
    q = q.gte("fecha_venta", `${mes}-01`).lte("fecha_venta", `${mes}-${String(ultimo).padStart(2,"0")}`);
  }

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  let result = data;

  // proyecto and cliente filtered in-memory (joined nested columns)
  if (proyecto) {
    const pn = proyecto.toLowerCase();
    result = result.filter(v => (v.lote?.proyecto?.nombre || "").toLowerCase().includes(pn));
  }
  if (cliente) {
    const cn = cliente.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    result = result.filter(v =>
      (v.venta_comprador || []).some(vc => {
        const full = `${vc.comprador?.nombres || ""} ${vc.comprador?.apellidos || ""} ${vc.comprador?.documento || ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        return full.includes(cn);
      })
    );
  }

  res.json(result);
};

exports.getById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: "ID de venta inválido" });
  const { data, error } = await supabase.schema(SCHEMA).from("venta")
    .select(`*, lote(*, proyecto(nombre)),
      venta_comprador(*, comprador(*)),
      venta_comisionista(*, comisionista(*)),
      cuota(*)`)
    .eq("id_venta", id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
};

// Suma N meses a una fecha en formato YYYY-MM-DD
// Clampea el día al último del mes destino (ej. 31 ene + 1 mes = 28 feb, no 3 mar)
function sumarMeses(fechaStr, meses) {
  const d = new Date(fechaStr + "T12:00:00");
  if (isNaN(d.getTime())) throw new Error(`Fecha inválida: "${fechaStr}"`);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  return d.toISOString().split("T")[0];
}

// Validaciones de negocio antes de crear la venta
function validarCamposVenta({ id_lote, valor_total, cuota_inicial, valor_comision, numero_cuotas, numero_cuotas_inicial, permutas }) {
  const vt  = Number(valor_total);
  const ci  = Number(cuota_inicial)  || 0;
  const vc  = Number(valor_comision) || 0;
  const nc  = parseInt(numero_cuotas)          || 0;
  const nci = parseInt(numero_cuotas_inicial)  || 0;
  if (!id_lote || isNaN(Number(id_lote)) || Number(id_lote) <= 0)
    return "id_lote inválido";
  if (!vt || vt <= 0)
    return "El valor total debe ser mayor a cero";
  if (ci < 0)
    return "La cuota inicial no puede ser negativa";
  if (ci > vt)
    return "La cuota inicial no puede superar el valor total";
  if (vc < 0)
    return "El valor de comisión no puede ser negativo";
  if (nc < 0 || nci < 0)
    return "El número de cuotas no puede ser negativo";
  if (Array.isArray(permutas)) {
    for (const p of permutas) {
      if (Number(p.valor) < 0) return "Los valores de permuta no pueden ser negativos";
    }
    const totalPerm = permutas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    if (totalPerm >= vt) return "El total de permutas no puede igualar o superar el valor total";
  }
  return null;
}

// Genera y persiste las cuotas del plan de pago para una venta
async function generarPlanDePago(idVenta, {
  cuota_inicial, valor_total,
  numero_cuotas_inicial, fecha_primera_cuota_inicial,
  numero_cuotas, fecha_primera_cuota,
  microcuotas,   // optional: [{valor, fecha}] con montos y fechas individuales
  totalPermutas  // optional: sum of permutas to deduct from saldo financiado
}) {
  const filas = [];
  const ci  = Number(cuota_inicial) || 0;
  const nci = Math.max(1, parseInt(numero_cuotas_inicial) || 1);
  const tp  = Number(totalPermutas) || 0;
  let offset = 0;

  // Micro-cuotas de la cuota inicial (tipo 'inicial')
  if (ci > 0) {
    const base = Math.floor(ci / nci);
    for (let i = 0; i < nci; i++) {
      const mc    = Array.isArray(microcuotas) ? microcuotas[i] : null;
      const valor = mc?.valor > 0 ? mc.valor : (i === nci - 1 ? ci - base * (nci - 1) : base);
      const fecha = mc?.fecha   || sumarMeses(fecha_primera_cuota_inicial, i);
      filas.push({
        id_venta:          idVenta,
        numero_cuota:      i + 1,
        tipo:              "inicial",
        fecha_vencimiento: fecha,
        valor_cuota:       valor,
        es_extraordinaria: false
      });
    }
    offset = nci;
  }

  // Cuotas regulares (tipo 'regular') — saldo descuenta permutas
  const saldo = Math.max(0, Number(valor_total) - ci - tp);
  const nc = parseInt(numero_cuotas) || 0;
  if (saldo > 0 && nc > 0) {
    const base = Math.floor(saldo / nc);
    for (let i = 0; i < nc; i++) {
      filas.push({
        id_venta:          idVenta,
        numero_cuota:      offset + i + 1,
        tipo:              "regular",
        fecha_vencimiento: sumarMeses(fecha_primera_cuota, i),
        valor_cuota:       i === nc - 1 ? saldo - base * (nc - 1) : base,
        es_extraordinaria: false
      });
    }
  }

  if (filas.length === 0) return;
  const { error } = await supabase.schema(SCHEMA).from("cuota").insert(filas);
  if (error) throw error;
}

async function crearVenta(req, res, estadoFijo) {
  const {
    id_lote, valor_total, cuota_inicial, estado, observaciones,
    compradores, id_comisionista, valor_comision,
    numero_cuotas_inicial, fecha_primera_cuota_inicial,
    numero_cuotas, fecha_primera_cuota,
    permutas, microcuotas
  } = req.body;

  // ── Validaciones de negocio ──
  const errValidacion = validarCamposVenta({
    id_lote, valor_total, cuota_inicial, valor_comision,
    numero_cuotas, numero_cuotas_inicial, permutas
  });
  if (errValidacion) return res.status(422).json({ error: errValidacion });

  // ── Verificar que el lote esté disponible (previene doble venta y race conditions) ──
  const { data: ventaExistente } = await supabase.schema(SCHEMA).from("venta")
    .select("id_venta").eq("id_lote", id_lote).neq("estado", "cancelada")
    .limit(1).maybeSingle();
  if (ventaExistente)
    return res.status(409).json({ error: "El lote ya tiene una venta activa o pendiente de autorización" });

  const totalPermutas = Array.isArray(permutas)
    ? permutas.reduce((s, p) => s + (Number(p.valor) || 0), 0)
    : 0;

  const estadoVenta = estadoFijo || estado || "activa";
  const detallePermutas = Array.isArray(permutas) && permutas.length > 0
    ? JSON.stringify(permutas.map(p => ({ descripcion: String(p.descripcion || "").trim(), valor: Number(p.valor) || 0 })))
    : null;

  const { data: venta, error: eventa } = await supabase.schema(SCHEMA).from("venta")
    .insert([{
      id_lote, valor_total, cuota_inicial, estado: estadoVenta, observaciones,
      total_permutas: totalPermutas > 0 ? totalPermutas : null,
      detalle_permutas: detallePermutas
    }]).select().single();
  if (eventa) return res.status(400).json({ error: eventa.message });

  // Compradores
  if (compradores?.length > 0) {
    const rows = compradores.map(c => ({ id_venta: venta.id_venta, id_comprador: c.id_comprador, porcentaje: c.porcentaje }));
    const { error: ec } = await supabase.schema(SCHEMA).from("venta_comprador").insert(rows);
    if (ec) {
      await supabase.schema(SCHEMA).from("venta").delete().eq("id_venta", venta.id_venta);
      return res.status(400).json({ error: ec.message });
    }
  }

  // Comisionista
  if (id_comisionista) {
    const { error: eco } = await supabase.schema(SCHEMA).from("venta_comisionista")
      .insert([{ id_venta: venta.id_venta, id_comisionista, valor_comision: Number(valor_comision) || 0 }]);
    if (eco) {
      await supabase.schema(SCHEMA).from("venta").delete().eq("id_venta", venta.id_venta);
      return res.status(400).json({ error: eco.message });
    }
  }

  // Plan de pago
  try {
    await generarPlanDePago(venta.id_venta, {
      cuota_inicial, valor_total,
      numero_cuotas_inicial, fecha_primera_cuota_inicial,
      numero_cuotas, fecha_primera_cuota,
      microcuotas, totalPermutas
    });
  } catch (err) {
    await supabase.schema(SCHEMA).from("venta").delete().eq("id_venta", venta.id_venta);
    return res.status(400).json({ error: "Error al generar el plan de pago: " + err.message });
  }

  res.status(201).json(venta);
}

exports.create = (req, res) => crearVenta(req, res, null);

exports.createSolicitud = (req, res) => crearVenta(req, res, "pendiente_autorizacion");

exports.getEstadoFinanciero = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("v_aux_ventas_estado_financiero").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};
