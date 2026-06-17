-- Patch 18: Enquetes (polls) em tempo real, compartilhadas entre todos.
-- A enquete aparece como card dentro do chat; votos contados no servidor.

CREATE TABLE IF NOT EXISTS polls (
  id          SERIAL       PRIMARY KEY,
  question    TEXT         NOT NULL,
  options     JSONB        NOT NULL,          -- ["Opção 1","Opção 2",...]
  created_by  VARCHAR(40),
  active      BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id     INTEGER      NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  voter       VARCHAR(40)  NOT NULL,
  option_idx  INTEGER      NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  PRIMARY KEY (poll_id, voter)
);

CREATE INDEX IF NOT EXISTS idx_polls_active ON polls(active) WHERE active = TRUE;
