-- Patch 09: reações em mensagens do chat — idempotente
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id BIGINT      REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INTEGER     REFERENCES users(id)    ON DELETE CASCADE,
  emoji      VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);
