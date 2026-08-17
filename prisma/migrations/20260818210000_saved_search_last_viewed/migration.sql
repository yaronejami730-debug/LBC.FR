-- Dernière consultation d'une recherche enregistrée.
--
-- Le badge affichait le nombre total d'annonces correspondantes : un chiffre
-- qui ne bouge presque jamais et ne dit rien d'utile — « 312 annonces » ne
-- donne aucune raison de cliquer. Ce qui intéresse, c'est ce qui est arrivé
-- **depuis la dernière fois**, et ce compteur doit retomber à zéro une fois vu.
--
-- Valeur initiale : la date de création de la recherche. Les recherches déjà
-- enregistrées repartent donc de leur propre historique, sans afficher d'un
-- coup des centaines de « nouveautés » vieilles de six mois.
ALTER TABLE "SavedSearch" ADD COLUMN "lastViewedAt" TIMESTAMP(3);
UPDATE "SavedSearch" SET "lastViewedAt" = "createdAt" WHERE "lastViewedAt" IS NULL;
