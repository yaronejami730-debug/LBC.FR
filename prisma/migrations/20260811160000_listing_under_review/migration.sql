-- Mise en revue d'une annonce en ligne.
--
-- Distincte du retrait de modération (`REMOVED`) : il n'y a ni sanction ni
-- compte à rebours de suppression. L'annonce sort de la vitrine le temps que
-- son auteur corrige ce qu'on lui signale, et repart en modération dès qu'il
-- l'a modifiée. Le statut lui-même est une chaîne (`UNDER_REVIEW`), rien à
-- migrer ; seule la date du passage en revue est nouvelle.
ALTER TABLE "Listing" ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);
