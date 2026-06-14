-- ============================================================
--  TopChat — Patch 01: alinhar schema com o código
--  Seguro para rodar em banco já existente (tudo idempotente).
--    psql $DATABASE_URL -f sql/patch-01.sql
-- ============================================================

-- 1. A chave 'spam_words' é lida em websocket.js e admin.js, mas não
--    estava nos defaults do schema. Criamos com lista vazia.
INSERT INTO system_config (key, value) VALUES ('spam_words', '[]')
ON CONFLICT (key) DO NOTHING;

-- 2. Índices úteis ausentes (login lista por last_seen; sessões filtram por token/expiração).
CREATE INDEX IF NOT EXISTS idx_users_last_seen   ON users(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires   ON sessions(expires_at);

-- 3. Limpeza de sessões expiradas (o código cria uma sessão a cada login
--    e nunca remove as vencidas — isso faz a tabela crescer sem limite).
--    Rode periodicamente, ou via cron:
--      psql $DATABASE_URL -c "DELETE FROM sessions WHERE expires_at < NOW();"
DELETE FROM sessions WHERE expires_at < NOW();
