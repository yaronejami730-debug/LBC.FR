-- Source externe : ajoute le domaine et le slug d'agence pour le scoping du scraper.
-- Le scraper ne crawle QUE le slug spécifié, jamais tout le domaine.
ALTER TABLE "ExternalSource" ADD COLUMN "domain" TEXT;
ALTER TABLE "ExternalSource" ADD COLUMN "agencySlug" TEXT;

CREATE INDEX "ExternalSource_domain_agencySlug_idx" ON "ExternalSource"("domain", "agencySlug");
