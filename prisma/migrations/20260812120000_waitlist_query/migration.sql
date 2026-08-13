-- Demande exprimée en toutes lettres sur une inscription à l'alerte.
--
-- Migration additive : une colonne nullable et son index. Aucune ligne
-- existante n'est lue ni modifiée, aucune contrainte n'est resserrée.
-- `IF NOT EXISTS` partout, donc rejouable sans effet.

ALTER TABLE "Waitlist" ADD COLUMN IF NOT EXISTS "query" TEXT;

CREATE INDEX IF NOT EXISTS "Waitlist_query_idx" ON "Waitlist"("query");
