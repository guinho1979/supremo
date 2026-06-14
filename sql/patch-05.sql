-- Patch 05: salas privadas + membros + convites — idempotente
CREATE TABLE IF NOT EXISTS private_rooms (
  id          BIGSERIAL    PRIMARY KEY,
  slug        VARCHAR(50)  UNIQUE NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  icon        VARCHAR(10)  DEFAULT '🔒',
  description TEXT         DEFAULT '',
  color       VARCHAR(20)  DEFAULT '#7c3aed',
  max_users   INTEGER      DEFAULT 10,
  password    TEXT         DEFAULT '',
  owner_id    INTEGER      REFERENCES users(id) ON DELETE CASCADE,
  owner_nick  VARCHAR(20)  NOT NULL,
  is_active   BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS private_room_members (
  room_id   BIGINT      REFERENCES private_rooms(id) ON DELETE CASCADE,
  user_id   INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  nick      VARCHAR(20) NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS private_room_invites (
  id         BIGSERIAL   PRIMARY KEY,
  room_id    BIGINT      REFERENCES private_rooms(id) ON DELETE CASCADE,
  from_nick  VARCHAR(20) NOT NULL,
  to_user_id INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  to_nick    VARCHAR(20) NOT NULL,
  status     VARCHAR(12) DEFAULT 'pending',   -- pending | accepted | declined
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pri_invites_to ON private_room_invites(to_user_id, status);
