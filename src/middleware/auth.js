// src/middleware/auth.js — Verificação de token JWT
const jwt = require('jsonwebtoken');
const db  = require('../db');

// Verifica o token e injeta req.user
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Tokens de convidado: validar apenas via JWT, sem consultar o banco
    if (payload.type === 'guest') {
      req.user  = { id: payload.guestId || null, guest_id: payload.guestId || null, nick: payload.nick, role: payload.role, type: 'guest' };
      req.token = token;
      return next();
    }

    // Usuários registrados: confere se o token ainda existe no banco (logout invalida)
    const { rows } = await db.query(
      `SELECT s.id, u.id as user_id, u.nick, u.role, u.is_banned, u.avatar, u.photo_url,
              u.nick_color, u.msg_color, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    const user = rows[0];

    if (user.is_banned) {
      return res.status(403).json({ error: 'Sua conta está banida.' });
    }

    req.user  = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido.' });
  }
}

// Garante que o usuário tem role mínimo
function requireRole(...roles) {
  return (req, res, next) => {
    const ORDER = ['guest','user','dj','vip','premium','mod','supervisor','admin'];
    const userLevel = ORDER.indexOf(req.user?.role);
    const minLevel  = Math.min(...roles.map(r => ORDER.indexOf(r)));

    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
