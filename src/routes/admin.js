// src/routes/admin.js — Painel de Administração
const express = require('express');
const bcrypt  = require('bcrypt');
const db      = require('../db');
const geoip   = require('../geoip');
const ws      = require('../websocket');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas admin exigem autenticação + role mínimo mod
router.use(authMiddleware);
router.use(requireRole('mod'));

// ─── GET /api/admin/users ─────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const search = req.query.q || '';
    const { rows } = await db.query(`
      SELECT id, nick, role, avatar, is_banned, ban_reason, ban_expires,
             created_at, last_seen, status, last_ip, last_user_agent,
             (SELECT COUNT(*) FROM messages m WHERE m.nick = users.nick) AS msg_count
      FROM users
      WHERE ($1 = '' OR nick ILIKE '%' || $1 || '%')
      ORDER BY created_at DESC
      LIMIT 100
    `, [search]);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

// ─── GET /api/admin/geoip?ip=X — geolocalização + VPN/Proxy ──
router.get('/geoip', async (req, res) => {
  try {
    const ip = (req.query.ip || '').trim();
    if (!ip) return res.json({ ok:false, reason:'sem-ip' });
    const out = await geoip.lookupGeo(ip);
    res.json(out);
  } catch (err) {
    res.json({ ok:false, reason:'erro' });
  }
});

// ─── GET /api/admin/reports ───────────────────────────────────
router.get('/reports', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM reports ORDER BY created_at DESC LIMIT 200
    `);
    res.json({ reports: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar denúncias.' });
  }
});

// ─── PATCH /api/admin/reports/:id ────────────────────────────
router.patch('/reports/:id', requireRole('supervisor'), async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(`
      UPDATE reports SET status = $1, resolved_by = $2, resolved_at = NOW()
      WHERE id = $3
    `, [status, req.user.nick, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar denúncia.' });
  }
});

// ─── POST /api/admin/ban ──────────────────────────────────────
router.post('/ban', requireRole('mod'), async (req, res) => {
  try {
    const { nick, reason, ban_type, expires_at, ban_ip } = req.body;

    if (!nick) return res.status(400).json({ error: 'Nick obrigatório.' });

    // Não pode banir admin
    const { rows: target } = await db.query(
      'SELECT id, role, last_ip FROM users WHERE LOWER(nick) = LOWER($1)', [nick]
    );

    if (target.length && target[0].role === 'admin') {
      return res.status(403).json({ error: 'Não é possível banir um administrador.' });
    }

    // Se pediu banir o IP, pega o último IP conhecido do usuário
    const ipToBan = (ban_ip && target[0] && target[0].last_ip) ? target[0].last_ip : null;

    // Registrar ban (com IP, se houver)
    await db.query(`
      INSERT INTO bans (nick, user_id, banned_by, reason, ban_type, expires_at, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [nick, target[0]?.id || null, req.user.nick, reason || '', ban_type || 'permanent', expires_at || null, ipToBan]);

    // Atualizar flag no usuário
    if (target.length) {
      await db.query(`
        UPDATE users SET is_banned = TRUE, ban_reason = $1, ban_expires = $2
        WHERE id = $3
      `, [reason || '', expires_at || null, target[0].id]);

      // Invalidar todas as sessões do banido
      await db.query('DELETE FROM sessions WHERE user_id = $1', [target[0].id]);
    }

    let msg = `${nick} foi banido com sucesso.`;
    if (ban_ip) {
      msg += ipToBan ? ` IP ${ipToBan} também bloqueado.` : ' (IP não registrado ainda — só o nick foi bloqueado.)';
    }
    res.json({ ok: true, message: msg, ip_banned: !!ipToBan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao banir usuário.' });
  }
});

