-- Patch 07: rádio/DJ por sala — idempotente
CREATE TABLE IF NOT EXISTS radio_config (
  room_slug  VARCHAR(50)  PRIMARY KEY,
  is_live    BOOLEAN      DEFAULT FALSE,
  stream_url TEXT         DEFAULT '',
  title      TEXT         DEFAULT '',
  dj_nick    VARCHAR(20)  DEFAULT '',
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);
