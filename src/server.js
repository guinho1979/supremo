// src/server.js — Servidor principal TopChat
require('dotenv').config();
const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const path         = require('path');
const jwt          = require('jsonwebtoken');
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

// Lê o cabeçalho "Cookie" e popula req.cookies, sem precisar de
// nenhuma dependência externa (substitui o pacote cookie-parser).
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach((part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return;
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        req.cookies[key] = decodeURIComponent(val);
      } catch (e) {
        req.cookies[key] = val;
      }
    });
  }
  next();
});

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

// ── DIAGNÓSTICO TEMPORÁRIO — remover depois de resolver o bug ──
app.get('/debug-cookies', (req, res) => {
  let valido = false;
  let motivoErro = null;
  const token = req.cookies && req.cookies.tc_session;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      valido = true;
    } catch (e) {
      motivoErro = e.message;
    }
  }
  res.json({
    protocolo_visto_pelo_servidor: req.protocol,
    header_cookie_bruto: req.headers.cookie || '(nenhum cookie enviado)',
    cookies_parseados: req.cookies,
    tem_tc_session: !!token,
    jwt_valido: valido,
    motivo_erro_jwt: motivoErro,
    jwt_secret_definido: !!process.env.JWT_SECRET,
    node_env: process.env.NODE_ENV || '(não definido)'
  });
});

// ── Fallback: decide qual página servir para rotas desconhecidas ──
// Se existe cookie de sessão com JWT válido, manda para a última página
// que o usuário visitou (guardada em tc_last_page pelo front-end), ou
// para salas.html se não houver nenhuma registrada. Sem cookie válido,
// manda para o login. Isso resolve o F5 quando a URL está escondida via
// history.pushState/replaceState no front-end: o navegador recarrega "/"
// e o servidor precisa decidir sozinho, sem depender do localStorage
// (que ele não vê).
const ALLOWED_PAGES = [
  'salas.html', 'chat.html', 'chatprivado.html', 'recados.html',
  'perfil.html', 'status.html', 'salas-privadas.html', 'bingo.html',
  'nickcor.html', 'admin.html', 'ulogin.html'
];
app.get('*', (req, res) => {
  let loggedIn = false;
  const cookieToken = req.cookies && req.cookies.tc_session;
  if (cookieToken) {
    try {
      jwt.verify(cookieToken, process.env.JWT_SECRET);
      loggedIn = true;
    } catch (e) {
      // cookie expirado ou inválido — trata como deslogado
    }
  }

  if (!loggedIn) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
  }

  // Só aceita o cookie de última página se estiver na lista permitida —
  // evita servir um arquivo arbitrário caso o cookie seja adulterado.
  const lastPage = req.cookies && req.cookies.tc_last_page;
  const page = ALLOWED_PAGES.includes(lastPage) ? lastPage : 'salas.html';
  res.sendFile(path.join(__dirname, '..', 'public', page));
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
