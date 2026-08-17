-- Pièces justificatives stockées en base, en dernier recours.
--
-- Le stockage nominal reste le Blob privé. Mais une pièce d'identité qui ne
-- part pas, c'est un professionnel qui ne peut pas se faire vérifier : quand
-- le Blob refuse — non configuré, accès privé indisponible, incident — le
-- document atterrit ici plutôt que d'être perdu.
--
-- Volume négligeable : une à trois pièces par compte professionnel, 8 Mo au
-- maximum chacune, et purgées à la décision de modération comme les autres.
CREATE TABLE "KycDocument" (
    "path" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("path")
);
CREATE INDEX "KycDocument_userId_idx" ON "KycDocument"("userId");
