-- Patch 16: ban por IP — garante a coluna ip_address na tabela bans
-- e cria índice para checagem rápida no login. Idempotente.

ALTER TABLE bans ADD COLUMN IF NOT EXISTS ip_address TEXT;
CREATE INDEX IF NOT EXISTS idx_bans_ip ON bans(ip_address) WHERE ip_address IS NOT NULL;
