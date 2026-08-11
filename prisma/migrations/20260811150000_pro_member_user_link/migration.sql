-- Rattachement d'une ligne d'équipe au compte Deal&Co personnel de la personne.
--
-- Corinne est coiffeuse au salon (ligne `ProMember`) et peut, par ailleurs,
-- avoir un compte Deal&Co à elle. Ce sont deux choses distinctes : ce lien
-- permet seulement d'afficher son agenda professionnel dans son espace
-- personnel, et disparaît de fait si le salon lui retire son accès.
ALTER TABLE "ProMember" ADD COLUMN "userId" TEXT;

CREATE INDEX "ProMember_userId_idx" ON "ProMember"("userId");

ALTER TABLE "ProMember" ADD CONSTRAINT "ProMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
