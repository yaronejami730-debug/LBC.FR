-- Cadrage de la photo de couverture.
--
-- Une photo de devanture est presque toujours prise en 4:3 ou en 3:2 ; le
-- bandeau de la fiche est en 16:5. Sans réglage, le recadrage automatique
-- coupe au centre et décapite l'enseigne une fois sur deux.
ALTER TABLE "ProProfile" ADD COLUMN "coverX" DOUBLE PRECISION NOT NULL DEFAULT 50;
ALTER TABLE "ProProfile" ADD COLUMN "coverY" DOUBLE PRECISION NOT NULL DEFAULT 50;
ALTER TABLE "ProProfile" ADD COLUMN "coverZoom" DOUBLE PRECISION NOT NULL DEFAULT 1;
