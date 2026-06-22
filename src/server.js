// src/server.js — Servidor principal TopChat
require('dotenv').config();
const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const path         = require('path');
const rateLimit    = require('express-rate-limit');
const setupWebSocket = require('./websocket');

const authRoutes  = require('./routes/auth');
const chatRoutes  = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const privateRoomsRoutes = require('./routes/private-rooms');
const interactiveRoutes  = require('./routes/interactive');
const radioRoutes        = require('./routes/radio');
const bingoRoutes        = require('./routes/bingo');

const app    = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// ── Body Parser ───────────────────────────────────────────────
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});

app.use('/api/', limiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Servir arquivos estáticos do frontend ─────────────────────
// Coloque seus arquivos HTML na pasta 'public'
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    // HTML e JS sempre revalidados — evita o navegador mostrar versão antiga (cache)
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// ── Rotas da API ──────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api',       chatRoutes);
app.use('/api/private-rooms', privateRoomsRoutes);
app.use('/api', interactiveRoutes);
app.use('/api/radio', radioRoutes);
app.use('/api/bingo', bingoRoutes);
app.use('/api/admin', adminRoutes);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Fallback: serve a última página visitada (cookie) ou login ──
app.get('*', (req, res) => {
  try {
    const cookieHeader = req.headers.cookie || '';
    const m = cookieHeader.match(/(?:^|;\s*)tc_last_page=([^;]+)/);
    const last = m ? decodeURIComponent(m[1]) : '';
    // Só aceita páginas válidas (.html sem traversal)
    if (last && /^[a-zA-Z0-9_-]+\.html$/.test(last)) {
      const filePath = path.join(__dirname, '..', 'public', last);
      return res.sendFile(filePath, (err) => {
        if (err) res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
      });
    }
  } catch (e) {}
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// ── WebSocket ─────────────────────────────────────────────────
setupWebSocket(server);

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 TopChat rodando na porta ${PORT}`);
  console.log(`   REST API: http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`   Frontend: http://localhost:${PORT}\n`);
});
