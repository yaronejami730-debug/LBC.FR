-- Corps complet des articles republiables intégralement.
--
-- Colonne distincte d'`excerpt`, et la distinction est juridique, pas
-- technique : `excerpt` est une citation bornée d'un article qu'on n'a pas le
-- droit de republier ; `bodyHtml` est l'article entier, republié parce que sa
-- licence l'autorise, et qui ne doit pas être tronqué — une licence « pas de
-- modification » n'autorise pas plus à couper qu'à réécrire.
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "bodyHtml" TEXT;
