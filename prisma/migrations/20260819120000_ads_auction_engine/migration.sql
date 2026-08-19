-- Moteur d'enchères publicitaire : enchère au second prix, score qualité,
-- mesure de visibilité, anti-fraude, solde réservé.
--
-- Additif uniquement : aucune colonne existante n'est supprimée ni renommée,
-- et chaque ajout porte une valeur par défaut. Une campagne déjà en diffusion
-- continue donc de tourner pendant et après la migration.

-- ── Campagne : enchère, modèle, score ────────────────────────────────────────
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "bidStrategy" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "maxBidCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "billingModel" TEXT NOT NULL DEFAULT 'CPC';
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "qualityScoreAt" TIMESTAMP(3);
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "dailyCapAt" TIMESTAMP(3);

-- Les campagnes « visibilité » déjà créées se facturent à l'impression visible :
-- c'est ce que leur objectif promet, et c'est ce que le moteur appliquera.
UPDATE "AdCampaign" SET "billingModel" = 'CPM' WHERE "objective" = 'VISIBILITE';

-- ── Créatif : score qualité ──────────────────────────────────────────────────
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "qualityScoreAt" TIMESTAMP(3);
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "qualityFactors" TEXT NOT NULL DEFAULT '{}';

-- ── Événement : visibilité mesurée, validation, enchère ──────────────────────
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "viewportPct" DOUBLE PRECISION;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "visibleMs" INTEGER;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "pageViewId" TEXT;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "sessionHash" TEXT;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "validationStatus" TEXT NOT NULL DEFAULT 'VALID';
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "invalidReason" TEXT;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "billingStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "auctionId" TEXT;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "bidCents" INTEGER;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "priceCents" INTEGER;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "adRank" DOUBLE PRECISION;
ALTER TABLE "AdEvent" ADD COLUMN IF NOT EXISTS "conversionType" TEXT;

-- Les événements déjà facturés le restent : sans cela, la facture émise et le
-- journal ne diraient plus la même chose.
UPDATE "AdEvent" SET "billingStatus" = 'BILLED' WHERE "costCents" > 0 AND "billingStatus" = 'NONE';

CREATE INDEX IF NOT EXISTS "AdEvent_campaignId_validationStatus_createdAt_idx"
  ON "AdEvent" ("campaignId", "validationStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "AdEvent_pageViewId_adId_idx" ON "AdEvent" ("pageViewId", "adId");
CREATE INDEX IF NOT EXISTS "AdEvent_sessionHash_createdAt_idx" ON "AdEvent" ("sessionHash", "createdAt");

-- ── Portefeuille : solde avant, idempotence, événement d'origine ─────────────
ALTER TABLE "AdWalletTransaction" ADD COLUMN IF NOT EXISTS "balanceBeforeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdWalletTransaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "AdWalletTransaction" ADD COLUMN IF NOT EXISTS "adEventId" TEXT;

-- Historique : le solde d'avant se déduit de celui d'après.
UPDATE "AdWalletTransaction"
   SET "balanceBeforeCents" = "balanceAfterCents" - "amountCents"
 WHERE "balanceBeforeCents" = 0;

CREATE UNIQUE INDEX IF NOT EXISTS "AdWalletTransaction_idempotencyKey_key"
  ON "AdWalletTransaction" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AdWalletTransaction_adEventId_idx" ON "AdWalletTransaction" ("adEventId");

-- ── Annonceur : solde réservé, recharge automatique (inactive) ───────────────
ALTER TABLE "Advertiser" ADD COLUMN IF NOT EXISTS "reservedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Advertiser" ADD COLUMN IF NOT EXISTS "autoTopUpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Advertiser" ADD COLUMN IF NOT EXISTS "autoTopUpThresholdCents" INTEGER;
ALTER TABLE "Advertiser" ADD COLUMN IF NOT EXISTS "autoTopUpAmountCents" INTEGER;
ALTER TABLE "Advertiser" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- ── Grille : prix planchers ─────────────────────────────────────────────────
ALTER TABLE "AdPlacementPricing" ADD COLUMN IF NOT EXISTS "floorCpcCents" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "AdPlacementPricing" ADD COLUMN IF NOT EXISTS "floorCpmCents" INTEGER NOT NULL DEFAULT 200;

-- Le plancher part du tarif déjà pratiqué : passer d'un prix fixe à une enchère
-- ne doit pas brader l'inventaire du jour au lendemain. 60 % du tarif affiché,
-- pour laisser à l'enchère de quoi descendre sans tomber à zéro.
UPDATE "AdPlacementPricing" SET "floorCpcCents" = GREATEST(5, ("priceCents" * 6) / 10) WHERE "model" = 'CPC';
UPDATE "AdPlacementPricing" SET "floorCpmCents" = GREATEST(50, ("priceCents" * 6) / 10) WHERE "model" = 'CPM';

-- ── Agrégats : visibilité, enchères ─────────────────────────────────────────
ALTER TABLE "AdStatDaily" ADD COLUMN IF NOT EXISTS "loads" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdStatDaily" ADD COLUMN IF NOT EXISTS "renders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdStatDaily" ADD COLUMN IF NOT EXISTS "invalidEvents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdStatDaily" ADD COLUMN IF NOT EXISTS "auctionEntries" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdStatDaily" ADD COLUMN IF NOT EXISTS "auctionWins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdStatDaily" ADD COLUMN IF NOT EXISTS "adRankSum" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ── Exonération de facturation, campagne par campagne ───────────────────────
-- Décidée par la régie avant le lancement, réversible à tout moment. La
-- campagne est diffusée et mesurée comme les autres ; seul le débit est
-- suspendu.
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "billingExemptAt" TIMESTAMP(3);
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "billingExemptReason" TEXT;
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "billingExemptBy" TEXT;
