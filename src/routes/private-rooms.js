// src/routes/private-rooms.js — Salas privadas + convites
const express = require('express');
const db      = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const isStaff = role => ['mod', 'supervisor', 'admin'].includes(role);
function requireUser(req, res) {
  if (!req.user.user_id) { res.status(403).json({ error: 'Apenas usuários registrados.' }); return false; }
  return true;
}

// ─── GET /api/private-rooms — salas que sou dono ou membro ────
router.get('/', async (req, res) => {
  if (!requireUser(req, res)) return;
  const uid = req.user.user_id;
  try {
    const { rows } = await db.query(`
      SELECT pr.id, pr.slug, pr.name, pr.icon, pr.description, pr.color, pr.max_users,
             pr.owner_nick, (pr.owner_id = $1) AS is_owner,
             (SELECT COUNT(*) FROM online_presence op
                WHERE op.room_slug = pr.slug AND op.last_ping > NOW() - INTERVAL '2 minutes') AS online
      FROM private_rooms pr
      WHERE pr.is_active = TRUE
        AND (pr.owner_id = $1 OR EXISTS(
              SELECT 1 FROM private_room_members m WHERE m.room_id = pr.id AND m.user_id = $1))
      ORDER BY pr.created_at DESC
    `, [uid]);
    res.json({ rooms: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao listar salas.' }); }
});

// ─── GET /api/private-rooms/invites — meus convites pendentes ─
router.get('/invites', async (req, res) => {
  if (!requireUser(req, res)) return;
  try {
    const { rows } = await db.query(`
      SELECT i.id, i.from_nick, i.created_at,
             pr.id AS room_id, pr.slug, pr.name, pr.icon, pr.description
      FROM private_room_invites i
      JOIN private_rooms pr ON pr.id = i.room_id
      WHERE i.to_user_id = $1 AND i.status = 'pending' AND pr.is_active = TRUE
      ORDER BY i.created_at DESC
    `, [req.user.user_id]);
    res.json({ invites: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar convites.' }); }
});

// ─── POST /api/private-rooms/invites/:id/accept ──────────────
router.post('/invites/:id/accept', async (req, res) => {
  if (!requireUser(req, res)) return;
  const uid = req.user.user_id;
  try {
    const { rows: [inv] } = await db.query(
      "SELECT * FROM private_room_invites WHERE id = $1 AND to_user_id = $2 AND status = 'pending'",
      [req.params.id, uid]
    );
    if (!inv) return res.status(404).json({ error: 'Convite não encontrado.' });
    await db.query(`
      INSERT INTO private_room_members (room_id, user_id, nick) VALUES ($1, $2, $3)
      ON CONFLICT (room_id, user_id) DO NOTHING
    `, [inv.room_id, uid, req.user.nick]);
    await db.query("UPDATE private_room_invites SET status = 'accepted' WHERE id = $1", [inv.id]);
    const { rows: [room] } = await db.query('SELECT slug, name FROM private_rooms WHERE id = $1', [inv.room_id]);
    res.json({ ok: true, room });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao aceitar convite.' }); }
});

// ─── POST /api/private-rooms/invites/:id/decline ─────────────
router.post('/invites/:id/decline', async (req, res) => {
  if (!requireUser(req, res)) return;
  try {
    await db.query(
      "UPDATE private_room_invites SET status = 'declined' WHERE id = $1 AND to_user_id = $2",
      [req.params.id, req.user.user_id]
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao recusar convite.' }); }
});

// ─── POST /api/private-rooms — criar sala ────────────────────
router.post('/', async (req, res) => {
  if (!requireUser(req, res)) return;
  const uid = req.user.user_id;
  const { name, icon, description, color, max_users } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome obrigatório.' });
  try {
    const { rows: [room] } = await db.query(`
      INSERT INTO private_rooms (slug, name, icon, description, color, max_users, owner_id, owner_nick)
      VALUES ('tmp', $1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [name.trim().slice(0, 60), (icon || '🔒').slice(0, 10), (description || '').slice(0, 300),
        color || '#7c3aed', parseInt(max_users) || 10, uid, req.user.nick]);
    const slug = 'priv_' + room.id;
    await db.query('UPDATE private_rooms SET slug = $1 WHERE id = $2', [slug, room.id]);
    await db.query(
      'INSERT INTO private_room_members (room_id, user_id, nick) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [room.id, uid, req.user.nick]
    );
    const { rows: [full] } = await db.query('SELECT * FROM private_rooms WHERE id = $1', [room.id]);
    res.status(201).json({ room: { ...full, is_owner: true, online: 1 } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar sala.' }); }
});

// ─── POST /api/private-rooms/:id/invite  { to_nick } ─────────
router.post('/:id/invite', async (req, res) => {
  if (!requireUser(req, res)) return;
  const uid = req.user.user_id;
  try {
    const { rows: [room] } = await db.query('SELECT * FROM private_rooms WHERE id = $1 AND is_active = TRUE', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Sala não encontrada.' });
    if (room.owner_id !== uid && !isStaff(req.user.role))
      return res.status(403).json({ error: 'Só o dono pode convidar.' });

    const toNick = (req.body.to_nick || '').trim();
    if (!toNick) return res.status(400).json({ error: 'Nick obrigatório.' });
    const { rows: [target] } = await db.query('SELECT id, nick FROM users WHERE LOWER(nick) = LOWER($1)', [toNick]);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (target.id === uid) return res.status(400).json({ error: 'Você já é dono da sala.' });

    const { rows: mem } = await db.query('SELECT 1 FROM private_room_members WHERE room_id = $1 AND user_id = $2', [room.id, target.id]);
    if (mem.length) return res.status(409).json({ error: 'Esse usuário já é membro.' });

    // Evita convites pendentes duplicados
    const { rows: dup } = await db.query(
      "SELECT 1 FROM private_room_invites WHERE room_id = $1 AND to_user_id = $2 AND status = 'pending'", [room.id, target.id]
    );
    if (!dup.length) {
      await db.query(
        'INSERT INTO private_room_invites (room_id, from_nick, to_user_id, to_nick) VALUES ($1, $2, $3, $4)',
        [room.id, req.user.nick, target.id, target.nick]
      );
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao convidar.' }); }
});

// ─── DELETE /api/private-rooms/:id — dono ou staff ───────────
router.delete('/:id', async (req, res) => {
  if (!requireUser(req, res)) return;
  try {
    const { rows: [room] } = await db.query('SELECT owner_id FROM private_rooms WHERE id = $1', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Sala não encontrada.' });
    if (room.owner_id !== req.user.user_id && !isStaff(req.user.role))
      return res.status(403).json({ error: 'Sem permissão.' });
    await db.query('UPDATE private_rooms SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao excluir sala.' }); }
});

// ─── GET /api/private-rooms/:id — detalhe + checagem de acesso ─
router.get('/:id', async (req, res) => {
  if (!requireUser(req, res)) return;
  const uid = req.user.user_id;
  try {
    const { rows: [room] } = await db.query('SELECT * FROM private_rooms WHERE id = $1 AND is_active = TRUE', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Sala não encontrada.' });
    const isOwner = room.owner_id === uid;
    const { rows: mem } = await db.query('SELECT 1 FROM private_room_members WHERE room_id = $1 AND user_id = $2', [room.id, uid]);
    if (!isOwner && !mem.length && !isStaff(req.user.role))
      return res.status(403).json({ error: 'Sala por convite. Aguarde um convite do dono.' });
    res.json({ room: { ...room, is_owner: isOwner } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar sala.' }); }
});

module.exports = router;
