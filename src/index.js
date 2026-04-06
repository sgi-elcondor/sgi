require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Rutas API ────────────────────────────────────────────────
app.use("/api/proyectos",    require("./routes/proyectos.routes"));
app.use("/api/lotes",        require("./routes/lotes.routes"));
app.use("/api/compradores",  require("./routes/compradores.routes"));
app.use("/api/ventas",       require("./routes/ventas.routes"));
app.use("/api/cuotas",       require("./routes/cuotas.routes"));
app.use("/api/pagos",        require("./routes/pagos.routes"));
app.use("/api/comisionistas",require("./routes/comisionistas.routes"));
app.use("/api/facturas",     require("./routes/facturas.routes"));
app.use("/api/recibos",      require("./routes/recibos.routes"));
app.use("/api/reportes",     require("./routes/reportes.routes"));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SGI corriendo en http://localhost:${PORT}`);
});

exports.getPanelDiario = async (req, res) => {
  const { data, error } = await supabase.schema(SCHEMA).from("v_aux_panel_operaciones_diarias").select("*").single();
  console.log("ERROR:", error);  // agrega esta línea
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};      
