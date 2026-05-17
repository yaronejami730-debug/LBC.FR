-- Blacklist : domaines / emails / téléphones / IP frauduleux.
-- Source de vérité ; chargée en mémoire au runtime, alimentée par cron.
CREATE TABLE "Blacklist" (
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Blacklist_pkey" PRIMARY KEY ("kind", "value")
);

CREATE INDEX "Blacklist_kind_idx" ON "Blacklist"("kind");
