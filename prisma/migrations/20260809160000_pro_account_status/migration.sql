-- Habilitation professionnelle : statut explicite, dossier complet, historique.
-- Un SIRET n'active rien : seul un modérateur fait passer un compte en APPROVED.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "professionalStatus" TEXT NOT NULL DEFAULT 'NONE';

-- Les comptes déjà professionnels avant l'introduction du statut sont
-- considérés comme validés : la vérification ne peut pas être rétroactive.
UPDATE "User" SET "professionalStatus" = 'APPROVED' WHERE "isPro" = true;

ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "requestType" TEXT NOT NULL DEFAULT 'CONVERT_FROM_PRIVATE';
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "siren" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "commercialName" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "businessAddress" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "businessActivity" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "businessCategory" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "responsibleFirstName" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "responsibleLastName" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "professionalPhone" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "professionalEmail" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "suspendedById" TEXT;
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "infoRequest" TEXT;

CREATE TABLE IF NOT EXISTS "ProVerificationLog" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProVerificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProVerificationLog_verificationId_createdAt_idx" ON "ProVerificationLog"("verificationId", "createdAt");

ALTER TABLE "ProVerificationLog"
    ADD CONSTRAINT "ProVerificationLog_verificationId_fkey"
    FOREIGN KEY ("verificationId") REFERENCES "ProVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
