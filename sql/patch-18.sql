-- Patch 18: as tabelas de enquete (polls/poll_votes) e quiz já são criadas
-- no patch-06. Este patch foi neutralizado para não conflitar com aquele
-- schema (que usa polls.is_active e poll_votes.user_id/option_index).
-- Mantido apenas como marcador — não altera o banco.
SELECT 1;
