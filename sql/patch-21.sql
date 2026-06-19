-- patch-21: permitir voto de visitante (1 por IP) e guardar quem votou
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS nick      VARCHAR(40) DEFAULT '';
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS voter_ip  TEXT        DEFAULT '';
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS voter_key TEXT        DEFAULT '';

-- preenche a chave dos votos já existentes (usuários registrados)
UPDATE poll_votes SET voter_key = 'u' || user_id WHERE (voter_key IS NULL OR voter_key = '') AND user_id IS NOT NULL;

-- troca a PK (poll_id,user_id) por um índice único em (poll_id,voter_key),
-- assim registrados são únicos por conta e visitantes por IP
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_pkey;
ALTER TABLE poll_votes ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_voter_uniq ON poll_votes (poll_id, voter_key);
