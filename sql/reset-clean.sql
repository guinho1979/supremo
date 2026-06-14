-- ============================================================
--  TopChat — Script de Reset Completo (CORRIGIDO)
--  Limpa todos os dados e mantém apenas o usuário admin.
--
--  Execute com:
--    psql $DATABASE_URL -f sql/reset-clean.sql
--
--  ⚠ ATENÇÃO: Esta ação é irreversível!
--
--  CORREÇÃO: a versão anterior referenciava 6 tabelas que NÃO
--  existem no schema (mod_logs, polls, poll_votes, quizzes,
--  quiz_answers, contacts) e quebrava na primeira linha.
--  Esta versão só toca nas tabelas realmente definidas em
--  schema.sql e re-cria as salas padrão após o reset.
-- ============================================================

-- 1. Desabilitar verificação de FK temporariamente
SET session_replication_role = replica;

-- 2. Limpar todas as tabelas de dados (uma única instrução resolve as FKs)
TRUNCATE TABLE
  messages,
  private_messages,
  sessions,
  online_presence,
  user_fans,
  user_blocks,
  device_credentials,
  login_logs,
  message_reactions,
  recado_reactions,
  recado_comments,
  recado_likes,
  recados,
  poll_votes,
  polls,
  quiz_answers,
  quizzes,
  private_room_invites,
  private_room_members,
  private_rooms,
  radio_config,
  reports,
  bans,
  bingo_cards,
  bingo_games,
  rooms,
  users
RESTART IDENTITY CASCADE;

-- 3. Reabilitar verificação de FK
SET session_replication_role = DEFAULT;

-- 4. Recriar as salas padrão (o TRUNCATE acima as removeu)
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

-- 5. Recriar o usuário admin (nick: admin / senha: admin123)
--    ⚠ TROQUE A SENHA APÓS O PRIMEIRO LOGIN!
INSERT INTO users (nick, password_hash, role, avatar)
VALUES (
  'admin',
  '$2b$12$JW165RUo0R2TWn8I5Q2jCOFmnvpzlNDTuk06r9GF5aLy1YYDaEK8O',
  'admin',
  '👑'
)
ON CONFLICT (nick) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      role          = 'admin',
      avatar        = '👑';

-- 6. Conferir resultado
SELECT id, nick, role, avatar, created_at FROM users;
-- Esperado: apenas 1 linha — o usuário admin.
