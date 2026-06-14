-- Patch 14: silenciar (mute), shadowban e denúncias
ALTER TABLE users ADD COLUMN IF NOT EXISTS muted_until   TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS shadow_banned BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS reports (
  id            BIGSERIAL   PRIMARY KEY,
  reporter_nick VARCHAR(20),
  target_nick   VARCHAR(20) NOT NULL,
  reason        TEXT        DEFAULT '',
  resolved      BOOLEAN     DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_open ON reports(resolved, created_at DESC);
