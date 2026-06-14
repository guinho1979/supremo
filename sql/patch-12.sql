-- Patch 12: credenciais de dispositivo (login biométrico / Face ID)
CREATE TABLE IF NOT EXISTS device_credentials (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  secret_hash TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devcred_user ON device_credentials(user_id);
