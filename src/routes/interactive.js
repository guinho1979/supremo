// src/routes/interactive.js — Enquetes (polls) e Quizzes
const express = require('express');
const db      = require('../db');
const ws      = require('../websocket');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const isStaff = role => ['mod', 'supervisor', 'admin'].includes(role);
const canHost = role => ['dj', 'mod', 'supervisor', 'admin'].includes(role); // quem pode criar
function bcast(room, event, data) { try { ws.broadcastAll({ event, data }); } catch (e) {} }

// ════════════════ ENQUETES ════════════════

// POST /api/polls  { room_slug, question, options[] }
router.post('/polls', async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem criar enquetes.' });
  if (!canHost(req.user.role)) return res.status(403).json({ error: 'Sem permissão para criar enquetes.' });
  const room_slug = req.body.room_slug || 'global';
  const { question } = req.body;
  let options = req.body.options;
  if (!question || !Array.isArray(options) || options.length < 2)
    return res.status(400).json({ error: 'Pergunta e pelo menos 2 opções são obrigatórias.' });
  options = options.map(o => String(o).slice(0, 100)).filter(Boolean).slice(0, 8);
  try {
    await db.query("UPDATE polls SET is_active = FALSE, closed_at = NOW() WHERE is_active = TRUE");
    const { rows: [p] } = await db.query(
      "INSERT INTO polls (room_slug, question, options, created_by) VALUES ($1,$2,$3,$4) RETURNING *",
      [room_slug, question.slice(0, 200), JSON.stringify(options), req.user.nick]
    );
    bcast(room_slug, 'poll_created', { id: p.id, question: p.question, options });
    res.status(201).json({ poll: p });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar enquete.' }); }
});

