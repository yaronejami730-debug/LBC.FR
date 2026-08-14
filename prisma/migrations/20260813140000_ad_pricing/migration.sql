-- Grille tarifaire des emplacements publicitaires.
--
-- Les valeurs par défaut sont un point de départ raisonnable pour une régie
-- qui démarre, pas une décision commerciale : elles s'ajustent depuis
-- l'administration sans redéploiement.
CREATE TABLE "AdPlacementPricing" (
    "placement" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'CPC',
    "priceCents" INTEGER NOT NULL DEFAULT 25,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "AdPlacementPricing_pkey" PRIMARY KEY ("placement")
);

INSERT INTO "AdPlacementPricing" ("placement", "model", "priceCents", "updatedAt") VALUES
    ('HOME_TOP',            'CPM', 300, CURRENT_TIMESTAMP),
    ('SEARCH_GRID',         'CPC',  20, CURRENT_TIMESTAMP),
    ('LISTING_ROTATOR',     'CPC',  25, CURRENT_TIMESTAMP),
    ('MOBILE_INTERSTITIAL', 'CPM', 500, CURRENT_TIMESTAMP);