// ─── POST /api/admin/unban ────────────────────────────────────
router.post('/unban', requireRole('supervisor'), async (req, res) => {
  try {
    const { nick } = req.body;
    await db.query(`
      UPDATE users SET is_banned = FALSE, ban_reason = '', ban_expires = NULL
      WHERE LOWER(nick) = LOWER($1)
    `, [nick]);
    // Remove os registros de ban desse nick (libera também o IP banido)
    await db.query('DELETE FROM bans WHERE LOWER(nick) = LOWER($1)', [nick]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desbanir.' });
  }
});

// ─── PATCH /api/admin/users/:id/role ─────────────────────────
router.patch('/users/:id/role', requireRole('supervisor'), async (req, res) => {
  try {
    const { role } = req.body;
    const VALID = ['user','dj','vip','premium','mod','supervisor','admin'];
    if (!VALID.includes(role)) return res.status(400).json({ error: 'Role inválido.' });

    // Só admin pode promover para admin/supervisor
    if (['admin','supervisor'].includes(role) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas admin pode promover para este cargo.' });
    }

    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar cargo.' });
  }
});

// ─── DELETE /api/admin/users/:id — excluir cadastro (só admin) ─
router.delete('/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const { rows: [u] } = await db.query('SELECT nick, role FROM users WHERE id = $1', [id]);
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (u.role === 'admin') return res.status(403).json({ error: 'Não é possível excluir um administrador.' });

    // Sessões fora; o resto é removido por ON DELETE CASCADE / SET NULL
    await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    await db.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ ok: true, message: `Cadastro de ${u.nick} excluído.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir cadastro.' });
  }
});

// ─── PATCH /api/admin/users/:id/nick ─────────────────────────
router.patch('/users/:id/nick', requireRole('supervisor'), async (req, res) => {
  try {
    const { nick } = req.body;
    if (!nick || !/^[a-zA-Z0-9_]{3,20}$/.test(nick))
      return res.status(400).json({ error: 'Nick inválido.' });

    // Verificar se já existe
    const { rows } = await db.query(
      'SELECT id FROM users WHERE LOWER(nick) = LOWER($1) AND id != $2', [nick, req.params.id]
    );
    if (rows.length) return res.status(409).json({ error: 'Nick já em uso.' });

    await db.query('UPDATE users SET nick = $1 WHERE id = $2', [nick, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar nick.' });
  }
});

// ─── GET /api/admin/bans ──────────────────────────────────────
router.get('/bans', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM bans ORDER BY created_at DESC LIMIT 100
    `);
    res.json({ bans: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar bans.' });
  }
});

// ─── PATCH /api/admin/system ──────────────────────────────────
router.patch('/system', requireRole('admin'), async (req, res) => {
  try {
    const { key, value } = req.body;
    const ALLOWED = ['register_blocked','guest_blocked','registered_blocked','members_only','bingo_enabled','msg_limit','msg_ttl','antiflood','block_vpn','notice_warn','notice_danger','maintenance','logo_url','radio_chat','radio_priv','radio_global'];
    if (!ALLOWED.includes(key)) return res.status(400).json({ error: 'Configuração inválida.' });

    await db.query(`
      INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, value]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar configuração.' });
  }
});

// ─── GET /api/admin/spam-words ────────────────────────────────
router.get('/spam-words', requireRole('supervisor'), async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT value FROM system_config WHERE key = 'spam_words'"
    );
    const words = rows.length ? JSON.parse(rows[0].value || '[]') : [];
    res.json({ words });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar palavras bloqueadas.' });
  }
});

// ─── POST /api/admin/spam-words ───────────────────────────────
router.post('/spam-words', requireRole('supervisor'), async (req, res) => {
  try {
    const { words } = req.body;
    if (!Array.isArray(words)) return res.status(400).json({ error: 'Lista inválida.' });
    const sanitized = words.map(w => String(w).toLowerCase().trim()).filter(Boolean);
    await db.query(`
      INSERT INTO system_config (key, value, updated_at) VALUES ('spam_words', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [JSON.stringify(sanitized)]);
    res.json({ ok: true, count: sanitized.length });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar palavras bloqueadas.' });
  }
});

// ─── Blacklist de IPs (reusa a tabela bans com ip_address) ────
router.get('/ip-block', requireRole('supervisor'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ip_address FROM bans
       WHERE ip_address IS NOT NULL AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY ip_address`
    );
    res.json({ ips: rows.map(r => r.ip_address) });
  } catch (err) { res.json({ ips: [] }); }
});

router.post('/ip-block', requireRole('supervisor'), async (req, res) => {
  try {
    const ip = (req.body.ip || '').trim();
    if (!ip) return res.status(400).json({ error: 'IP obrigatório.' });
    const { rows: ex } = await db.query('SELECT 1 FROM bans WHERE ip_address = $1 LIMIT 1', [ip]);
    if (!ex.length) {
      await db.query(
        `INSERT INTO bans (nick, banned_by, reason, ban_type, ip_address)
         VALUES ('[IP]', $1, 'Blacklist manual', 'ip', $2)`,
        [req.user.nick, ip]
      );
    }
    res.json({ ok: true, message: `IP ${ip} bloqueado.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao bloquear IP.' });
  }
});

