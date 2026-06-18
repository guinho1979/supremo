// Registro de ações de moderação (staff) — usado por admin.js, chat.js e websocket.js
const db = require('./db');

async function logAction(a) {
  try {
    await db.query(
      `INSERT INTO mod_actions (actor_nick, actor_role, action, target_nick, detail)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        (a.actor_nick || '').toString().slice(0, 40),
        (a.actor_role || '').toString().slice(0, 20),
        (a.action || '').toString().slice(0, 30),
        (a.target_nick || '').toString().slice(0, 40),
        (a.detail || '').toString().slice(0, 500)
      ]
    );
  } catch (e) { /* tabela pode não existir em deploy antigo — ignora */ }
}

module.exports = { logAction };
