-- Patch 14: silenciar (mute), shadowban e denúncias
-- Corrigido: compatibiliza a tabela "reports" exista ela como o schema.sql
-- a criou ou não. Tudo idempotente (seguro para rodar várias vezes).

ALTER TABLE users ADD COLUMN IF NOT EXISTS muted_until   TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS shadow_banned BOOLEAN DEFAULT FALSE;

-- Cria a tabela só se ainda não existir (sem NOT NULL para não conflitar).
CREATE TABLE IF NOT EXISTS reports (
  id            BIGSERIAL   PRIMARY KEY,
  reporter_nick VARCHAR(20),
  target_nick   VARCHAR(20),
  reason        TEXT        DEFAULT '',
  resolved      BOOLEAN     DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Garante as colunas que o código usa, mesmo se a tabela já existia
-- com o formato antigo do schema.sql.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_nick VARCHAR(20);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved    BOOLEAN DEFAULT FALSE;

-- Se a tabela antiga tinha "reported_nick NOT NULL", relaxa essa regra
-- (o código insere "target_nick", não "reported_nick"), senão a denúncia falha.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'reported_nick'
  ) THEN
    ALTER TABLE reports ALTER COLUMN reported_nick DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_open ON reports(resolved, created_at DESC);
