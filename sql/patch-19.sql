-- patch-19: registro de ações de moderação (staff)
CREATE TABLE IF NOT EXISTS mod_actions (
  id          BIGSERIAL    PRIMARY KEY,
  actor_nick  VARCHAR(40)  NOT NULL,
  actor_role  VARCHAR(20)  DEFAULT '',
  action      VARCHAR(30)  NOT NULL,        -- ban | kick | mute | unmute | shadow | delete_msg | delete_file | clear_room
  target_nick VARCHAR(40)  DEFAULT '',
  detail      TEXT         DEFAULT '',       -- ex.: conteúdo apagado, duração do mute, etc.
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mod_actions_created ON mod_actions (created_at DESC);
