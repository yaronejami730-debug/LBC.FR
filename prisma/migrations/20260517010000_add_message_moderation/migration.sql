-- Modération de la messagerie privée : score de risque + drapeau scam/phishing.
ALTER TABLE "Message" ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Message" ADD COLUMN "flagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "flagReason" TEXT;

-- Index pour la file de modération admin (messages signalés, plus récents d'abord).
CREATE INDEX "Message_flagged_createdAt_idx" ON "Message"("flagged", "createdAt");
