-- patch-23.sql — Status estilo WhatsApp (expira em 24h)
CREATE TABLE IF NOT EXISTS statuses (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     INTEGER      REFERENCES users(id) ON DELETE CASCADE,
  nick        VARCHAR(20)  NOT NULL,
  role        VARCHAR(20)  DEFAULT 'user',
  avatar      VARCHAR(10)  DEFAULT '😊',
  photo_url   TEXT,
  content     TEXT         DEFAULT '',
  media_url   TEXT,                       -- imagem/vídeo em data URL (base64) ou link
  media_type  VARCHAR(20),                -- 'image' | 'video' | null (texto)
  bg          VARCHAR(160),               -- fundo (cor/gradiente CSS) para status de texto
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  expires_at  TIMESTAMPTZ  DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_statuses_expires ON statuses (expires_at);
CREATE INDEX IF NOT EXISTS idx_statuses_user    ON statuses (user_id);
