-- Patch 02: campos extras de recados (mídia e cor) — idempotente
ALTER TABLE recados ADD COLUMN IF NOT EXISTS media_url  TEXT;
ALTER TABLE recados ADD COLUMN IF NOT EXISTS media_type VARCHAR(10);
ALTER TABLE recados ADD COLUMN IF NOT EXISTS color      VARCHAR(20);
