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
app.set('trust proxy', true);
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
app.use(express.static(path.join(__dirname, '..', 'public')));

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

// ── Fallback: serve index/login para rotas desconhecidas ──────
app.get('*', (req, res) => {
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
