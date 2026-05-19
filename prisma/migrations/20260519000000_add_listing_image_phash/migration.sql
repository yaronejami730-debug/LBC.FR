-- CreateTable (idempotent — la table peut préexister via `prisma db push`)
CREATE TABLE IF NOT EXISTS "ListingImage" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "phash" BIGINT,
    "lshBand0" INTEGER,
    "lshBand1" INTEGER,
    "lshBand2" INTEGER,
    "lshBand3" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "blurVar" DOUBLE PRECISION,
    "isScreenshot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

-- AddColumn (table préexistante : complète les colonnes manquantes)
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "phash" BIGINT;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "lshBand0" INTEGER;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "lshBand1" INTEGER;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "lshBand2" INTEGER;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "lshBand3" INTEGER;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "blurVar" DOUBLE PRECISION;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "isScreenshot" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ListingImage_phash_idx" ON "ListingImage"("phash");
CREATE INDEX IF NOT EXISTS "ListingImage_lshBand0_idx" ON "ListingImage"("lshBand0");
CREATE INDEX IF NOT EXISTS "ListingImage_lshBand1_idx" ON "ListingImage"("lshBand1");
CREATE INDEX IF NOT EXISTS "ListingImage_lshBand2_idx" ON "ListingImage"("lshBand2");
CREATE INDEX IF NOT EXISTS "ListingImage_lshBand3_idx" ON "ListingImage"("lshBand3");
CREATE INDEX IF NOT EXISTS "ListingImage_listingId_idx" ON "ListingImage"("listingId");

-- AddForeignKey (idempotent — ignore si la contrainte existe déjà)
DO $$ BEGIN
  ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
