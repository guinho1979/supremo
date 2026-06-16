-- Patch 17: mensagens de Contato / Reclamação enviadas pelos usuários no chat.
-- Aparecem na seção Contatos do painel admin. Idempotente.

CREATE TABLE IF NOT EXISTS contacts (
  id          SERIAL       PRIMARY KEY,
  user_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  nick        VARCHAR(40),
  type        VARCHAR(30)  DEFAULT 'contato',
  message     TEXT         NOT NULL,
  status      VARCHAR(20)  DEFAULT 'novo',
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC);
