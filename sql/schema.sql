-- ============================================================
--  TopChat — Schema PostgreSQL completo
--  Execute este arquivo no seu banco antes de iniciar o server
-- ============================================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  nick          VARCHAR(20)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'user',  -- user | vip | premium | dj | mod | supervisor | admin
  avatar        VARCHAR(10)  DEFAULT '😊',
  photo_url     TEXT         DEFAULT '',
  nick_color    VARCHAR(20)  DEFAULT '#e2e0f0',
  msg_color     VARCHAR(20)  DEFAULT '#0a1628',
  nick_gradient TEXT         DEFAULT '',               -- JSON string
  status        VARCHAR(20)  DEFAULT 'online',         -- online | away | busy | invisible
  birthday      DATE,
  is_banned     BOOLEAN      DEFAULT FALSE,
  ban_reason    TEXT         DEFAULT '',
  ban_expires   TIMESTAMPTZ,                           -- NULL = banimento permanente
  ip_banned     TEXT[]       DEFAULT '{}',
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  last_seen     TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  SESSIONS (tokens de autenticação)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT         NOT NULL UNIQUE,
  user_type  VARCHAR(20)  DEFAULT 'registered',   -- registered | guest
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  expires_at TIMESTAMPTZ  DEFAULT NOW() + INTERVAL '7 days'
);

-- ─────────────────────────────────────────────────────────────
--  ROOMS (salas de chat)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id           SERIAL PRIMARY KEY,
  slug         VARCHAR(40)  NOT NULL UNIQUE,  -- ex: 'geral', 'esportes'
  name         VARCHAR(80)  NOT NULL,
  description  TEXT         DEFAULT '',
  icon         VARCHAR(10)  DEFAULT '💬',
  category     VARCHAR(40)  DEFAULT 'geral',
  is_private   BOOLEAN      DEFAULT FALSE,
  is_active    BOOLEAN      DEFAULT TRUE,
  min_role     VARCHAR(20)  DEFAULT 'guest',  -- role mínimo para entrar
  max_users    INTEGER      DEFAULT 200,
  sort_order   INTEGER      DEFAULT 0,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  MESSAGES (mensagens do chat — auto-delete 10 min via job)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL    PRIMARY KEY,
  room_slug   VARCHAR(40)  NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
  user_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  nick        VARCHAR(20)  NOT NULL,          -- desnormalizado para histórico
  role        VARCHAR(20)  DEFAULT 'user',
  content     TEXT         NOT NULL,
  msg_type    VARCHAR(20)  DEFAULT 'text',    -- text | image | audio | video | gif | sticker | system
  media_url   TEXT         DEFAULT '',
  reply_to    BIGINT       REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted  BOOLEAN      DEFAULT FALSE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Index para busca rápida por sala e tempo
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_slug, created_at DESC);

