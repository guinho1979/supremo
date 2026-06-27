-- patch-25.sql — Suporte a "Reply" (citação) em mensagens privadas
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS quoted_nick VARCHAR(20) DEFAULT NULL;
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS quoted_text TEXT DEFAULT NULL;