router.delete('/ip-block/:ip', requireRole('supervisor'), async (req, res) => {
  try {
    const ip = decodeURIComponent(req.params.ip || '');
    await db.query('DELETE FROM bans WHERE ip_address = $1', [ip]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover IP.' });
  }
});

// ─── Contatos / Reclamações ──────────────────────────────────
router.get('/contacts', requireRole('supervisor'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, nick, type, message, status, created_at FROM contacts ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ contacts: rows });
  } catch (err) { res.json({ contacts: [] }); }
});
router.delete('/contacts/:id', requireRole('supervisor'), async (req, res) => {
  try { await db.query('DELETE FROM contacts WHERE id = $1', [parseInt(req.params.id, 10)]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Erro ao excluir.' }); }
});
router.delete('/contacts', requireRole('supervisor'), async (req, res) => {
  try { await db.query('DELETE FROM contacts'); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Erro ao limpar.' }); }
});

// ─── DELETE /api/admin/recados/:id ───────────────────────────
router.delete('/recados/:id', async (req, res) => {
  try {
    await db.query('UPDATE recados SET is_deleted = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar recado.' });
  }
});

// ─── POST /api/admin/recados/:id/pin ─────────────────────────
router.post('/recados/:id/pin', async (req, res) => {
  try {
    await db.query('UPDATE recados SET is_pinned = NOT is_pinned WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fixar recado.' });
  }
});

// ─── Salas públicas (criar/excluir) ──────────────────────────
router.post('/rooms', requireRole('admin'), async (req, res) => {
  const name = (req.body.name || '').trim();
  let slug = (req.body.slug || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const icon = (req.body.icon || '💬').slice(0, 8);
  const description = (req.body.description || '').slice(0, 300);
  const roles = ['guest','user','vip','premium','dj','mod','supervisor','admin'];
  const min_role = roles.includes(req.body.min_role) ? req.body.min_role : 'guest';
  let max_users = parseInt(req.body.max_users, 10);
  if (!Number.isFinite(max_users) || max_users < 5) max_users = 200;
  if (max_users > 500) max_users = 500;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
  if (!slug) slug = (name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || ('sala-' + Date.now());
  try {
    const { rows: ex } = await db.query('SELECT 1 FROM rooms WHERE slug = $1', [slug]);
    if (ex.length) return res.status(409).json({ error: 'Já existe uma sala com esse identificador.' });
    await db.query(
      'INSERT INTO rooms (slug, name, icon, description, min_role, max_users) VALUES ($1, $2, $3, $4, $5, $6)',
      [slug, name, icon, description, min_role, max_users]
    );
    res.status(201).json({ room: { slug, name, icon, description, min_role, max_users } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar sala.' }); }
});
router.delete('/rooms/:slug', requireRole('admin'), async (req, res) => {
  try { await db.query('DELETE FROM rooms WHERE slug = $1', [req.params.slug]); res.json({ ok: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao excluir sala.' }); }
});

// ─── GET /api/admin/logins — acessos recentes (24h) ──────────
router.get('/logins', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT nick, kind, ip, user_agent, created_at
      FROM login_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC LIMIT 500
    `);
    res.json({ logins: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar acessos.' }); }
});

// ─── DELETE /api/admin/rooms/:slug/messages — limpar sala ────
router.delete('/rooms/:slug/messages', requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM messages WHERE room_slug = $1', [req.params.slug]);
    try { ws.broadcastToRoom(req.params.slug, { event: 'room_cleared', data: { room: req.params.slug } }); } catch (e) {}
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao limpar mensagens.' }); }
});

// ─── Chave do Bot (segredo, só admin) ────────────────────────
router.get('/bot-key', requireRole('admin'), async (req, res) => {
  try {
    const { rows: [r] } = await db.query("SELECT value FROM system_config WHERE key = 'bot_api_key'");
    res.json({ key: (r && r.value) || '' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});
router.post('/bot-key', requireRole('admin'), async (req, res) => {
  const key = (req.body.key || '').trim();
  try {
    await db.query(
      `INSERT INTO system_config (key, value) VALUES ('bot_api_key', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key]
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao salvar a chave.' }); }
});

// ─── GET /api/admin/banned — lista de banidos ────────────────
router.get('/banned', requireRole('mod'), async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT nick, role, ban_reason, ban_expires FROM users WHERE is_banned = TRUE ORDER BY nick"
    );
    res.json({ banned: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// ─── Silenciar (mute) ────────────────────────────────────────
router.post('/mute', requireRole('mod'), async (req, res) => {
  const nick = (req.body.nick || '').trim();
  let minutes = parseInt(req.body.minutes, 10); if (!Number.isFinite(minutes) || minutes < 1) minutes = 10;
  if (!nick) return res.status(400).json({ error: 'Nick obrigatório.' });
  try {
    const until = new Date(Date.now() + minutes * 60000);
    const { rows } = await db.query('UPDATE users SET muted_until = $1 WHERE LOWER(nick)=LOWER($2) RETURNING nick', [until, nick]);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
    try { ws.setModFlags(rows[0].nick, { mutedUntil: until }); } catch (e) {}
    res.json({ ok: true, until });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao silenciar.' }); }
});
router.post('/unmute', requireRole('mod'), async (req, res) => {
  const nick = (req.body.nick || '').trim();
  try {
    const { rows } = await db.query('UPDATE users SET muted_until = NULL WHERE LOWER(nick)=LOWER($1) RETURNING nick', [nick]);
    if (rows.length) { try { ws.setModFlags(rows[0].nick, { mutedUntil: null }); } catch (e) {} }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// ─── Shadowban ───────────────────────────────────────────────
router.post('/shadow', requireRole('supervisor'), async (req, res) => {
  const nick = (req.body.nick || '').trim();
  const on = !!req.body.on;
  if (!nick) return res.status(400).json({ error: 'Nick obrigatório.' });
  try {
    const { rows } = await db.query('UPDATE users SET shadow_banned = $1 WHERE LOWER(nick)=LOWER($2) RETURNING nick', [on, nick]);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
    try { ws.setModFlags(rows[0].nick, { shadowBanned: on }); } catch (e) {}
    res.json({ ok: true, on });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

// ─── Denúncias ───────────────────────────────────────────────
router.get('/reports', requireRole('mod'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM reports WHERE resolved = FALSE ORDER BY created_at DESC LIMIT 100');
    res.json({ reports: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});
router.post('/reports/:id/resolve', requireRole('mod'), async (req, res) => {
  try {
    await db.query('UPDATE reports SET resolved = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro.' }); }
});

module.exports = router;
