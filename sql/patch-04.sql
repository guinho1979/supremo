-- Patch 04: campos estendidos de perfil — idempotente
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio                TEXT        DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS city               VARCHAR(60) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS age                VARCHAR(10) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender             VARCHAR(20) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS job                VARCHAR(60) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests          TEXT        DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS nick_emoji         VARCHAR(16) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS nick_effect        VARCHAR(20) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_audio      TEXT        DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_audio_name VARCHAR(120) DEFAULT '';
