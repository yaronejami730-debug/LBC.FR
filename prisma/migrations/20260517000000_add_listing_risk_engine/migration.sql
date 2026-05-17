-- Risk engine : empreinte SimHash + bandes LSH + score de risque sur les annonces.
ALTER TABLE "Listing" ADD COLUMN "simhash" TEXT;
ALTER TABLE "Listing" ADD COLUMN "lshBand0" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "lshBand1" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "lshBand2" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "lshBand3" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN "riskDecision" TEXT;

-- Index LSH : une nouvelle annonce ne compare ses candidats qu'aux annonces
-- partageant au moins une bande (lookup O(1) au lieu de O(n) paires).
CREATE INDEX "Listing_lshBand0_idx" ON "Listing"("lshBand0");
CREATE INDEX "Listing_lshBand1_idx" ON "Listing"("lshBand1");
CREATE INDEX "Listing_lshBand2_idx" ON "Listing"("lshBand2");
CREATE INDEX "Listing_lshBand3_idx" ON "Listing"("lshBand3");
