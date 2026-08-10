-- L'état ne s'applique qu'à un objet.
--
-- La colonne était NOT NULL DEFAULT 'Good' : toute annonce en héritait, y
-- compris les prestations, les offres d'emploi et les événements. Cette valeur
-- fausse remontait ensuite dans les filtres et les recommandations.
--
-- On rend la colonne nullable, on retire le défaut, et le backfill des lignes
-- déjà polluées est fait par scripts/backfill-offer-intent.ts (qui rejoue le
-- moteur d'intention sur le titre plutôt que de deviner depuis la catégorie).
ALTER TABLE "Listing" ALTER COLUMN "condition" DROP NOT NULL;
ALTER TABLE "Listing" ALTER COLUMN "condition" DROP DEFAULT;
