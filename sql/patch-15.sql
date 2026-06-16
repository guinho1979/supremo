-- Patch 15: registrar IP e dispositivo (user-agent) do último acesso de cada usuário.
-- Usado na seção de Moderação do painel admin. Tudo idempotente.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip         VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_user_agent TEXT;
