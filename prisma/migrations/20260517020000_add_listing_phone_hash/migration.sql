-- Réputation téléphone : hash du numéro normalisé pour le matching multi-comptes.
ALTER TABLE "Listing" ADD COLUMN "phoneHash" TEXT;
CREATE INDEX "Listing_phoneHash_idx" ON "Listing"("phoneHash");
