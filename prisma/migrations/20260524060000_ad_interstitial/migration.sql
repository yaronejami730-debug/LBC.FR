-- Pub interstitielle (plein écran modal) à l'ouverture de l'app.
ALTER TABLE "Advertisement" ADD COLUMN "isInterstitial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Advertisement" ADD COLUMN "impInterstitial" INTEGER NOT NULL DEFAULT 0;
