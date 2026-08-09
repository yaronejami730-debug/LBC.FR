-- Durée de vie des pièces justificatives.
-- Approbation : effacement immédiat. Refus / complément : conservation, puis
-- effacement automatique au bout de 14 mois d'inaction.
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "documentsDeletedAt" TIMESTAMP(3);
