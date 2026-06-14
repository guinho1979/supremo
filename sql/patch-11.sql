-- Patch 11: bloqueio de usuários (por usuário) — idempotente
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id   INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  blocked_nick VARCHAR(20) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_nick)
);
