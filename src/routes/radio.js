// src/routes/radio.js — Rádio/DJ por sala (stream + faixa atual)
const express = require('express');
const db      = require('../db');
const ws      = require('../websocket');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const canHost = role => ['dj', 'mod', 'supervisor', 'admin'].includes(role);
function bcast(room, event, data) { try { ws.broadcastToRoom(room, { event, data }); } catch (e) {} }

// GET /api/radio?room=slug
router.get('/', async (req, res) => {
  try {
    const { rows: [r] } = await db.query('SELECT * FROM radio_config WHERE room_slug = $1', [req.query.room || '']);
    res.json({ radio: r || { is_live: false, stream_url: '', title: '', dj_nick: '' } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// POST /api/radio  { room_slug, stream_url, title }  — coloca no ar
router.post('/', async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem transmitir.' });
  if (!canHost(req.user.role)) return res.status(403).json({ error: 'Apenas DJ/staff podem transmitir.' });
  const { room_slug } = req.body;
  const stream_url = (req.body.stream_url || '').slice(0, 500);
  const title = (req.body.title || '').slice(0, 200);
  if (!room_slug || !stream_url) return res.status(400).json({ error: 'Sala e URL do stream são obrigatórias.' });
  try {
    await db.query(`
      INSERT INTO radio_config (room_slug, is_live, stream_url, title, dj_nick, updated_at)
      VALUES ($1, TRUE, $2, $3, $4, NOW())
      ON CONFLICT (room_slug) DO UPDATE
        SET is_live = TRUE, stream_url = EXCLUDED.stream_url, title = EXCLUDED.title,
            dj_nick = EXCLUDED.dj_nick, updated_at = NOW()
    `, [room_slug, stream_url, title, req.user.nick]);
    bcast(room_slug, 'radio_update', { is_live: true, stream_url, title, dj_nick: req.user.nick });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao transmitir.' }); }
});

// POST /api/radio/stop  { room_slug }
router.post('/stop', async (req, res) => {
  if (!canHost(req.user.role)) return res.status(403).json({ error: 'Sem permissão.' });
  const { room_slug } = req.body;
  try {
    await db.query('UPDATE radio_config SET is_live = FALSE, updated_at = NOW() WHERE room_slug = $1', [room_slug]);
    bcast(room_slug, 'radio_stop', { room_slug });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao parar.' }); }
});

module.exports = router;
