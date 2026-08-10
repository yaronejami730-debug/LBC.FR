-- Nom lisible de l'appareil dans « Appareils connectés ».
--
-- La table n'était alimentée par rien : seuls les jetons push mobiles
-- remontaient, et un ordinateur connecté au compte restait invisible. Les
-- sessions sont désormais enregistrées à la connexion, avec un libellé dérivé
-- du User-Agent (« Chrome sur macOS ») — le User-Agent brut n'est pas conservé,
-- seule son empreinte l'est déjà via "uaHash".
ALTER TABLE "DeviceSession" ADD COLUMN IF NOT EXISTS "deviceName" TEXT;
