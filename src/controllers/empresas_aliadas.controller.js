const supabase    = require("../config/supabase");
const auditoria   = require("../services/auditoria.service");
const empresasSvc = require("../services/empresas.service");

const SCHEMA = "condor";
const TIPOS  = ["proveedor", "socio", "contratista", "otro"];

function _validarCampos(body, { partial = false } = {}) {
  const out = {};

  if (!partial || body.razon_social !== undefined) {
    const razon = String(body.razon_social || "").trim();
    if (razon.length < 3) return { error: "La razón social es obligatoria (mínimo 3 caracteres)." };
    out.razon_social = razon;
  }

  if (!partial || body.nit !== undefined) {
    const nit = empresasSvc.validarNit(body.nit);
    if (nit.error) return { error: nit.error };
    out.nit = nit.value;
  }

  if (!partial || body.rup !== undefined) {
    const rup = empresasSvc.validarRup(body.rup);
    if (rup.error) return { error: rup.error };
    out.rup = rup.value;
  }

  if (!partial || body.codigos_actividad !== undefined) {
    const codigos = empresasSvc.validarCodigosActividad(body.codigos_actividad);
    if (codigos.error) return { error: codigos.error };
    out.codigos_actividad = codigos.value;
  }

  if (body.tipo !== undefined || !partial) {
    const tipo = String(body.tipo || "proveedor").trim();
    if (!TIPOS.includes(tipo)) return { error: `Tipo inválido. Opciones: ${TIPOS.join(", ")}` };
    out.tipo = tipo;
  }

  if (body.contacto_email !== undefined && String(body.contacto_email || "").trim()) {
    const email = String(body.contacto_email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email de contacto no es válido." };
    out.contacto_email = email;
  } else if (body.contacto_email !== undefined) {
    out.contacto_email = null;
  }

  for (const campo of ["contacto_nombre", "contacto_telefono", "direccion", "ciudad", "notas"]) {
    if (body[campo] !== undefined) out[campo] = String(body[campo] || "").trim() || null;
  }

  if (body.activo !== undefined) out.activo = !!body.activo;

  return { value: out };
}

// GET /api/v1/empresas-aliadas?q=&tipo=&activas=1
exports.getAll = async (req, res) => {
  try {
    let query = supabase.schema(SCHEMA)
      .from("empresa_aliada")
      .select("*")
      .order("razon_social", { ascending: true });

    if (req.query.activas) query = query.eq("activo", true);
    if (req.query.tipo && TIPOS.includes(req.query.tipo)) query = query.eq("tipo", req.query.tipo);
    if (req.query.q) {
      const q = String(req.query.q).trim();
      query = query.or(`razon_social.ilike.%${q}%,nit.ilike.%${q}%,rup.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/empresas-aliadas/:id — detalle + historial comercial (ALI-02)
exports.getById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de empresa inválido" });

    const { data: empresa, error } = await supabase.schema(SCHEMA)
      .from("empresa_aliada")
      .select("*, creador:creado_por (nombres, apellidos)")
      .eq("id_empresa", id)
      .single();

    if (error || !empresa) return res.status(404).json({ error: "Empresa no encontrada" });

    const [{ data: gastos }, { data: requerimientos }] = await Promise.all([
      supabase.schema(SCHEMA).from("gasto")
        .select("id_gasto, fecha, descripcion, valor, categoria, comprobante_url, proyecto:id_proyecto (nombre)")
        .eq("id_empresa", id)
        .order("fecha", { ascending: false }),
      supabase.schema(SCHEMA).from("requerimiento")
        .select("id_requerimiento, numero, descripcion, estado, valor_desembolsado, fecha_desembolso")
        .eq("id_empresa", id)
        .order("fecha_desembolso", { ascending: false }),
    ]);

    const totalGastos = (gastos || []).reduce((s, g) => s + Number(g.valor || 0), 0);

    return res.json({
      ...empresa,
      creador: empresa.creador
        ? `${empresa.creador.nombres || ""} ${empresa.creador.apellidos || ""}`.trim()
        : null,
      historial: {
        gastos:         (gastos || []).map(g => ({ ...g, proyecto: g.proyecto?.nombre || null })),
        requerimientos: requerimientos || [],
        total_gastos:   totalGastos,
        operaciones:    (gastos || []).length + (requerimientos || []).length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/v1/empresas-aliadas
exports.create = async (req, res) => {
  try {
    const val = _validarCampos(req.body);
    if (val.error) return res.status(422).json({ error: val.error });

    const { data, error } = await supabase.schema(SCHEMA)
      .from("empresa_aliada")
      .insert([{ ...val.value, creado_por: req.usuario.id_usuario }])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: `Ya existe una empresa registrada con el NIT ${val.value.nit}.` });
      }
      return res.status(400).json({ error: error.message });
    }

    await auditoria.log({
      tabla:   "empresa_aliada",
      id:      data.id_empresa,
      campo:   "creacion",
      nuevo:   JSON.stringify({ razon_social: data.razon_social, nit: data.nit, rup: data.rup }),
      usuario: req.usuario.email,
      motivo:  "registro_empresa_aliada",
    });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PUT /api/v1/empresas-aliadas/:id
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID de empresa inválido" });

    const { data: actual } = await supabase.schema(SCHEMA)
      .from("empresa_aliada").select("*").eq("id_empresa", id).single();
    if (!actual) return res.status(404).json({ error: "Empresa no encontrada" });

    const val = _validarCampos(req.body, { partial: true });
    if (val.error) return res.status(422).json({ error: val.error });
    if (!Object.keys(val.value).length) return res.json(actual);

    const { data, error } = await supabase.schema(SCHEMA)
      .from("empresa_aliada")
      .update(val.value)
      .eq("id_empresa", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: `Ya existe otra empresa registrada con el NIT ${val.value.nit}.` });
      }
      return res.status(400).json({ error: error.message });
    }

    const auditRows = Object.entries(val.value)
      .filter(([campo, nuevo]) => String(actual[campo] ?? "") !== String(nuevo ?? ""))
      .map(([campo, nuevo]) => ({
        tabla_afectada: "empresa_aliada",
        id_registro:    id,
        campo,
        valor_anterior: actual[campo] != null ? String(actual[campo]) : null,
        valor_nuevo:    nuevo != null ? String(nuevo) : null,
        usuario_db:     req.usuario.email,
        motivo:         "edicion_empresa_aliada",
      }));
    if (auditRows.length) {
      await supabase.schema(SCHEMA).from("auditoria").insert(auditRows);
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