-- ─────────────────────────────────────────────────────────────
--  PRIVATE MESSAGES (mensagens privadas / DM)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private_messages (
  id           BIGSERIAL   PRIMARY KEY,
  from_user_id INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  to_user_id   INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  from_nick    VARCHAR(20) NOT NULL,
  to_nick      VARCHAR(20) NOT NULL,
  content      TEXT        NOT NULL,
  msg_type     VARCHAR(20) DEFAULT 'text',
  media_url    TEXT        DEFAULT '',
  is_read      BOOLEAN     DEFAULT FALSE,
  is_deleted   BOOLEAN     DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_to_user ON private_messages(to_user_id, is_read);

-- ─────────────────────────────────────────────────────────────
--  RECADOS (mural público)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recados (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  nick        VARCHAR(20) NOT NULL,
  role        VARCHAR(20) DEFAULT 'user',
  avatar      VARCHAR(10) DEFAULT '😊',
  content     TEXT        NOT NULL,
  likes       INTEGER     DEFAULT 0,
  is_pinned   BOOLEAN     DEFAULT FALSE,
  is_deleted  BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  RECADO LIKES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recado_likes (
  recado_id   BIGINT      REFERENCES recados(id) ON DELETE CASCADE,
  user_id     INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (recado_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
--  REPORTS (denúncias)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id            BIGSERIAL   PRIMARY KEY,
  reporter_nick VARCHAR(20) NOT NULL,
  reported_nick VARCHAR(20) NOT NULL,
  room_slug     VARCHAR(40),
  reason        TEXT        NOT NULL,
  status        VARCHAR(20) DEFAULT 'pendente',   -- pendente | resolvido | ignorado
  resolved_by   VARCHAR(20),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
--  BANS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bans (
  id           SERIAL      PRIMARY KEY,
  nick         VARCHAR(20) NOT NULL,
  user_id      INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  banned_by    VARCHAR(20) NOT NULL,
  reason       TEXT        DEFAULT '',
  ban_type     VARCHAR(20) DEFAULT 'permanent',  -- permanent | temporary
  expires_at   TIMESTAMPTZ,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  SYSTEM CONFIG (configurações do admin)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  key    VARCHAR(80) PRIMARY KEY,
  value  TEXT        NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valores padrão
INSERT INTO system_config (key, value) VALUES
  ('register_blocked', 'false'),
  ('guest_blocked',    'false'),
  ('notice_warn',      ''),
  ('notice_danger',    ''),
  ('maintenance',      'false'),
  ('logo_url',         '')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
--  BINGO GAMES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bingo_games (
  id          SERIAL      PRIMARY KEY,
  room_slug   VARCHAR(40) NOT NULL,
  host_nick   VARCHAR(20) NOT NULL,
  status      VARCHAR(20) DEFAULT 'waiting',   -- waiting | running | finished
  drawn_nums  INTEGER[]   DEFAULT '{}',
  winner_nick VARCHAR(20),
  prize       TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bingo_cards (
  id          SERIAL      PRIMARY KEY,
  game_id     INTEGER     REFERENCES bingo_games(id) ON DELETE CASCADE,
  user_id     INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  nick        VARCHAR(20) NOT NULL,
  card        INTEGER[]   NOT NULL,             -- 25 números
  marked      BOOLEAN[]   DEFAULT ARRAY_FILL(false, ARRAY[25]),
  has_bingo   BOOLEAN     DEFAULT FALSE
);

-- ─────────────────────────────────────────────────────────────
--  ONLINE PRESENCE (usuários atualmente online)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS online_presence (
  user_id    INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nick       VARCHAR(20) NOT NULL,
  room_slug  VARCHAR(40),
  socket_id  TEXT,
  last_ping  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  SALAS PADRÃO
-- ─────────────────────────────────────────────────────────────
INSERT INTO rooms (slug, name, description, icon, category, sort_order) VALUES
  ('geral',     'Geral',          'Sala principal para todos',           '💬', 'geral',    1),
  ('esportes',  'Esportes',       'Futebol, MMA e todos os esportes',    '⚽', 'esportes', 2),
  ('musica',    'Música',         'Para os amantes da boa música',       '🎵', 'cultura',  3),
  ('jogos',     'Jogos',          'Games, RPG e diversão',               '🎮', 'games',    4),
  ('filmes',    'Filmes & Séries','Cinema, Netflix e indicações',        '🎬', 'cultura',  5),
  ('tecnologia','Tecnologia',     'Tech, programação e gadgets',         '💻', 'tech',     6),
  ('vip',       'VIP Lounge',     'Exclusivo para VIP e Premium',        '⭐', 'especial', 7),
  ('admin',     'Staff',          'Sala da equipe de moderação',         '🛡', 'staff',    8)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
--  ADMIN PADRÃO
--  Nick: admin | Senha: admin123
--  Hash bcrypt rounds=12 gerado para a senha "admin123"
-- ─────────────────────────────────────────────────────────────
INSERT INTO users (nick, password_hash, role, avatar) VALUES
  ('admin', '$2b$12$JW165RUo0R2TWn8I5Q2jCOFmnvpzlNDTuk06r9GF5aLy1YYDaEK8O', 'admin', '👑')
ON CONFLICT (nick) DO UPDATE
  SET password_hash = '$2b$12$JW165RUo0R2TWn8I5Q2jCOFmnvpzlNDTuk06r9GF5aLy1YYDaEK8O',
      role = 'admin',
      avatar = '👑';
