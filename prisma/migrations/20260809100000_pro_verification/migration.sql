-- Vérification d'identité des comptes professionnels.
-- Un SIRET est public : sans pièce d'identité + justificatif d'entreprise,
-- rien ne distingue un pro d'un usurpateur de SIRET.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "proVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ProVerification" (
    "id" 
    EXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "siret" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "idDocumentType" TEXT NOT NULL,
    "idDocumentPath" TEXT NOT NULL,
    "companyDocType" TEXT NOT NULL,
    "companyDocPath" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "adminNote" TEXT,

    CONSTRAINT "ProVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProVerification_status_submittedAt_idx" ON "ProVerification"("status", "submittedAt");
CREATE INDEX IF NOT EXISTS "ProVerification_userId_idx" ON "ProVerification"("userId");

ALTER TABLE "ProVerification"
    ADD CONSTRAINT "ProVerification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProVerification"
    ADD CONSTRAINT "ProVerification_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
