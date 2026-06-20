// src/routes/chat.js — Salas, Mensagens, Recados
const express = require('express');
const db      = require('../db');
const ws      = require('../websocket');
const { logAction } = require('../modlog');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/rooms ───────────────────────────────────────────
// Lista todas as salas ativas com contagem de online
router.get('/rooms', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*,
        COUNT(op.user_id) AS online_count
      FROM rooms r
      LEFT JOIN online_presence op ON op.room_slug = r.slug
      WHERE r.is_active = TRUE
      GROUP BY r.id
      ORDER BY r.sort_order, r.name
    `);
    res.json({ rooms: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar salas.' });
  }
});

// ─── GET /api/rooms/:slug/messages ───────────────────────────
// Histórico de mensagens da sala (últimas 50, não deletadas)
router.get('/rooms/:slug/messages', authMiddleware, async (req, res) => {
  try {
    const slug = req.params.slug;

    // Proteção: mensagens de sala PRIVADA só podem ser lidas por
    // membro, dono da sala, ou staff (mod/supervisor/admin).
    if (slug.indexOf('priv_') === 0) {
      const isStaff = ['mod', 'supervisor', 'admin'].includes(req.user.role);
      if (!isStaff) {
        const uid = req.user.user_id;
        const roomId = parseInt(slug.slice(5), 10);
        let allowed = false;
        if (uid && roomId) {
          const { rows: [room] } = await db.query(
            'SELECT owner_id FROM private_rooms WHERE id = $1', [roomId]
          ).catch(() => ({ rows: [] }));
          allowed = !!(room && room.owner_id === uid);
          if (!allowed) {
            const { rows: mem } = await db.query(
              'SELECT 1 FROM private_room_members WHERE room_id = $1 AND user_id = $2', [roomId, uid]
            ).catch(() => ({ rows: [] }));
            allowed = mem.length > 0;
          }
        }
        if (!allowed) return res.status(403).json({ error: 'Sem acesso a esta sala privada.' });
      }
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const { rows } = await db.query(`
      SELECT id, nick, role, content, msg_type, media_url, reply_to, created_at
      FROM messages
      WHERE room_slug = $1
        AND is_deleted = FALSE
        AND created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY created_at DESC
      LIMIT $2
    `, [slug, limit]);

    res.json({ messages: rows.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar mensagens.' });
  }
});

// ─── GET /api/online ──────────────────────────────────────────
// Usuários online agora (para o contador)
router.get('/online', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT COUNT(*) AS total,
        COUNT(DISTINCT room_slug) AS rooms
      FROM online_presence
      WHERE last_ping > NOW() - INTERVAL '2 minutes'
    `);
    res.json({
      count: parseInt(rows[0].total),
      rooms: parseInt(rows[0].rooms)
    });
  } catch (err) {
    res.json({ count: 0, rooms: 0 });
  }
});

