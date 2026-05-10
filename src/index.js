require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

const { verificarToken }   = require('./middlewares/auth.middleware');
const { verificarPermiso } = require('./middlewares/permisos.middleware');

// ── Middlewares globales ─────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Servir favicon.ico sin requerir token — evita 401
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'src', 'img', 'favicon.svg'));
});

// ── Rutas de autenticación (sin verificarToken) ──────────
app.use('/api/auth', require('./routes/auth.routes'));

app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID,
    measurementId:     process.env.FIREBASE_MEASUREMENT_ID,
  });
});

// ── Todas las demás rutas requieren token y permisos ─────
app.use('/api', verificarToken, verificarPermiso);

app.use('/api/proyectos',      require('./routes/proyectos.routes'));
app.use('/api/lotes',          require('./routes/lotes.routes'));
app.use('/api/compradores',    require('./routes/compradores.routes'));
app.use('/api/ventas',         require('./routes/ventas.routes'));
app.use('/api/cuotas',         require('./routes/cuotas.routes'));
app.use('/api/pagos',          require('./routes/pagos.routes'));
app.use('/api/comisionistas',  require('./routes/comisionistas.routes'));
app.use('/api/facturas',       require('./routes/facturas.routes'));
app.use('/api/recibos',        require('./routes/recibos.routes'));
app.use('/api/reportes',       require('./routes/reportes.routes'));
app.use('/api/usuarios',       require('./routes/usuarios.routes'));

// ── Protege ruta wildcard y sirve index.html para frontend con token válido —------
app.use(verificarToken);
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SGI corriendo en http://localhost:${PORT}`);
});