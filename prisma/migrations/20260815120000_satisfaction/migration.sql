-- Collecte de satisfaction : sollicitations et réponses.
--
-- Migration additive : deux tables neuves, aucune table existante touchée.
-- `IF NOT EXISTS` partout, donc rejouable sans effet.

CREATE TABLE IF NOT EXISTS "SatisfactionCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activityCount" INTEGER,
    "sendAfter" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SatisfactionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SatisfactionCampaign_status_sendAfter_idx"
  ON "SatisfactionCampaign"("status", "sendAfter");
CREATE INDEX IF NOT EXISTS "SatisfactionCampaign_userId_sentAt_idx"
  ON "SatisfactionCampaign"("userId", "sentAt");

-- ── La garantie anti-doublon ─────────────────────────────────────────────
--
-- Un compte ne peut avoir qu'une seule campagne ouverte à la fois. C'est un
-- index unique *partiel* : il ne porte que sur les états PENDING et SCHEDULED,
-- ce qui laisse un compte accumuler autant de campagnes envoyées que le temps
-- lui en apporte, tout en interdisant qu'il en ait deux en attente.
--
-- C'est cette ligne — et non une vérification applicative — qui rend le système
-- idempotent. Deux exécutions simultanées du planificateur qui décideraient
-- pour le même compte : la seconde échoue à l'insertion, proprement, et son
-- appelant l'ignore. Aucun verrou, aucune transaction longue, aucune fenêtre de
-- concurrence à raisonner.
--
-- Prisma ne sait pas déclarer d'index partiel : il vit donc ici, et le schéma
-- porte un commentaire qui y renvoie.
CREATE UNIQUE INDEX IF NOT EXISTS "satisfaction_one_open_per_user"
  ON "SatisfactionCampaign"("userId")
  WHERE "status" IN ('PENDING', 'SCHEDULED');

CREATE TABLE IF NOT EXISTS "SatisfactionResponse" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "nps" INTEGER,
    "likes" TEXT,
    "improvements" TEXT,
    "wishedFeature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SatisfactionResponse_pkey" PRIMARY KEY ("id")
);

-- Une réponse par campagne : recharger la page de remerciement ne doit pas
-- créer un second avis.
CREATE UNIQUE INDEX IF NOT EXISTS "SatisfactionResponse_campaignId_key"
  ON "SatisfactionResponse"("campaignId");
CREATE INDEX IF NOT EXISTS "SatisfactionResponse_rating_idx" ON "SatisfactionResponse"("rating");
CREATE INDEX IF NOT EXISTS "SatisfactionResponse_createdAt_idx" ON "SatisfactionResponse"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SatisfactionCampaign_userId_fkey') THEN
    ALTER TABLE "SatisfactionCampaign" ADD CONSTRAINT "SatisfactionCampaign_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SatisfactionResponse_campaignId_fkey') THEN
    ALTER TABLE "SatisfactionResponse" ADD CONSTRAINT "SatisfactionResponse_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "SatisfactionCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