// ─── GET /api/online/room?slug= — usuários online numa sala ───
router.get('/online/room', authMiddleware, async (req, res) => {
  try {
    const slug = req.query.slug || '';
    const { rows } = await db.query(`
      SELECT op.nick, u.role, u.avatar
      FROM online_presence op JOIN users u ON u.id = op.user_id
      WHERE op.room_slug = $1 AND op.last_ping > NOW() - INTERVAL '2 minutes'
      ORDER BY u.role DESC
    `, [slug]);
    res.json({ users: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// ─── GET /api/online/last ─────────────────────────────────────
// Últimos 10 usuários que fizeram login (para exibir na tela de login)
router.get('/online/last', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.nick, u.role, u.avatar, u.photo_url, u.nick_color
      FROM users u
      WHERE u.is_banned = FALSE
      ORDER BY u.last_seen DESC
      LIMIT 10
    `);
    res.json({ users: rows });
  } catch (err) {
    res.json({ users: [] });
  }
});

// ─── GET /api/recados ─────────────────────────────────────────
router.get('/recados', authMiddleware, async (req, res) => {
  try {
    const page  = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const { rows } = await db.query(`
      SELECT r.id, r.user_id, r.nick, r.role, r.avatar, r.content, r.likes,
             r.media_url, r.media_type, r.color, r.is_pinned, r.created_at,
             u.photo_url AS author_photo,
             COALESCE((SELECT json_agg(json_build_object('nick', rr.nick, 'emoji', rr.emoji))
                       FROM recado_reactions rr WHERE rr.recado_id = r.id), '[]') AS reactions,
             COALESCE((SELECT json_agg(json_build_object(
                          'id', rc.id, 'nick', rc.nick, 'role', rc.role,
                          'avatar', rc.avatar, 'photo', cu.photo_url, 'content', rc.content, 'created_at', rc.created_at
                       ) ORDER BY rc.created_at)
                       FROM recado_comments rc
                       LEFT JOIN users cu ON cu.id = rc.user_id
                       WHERE rc.recado_id = r.id), '[]') AS comments
      FROM recados r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.is_deleted = FALSE
      ORDER BY r.is_pinned DESC, r.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({ recados: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar recados.' });
  }
});

// ─── POST /api/recados ────────────────────────────────────────
router.post('/recados', authMiddleware, async (req, res) => {
  try {
    if (!req.user.user_id)
      return res.status(403).json({ error: 'Visitantes não podem publicar recados.' });
    const { content = '', media_url = null, media_type = null, color = null } = req.body;
    const text = (content || '').trim();
    if (!text && !media_url)
      return res.status(400).json({ error: 'Escreva algo ou anexe uma mídia.' });
    if (text.length > 500)
      return res.status(400).json({ error: 'Recado muito longo (máx 500 chars).' });

    const { rows: [recado] } = await db.query(`
      INSERT INTO recados (user_id, nick, role, avatar, content, media_url, media_type, color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.user.user_id, req.user.nick, req.user.role, req.user.avatar || '😊', text, media_url, media_type, color]);

    res.status(201).json({ recado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao postar recado.' });
  }
});

// ─── POST /api/recados/:id/like ───────────────────────────────
router.post('/recados/:id/like', authMiddleware, async (req, res) => {
  try {
    const recadoId = parseInt(req.params.id);
    const userId   = req.user.user_id;

    if (!userId) return res.status(403).json({ error: 'Visitantes não podem curtir.' });

    // Toggle like
    const { rows: existing } = await db.query(
      'SELECT 1 FROM recado_likes WHERE recado_id = $1 AND user_id = $2',
      [recadoId, userId]
    );

    if (existing.length) {
      await db.query('DELETE FROM recado_likes WHERE recado_id = $1 AND user_id = $2', [recadoId, userId]);
    } else {
      await db.query('INSERT INTO recado_likes (recado_id, user_id) VALUES ($1, $2)', [recadoId, userId]);
    }

    const { rows: [count] } = await db.query(
      'SELECT COUNT(*) AS total FROM recado_likes WHERE recado_id = $1', [recadoId]
    );

    res.json({ liked: !existing.length, total: parseInt(count.total) });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao curtir.' });
  }
});

// ─── POST /api/recados/:id/react  { emoji } — reação (toggle) ─
router.post('/recados/:id/react', authMiddleware, async (req, res) => {
  try {
    const recadoId = parseInt(req.params.id);
    const userId = req.user.user_id;
    if (!userId) return res.status(403).json({ error: 'Visitantes não podem reagir.' });
    const emoji = (req.body.emoji || '').slice(0, 8);
    if (!emoji) return res.status(400).json({ error: 'Emoji obrigatório.' });

    const { rows: ex } = await db.query(
      'SELECT emoji FROM recado_reactions WHERE recado_id = $1 AND user_id = $2', [recadoId, userId]
    );
    if (ex.length && ex[0].emoji === emoji) {
      await db.query('DELETE FROM recado_reactions WHERE recado_id = $1 AND user_id = $2', [recadoId, userId]);
    } else {
      await db.query(`
        INSERT INTO recado_reactions (recado_id, user_id, nick, emoji) VALUES ($1, $2, $3, $4)
        ON CONFLICT (recado_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji
      `, [recadoId, userId, req.user.nick, emoji]);
    }
    const { rows } = await db.query(
      'SELECT nick, emoji FROM recado_reactions WHERE recado_id = $1', [recadoId]
    );
    res.json({ reactions: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao reagir.' }); }
});

// ─── POST /api/recados/:id/comments  { content } ─────────────
router.post('/recados/:id/comments', authMiddleware, async (req, res) => {
  try {
    if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem comentar.' });
    const recadoId = parseInt(req.params.id);
    const content = (req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comentário vazio.' });
    if (content.length > 300) return res.status(400).json({ error: 'Comentário muito longo (máx 300).' });

    const { rows: [c] } = await db.query(`
      INSERT INTO recado_comments (recado_id, user_id, nick, role, avatar, content)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [recadoId, req.user.user_id, req.user.nick, req.user.role, req.user.avatar || '😊', content]);
    res.status(201).json({ comment: c });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao comentar.' }); }
});

// ─── DELETE /api/recados/comments/:cid — autor ou staff ──────
router.delete('/recados/comments/:cid', authMiddleware, async (req, res) => {
  try {
    const cid = parseInt(req.params.cid);
    const { rows: [c] } = await db.query('SELECT user_id FROM recado_comments WHERE id = $1', [cid]);
    if (!c) return res.status(404).json({ error: 'Comentário não encontrado.' });
    const staff = ['mod', 'supervisor', 'admin'].includes(req.user.role);
    if (c.user_id !== req.user.user_id && !staff) return res.status(403).json({ error: 'Sem permissão.' });
    await db.query('DELETE FROM recado_comments WHERE id = $1', [cid]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao excluir comentário.' }); }
});

// ─── DELETE /api/recados/:id — autor ou staff ────────────────
router.delete('/recados/:id', authMiddleware, async (req, res) => {
  try {
    const recadoId = parseInt(req.params.id);
    const { rows: [r] } = await db.query('SELECT user_id FROM recados WHERE id = $1', [recadoId]);
    if (!r) return res.status(404).json({ error: 'Recado não encontrado.' });
    const staff = ['mod', 'supervisor', 'admin'].includes(req.user.role);
    if (r.user_id !== req.user.user_id && !staff) return res.status(403).json({ error: 'Sem permissão.' });
    await db.query('UPDATE recados SET is_deleted = TRUE WHERE id = $1', [recadoId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao excluir recado.' }); }
});

// ─── POST /api/reports ────────────────────────────────────────
router.post('/reports', authMiddleware, async (req, res) => {
  try {
    const { reported_nick, room_slug, reason } = req.body;
    if (!reported_nick || !reason)
      return res.status(400).json({ error: 'Dados incompletos.' });

    await db.query(`
      INSERT INTO reports (reporter_nick, reported_nick, room_slug, reason)
      VALUES ($1, $2, $3, $4)
    `, [req.user.nick, reported_nick, room_slug || null, reason]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar denúncia.' });
  }
});

// ─── GET /api/system/config ───────────────────────────────────
// Retorna configurações públicas do sistema (avisos, flags)
router.get('/system/config', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM system_config');
    const cfg = {};
    // Nunca expor segredos no endpoint público
    const isSecret = (k) => k === 'bot_api_key' || /(_key|_secret|_token|password)$/i.test(k);
    rows.forEach(r => { if (!isSecret(r.key)) cfg[r.key] = r.value; });
    res.json({ config: cfg });
  } catch (err) {
    res.json({ config: {} });
  }
});

// ─── POST /api/contacts — usuário envia contato/reclamação ───
router.post('/contacts', authMiddleware, async (req, res) => {
  try {
    const type = (req.body.type || 'contato').toString().slice(0, 30);
    const message = (req.body.message || '').toString().trim().slice(0, 2000);
    if (!message) return res.status(400).json({ error: 'Mensagem obrigatória.' });
    await db.query(
      `INSERT INTO contacts (user_id, nick, type, message) VALUES ($1, $2, $3, $4)`,
      [req.user.user_id || null, req.user.nick || 'visitante', type, message]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao enviar mensagem.' });
  }
});

// ─── POST /api/messages/:id/react  { emoji } — toggle ─────────
router.post('/messages/:id/react', authMiddleware, async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem reagir.' });
  const emoji = (req.body.emoji || '').slice(0, 16);
  if (!emoji) return res.status(400).json({ error: 'Emoji obrigatório.' });
  try {
    const { rows: [m] } = await db.query('SELECT room_slug FROM messages WHERE id = $1', [req.params.id]);
    if (!m) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    const { rows: [cur] } = await db.query(
      'SELECT emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2', [req.params.id, req.user.user_id]
    );
    let mine = emoji;
    if (cur && cur.emoji === emoji) {
      await db.query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2', [req.params.id, req.user.user_id]);
      mine = null;
    } else {
      await db.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1,$2,$3)
         ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji`,
        [req.params.id, req.user.user_id, emoji]
      );
    }
    const { rows: summary } = await db.query(
      'SELECT emoji, COUNT(*)::int AS count FROM message_reactions WHERE message_id = $1 GROUP BY emoji ORDER BY count DESC',
      [req.params.id]
    );
    try { ws.broadcastToRoom(m.room_slug, { event: 'message_reaction', data: { message_id: Number(req.params.id), summary } }); } catch (e) {}
    res.json({ summary, mine });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao reagir.' }); }
});

// ─── Apagar mensagem (autor ou staff) ────────────────────────
router.delete('/messages/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: [m] } = await db.query(
      'SELECT room_slug, user_id, nick, content, msg_type FROM messages WHERE id = $1 AND is_deleted = FALSE', [req.params.id]
    );
    if (!m) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    const isStaff = ['mod', 'supervisor', 'admin'].includes(req.user.role);
    const isAuthor = req.user.user_id && m.user_id && Number(req.user.user_id) === Number(m.user_id);
    if (!isStaff && !isAuthor) return res.status(403).json({ error: 'Sem permissão para apagar esta mensagem.' });
    // Proteção: não apagar mensagem de membro da equipe (exceto a própria)
    if (!isAuthor) {
      const { rows: [au] } = await db.query('SELECT role FROM users WHERE LOWER(nick)=LOWER($1)', [m.nick]);
      if (au && ['admin','supervisor','mod'].includes(au.role)) {
        return res.status(403).json({ error: 'Não é possível apagar mensagens de um membro da equipe.' });
      }
    }
    await db.query('UPDATE messages SET is_deleted = TRUE WHERE id = $1', [req.params.id]);
    try {
      ws.broadcastToRoom(m.room_slug, {
        event: 'message_deleted',
        data: { id: Number(req.params.id), by: req.user.nick, by_role: req.user.role, target: m.nick }
      });
    } catch (e) {}
    if (isStaff && !isAuthor) {
      const what = String(m.msg_type || '').indexOf('media:') === 0
        ? '[' + m.msg_type.replace('media:', '') + ']'
        : (m.content || '').slice(0, 120);
      logAction({ actor_nick: req.user.nick, actor_role: req.user.role, action: 'delete_msg', target_nick: m.nick, detail: what });
    }
    res.json({ ok: true, id: Number(req.params.id) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao apagar mensagem.' }); }
});

// ─── Bloqueio de usuários ────────────────────────────────────
router.get('/blocks', authMiddleware, async (req, res) => {
  if (!req.user.user_id) return res.json({ blocks: [] });
  try {
    const { rows } = await db.query('SELECT blocked_nick FROM user_blocks WHERE blocker_id = $1', [req.user.user_id]);
    res.json({ blocks: rows.map(r => r.blocked_nick) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});
router.post('/blocks', authMiddleware, async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem bloquear.' });
  const nick = (req.body.nick || '').trim();
  if (!nick) return res.status(400).json({ error: 'Nick obrigatório.' });
  if (nick.toLowerCase() === String(req.user.nick).toLowerCase()) return res.status(400).json({ error: 'Você não pode se bloquear.' });
  try {
    const { rows: [tgt] } = await db.query('SELECT role FROM users WHERE LOWER(nick)=LOWER($1)', [nick]);
    if (tgt && ['admin','supervisor','mod'].includes(tgt.role)) {
      return res.status(403).json({ error: 'Não é possível bloquear um membro da equipe.' });
    }
    await db.query('INSERT INTO user_blocks (blocker_id, blocked_nick) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.user_id, nick]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao bloquear.' }); }
});
router.delete('/blocks/:nick', authMiddleware, async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem desbloquear.' });
  try {
    await db.query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_nick = $2', [req.user.user_id, req.params.nick]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// ─── GET /api/bot/key — o BOT externo busca a chave atual ────
// Autenticado por um segredo próprio do bot (header x-bot-secret == BOT_SECRET).
// Desligado por padrão: só funciona se BOT_SECRET estiver no .env.
router.get('/bot/key', async (req, res) => {
  const secret = process.env.BOT_SECRET;
  if (!secret) return res.status(403).json({ error: 'BOT_SECRET não configurado no servidor.' });
  const provided = req.headers['x-bot-secret'] || '';
  if (provided !== secret) return res.status(401).json({ error: 'Não autorizado.' });
  try {
    const { rows: [r] } = await db.query("SELECT value FROM system_config WHERE key = 'bot_api_key'");
    res.json({ key: (r && r.value) || '' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// ─── GET /api/users/recent — últimos online (público) ───────
router.get('/users/recent', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT nick, role, avatar, photo_url, nick_emoji, last_seen
       FROM users WHERE last_seen IS NOT NULL ORDER BY last_seen DESC LIMIT 30`
    );
    res.json({ users: rows });
  } catch (err) { res.json({ users: [] }); }
});

// ─── GET /api/users/:nick — perfil público + fãs ─────────────
router.get('/users/:nick', authMiddleware, async (req, res) => {
  try {
    const { rows: [u] } = await db.query(
      `SELECT id, nick, role, avatar, photo_url, bio, city, age, gender, interests, job,
              status, nick_color, nick_emoji, nick_effect, profile_audio, profile_audio_name
       FROM users WHERE LOWER(nick) = LOWER($1)`, [req.params.nick]
    );
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const { rows: [fc] } = await db.query('SELECT COUNT(*)::int AS c FROM user_fans WHERE target_nick = $1', [u.nick]);
    let isFan = false;
    if (req.user.user_id) {
      const { rows: f } = await db.query('SELECT 1 FROM user_fans WHERE fan_id = $1 AND target_nick = $2', [req.user.user_id, u.nick]);
      isFan = f.length > 0;
    }
    delete u.id;
    res.json({ user: u, fans: { count: fc.c, isFan } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// ─── POST /api/users/:nick/fan — virar/deixar de ser fã ──────
router.post('/users/:nick/fan', authMiddleware, async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não podem ser fãs.' });
  const target = req.params.nick;
  if (target.toLowerCase() === String(req.user.nick).toLowerCase()) return res.status(400).json({ error: 'Você não pode ser seu próprio fã.' });
  try {
    const { rows: ex } = await db.query('SELECT 1 FROM user_fans WHERE fan_id = $1 AND target_nick = $2', [req.user.user_id, target]);
    if (ex.length) await db.query('DELETE FROM user_fans WHERE fan_id = $1 AND target_nick = $2', [req.user.user_id, target]);
    else await db.query('INSERT INTO user_fans (fan_id, target_nick) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.user_id, target]);
    const { rows: [fc] } = await db.query('SELECT COUNT(*)::int AS c FROM user_fans WHERE target_nick = $1', [target]);
    res.json({ ok: true, isFan: !ex.length, count: fc.c });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// ─── POST /api/reports — usuário denuncia outro ─────────────
router.post('/reports', authMiddleware, async (req, res) => {
  const target = (req.body.target_nick || '').trim();
  const reason = (req.body.reason || '').slice(0, 300);
  if (!target) return res.status(400).json({ error: 'Quem você quer denunciar?' });
  try {
    await db.query('INSERT INTO reports (reporter_nick, target_nick, reason) VALUES ($1,$2,$3)', [req.user.nick, target, reason]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao enviar denúncia.' }); }
});

// ─── POST /api/bot/chat — o Supra responde (IA) com segurança ──
// A chave do Groq fica SÓ no servidor (banco: system_config.bot_api_key).
// O navegador manda as mensagens e recebe só o texto da resposta.
router.post('/bot/chat', authMiddleware, async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages : null;
    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'Mensagens ausentes.' });
    }

    const { rows: [r] } = await db.query(
      "SELECT value FROM system_config WHERE key = 'bot_api_key'"
    );
    const apiKey = (r && r.value) || '';
    if (!apiKey) {
      return res.status(503).json({ error: 'Chave do bot não configurada.' });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        messages,
      }),
    });

    const data = await groqRes.json();
    if (data.error) {
      console.warn('Supra (Groq) error:', data.error);
      return res.status(502).json({ error: 'Falha ao gerar resposta.' });
    }
    const reply = data.choices?.[0]?.message?.content?.trim() || '';
    res.json({ reply });
  } catch (err) {
    console.error('bot/chat error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── Pedidos ao DJ ───────────────────────────────────────────
router.post('/dj/requests', authMiddleware, async (req, res) => {
  try {
    const song = (req.body.song || '').toString().trim().slice(0, 120);
    const artist = (req.body.artist || '').toString().trim().slice(0, 120);
    const dedica = (req.body.dedica || '').toString().trim().slice(0, 60);
    if (!song) return res.status(400).json({ error: 'Informe a música.' });
    const { rows: [r] } = await db.query(
      `INSERT INTO dj_requests (nick, song, artist, dedica) VALUES ($1,$2,$3,$4) RETURNING id`,
      [req.user.nick, song, artist, dedica]
    );
    res.json({ ok: true, id: r.id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao enviar pedido.' }); }
});
router.get('/dj/requests', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, nick, song, artist, dedica, status, created_at
       FROM dj_requests ORDER BY created_at DESC LIMIT 120`
    );
    res.json({ requests: rows });
  } catch (err) { res.json({ requests: [] }); }
});
router.post('/dj/requests/:id/played', authMiddleware, async (req, res) => {
  if (!['dj', 'mod', 'supervisor', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas DJ/staff.' });
  try {
    await db.query('UPDATE dj_requests SET status = $1 WHERE id = $2', [req.body.status === 'fila' ? 'fila' : 'tocado', parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro.' }); }
});
router.delete('/dj/requests/:id', authMiddleware, async (req, res) => {
  if (!['dj', 'mod', 'supervisor', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas DJ/staff.' });
  try {
    await db.query('DELETE FROM dj_requests WHERE id = $1', [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro.' }); }
});

module.exports = router;


