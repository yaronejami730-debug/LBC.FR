-- CreateTable
CREATE TABLE "AdvertiserLead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "notes" TEXT,
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertiserLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertiserLead_status_createdAt_idx" ON "AdvertiserLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserLead_email_idx" ON "AdvertiserLead"("email");

-- Ces trois index étaient déclarés dans schema.prisma mais n'avaient jamais eu
-- de migration : la base de production ne les a donc jamais eus. Toutes les
-- requêtes de liste (catégorie, sous-catégorie, ville) tournaient en scan
-- séquentiel — c'est ce qui a fait exploser le quota compute fin juillet.
-- CreateIndex
CREATE INDEX "Listing_status_deletedAt_shadowBanned_createdAt_idx" ON "Listing"("status", "deletedAt", "shadowBanned", "createdAt");

-- CreateIndex
CREATE INDEX "Listing_status_deletedAt_shadowBanned_category_idx" ON "Listing"("status", "deletedAt", "shadowBanned", "category");

-- CreateIndex
CREATE INDEX "Listing_status_deletedAt_shadowBanned_category_subcategory__idx" ON "Listing"("status", "deletedAt", "shadowBanned", "category", "subcategory", "location");

