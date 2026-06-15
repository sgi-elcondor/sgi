const supabase  = require("../config/supabase");
const auditoria = require("../services/auditoria.service");
const SCHEMA    = "condor";

// §13: states are derived, never orphaned. A lote flagged 'vendido'/'entregado' but without an
// active venta (e.g. its sale was deleted) is effectively available, so we don't show it as sold.
function estadoMostrado(lote, idVenta) {
  const est = String(lote.estado || "").toLowerCase();
  if (!idVenta && (est === "vendido" || est === "entregado")) return "disponible";
  return lote.estado;
}

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("lote")
    .select("*, proyecto(nombre)").order("codigo_lote");
  if (error) return res.status(500).json({ error: error.message });

  // Attach the active (non-cancelled) venta id so the lotes view can link a sold lot to its sale.
  // Queried separately (like getDisponibles) to avoid the unreliable reverse embed.
  const { data: ventas } = await supabase.schema(SCHEMA)
    .from("venta").select("id_venta, id_lote, estado");
  const ventaPorLote = {};
  for (const v of (ventas || [])) {
    if (v.estado === "cancelada") continue;
    if (ventaPorLote[v.id_lote] == null) ventaPorLote[v.id_lote] = v.id_venta;
  }

  res.json((data || []).map(l => {
    const id_venta = ventaPorLote[l.id_lote] ?? null;
    return { ...l, id_venta, estado: estadoMostrado(l, id_venta) };
  }));
};

exports.getDisponibles = async (req, res) => {
  // Trae todas las ventas sin filtrar por enum para evitar validaciones del tipo
  const { data: todasVentas, error: ev } = await supabase.schema(SCHEMA)
    .from("venta").select("id_lote, estado");
  if (ev) return res.status(500).json({ error: ev.message });

  // Filter in JS: a lot is occupied if it has a non-cancelled/voided sale
  // Only "cancelada" returns the lot to the available inventory
  const estadosLibres = new Set(["cancelada"]);
  const idsOcupados = new Set(
    (todasVentas || []).filter(v => !estadosLibres.has(v.estado)).map(v => v.id_lote)
  );

  let q = supabase.schema(SCHEMA).from("lote")
    .select("*, proyecto(id_proyecto, nombre)")
    .order("manzana").order("numero_lote");

  if (idsOcupados.size > 0) {
    q = q.not("id_lote", "in", `(${[...idsOcupados].join(",")})`);
  }

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(l => ({
    id_lote:      l.id_lote,
    id_proyecto:  l.proyecto?.id_proyecto || l.id_proyecto,
    proyecto:     l.proyecto?.nombre || null,
    manzana:      l.manzana,
    numero_lote:  l.numero_lote,
    codigo_lote:  l.codigo_lote,
    area_m2:      l.area_m2,
    precio_lista: l.precio_base,
  })));
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("lote").select("*, proyecto(nombre)").eq("id_lote", req.params.id).single();
  if (error) return res.status(404).json({ error: error.message });

  // Attach the active venta (if any) so the edit modal knows whether the price must be changed
  // through the cuotas plan editor, and derive the displayed estado consistently with getAll.
  const { data: venta } = await supabase.schema(SCHEMA)
    .from("venta").select("id_venta").eq("id_lote", data.id_lote).neq("estado", "cancelada")
    .order("id_venta", { ascending: false }).limit(1).maybeSingle();
  const id_venta = venta?.id_venta ?? null;

  res.json({ ...data, id_venta, estado: estadoMostrado(data, id_venta) });
};

exports.create = async (req, res) => {
  const { id_proyecto, codigo_lote, area_m2, precio_base, descripcion, manzana, numero_lote, dimensiones } = req.body;
  const { data, error } = await supabase.schema(SCHEMA).from("lote").insert([{ id_proyecto, codigo_lote, area_m2, precio_base, descripcion, manzana, numero_lote, dimensiones }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

exports.update = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: "ID de lote inválido" });

  const { data: actual, error: eRead } = await supabase.schema(SCHEMA)
    .from("lote").select("precio_base").eq("id_lote", id).single();
  if (eRead || !actual) return res.status(404).json({ error: "Lote no encontrado" });

  const ALLOWED = ["id_proyecto", "codigo_lote", "area_m2", "precio_base", "descripcion", "manzana", "numero_lote", "dimensiones"];
  const campos = {};
  for (const k of ALLOWED) if (req.body[k] !== undefined) campos[k] = req.body[k];

  if (campos.id_proyecto !== undefined &&
      (isNaN(Number(campos.id_proyecto)) || Number(campos.id_proyecto) <= 0)) {
    return res.status(422).json({ error: "Debe seleccionar un proyecto válido" });
  }

  if (campos.precio_base !== undefined &&
      (isNaN(Number(campos.precio_base)) || Number(campos.precio_base) <= 0)) {
    return res.status(422).json({ error: "El precio debe ser mayor a cero" });
  }

  const nuevoPrecio  = campos.precio_base !== undefined ? Number(campos.precio_base) : null;
  const precioCambio = nuevoPrecio !== null && nuevoPrecio !== Number(actual.precio_base);

  // RN-17/§8.4: a sold lote's value can't change in isolation — it would leave the cuotas plan
  // descuadrado. The change must go through the venta's balanced plan editor (which also syncs
  // precio_base back to the lote). Reject here so the price can never desync the plan.
  if (precioCambio) {
    const { data: venta } = await supabase.schema(SCHEMA)
      .from("venta").select("id_venta")
      .eq("id_lote", id).neq("estado", "cancelada")
      .order("id_venta", { ascending: false }).limit(1).maybeSingle();
    if (venta) {
      return res.status(409).json({
        error: "Este lote está vendido. Cambia su valor desde el plan de cuotas de la venta para mantener el cuadre exacto del plan.",
        requiere_plan: true,
        id_venta: venta.id_venta,
      });
    }
  }

  const { data, error } = await supabase.schema(SCHEMA)
    .from("lote").update(campos).eq("id_lote", id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (precioCambio) {
    await auditoria.log({
      tabla:    "lote",
      id,
      campo:    "precio_base",
      anterior: actual.precio_base,
      nuevo:    nuevoPrecio,
      usuario:  req.usuario?.email || "sistema",
      motivo:   "edicion_lote",
    });
  }

  res.json(data);
};
