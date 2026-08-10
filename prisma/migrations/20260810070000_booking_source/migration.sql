-- Origine du rendez-vous.
--
-- Un rendez-vous pris au téléphone par la coiffeuse et un rendez-vous pris en
-- ligne par le client sont le même objet, créés par le même moteur, soumis aux
-- mêmes règles de disponibilité. Seule leur provenance diffère, et elle
-- n'intéresse que les statistiques.
ALTER TABLE "ProBooking" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'ONLINE';
