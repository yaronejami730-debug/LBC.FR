-- Moteur de recommandation locale : géolocalisation des annonces, profil
-- géographique et catégoriel des comptes, journal des recommandations.
--
-- Migration additive : trois colonnes nullables sur "Listing", quatre tables
-- nouvelles, aucune donnée existante lue ni déplacée. `IF NOT EXISTS` partout,
-- donc rejouable sans effet. Les colonnes géographiques restent nulles jusqu'au
-- passage de `scripts/backfill-listing-geo.ts` — un moteur qui ne trouve pas de
-- coordonnées n'envoie rien, il ne devine pas.

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "geoLat" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "geoLng" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "geoPrecision" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "geoCity" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "geoInsee" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "geoResolvedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Listing_geoLat_geoLng_idx" ON "Listing"("geoLat", "geoLng");
CREATE INDEX IF NOT EXISTS "Listing_status_deletedAt_shadowBanned_geoResolvedAt_idx"
  ON "Listing"("status", "deletedAt", "shadowBanned", "geoResolvedAt");

CREATE TABLE IF NOT EXISTS "UserLocationProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zoneKey" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "postalCode" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "precision" TEXT NOT NULL DEFAULT 'COMMUNE',
    "source" TEXT NOT NULL,
    "certainty" TEXT NOT NULL DEFAULT 'ESTIMATED',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "listingCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "firstActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocationProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserLocationProfile_userId_zoneKey_key"
  ON "UserLocationProfile"("userId", "zoneKey");
CREATE INDEX IF NOT EXISTS "UserLocationProfile_userId_confidence_idx"
  ON "UserLocationProfile"("userId", "confidence");
CREATE INDEX IF NOT EXISTS "UserLocationProfile_lat_lng_idx"
  ON "UserLocationProfile"("lat", "lng");
CREATE INDEX IF NOT EXISTS "UserLocationProfile_certainty_confidence_idx"
  ON "UserLocationProfile"("certainty", "confidence");

CREATE TABLE IF NOT EXISTS "UserCategoryInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "publishedCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "emailClickCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredEmailCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCategoryInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserCategoryInterest_userId_categoryId_key"
  ON "UserCategoryInterest"("userId", "categoryId");
CREATE INDEX IF NOT EXISTS "UserCategoryInterest_categoryId_score_idx"
  ON "UserCategoryInterest"("categoryId", "score");

CREATE TABLE IF NOT EXISTS "RecommendationCampaign" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "listingCount" INTEGER NOT NULL DEFAULT 0,
    "candidateUsers" INTEGER NOT NULL DEFAULT 0,
    "targetedUsers" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "RecommendationCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecommendationCampaign_categoryId_startedAt_idx"
  ON "RecommendationCampaign"("categoryId", "startedAt");
CREATE INDEX IF NOT EXISTS "RecommendationCampaign_startedAt_idx"
  ON "RecommendationCampaign"("startedAt");

CREATE TABLE IF NOT EXISTS "ListingRecommendationLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "categoryScore" INTEGER NOT NULL DEFAULT 0,
    "locationScore" INTEGER NOT NULL DEFAULT 0,
    "recencyScore" INTEGER NOT NULL DEFAULT 0,
    "distanceKm" DOUBLE PRECISION,
    "locationCertainty" TEXT NOT NULL DEFAULT 'ESTIMATED',
    "matchedZoneKey" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingRecommendationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ListingRecommendationLog_userId_listingId_key"
  ON "ListingRecommendationLog"("userId", "listingId");
CREATE INDEX IF NOT EXISTS "ListingRecommendationLog_campaignId_idx"
  ON "ListingRecommendationLog"("campaignId");
CREATE INDEX IF NOT EXISTS "ListingRecommendationLog_userId_sentAt_idx"
  ON "ListingRecommendationLog"("userId", "sentAt");
CREATE INDEX IF NOT EXISTS "ListingRecommendationLog_listingId_clickedAt_idx"
  ON "ListingRecommendationLog"("listingId", "clickedAt");

-- Clés étrangères. `DO $$ … $$` parce que PostgreSQL n'accepte pas
-- `ADD CONSTRAINT IF NOT EXISTS` : sans ce garde, rejouer la migration échoue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserLocationProfile_userId_fkey') THEN
    ALTER TABLE "UserLocationProfile" ADD CONSTRAINT "UserLocationProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserCategoryInterest_userId_fkey') THEN
    ALTER TABLE "UserCategoryInterest" ADD CONSTRAINT "UserCategoryInterest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ListingRecommendationLog_userId_fkey') THEN
    ALTER TABLE "ListingRecommendationLog" ADD CONSTRAINT "ListingRecommendationLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ListingRecommendationLog_listingId_fkey') THEN
    ALTER TABLE "ListingRecommendationLog" ADD CONSTRAINT "ListingRecommendationLog_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ListingRecommendationLog_campaignId_fkey') THEN
    ALTER TABLE "ListingRecommendationLog" ADD CONSTRAINT "ListingRecommendationLog_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "RecommendationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
