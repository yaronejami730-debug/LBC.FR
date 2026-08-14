-- Comptes annonceurs de la régie Deal&Co Ads.
--
-- Identité distincte de `User` : un annonceur n'a aucun droit sur la
-- marketplace, et un compte marketplace n'a aucun droit sur la régie.
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "siret" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "loginId" TEXT NOT NULL,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Advertiser_email_key" ON "Advertiser"("email");
CREATE UNIQUE INDEX "Advertiser_loginId_key" ON "Advertiser"("loginId");
CREATE INDEX "Advertiser_suspendedAt_idx" ON "Advertiser"("suspendedAt");
CREATE INDEX "Advertiser_email_idx" ON "Advertiser"("email");
