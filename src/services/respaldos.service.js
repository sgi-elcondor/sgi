const supabase = require("../config/supabase");
const SCHEMA   = "condor";

const GITHUB_OWNER = "sgi-elcondor";
const GITHUB_REPO  = "sgi";

async function listar() {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("respaldo")
    .select("id_respaldo, fecha, tipo, alcance, tamano_bytes, estado, origen")
    .neq("estado", "purgado")
    .order("fecha", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function obtener(id) {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("respaldo")
    .select("id_respaldo, fecha, tipo, alcance, tamano_bytes, ubicacion, ubicacion_r2, estado, origen")
    .eq("id_respaldo", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function crearSolicitudRestauracion({ id_respaldo, alcance, id_usuario }) {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("respaldo_restauracion")
    .insert([{ id_respaldo, alcance, solicitado_por: id_usuario }])
    .select("id_restauracion, id_respaldo, alcance, estado, solicitado_en")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function obtenerRestauracion(id) {
  const { data, error } = await supabase.schema(SCHEMA)
    .from("respaldo_restauracion")
    .select("id_restauracion, id_respaldo, alcance, estado, solicitado_por, solicitado_en, finalizado_en, detalle")
    .eq("id_restauracion", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function marcarRestauracionFallida(id_restauracion, detalle) {
  const { error } = await supabase.schema(SCHEMA)
    .from("respaldo_restauracion")
    .update({ estado: "fallido", detalle, finalizado_en: new Date().toISOString() })
    .eq("id_restauracion", id_restauracion);
  if (error) throw new Error(error.message);
}

// Fires the restore.yml workflow via GitHub's REST API. The direct Postgres
// connection string used by pg_restore lives only as a GitHub Actions secret —
// this PAT can only ask GitHub to run the job, never touch the database itself.
async function dispararWorkflowRestore({ id_restauracion, id_respaldo, alcance, ubicacion, ubicacion_r2 }) {
  const token = process.env.GITHUB_PAT;
  if (!token) throw new Error("GITHUB_PAT no configurado en el servidor.");

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/restore.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          id_respaldo:      String(id_respaldo),
          alcance:          String(alcance),
          id_restauracion:  String(id_restauracion),
          ubicacion:        String(ubicacion || ""),
          ubicacion_r2:     String(ubicacion_r2 || ""),
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub workflow_dispatch falló (${res.status}): ${text}`);
  }
}

module.exports = {
  listar,
  obtener,
  crearSolicitudRestauracion,
  obtenerRestauracion,
  marcarRestauracionFallida,
  dispararWorkflowRestore,
};
