-- Emplacements de l'espace professionnel : tableau de bord et agenda.
--
-- Tarifés plus haut que le grand public, et c'est justifié : l'audience est un
-- gérant d'établissement sur son outil de travail. Un fournisseur de logiciel
-- de caisse ou un grossiste paie volontiers pour cette audience-là, qu'il ne
-- trouve pas ailleurs sur le site.
INSERT INTO "AdPlacementPricing" ("placement", "model", "priceCents", "updatedAt") VALUES
    ('PRO_SPACE',  'CPC', 45, CURRENT_TIMESTAMP),
    ('PRO_AGENDA', 'CPC', 40, CURRENT_TIMESTAMP)
ON CONFLICT ("placement") DO NOTHING;
