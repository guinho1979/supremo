-- Patch 08: permitir mensagens em salas privadas (slug priv_*)
-- A FK messages.room_slug -> rooms(slug) impedia salvar/recuperar histórico
-- de salas privadas. Removida para que o chat privado tenha histórico.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_room_slug_fkey;
