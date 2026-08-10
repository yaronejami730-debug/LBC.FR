-- Accès personnel des membres d'équipe à leur planning.
--
-- Un membre d'équipe n'est pas un compte Deal&Co : il ne publie pas, n'achète
-- pas, n'a pas de fiche. Il consulte les rendez-vous qui lui sont attribués.
-- Ses identifiants sont donc portés par la ligne d'équipe et générés par la
-- responsable du salon, pas obtenus par une inscription.
ALTER TABLE "ProMember" ADD COLUMN "loginId" TEXT;
ALTER TABLE "ProMember" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "ProMember" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProMember" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "ProMember" ADD COLUMN "accessRevokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ProMember_loginId_key" ON "ProMember"("loginId");
