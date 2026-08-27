-- Titre et résumé réécrits automatiquement à partir de l'article.
--
-- Les colonnes d'origine (`title`, `excerpt`) ne sont pas touchées : le titre du
-- journaliste reste affiché sur la page de l'article, et la citation reste la
-- source de vérité. Ce qui est réécrit est signalé comme tel — présenter un
-- titre que nous avons produit comme étant celui du média serait une fausse
-- attribution.
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "aiTitle"   TEXT;
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "aiAt"      TIMESTAMP(3);

-- Le cron cherche « ce qui a un corps mais pas encore de résumé » : sans index,
-- c'est un balayage complet de la table à chaque passage.
CREATE INDEX IF NOT EXISTS "NewsItem_aiAt_idx" ON "NewsItem"("aiAt");
