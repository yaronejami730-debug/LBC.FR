-- Pièces jointes du support.
--
-- Volontairement hors du stockage public des photos d'annonces : une capture
-- d'écran de support contient souvent une facture, une pièce d'identité ou une
-- conversation privée. Une URL publique, même illisible, reste une URL
-- publique. Le fichier est donc conservé ici et relu par une route qui vérifie
-- que le demandeur est bien partie à la discussion.
CREATE TABLE "SupportAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportAttachment_ticketId_idx" ON "SupportAttachment"("ticketId");
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nom du fichier affiché dans le fil : « facture-mars.pdf » se reconnaît,
-- « a3f9c2.pdf » non.
ALTER TABLE "SupportMessage" ADD COLUMN "attachmentName" TEXT;
