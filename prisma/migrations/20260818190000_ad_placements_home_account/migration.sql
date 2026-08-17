-- Nouveaux emplacements : intercalaires d'accueil, menu, favoris, réservations.
--
-- Sans ligne tarifaire, `eventCost` renvoie zéro et l'emplacement serait servi
-- gratuitement. Le tarif accompagne donc toujours l'ouverture d'un inventaire.
--
-- L'intercalaire d'accueil se paie au mille comme le bandeau du haut, un cran
-- en dessous : il est vu en descendant, pas en arrivant. Le menu, les favoris
-- et les réservations touchent peu de monde mais un monde décidé — au clic,
-- donc, là où l'annonceur ne paie que ce qui se transforme.
INSERT INTO "AdPlacementPricing" ("placement", "model", "priceCents", "updatedAt") VALUES
    ('HOME_FEED',   'CPM', 200, CURRENT_TIMESTAMP),
    ('MENU_DRAWER', 'CPC',  15, CURRENT_TIMESTAMP),
    ('FAVORITES',   'CPC',  20, CURRENT_TIMESTAMP),
    ('BOOKINGS',    'CPC',  22, CURRENT_TIMESTAMP)
ON CONFLICT ("placement") DO NOTHING;
