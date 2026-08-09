-- Espace professionnel + carte de prestations.
-- Un établissement présente ses trente prestations sur une fiche, pas en
-- publiant trente annonces.

CREATE TABLE IF NOT EXISTS "ProProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categories" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "hours" TEXT NOT NULL DEFAULT '{}',
    "photos" TEXT NOT NULL DEFAULT '[]',
    "coverImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProProfile_userId_key" ON "ProProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProProfile_slug_key" ON "ProProfile"("slug");
CREATE INDEX IF NOT EXISTS "ProProfile_isPublished_city_idx" ON "ProProfile"("isPublished", "city");

ALTER TABLE "ProProfile"
    ADD CONSTRAINT "ProProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProService" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "durationMin" INTEGER,
    "price" DOUBLE PRECISION NOT NULL,
    "priceNote" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProService_profileId_position_idx" ON "ProService"("profileId", "position");

ALTER TABLE "ProService"
    ADD CONSTRAINT "ProService_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
