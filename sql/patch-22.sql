-- patch-22.sql — adiciona coluna "lema" (frase curta exibida no perfil)
ALTER TABLE users ADD COLUMN IF NOT EXISTS lema VARCHAR(40) DEFAULT '';
