-- patch-24.sql — Novos campos de perfil (capa, tema, humor, redes sociais)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme             VARCHAR(80)  DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mood              VARCHAR(80)  DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_instagram  VARCHAR(80)  DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_tiktok     VARCHAR(80)  DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_twitter    VARCHAR(80)  DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_youtube    VARCHAR(120) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_facebook   VARCHAR(120) DEFAULT '';
