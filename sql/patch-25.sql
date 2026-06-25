-- patch-25.sql — Preferência de receber convites de sala privada
ALTER TABLE users ADD COLUMN IF NOT EXISTS accept_invites BOOLEAN DEFAULT TRUE;
