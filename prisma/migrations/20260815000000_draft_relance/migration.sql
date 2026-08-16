-- Relances d'abandon de formulaire.
--
-- Deux horodatages portés par le brouillon lui-même : la première relance
-- (~1 h 30 après l'abandon) et la seconde (~4 h après la première). Les
-- remettre à NULL quand le vendeur reprend sa saisie suffit à réarmer le
-- cycle, sans avoir à interroger l'historique des emails.
ALTER TABLE "Draft" ADD COLUMN "nudge1SentAt" TIMESTAMP(3);
ALTER TABLE "Draft" ADD COLUMN "nudge2SentAt" TIMESTAMP(3);

CREATE INDEX "Draft_nudge1SentAt_idx" ON "Draft"("nudge1SentAt");
