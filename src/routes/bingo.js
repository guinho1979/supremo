// src/routes/bingo.js — Bingo (servidor sorteia e valida)
const express = require('express');
const db      = require('../db');
const ws      = require('../websocket');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const ROOM = 'bingo';
const isStaff = role => ['mod', 'supervisor', 'admin'].includes(role);
function bcast(event, data) { try { ws.broadcastToRoom(ROOM, { event, data }); } catch (e) {} }
function genCard() {
  const set = new Set();
  while (set.size < 15) set.add(Math.floor(Math.random() * 75) + 1);
  return [...set].sort((a, b) => a - b);
}
async function currentGame() {
  const { rows: [g] } = await db.query(
    "SELECT * FROM bingo_games WHERE room_slug = $1 AND status = 'running' ORDER BY id DESC LIMIT 1", [ROOM]
  );
  return g || null;
}

// GET /api/bingo/state — jogo atual + minha cartela
router.get('/state', async (req, res) => {
  try {
    const g = await currentGame();
    let card = null;
    if (g && req.user.user_id) {
      const { rows: [c] } = await db.query('SELECT card FROM bingo_cards WHERE game_id = $1 AND user_id = $2', [g.id, req.user.user_id]);
      if (c) card = c.card;
    }
    res.json({ game: g ? { id: g.id, status: g.status, drawn: g.drawn_nums || [], host: g.host_nick, winner: g.winner_nick } : null, card });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// POST /api/bingo/start — operador (staff)
router.post('/start', async (req, res) => {
  if (!isStaff(req.user.role)) return res.status(403).json({ error: 'Apenas o operador (staff) pode iniciar.' });
  try {
    await db.query("UPDATE bingo_games SET status = 'finished', finished_at = NOW() WHERE room_slug = $1 AND status = 'running'", [ROOM]);
    const { rows: [g] } = await db.query(
      "INSERT INTO bingo_games (room_slug, host_nick, status) VALUES ($1, $2, 'running') RETURNING *", [ROOM, req.user.nick]
    );
    bcast('bingo_started', { id: g.id, host: g.host_nick });
    res.status(201).json({ game: { id: g.id, status: 'running', drawn: [] } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao iniciar.' }); }
});

// POST /api/bingo/card — pega/gera minha cartela do jogo atual
router.post('/card', async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não jogam (apenas assistem).' });
  try {
    const g = await currentGame();
    if (!g) return res.status(409).json({ error: 'Nenhum jogo em andamento.' });
    const { rows: [ex] } = await db.query('SELECT card FROM bingo_cards WHERE game_id = $1 AND user_id = $2', [g.id, req.user.user_id]);
    if (ex) return res.json({ card: ex.card });
    const card = genCard();
    await db.query('INSERT INTO bingo_cards (game_id, user_id, nick, card) VALUES ($1,$2,$3,$4)', [g.id, req.user.user_id, req.user.nick, card]);
    res.json({ card });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao gerar cartela.' }); }
});

// POST /api/bingo/draw — operador sorteia
router.post('/draw', async (req, res) => {
  if (!isStaff(req.user.role)) return res.status(403).json({ error: 'Apenas o operador pode sortear.' });
  try {
    const g = await currentGame();
    if (!g) return res.status(409).json({ error: 'Nenhum jogo em andamento.' });
    const drawn = g.drawn_nums || [];
    if (drawn.length >= 75) return res.status(400).json({ error: 'Todos os números já saíram.' });
    const rem = [];
    for (let i = 1; i <= 75; i++) if (!drawn.includes(i)) rem.push(i);
    const n = rem[Math.floor(Math.random() * rem.length)];
    await db.query('UPDATE bingo_games SET drawn_nums = array_append(drawn_nums, $1) WHERE id = $2', [n, g.id]);
    const all = drawn.concat(n);
    bcast('bingo_draw', { n, drawn: all });
    res.json({ n, drawn: all });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao sortear.' }); }
});

// POST /api/bingo/bingo — jogador canta bingo (servidor valida)
router.post('/bingo', async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não jogam.' });
  try {
    const g = await currentGame();
    if (!g) return res.status(409).json({ error: 'Nenhum jogo em andamento.' });
    const { rows: [c] } = await db.query('SELECT card FROM bingo_cards WHERE game_id = $1 AND user_id = $2', [g.id, req.user.user_id]);
    if (!c) return res.status(400).json({ error: 'Você não tem cartela neste jogo.' });
    const drawn = g.drawn_nums || [];
    const win = c.card.every(n => drawn.includes(n));
    if (!win) return res.status(400).json({ error: 'Ainda não! Nem todos os seus números saíram.' });
    await db.query("UPDATE bingo_games SET status = 'finished', winner_nick = $1, finished_at = NOW() WHERE id = $2", [req.user.nick, g.id]);
    await db.query('UPDATE bingo_cards SET has_bingo = TRUE WHERE game_id = $1 AND user_id = $2', [g.id, req.user.user_id]);
    bcast('bingo_winner', { winner: req.user.nick });
    res.json({ ok: true, winner: req.user.nick });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// POST /api/bingo/reset — operador
router.post('/reset', async (req, res) => {
  if (!isStaff(req.user.role)) return res.status(403).json({ error: 'Apenas o operador pode reiniciar.' });
  try {
    await db.query("UPDATE bingo_games SET status = 'finished', finished_at = NOW() WHERE room_slug = $1 AND status = 'running'", [ROOM]);
    bcast('bingo_reset', {});
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao reiniciar.' }); }
});

module.exports = router;
