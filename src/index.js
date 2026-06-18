require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

const { verificarToken }   = require('./middlewares/auth.middleware');
const { verificarPermiso } = require('./middlewares/permisos.middleware');


app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  const livereload        = require('livereload');
  const connectLivereload = require('connect-livereload');

  const lrServer = livereload.createServer();
  lrServer.watch(path.join(__dirname, '..', 'public'));

  app.use(connectLivereload());
}

// Redirect *.html to extensionless clean URLs (301 for SEO canonical)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.endsWith('.html')) {
    let clean = req.path.slice(0, -'.html'.length);
    if (clean === '/index') clean = '/';
    return res.redirect(301, clean + req.originalUrl.slice(req.path.length));
  }
  next();
});

// Public landing: the bare root shows the projects page. The authenticated app is served by
// the SPA wildcard at any other path (login redirects to /app after sign-in).
app.get('/', (req, res) => res.redirect('/proyectos'));

app.use(express.static(path.join(__dirname, "..", "public"), { extensions: ['html'] }));

// Servir favicon.ico sin requerir token â€” evita 401
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'src', 'img', 'favicon.svg'));
});

app.use('/api/v1/auth', require('./routes/auth.routes'));

// Public showcase endpoints — no token required (must stay before verificarToken below)
app.use('/api/v1/public', require('./routes/public.routes'));

app.get('/api/v1/firebase-config', (req, res) => {
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

app.use('/api/v1', verificarToken, verificarPermiso);

app.use('/api/v1/proyectos',      require('./routes/proyectos.routes'));
app.use('/api/v1/lotes',          require('./routes/lotes.routes'));
app.use('/api/v1/compradores',    require('./routes/compradores.routes'));
app.use('/api/v1/ventas',         require('./routes/ventas.routes'));
app.use('/api/v1/cuotas',         require('./routes/cuotas.routes'));
app.use('/api/v1/pagos',          require('./routes/pagos.routes'));
app.use('/api/v1/comisionistas',  require('./routes/comisionistas.routes'));
app.use('/api/v1/facturas',       require('./routes/facturas.routes'));
app.use('/api/v1/recibos',        require('./routes/recibos.routes'));
app.use('/api/v1/reportes',       require('./routes/reportes.routes'));
app.use('/api/v1/usuarios',       require('./routes/usuarios.routes'));
app.use('/api/v1/roles',          require('./routes/roles.routes'));
app.use('/api/v1/uploads',            require('./routes/uploads.routes'));
app.use('/api/v1/bank-transactions',  require('./routes/bank_transactions.routes'));
app.use('/api/v1/juridico',       require('./routes/juridico.routes'));
app.use('/api/v1/gastos',         require('./routes/gastos.routes'));
app.use('/api/v1/recepciones',    require('./routes/recepciones.routes'));

// â”€â”€ Protege ruta wildcard y sirve index.html para frontend con token vÃ¡lido â€”------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const { actualizarMora } = require('./services/mora.service');

app.listen(PORT, () => {
  console.log(`SGI corriendo en http://localhost:${PORT}`);
  actualizarMora().catch(err => console.error('[mora] startup error:', err.message));
});

// Run mora sync every 24 h
setInterval(
  () => actualizarMora().catch(err => console.error('[mora] interval error:', err.message)),
  24 * 60 * 60 * 1000
);

