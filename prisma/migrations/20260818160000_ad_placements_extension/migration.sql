-- Nouveaux emplacements publicitaires : messagerie, dépôt d'annonce, profil,
-- e-mail.
--
-- Un emplacement sans ligne tarifaire est servi gratuitement — `eventCost`
-- renvoie zéro quand la grille ne le connaît pas. Les prix arrivent donc en
-- même temps que l'inventaire, sinon la régie diffuserait sans facturer.
--
-- Les niveaux suivent l'attention réellement obtenue : la messagerie est
-- consultée souvent mais brièvement, le dépôt touche un vendeur concentré sur
-- autre chose, l'e-mail se paie à l'ouverture et non à la seconde de présence.
INSERT INTO "AdPlacementPricing" ("placement", "model", "priceCents", "updatedAt") VALUES
    ('MESSAGES_TOP',    'CPM', 220, CURRENT_TIMESTAMP),
    ('MESSAGES_BOTTOM', 'CPM', 120, CURRENT_TIMESTAMP),
    ('POST_FORM',       'CPC',  18, CURRENT_TIMESTAMP),
    ('PROFILE_BANNER',  'CPM', 150, CURRENT_TIMESTAMP),
    ('EMAIL_BANNER',    'CPC',  30, CURRENT_TIMESTAMP)
ON CONFLICT ("placement") DO NOTHING;
