-- Veille automobile : les articles captés par flux RSS.
--
-- Table de signal, pas de contenu : aucune page n'est générée à partir de ces
-- lignes. Elles servent à dater les pages existantes et à repérer les sujets
-- dont la presse parle pendant que nous avons du stock.
CREATE TABLE IF NOT EXISTS "NewsItem" (
    "id"          TEXT NOT NULL,
    "source"      TEXT NOT NULL,
    "url"         TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "summary"     TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "brandSlug"   TEXT,
    "modelSlug"   TEXT,
    "categories"  TEXT NOT NULL DEFAULT '[]',
    "fetchedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- L'unicité porte sur l'URL : un flux republie le même article quand son titre
-- change, et deux lignes pour un article fausseraient le comptage des sujets.
CREATE UNIQUE INDEX IF NOT EXISTS "NewsItem_url_key" ON "NewsItem" ("url");
CREATE INDEX IF NOT EXISTS "NewsItem_brandSlug_publishedAt_idx" ON "NewsItem" ("brandSlug", "publishedAt");
CREATE INDEX IF NOT EXISTS "NewsItem_brandSlug_modelSlug_publishedAt_idx" ON "NewsItem" ("brandSlug", "modelSlug", "publishedAt");
CREATE INDEX IF NOT EXISTS "NewsItem_publishedAt_idx" ON "NewsItem" ("publishedAt");
