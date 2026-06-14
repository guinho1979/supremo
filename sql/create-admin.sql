-- ============================================================
--  TopChat — Criar acesso Admin
--  Nick:  admin
--  Senha: admin123
--
--  Execute no banco após o schema.sql:
--    psql $DATABASE_URL -f sql/create-admin.sql
--
--  ⚠ TROQUE A SENHA APÓS O PRIMEIRO LOGIN!
-- ============================================================

INSERT INTO users (nick, password_hash, role, avatar)
VALUES (
  'admin',
  '$2b$12$JW165RUo0R2TWn8I5Q2jCOFmnvpzlNDTuk06r9GF5aLy1YYDaEK8O',
  'admin',
  '👑'
)
ON CONFLICT (nick) DO UPDATE
  SET password_hash = '$2b$12$JW165RUo0R2TWn8I5Q2jCOFmnvpzlNDTuk06r9GF5aLy1YYDaEK8O',
      role          = 'admin',
      avatar        = '👑';

SELECT id, nick, role, avatar, created_at FROM users WHERE nick = 'admin';
