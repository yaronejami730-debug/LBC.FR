-- Équipes internes : qui fait quoi dans l'administration.
--
-- Jusqu'ici, un seul niveau : `User.role = "ADMIN"`, c'est-à-dire tout ou rien.
-- Quelqu'un embauché pour répondre au support pouvait supprimer des comptes et
-- lire les pièces d'identité des professionnels. C'est le problème que ces
-- tables règlent — le rôle `ADMIN` reste la porte d'entrée de
-- l'administration, l'appartenance à une équipe dit ce qu'on y fait.
--
-- Une table d'équipes plutôt qu'une colonne `staffRole` : quelqu'un fait
-- souvent deux choses (support *et* modération), et une colonne unique
-- obligerait à créer des rôles combinés qui se multiplient.
CREATE TABLE "StaffTeam" (
    "id" TEXT NOT NULL,
    -- Identifiant stable utilisé dans le code : support, moderation, pro,
    -- publicite, seo, direction.
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    -- Sections d'administration ouvertes à cette équipe (JSON, clés de
    -- `lib/admin/sections.ts`). Vide = aucune.
    "sections" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffTeam_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffTeam_slug_key" ON "StaffTeam"("slug");

CREATE TABLE "StaffMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    -- Qui a accordé l'accès, et quand : un droit sans trace ne se retire pas
    -- avec confiance.
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffMembership_userId_teamId_key" ON "StaffMembership"("userId", "teamId");
CREATE INDEX "StaffMembership_teamId_idx" ON "StaffMembership"("teamId");

ALTER TABLE "StaffMembership" ADD CONSTRAINT "StaffMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffMembership" ADD CONSTRAINT "StaffMembership_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "StaffTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les équipes de départ, correspondant aux chapitres de l'administration.
-- « Direction » a tout : sans elle, la première migration créerait un système
-- de droits dont personne ne détient la clé.
INSERT INTO "StaffTeam" ("id", "slug", "label", "description", "sections", "updatedAt") VALUES
    ('team_direction', 'direction', 'Direction', 'Accès complet à l''administration.', '["*"]', CURRENT_TIMESTAMP),
    ('team_moderation', 'moderation', 'Modération', 'Annonces, signalements, sécurité, comptes utilisateurs.', '["listings","securite","users","categories","categorisation"]', CURRENT_TIMESTAMP),
    ('team_support', 'support', 'Support client', 'Discussions avec les utilisateurs et satisfaction.', '["support","satisfaction","notifications"]', CURRENT_TIMESTAMP),
    ('team_pro', 'pro', 'Comptes professionnels', 'Vérification des professionnels et de leurs pièces.', '["professionnels"]', CURRENT_TIMESTAMP),
    ('team_publicite', 'publicite', 'Publicité', 'Régie, annonceurs, campagnes et diffusion.', '["publicite","crm","banniere"]', CURRENT_TIMESTAMP),
    ('team_seo', 'seo', 'Acquisition', 'SEO, recommandations et moteur comportemental.', '["seo","recommandations","behavioral"]', CURRENT_TIMESTAMP);
