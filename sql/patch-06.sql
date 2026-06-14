-- Patch 06: enquetes (polls) e quizzes — idempotente
CREATE TABLE IF NOT EXISTS polls (
  id         BIGSERIAL   PRIMARY KEY,
  room_slug  VARCHAR(50) NOT NULL,
  question   TEXT        NOT NULL,
  options    JSONB       NOT NULL,            -- ["op1","op2",...]
  created_by VARCHAR(20) NOT NULL,
  is_active  BOOLEAN     DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id      BIGINT  REFERENCES polls(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);
CREATE TABLE IF NOT EXISTS quizzes (
  id            BIGSERIAL   PRIMARY KEY,
  room_slug     VARCHAR(50) NOT NULL,
  question      TEXT        NOT NULL,
  options       JSONB       NOT NULL,
  correct_index INTEGER     NOT NULL,
  created_by    VARCHAR(20) NOT NULL,
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  closed_at     TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS quiz_answers (
  quiz_id      BIGINT      REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id      INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  nick         VARCHAR(20) NOT NULL,
  option_index INTEGER     NOT NULL,
  is_correct   BOOLEAN     DEFAULT FALSE,
  answered_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quiz_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_polls_room   ON polls(room_slug, is_active);
CREATE INDEX IF NOT EXISTS idx_quizzes_room ON quizzes(room_slug, is_active);
