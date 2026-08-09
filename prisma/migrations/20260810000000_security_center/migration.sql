-- Centre de sécurité : retrait d'annonce avec délai de conservation,
-- surveillance de comptes, registre anti-réinscription, journal d'audit.

-- Retrait d'annonce. "removedAt" date le retrait, "permanentDeletionAt" la
-- destruction définitive (removedAt + 21 jours). Les deux redeviennent NULL
-- quand l'annonce est validée à nouveau.
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "permanentDeletionAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Listing_status_permanentDeletionAt_idx"
    ON "Listing"("status", "permanentDeletionAt");

-- Surveillance : marque-page de modérateur, sans effet sur le compte.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "watchedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "watchReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "watchedBy" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banDecidedBy" TEXT;
CREATE INDEX IF NOT EXISTS "User_watchedAt_idx" ON "User"("watchedAt");
CREATE INDEX IF NOT EXISTS "User_bannedAt_idx" ON "User"("bannedAt");

-- Registre anti-réinscription : uniquement des empreintes, jamais de valeur
-- en clair. Survit à la destruction du compte d'origine.
CREATE TABLE IF NOT EXISTS "BanRegistry" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "siretHash" TEXT,
    "deviceHashes" TEXT NOT NULL DEFAULT '[]',
    "banReason" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanRegistry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BanRegistry_emailHash_key" ON "BanRegistry"("emailHash");
CREATE INDEX IF NOT EXISTS "BanRegistry_phoneHash_idx" ON "BanRegistry"("phoneHash");
CREATE INDEX IF NOT EXISTS "BanRegistry_siretHash_idx" ON "BanRegistry"("siretHash");

-- Journal des actions irréversibles. Pas de données personnelles : une
-- suppression définitive ne doit pas ressusciter ce qu'elle efface.
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
