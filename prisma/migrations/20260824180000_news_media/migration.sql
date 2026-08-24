-- Photo et adresse de page pour les articles captés.
--
-- La photo vient de la balise <enclosure> du flux : c'est le visuel que le
-- média publie lui-même pour être repris. Rien n'est récupéré sur sa page.
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Unicité du slug : deux articles ne peuvent pas revendiquer la même URL.
CREATE UNIQUE INDEX IF NOT EXISTS "NewsItem_slug_key" ON "NewsItem" ("slug");
