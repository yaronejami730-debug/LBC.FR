-- Mode d'usage de l'appareil : "user" (par défaut) ou "admin".
-- Un administrateur bascule son application en mode administrateur ; les
-- notifications qu'il reçoit changent alors de nature, appareil par appareil.
ALTER TABLE "ExpoPushToken" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS "ExpoPushToken_mode_disabledAt_idx" ON "ExpoPushToken"("mode", "disabledAt");
