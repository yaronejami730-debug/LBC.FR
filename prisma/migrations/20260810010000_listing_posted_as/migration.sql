-- Casquette de publication et adresse précise.
--
-- Un compte converti du particulier au professionnel publie tantôt en son nom,
-- tantôt au nom de son établissement. Les deux n'obéissent pas aux mêmes
-- règles d'affichage : l'adresse complète n'est admise que côté professionnel.
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "postedAs" TEXT NOT NULL DEFAULT 'PARTICULIER';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "addressLine" TEXT;

-- Les annonces existantes des comptes professionnels vérifiés sont, par
-- construction, des annonces professionnelles.
UPDATE "Listing" l
SET "postedAs" = 'PRO'
FROM "User" u
WHERE l."userId" = u."id"
  AND u."isPro" = true
  AND l."postedAs" = 'PARTICULIER';

CREATE INDEX IF NOT EXISTS "Listing_postedAs_idx" ON "Listing"("postedAs");