// GET /api/polls/active?room=slug
router.get('/polls/active', async (req, res) => {
  try {
    const { rows: [p] } = await db.query(
      "SELECT * FROM polls WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
    );
    if (!p) return res.json({ poll: null });
    const counts = await pollCounts(p.id, p.options.length);
    let myVote = null;
    if (req.user.user_id) {
      const { rows: [v] } = await db.query("SELECT option_index FROM poll_votes WHERE poll_id=$1 AND user_id=$2", [p.id, req.user.user_id]);
      if (v) myVote = v.option_index;
    }
    res.json({ poll: { id: p.id, question: p.question, options: p.options, created_by: p.created_by }, counts, my_vote: myVote });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// POST /api/polls/:id/vote  { option_index }
router.post('/polls/:id/vote', async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem votar.' });
  try {
    const { rows: [p] } = await db.query("SELECT * FROM polls WHERE id=$1 AND is_active=TRUE", [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Enquete encerrada ou inexistente.' });
    const idx = parseInt(req.body.option_index);
    if (isNaN(idx) || idx < 0 || idx >= p.options.length) return res.status(400).json({ error: 'Opção inválida.' });
    await db.query(
      "INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES ($1,$2,$3) ON CONFLICT (poll_id, user_id) DO UPDATE SET option_index = EXCLUDED.option_index",
      [p.id, req.user.user_id, idx]
    );
    const counts = await pollCounts(p.id, p.options.length);
    bcast(p.room_slug, 'poll_update', { id: p.id, counts });
    res.json({ counts, my_vote: idx });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao votar.' }); }
});

// POST /api/polls/:id/close
router.post('/polls/:id/close', async (req, res) => {
  try {
    const { rows: [p] } = await db.query("SELECT * FROM polls WHERE id=$1", [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Enquete não encontrada.' });
    if (p.created_by !== req.user.nick && !isStaff(req.user.role)) return res.status(403).json({ error: 'Sem permissão.' });
    await db.query("UPDATE polls SET is_active=FALSE, closed_at=NOW() WHERE id=$1", [p.id]);
    const counts = await pollCounts(p.id, p.options.length);
    bcast(p.room_slug, 'poll_closed', { id: p.id, counts });
    res.json({ ok: true, counts });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao encerrar.' }); }
});

// POST /api/polls/close — encerra a enquete ativa (painel admin, sem id)
router.post('/polls/close', async (req, res) => {
  if (!isStaff(req.user.role)) return res.status(403).json({ error: 'Sem permissão.' });
  try {
    const { rows: [p] } = await db.query("SELECT * FROM polls WHERE is_active=TRUE ORDER BY id DESC LIMIT 1");
    if (p) {
      await db.query("UPDATE polls SET is_active=FALSE, closed_at=NOW() WHERE id=$1", [p.id]);
      const counts = await pollCounts(p.id, p.options.length);
      bcast(p.room_slug, 'poll_closed', { id: p.id, counts });
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao encerrar.' }); }
});

// DELETE /api/polls — zera todas as enquetes (painel admin)
router.delete('/polls', async (req, res) => {
  if (!isStaff(req.user.role)) return res.status(403).json({ error: 'Sem permissão.' });
  try {
    const { rows: [p] } = await db.query("SELECT * FROM polls WHERE is_active=TRUE ORDER BY id DESC LIMIT 1");
    if (p) { const counts = await pollCounts(p.id, p.options.length); bcast(p.room_slug, 'poll_closed', { id: p.id, counts }); }
    await db.query("DELETE FROM polls");
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao zerar.' }); }
});

async function pollCounts(pollId, n) {
  const { rows } = await db.query("SELECT option_index, COUNT(*)::int AS c FROM poll_votes WHERE poll_id=$1 GROUP BY option_index", [pollId]);
  const counts = new Array(n).fill(0);
  rows.forEach(r => { if (r.option_index >= 0 && r.option_index < n) counts[r.option_index] = r.c; });
  return counts;
}

// ════════════════ QUIZZES ════════════════

// POST /api/quizzes  { room_slug, question, options[], correct_index }
router.post('/quizzes', async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem criar quizzes.' });
  if (!canHost(req.user.role)) return res.status(403).json({ error: 'Sem permissão para criar quizzes.' });
  const room_slug = req.body.room_slug || 'global';
  const { question, correct_index } = req.body;
  let options = req.body.options;
  if (!question || !Array.isArray(options) || options.length < 2)
    return res.status(400).json({ error: 'Pergunta e pelo menos 2 opções são obrigatórias.' });
  const ci = parseInt(correct_index);
  if (isNaN(ci) || ci < 0 || ci >= options.length) return res.status(400).json({ error: 'Resposta correta inválida.' });
  options = options.map(o => String(o).slice(0, 100)).filter(Boolean).slice(0, 8);
  try {
    await db.query("UPDATE quizzes SET is_active=FALSE, closed_at=NOW() WHERE is_active=TRUE");
    const { rows: [q] } = await db.query(
      "INSERT INTO quizzes (room_slug, question, options, correct_index, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [room_slug, question.slice(0, 200), JSON.stringify(options), ci, req.user.nick]
    );
    // Não revela a resposta correta no broadcast de criação
    bcast(room_slug, 'quiz_created', { id: q.id, question: q.question, options });
    res.status(201).json({ quiz: { id: q.id } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar quiz.' }); }
});

// GET /api/quizzes/active?room=slug  (esconde a resposta correta enquanto aberto)
router.get('/quizzes/active', async (req, res) => {
  try {
    const { rows: [q] } = await db.query(
      "SELECT * FROM quizzes WHERE is_active=TRUE ORDER BY id DESC LIMIT 1"
    );
    if (!q) return res.json({ quiz: null });
    let answered = false, myAnswer = null;
    if (req.user.user_id) {
      const { rows: [a] } = await db.query("SELECT option_index FROM quiz_answers WHERE quiz_id=$1 AND user_id=$2", [q.id, req.user.user_id]);
      if (a) { answered = true; myAnswer = a.option_index; }
    }
    res.json({ quiz: { id: q.id, question: q.question, options: q.options, created_by: q.created_by }, answered, my_answer: myAnswer });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// POST /api/quizzes/:id/answer  { option_index }
router.post('/quizzes/:id/answer', async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem responder.' });
  try {
    const { rows: [q] } = await db.query("SELECT * FROM quizzes WHERE id=$1 AND is_active=TRUE", [req.params.id]);
    if (!q) return res.status(404).json({ error: 'Quiz encerrado ou inexistente.' });
    const { rows: ex } = await db.query("SELECT 1 FROM quiz_answers WHERE quiz_id=$1 AND user_id=$2", [q.id, req.user.user_id]);
    if (ex.length) return res.status(409).json({ error: 'Você já respondeu.' });
    const idx = parseInt(req.body.option_index);
    if (isNaN(idx) || idx < 0 || idx >= q.options.length) return res.status(400).json({ error: 'Opção inválida.' });
    const correct = idx === q.correct_index;
    await db.query(
      "INSERT INTO quiz_answers (quiz_id, user_id, nick, option_index, is_correct) VALUES ($1,$2,$3,$4,$5)",
      [q.id, req.user.user_id, req.user.nick, idx, correct]
    );
    bcast(q.room_slug, 'quiz_answer', { id: q.id, nick: req.user.nick });
    res.json({ correct });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao responder.' }); }
});

// POST /api/quizzes/:id/close  — revela resposta + placar
router.post('/quizzes/:id/close', async (req, res) => {
  try {
    const { rows: [q] } = await db.query("SELECT * FROM quizzes WHERE id=$1", [req.params.id]);
    if (!q) return res.status(404).json({ error: 'Quiz não encontrado.' });
    if (q.created_by !== req.user.nick && !isStaff(req.user.role)) return res.status(403).json({ error: 'Sem permissão.' });
    await db.query("UPDATE quizzes SET is_active=FALSE, closed_at=NOW() WHERE id=$1", [q.id]);
    const { rows: winners } = await db.query("SELECT nick FROM quiz_answers WHERE quiz_id=$1 AND is_correct=TRUE ORDER BY answered_at ASC", [q.id]);
    bcast(q.room_slug, 'quiz_closed', { id: q.id, correct_index: q.correct_index, winners: winners.map(w => w.nick) });
    res.json({ ok: true, correct_index: q.correct_index, winners: winners.map(w => w.nick) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao encerrar.' }); }
});

// GET /api/quizzes/scores?room=slug — placar acumulado (acertos por pessoa)
router.get('/quizzes/scores', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT qa.nick, COUNT(*)::int AS score
      FROM quiz_answers qa JOIN quizzes q ON q.id = qa.quiz_id
      WHERE q.room_slug = $1 AND qa.is_correct = TRUE
      GROUP BY qa.nick ORDER BY score DESC LIMIT 20
    `, [req.query.room || '']);
    res.json({ scores: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

module.exports = router;
