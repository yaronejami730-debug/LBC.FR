-- Signature des articles captés.
--
-- Les flux d'articles ne portent pas d'auteur ; les flux par journaliste, si.
-- Le recoupement se fait à la captation.
ALTER TABLE "NewsItem" ADD COLUMN IF NOT EXISTS "authorName" TEXT;
