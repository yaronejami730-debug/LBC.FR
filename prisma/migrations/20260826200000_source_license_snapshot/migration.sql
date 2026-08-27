-- Mémoire de la surveillance des licences.
--
-- Une licence est une déclaration unilatérale : elle peut être retirée sans
-- que personne soit prévenu. Cette table garde, source par source, l'empreinte
-- de la page qui l'établit et la réponse à la seule question qui compte —
-- la phrase qui nous autorise est-elle toujours écrite là ?
CREATE TABLE IF NOT EXISTS "SourceLicenseSnapshot" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "quoteFound" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "changedAt" TIMESTAMP(3),
    CONSTRAINT "SourceLicenseSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SourceLicenseSnapshot_sourceKey_key" ON "SourceLicenseSnapshot"("sourceKey");
CREATE INDEX IF NOT EXISTS "SourceLicenseSnapshot_quoteFound_idx" ON "SourceLicenseSnapshot"("quoteFound");
