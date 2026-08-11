-- File d'indexation SEO.
--
-- Migration additive : aucune table existante n'est touchée, aucune donnée
-- n'est lue ni déplacée. `IF NOT EXISTS` partout, donc rejouable sans effet.

CREATE TABLE IF NOT EXISTS "SeoUrl" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "priorityBand" TEXT NOT NULL DEFAULT 'NORMALE',
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReasons" TEXT NOT NULL DEFAULT '[]',
    "inSitemap" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "httpStatus" INTEGER,
    "canonical" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3),
    "coverageState" TEXT,
    "googleCanonical" TEXT,
    "contentUpdatedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoUrl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeoUrl_url_key" ON "SeoUrl"("url");
CREATE INDEX IF NOT EXISTS "SeoUrl_status_idx" ON "SeoUrl"("status");
CREATE INDEX IF NOT EXISTS "SeoUrl_type_status_idx" ON "SeoUrl"("type", "status");
CREATE INDEX IF NOT EXISTS "SeoUrl_indexable_score_idx" ON "SeoUrl"("indexable", "score");
CREATE INDEX IF NOT EXISTS "SeoUrl_lastCheckedAt_idx" ON "SeoUrl"("lastCheckedAt");
CREATE INDEX IF NOT EXISTS "SeoUrl_inSitemap_idx" ON "SeoUrl"("inSitemap");

CREATE TABLE IF NOT EXISTS "SeoJobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,

    CONSTRAINT "SeoJobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SeoJobRun_job_startedAt_idx" ON "SeoJobRun"("job", "startedAt");
