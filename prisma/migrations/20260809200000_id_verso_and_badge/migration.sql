-- Verso de la pièce d'identité + badge de vérification différé.
ALTER TABLE "ProVerification" ADD COLUMN IF NOT EXISTS "idDocumentBackPath" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "badgeRequestedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "badgeGrantedAt" TIMESTAMP(3);
