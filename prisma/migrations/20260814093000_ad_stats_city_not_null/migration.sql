-- `citySlug` non nul, avec la chaîne vide pour « commune inconnue ».
--
-- Deux NULL sont distincts dans un index unique PostgreSQL : le quadruplet
-- (jour, campagne, emplacement, ville inconnue) aurait pu se dupliquer, et le
-- cumul aurait été faux.
DROP INDEX IF EXISTS "AdStatDaily_key";

UPDATE "AdStatDaily" SET "citySlug" = '' WHERE "citySlug" IS NULL;
ALTER TABLE "AdStatDaily" ALTER COLUMN "citySlug" SET DEFAULT '';
ALTER TABLE "AdStatDaily" ALTER COLUMN "citySlug" SET NOT NULL;

CREATE UNIQUE INDEX "AdStatDaily_day_campaignId_placement_citySlug_key"
    ON "AdStatDaily"("day", "campaignId", "placement", "citySlug");
