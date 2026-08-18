-- Correction des droits semés : clés de chapitre, pas noms d'écrans.
--
-- La migration précédente listait les écrans — « listings », « securite »,
-- « users » — alors que les droits se comparent aux **clés de chapitre** de
-- `lib/admin/sections.ts` : « moderation », « support », « acquisition ».
-- Aucune équipe n'avait encore de membre, donc personne n'a été affecté ; mais
-- la première personne ajoutée à « Modération » se serait retrouvée devant une
-- administration vide, sans que rien n'explique pourquoi.
UPDATE "StaffTeam" SET "sections" = '["moderation"]',   "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'moderation';
UPDATE "StaffTeam" SET "sections" = '["support"]',      "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'support';
UPDATE "StaffTeam" SET "sections" = '["professionnels"]', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'pro';
UPDATE "StaffTeam" SET "sections" = '["publicite"]',    "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'publicite';
UPDATE "StaffTeam" SET "sections" = '["acquisition"]',  "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'seo';
