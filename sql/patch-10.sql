-- Patch 10: log de acessos (login/register/guest) com IP
CREATE TABLE IF NOT EXISTS login_logs (
  id         BIGSERIAL   PRIMARY KEY,
  nick       VARCHAR(20) NOT NULL,
  kind       VARCHAR(12) NOT NULL,   -- registered | guest
  ip         TEXT        DEFAULT '',
  user_agent TEXT        DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_logs_time ON login_logs(created_at DESC);
