-- Agrégats journaliers de la régie publicitaire.
--
-- Le détail (`AdEvent`) reste la source de vérité ; cette table est ce que
-- lisent les écrans. Sans elle, afficher une courbe sur trente jours signifie
-- parcourir tous les événements de la période à chaque chargement.
CREATE TABLE "AdStatDaily" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "citySlug" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdStatDaily_pkey" PRIMARY KEY ("id")
);

-- `citySlug` nullable dans une contrainte d'unicité : PostgreSQL considère
-- deux NULL comme distincts, d'où l'index sur l'expression avec repli.
CREATE UNIQUE INDEX "AdStatDaily_key" ON "AdStatDaily"("day", "campaignId", "placement", COALESCE("citySlug", ''));
CREATE INDEX "AdStatDaily_campaignId_day_idx" ON "AdStatDaily"("campaignId", "day");
CREATE INDEX "AdStatDaily_day_idx" ON "AdStatDaily"("day");
