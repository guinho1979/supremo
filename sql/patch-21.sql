-- patch-21: voto de enquete com nick/IP e dedup por chave.
-- Tudo protegido em DO/EXCEPTION para NUNCA derrubar a migração/deploy.
DO $$
BEGIN
  BEGIN ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS nick      VARCHAR(40) DEFAULT ''; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS voter_ip  TEXT        DEFAULT ''; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS voter_key TEXT        DEFAULT ''; EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    UPDATE poll_votes SET voter_key = 'u' || user_id
    WHERE (voter_key IS NULL OR voter_key = '') AND user_id IS NOT NULL;
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_pkey; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE poll_votes ALTER COLUMN user_id DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END;
  BEGIN CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_voter_uniq ON poll_votes (poll_id, voter_key); EXCEPTION WHEN others THEN NULL; END;
END $$;
