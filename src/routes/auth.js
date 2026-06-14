// src/routes/auth.js — Login, Cadastro, Visitante, Logout
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const ws = require('../websocket');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

async function logLogin(req, nick, kind) {
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
    await db.query('INSERT INTO login_logs (nick, kind, ip, user_agent) VALUES ($1,$2,$3,$4)',
      [nick, kind, ip, req.headers['user-agent'] || '']);
  } catch (e) { /* não bloqueia login */ }
}
const SALT_ROUNDS = 12;

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { nick, password, birthday } = req.body;

    // Validações
    if (!nick || !password)
      return res.status(400).json({ error: 'Nick e senha são obrigatórios.' });
    if (nick.length < 3 || nick.length > 20)
      return res.status(400).json({ error: 'Nick deve ter entre 3 e 20 caracteres.' });
    if (!/^[a-zA-Z0-9_]+$/.test(nick))
      return res.status(400).json({ error: 'Nick: apenas letras, números e _.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Senha mínimo 6 caracteres.' });

    // Checar se o sistema permite cadastro
    const { rows: cfg } = await db.query(
      "SELECT value FROM system_config WHERE key = 'register_blocked'"
    );
    if (cfg[0]?.value === 'true')
      return res.status(403).json({ error: 'Cadastro está fechado pelo administrador.' });

    // Nick já existe?
    const { rows: exists } = await db.query(
      'SELECT id FROM users WHERE LOWER(nick) = LOWER($1)', [nick]
    );
    if (exists.length)
      return res.status(409).json({ error: 'Este nick já está em uso.' });

    if (ws.isNickOnline(nick))
      return res.status(409).json({ error: 'Esse apelido está sendo usado por alguém online agora.' });

    // Hash da senha
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Criar usuário
    const { rows: [user] } = await db.query(
      `INSERT INTO users (nick, password_hash, birthday)
       VALUES ($1, $2, $3)
       RETURNING id, nick, role, avatar`,
      [nick, hash, birthday || null]
    );

    // Gerar JWT
    const jwt_token = jwt.sign(
      { userId: user.id, nick: user.nick, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Criar sessão usando o próprio JWT como token (middleware valida via sessions)
    await db.query(
      `INSERT INTO sessions (user_id, token, user_type, ip_address)
       VALUES ($1, $2, 'registered', $3)`,
      [user.id, jwt_token, req.ip]
    );
    await logLogin(req, user.nick, 'registered');

    res.status(201).json({
      token: jwt_token,
      user: { id: user.id, nick: user.nick, role: user.role, avatar: user.avatar }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { nick, password } = req.body;

    if (!nick || !password)
      return res.status(400).json({ error: 'Preencha nick e senha.' });

    // Checar sistema
    const { rows: cfg } = await db.query(
      "SELECT value FROM system_config WHERE key = 'maintenance'"
    );
    if (cfg[0]?.value === 'true')
      return res.status(503).json({ error: 'Site em manutenção. Tente mais tarde.' });

    // Buscar usuário
    const { rows } = await db.query(
      `SELECT id, nick, role, password_hash, is_banned, ban_reason,
              ban_expires, avatar, photo_url, nick_color, msg_color,
              nick_gradient, status
       FROM users WHERE LOWER(nick) = LOWER($1)`,
      [nick]
    );

    if (!rows.length)
      return res.status(401).json({ error: 'Nick ou senha incorretos.' });

    const user = rows[0];

    // Verificar ban
    if (user.is_banned) {
      if (!user.ban_expires || new Date(user.ban_expires) > new Date()) {
        // Retorna 200 mas sem dados (para não revelar que o nick existe)
        return res.status(200).json({ banned: true });
      }
      // Ban expirou — desbanir automaticamente
      await db.query('UPDATE users SET is_banned = FALSE WHERE id = $1', [user.id]);
    }

    // Verificar senha
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Nick ou senha incorretos.' });

    // Atualizar last_seen
    await db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    // JWT
    const jwt_token = jwt.sign(
      { userId: user.id, nick: user.nick, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Criar sessão usando o próprio JWT como token (middleware valida via sessions)
    await db.query(
      `INSERT INTO sessions (user_id, token, user_type, ip_address, user_agent)
       VALUES ($1, $2, 'registered', $3, $4)`,
      [user.id, jwt_token, req.ip, req.headers['user-agent'] || '']
    );
    await logLogin(req, user.nick, 'registered');

    res.json({
      token: jwt_token,
      user: {
        id:           user.id,
        nick:         user.nick,
        role:         user.role,
        avatar:       user.avatar,
        photo_url:    user.photo_url,
        nick_color:   user.nick_color,
        msg_color:    user.msg_color,
        nick_gradient: user.nick_gradient,
        status:       user.status,
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

// ─── POST /api/auth/guest ─────────────────────────────────────
router.post('/guest', async (req, res) => {
  try {
    const { nick } = req.body;

    if (!nick || nick.length < 2 || nick.length > 20)
      return res.status(400).json({ error: 'Nick deve ter entre 2 e 20 caracteres.' });
    if (!/^[a-zA-Z0-9_]+$/.test(nick))
      return res.status(400).json({ error: 'Nick: apenas letras, números e _.' });

    // Checar se visitantes estão bloqueados
    const { rows: cfg } = await db.query(
      "SELECT value FROM system_config WHERE key = 'guest_blocked'"
    );
    if (cfg[0]?.value === 'true')
      return res.status(403).json({ error: 'Entrada de visitantes está fechada.' });

    // Nick em uso por usuário registrado?
    const { rows: taken } = await db.query(
      'SELECT id FROM users WHERE LOWER(nick) = LOWER($1)', [nick]
    );
    if (taken.length)
      return res.status(409).json({ error: 'Este nick pertence a um usuário cadastrado.' });

    if (ws.isNickOnline(nick))
      return res.status(409).json({ error: 'Esse apelido já está conectado agora. Escolha outro.' });

    // id rotativo do visitante (muda a cada entrada)
    const guestId = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const jwt_token = jwt.sign(
      { userId: null, guestId, nick, role: 'guest', type: 'guest' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    await logLogin(req, nick, 'guest');

    res.json({
      token: jwt_token,
      user: { id: guestId, nick, role: 'guest', avatar: '👤', type: 'guest' }
    });

  } catch (err) {
    console.error('Guest error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM sessions WHERE token = $1', [req.token]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao sair.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (!req.user.user_id) return res.json({ user: req.user });
    const { rows: [u] } = await db.query(
      `SELECT id, nick, role, avatar, photo_url, nick_color, msg_color, nick_gradient,
              status, birthday, bio, city, age, gender, job, interests,
              nick_emoji, nick_effect, profile_audio, profile_audio_name
       FROM users WHERE id = $1`, [req.user.user_id]);
    res.json({ user: { ...req.user, ...(u || {}) } });
  } catch (err) {
    res.json({ user: req.user });
  }
});


// ─── PATCH /api/auth/me ───────────────────────────────────────
// Atualiza foto de perfil, avatar emoji, cores e status do usuário
router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (!userId) return res.status(403).json({ error: 'Visitantes não podem atualizar perfil.' });

    const b = req.body;
    if (b.photo_url && b.photo_url.length > 3 * 1024 * 1024)
      return res.status(400).json({ error: 'Foto muito grande. Máximo 2MB.' });
    if (b.profile_audio && b.profile_audio.length > 8 * 1024 * 1024)
      return res.status(400).json({ error: 'Áudio muito grande (máx ~6MB).' });

    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['photo_url','avatar','nick_color','msg_color','status','nick_gradient',
                     'bio','city','age','gender','job','interests','nick_emoji','nick_effect',
                     'profile_audio','profile_audio_name'];
    for (const key of allowed) {
      if (b[key] !== undefined) { fields.push(`${key} = $${i++}`); values.push(b[key]); }
    }
    if (b.birthday !== undefined) { fields.push(`birthday = $${i++}`); values.push(b.birthday || null); }

    if (b.nick !== undefined) {
      const newNick = String(b.nick).trim();
      if (newNick && newNick !== req.user.nick) {
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(newNick))
          return res.status(400).json({ error: 'Nick inválido (3–20, letras/números/_).' });
        const { rows: taken } = await db.query('SELECT 1 FROM users WHERE LOWER(nick)=LOWER($1) AND id<>$2', [newNick, userId]);
        if (taken.length) return res.status(409).json({ error: 'Esse nick já está em uso.' });
        fields.push(`nick = $${i++}`); values.push(newNick);
      }
    }

    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });

    values.push(userId);
    await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`,
      values
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /me error:', err);
    res.status(500).json({ error: 'Erro ao salvar perfil.' });
  }
});

// ─── PATCH /api/auth/password ─────────────────────────────────
router.patch('/password', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (!userId) return res.status(403).json({ error: 'Visitantes não têm senha.' });
    const current = req.body.current || '';
    const novo = req.body.new_password || '';
    if (novo.length < 6) return res.status(400).json({ error: 'Nova senha: mínimo 6 caracteres.' });
    const { rows: [u] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const ok = await bcrypt.compare(current, u.password_hash);
    if (!ok) return res.status(403).json({ error: 'Senha atual incorreta.' });
    const hash = await bcrypt.hash(novo, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /password error:', err);
    res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
});

// ─── Face ID / biometria (segredo de dispositivo) ────────────
// Cadastra um segredo de dispositivo para o usuário logado (protegido no app pela biometria)
router.post('/faceid/enroll', authMiddleware, async (req, res) => {
  if (!req.user.user_id) return res.status(403).json({ error: 'Visitantes não têm Face ID.' });
  const secret = req.body.secret || '';
  if (secret.length < 16) return res.status(400).json({ error: 'Segredo inválido.' });
  try {
    const hash = await bcrypt.hash(secret, 12);
    await db.query('INSERT INTO device_credentials (user_id, secret_hash) VALUES ($1, $2)', [req.user.user_id, hash]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao cadastrar Face ID.' }); }
});

// Login por Face ID: valida o segredo do dispositivo e emite um token novo
router.post('/faceid/login', async (req, res) => {
  const nick = (req.body.nick || '').trim();
  const secret = req.body.secret || '';
  if (!nick || !secret) return res.status(400).json({ error: 'Dados incompletos.' });
  try {
    const { rows: [user] } = await db.query('SELECT * FROM users WHERE LOWER(nick) = LOWER($1)', [nick]);
    if (!user) return res.status(401).json({ error: 'Conta não encontrada.' });
    if (user.is_banned) return res.status(403).json({ error: 'Esta conta está banida.' });
    const { rows: creds } = await db.query('SELECT secret_hash FROM device_credentials WHERE user_id = $1', [user.id]);
    let match = false;
    for (const c of creds) { if (await bcrypt.compare(secret, c.secret_hash)) { match = true; break; } }
    if (!match) return res.status(401).json({ error: 'Face ID não reconhecido neste dispositivo.' });

    const jwt_token = jwt.sign(
      { userId: user.id, nick: user.nick, role: user.role, type: 'registered' },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    await db.query(
      `INSERT INTO sessions (user_id, token, user_type, ip_address, user_agent)
       VALUES ($1, $2, 'registered', $3, $4)`,
      [user.id, jwt_token, req.ip, req.headers['user-agent'] || '']
    );
    await db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);
    await logLogin(req, user.nick, 'registered');
    res.json({
      token: jwt_token,
      user: { id: user.id, nick: user.nick, role: user.role, avatar: user.avatar, photo_url: user.photo_url,
              nick_color: user.nick_color, msg_color: user.msg_color, status: user.status, type: 'registered' }
    });
  } catch (err) { console.error('faceid/login error:', err); res.status(500).json({ error: 'Erro no Face ID.' }); }
});

module.exports = router;
