-- Accusés de remise et indicateur de saisie.
--
-- `read` disait déjà « lu », mais sans distinguer « parti » de « arrivé » : le
-- destinataire pouvait être hors ligne pendant des heures sans que l'expéditeur
-- puisse faire la différence entre un message perdu et un message non ouvert.
--
--   envoyé    → une coche      (la ligne existe)
--   remis     → deux coches    (l'appareil du destinataire l'a récupéré)
--   lu        → deux coches bleues
ALTER TABLE "Message" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "readAt" TIMESTAMP(3);

-- Saisie en cours. Une date d'expiration plutôt qu'un booléen : un onglet fermé
-- brutalement laisserait « écrit… » affiché pour toujours.
ALTER TABLE "ConversationParticipant" ADD COLUMN "typingUntil" TIMESTAMP(3);

CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
