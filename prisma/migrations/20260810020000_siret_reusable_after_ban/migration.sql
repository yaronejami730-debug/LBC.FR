-- Un SIRET est un identifiant public : il n'appartient pas au fraudeur qui l'a
-- recopié. Le bannir reviendrait à interdire à l'entreprise réelle — Apple,
-- Sony, n'importe quelle PME usurpée — d'ouvrir un jour son propre compte.
--
-- Le SIRET reste donc réutilisable. Il devient un signal porté par le dossier
-- de vérification, examiné par un modérateur sur pièces.
ALTER TABLE "ProVerification"
    ADD COLUMN IF NOT EXISTS "siretPreviouslyBanned" BOOLEAN NOT NULL DEFAULT false;

-- Les comptes déjà bannis relâchent le SIRET qu'ils retenaient : la colonne
-- User.siret est unique, et tant qu'un banni l'occupe l'entreprise réelle se
-- voit répondre « ce SIRET est déjà associé à un compte ».
UPDATE "User" SET "siret" = NULL WHERE "bannedAt" IS NOT NULL AND "siret" IS NOT NULL;
