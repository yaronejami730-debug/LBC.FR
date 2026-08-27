-- Retrait de la revue de presse.
--
-- Les deux premières tables ne portent que des données dérivées : tout leur
-- contenu venait de flux publics et serait reconstitué à l'identique par une
-- captation. Les jeter ne perd rien.
DROP TABLE IF EXISTS "NewsItem";
DROP TABLE IF EXISTS "SourceLicenseSnapshot";

-- « NewsSubscriber », lui, n'est pas une table de flux, et c'est pourquoi il
-- est traité autrement.
--
-- Il porte deux preuves qu'aucune captation ne refabriquerait : `confirmedAt`,
-- qui établit le double opt-in de chaque abonné, et `unsubscribedAt`, dont la
-- ligne est conservée exprès pour établir l'opt-out. Détruire la table
-- effacerait la démonstration que ces personnes avaient consenti — et surtout
-- que celles qui se sont désabonnées l'ont fait. Si un envoi reprend un jour,
-- il repartirait sans registre de désabonnement, ce qui se paie en réclamation,
-- pas en dette technique.
--
-- La table est donc renommée plutôt que supprimée : elle sort du schéma Prisma
-- et de l'application, les données restent lisibles. Prisma ne touche pas aux
-- tables qu'il ne déclare pas.
ALTER TABLE IF EXISTS "NewsSubscriber" RENAME TO "archive_news_subscriber";
