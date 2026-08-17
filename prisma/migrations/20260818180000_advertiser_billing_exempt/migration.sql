-- Portefeuille désactivé : diffusion sans facturation.
--
-- Un annonceur peut être servi gratuitement — partenariat, contrepartie,
-- période d'essai. Ce n'est pas un solde à zéro qu'on remplirait de crédits
-- fictifs : les crédits fictifs polluent la comptabilité et personne ne sait
-- plus, six mois plus tard, ce qui a été payé et ce qui a été offert.
--
-- Ici, le solde reste ce qu'il est, et la facturation est simplement suspendue.
-- Les événements continuent d'être enregistrés — impressions, clics,
-- statistiques : l'annonceur voit ce que sa campagne produit. Seule l'écriture
-- au débit n'a pas lieu. Réactiver le portefeuille suffit à reprendre la
-- facturation, sans rien reconstituer.
ALTER TABLE "Advertiser" ADD COLUMN "billingDisabledAt" TIMESTAMP(3);
ALTER TABLE "Advertiser" ADD COLUMN "billingDisabledReason" TEXT;
