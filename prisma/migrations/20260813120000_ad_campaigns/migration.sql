-- Campagnes, zones, créatifs et événements de la régie Deal&Co Ads.
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "dailyBudgetCents" INTEGER NOT NULL,
    "totalBudgetCents" INTEGER NOT NULL,
    "spentCents" INTEGER NOT NULL DEFAULT 0,
    "audienceAges" TEXT NOT NULL DEFAULT '[]',
    "categories" TEXT NOT NULL DEFAULT '[]',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdCampaign_status_startAt_endAt_idx" ON "AdCampaign"("status", "startAt", "endAt");
CREATE INDEX "AdCampaign_advertiserId_status_idx" ON "AdCampaign"("advertiserId", "status");
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_advertiserId_fkey"
    FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdCampaignZone" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "citySlug" TEXT NOT NULL,
    "postalCode" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusKm" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AdCampaignZone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdCampaignZone_campaignId_idx" ON "AdCampaignZone"("campaignId");
CREATE INDEX "AdCampaignZone_citySlug_idx" ON "AdCampaignZone"("citySlug");
ALTER TABLE "AdCampaignZone" ADD CONSTRAINT "AdCampaignZone_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdCampaignPlacement" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    CONSTRAINT "AdCampaignPlacement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdCampaignPlacement_campaignId_placement_key" ON "AdCampaignPlacement"("campaignId", "placement");
CREATE INDEX "AdCampaignPlacement_placement_idx" ON "AdCampaignPlacement"("placement");
ALTER TABLE "AdCampaignPlacement" ADD CONSTRAINT "AdCampaignPlacement_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageUrlWide" TEXT,
    "ctaLabel" TEXT NOT NULL,
    "destinationUrl" TEXT,
    "listingId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Ad_campaignId_isActive_idx" ON "Ad"("campaignId", "isActive");
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "citySlug" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'WEB',
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "dedupKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdEvent_dedupKey_key" ON "AdEvent"("dedupKey");
CREATE INDEX "AdEvent_campaignId_type_createdAt_idx" ON "AdEvent"("campaignId", "type", "createdAt");
CREATE INDEX "AdEvent_createdAt_idx" ON "AdEvent"("createdAt");
ALTER TABLE "AdEvent" ADD CONSTRAINT "AdEvent_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdEvent" ADD CONSTRAINT "AdEvent_adId_fkey"
    FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
