-- patch-26.sql — Suporte a dispositivo real via User-Agent Client Hints
-- (o Chrome moderno "congela" o User-Agent legado como "Android 10; K"
--  por privacidade — precisamos do device_label enviado pelo cliente,
--  capturado via navigator.userAgentData.getHighEntropyValues())
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS device_label TEXT DEFAULT NULL;
ALTER TABLE users       ADD COLUMN IF NOT EXISTS last_device_label TEXT DEFAULT NULL;
