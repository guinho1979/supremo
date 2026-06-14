-- Patch 13: fãs (seguidores) de usuários
CREATE TABLE IF NOT EXISTS user_fans (
  fan_id      INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  target_nick VARCHAR(20) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (fan_id, target_nick)
);
CREATE INDEX IF NOT EXISTS idx_userfans_target ON user_fans(target_nick);
