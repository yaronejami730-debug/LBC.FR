-- AlterTable: Add missing columns to Listing
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateTable: Favorite
CREATE TABLE IF NOT EXISTS "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_listingId_key" ON "Favorite"("userId", "listingId");

-- AddForeignKey (only if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Favorite_userId_fkey'
  ) THEN
    ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Favorite_listingId_fkey'
  ) THEN
    ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
