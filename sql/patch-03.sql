-- Patch 03: reações (multi-emoji) e comentários de recados — idempotente
CREATE TABLE IF NOT EXISTS recado_reactions (
  recado_id  BIGINT      REFERENCES recados(id) ON DELETE CASCADE,
  user_id    INTEGER     REFERENCES users(id)   ON DELETE CASCADE,
  nick       VARCHAR(20) NOT NULL,
  emoji      VARCHAR(8)  NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (recado_id, user_id)
);

CREATE TABLE IF NOT EXISTS recado_comments (
  id         BIGSERIAL   PRIMARY KEY,
  recado_id  BIGINT      REFERENCES recados(id) ON DELETE CASCADE,
  user_id    INTEGER     REFERENCES users(id)   ON DELETE SET NULL,
  nick       VARCHAR(20) NOT NULL,
  role       VARCHAR(20) DEFAULT 'user',
  avatar     VARCHAR(10) DEFAULT '😊',
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recado_comments ON recado_comments(recado_id, created_at);
