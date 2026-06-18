-- patch-20: pedidos de música ao DJ
CREATE TABLE IF NOT EXISTS dj_requests (
  id          BIGSERIAL    PRIMARY KEY,
  nick        VARCHAR(40)  NOT NULL,
  song        VARCHAR(120) NOT NULL,
  artist      VARCHAR(120) DEFAULT '',
  dedica      VARCHAR(60)  DEFAULT '',
  status      VARCHAR(12)  DEFAULT 'fila',   -- fila | tocado
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dj_requests_created ON dj_requests (created_at DESC);
