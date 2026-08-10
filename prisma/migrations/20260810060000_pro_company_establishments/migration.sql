-- Compte / Entreprise / Établissement.
--
-- Jusqu'ici, `ProProfile.userId` était UNIQUE : un compte professionnel ne
-- pouvait porter qu'une seule fiche. C'était l'hypothèse « 1 compte = 1
-- boutique », qui interdit à une SARL d'exploiter trois salons sans ouvrir
-- trois comptes et trois adresses email.
--
-- La hiérarchie devient :
--   User  →  ProAccess  →  ProCompany  →  ProProfile (l'établissement)
--
-- Aucune donnée n'est supprimée. Les nouvelles colonnes arrivent nullables,
-- sont remplies depuis l'existant, et ne deviendront obligatoires qu'une fois
-- le remplissage vérifié.

-- ── L'entreprise ──────────────────────────────────────────────────────────
--
-- `User.siret` et `User.companyName` restent en place : la vérification
-- professionnelle, le registre anti-réinscription et la détection de fraude
-- s'appuient dessus. Cette table est la source de vérité de ce qui est affiché
-- et facturé, pas de l'habilitation.
CREATE TABLE IF NOT EXISTS "ProCompany" (
  "id"             TEXT NOT NULL,
  "legalName"      TEXT NOT NULL,
  "tradeName"      TEXT,
  "siret"          TEXT,
  "legalForm"      TEXT,
  "vatNumber"      TEXT,
  "billingEmail"   TEXT,
  "billingAddress" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProCompany_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProCompany_siret_idx" ON "ProCompany"("siret");

-- ── Les droits ────────────────────────────────────────────────────────────
--
-- À ne pas confondre avec `ProMember`, qui est la personne qu'on planifie.
-- `ProAccess` est le compte qui administre. Une même personne peut être
-- propriétaire de sa société et salariée d'une autre : deux lignes, aucun cas
-- particulier.
CREATE TABLE IF NOT EXISTS "ProAccess" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "companyId"        TEXT NOT NULL,
  "role"             TEXT NOT NULL DEFAULT 'OWNER',
  "establishmentIds" TEXT NOT NULL DEFAULT '[]',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProAccess_userId_companyId_key" ON "ProAccess"("userId", "companyId");
CREATE INDEX IF NOT EXISTS "ProAccess_companyId_role_idx" ON "ProAccess"("companyId", "role");

-- ── Un membre, plusieurs établissements ───────────────────────────────────
--
-- Dupliquer un membre par salon serait un piège : la contrainte d'exclusion
-- anti-double-booking porte sur "memberId", donc deux lignes distinctes
-- laisseraient Nathalie être réservée à 14h00 dans les deux salons à la fois.
CREATE TABLE IF NOT EXISTS "ProMemberEstablishment" (
  "id"        TEXT NOT NULL,
  "memberId"  TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  CONSTRAINT "ProMemberEstablishment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProMemberEstablishment_memberId_profileId_key"
  ON "ProMemberEstablishment"("memberId", "profileId");
CREATE INDEX IF NOT EXISTS "ProMemberEstablishment_profileId_idx"
  ON "ProMemberEstablishment"("profileId");

-- ── Nouvelles colonnes ────────────────────────────────────────────────────
ALTER TABLE "ProProfile" ADD COLUMN IF NOT EXISTS "companyId"    TEXT;
ALTER TABLE "ProProfile" ADD COLUMN IF NOT EXISTS "activityType" TEXT;
ALTER TABLE "ProProfile" ADD COLUMN IF NOT EXISTS "capabilities" TEXT NOT NULL DEFAULT '[]';

-- Horaires et pauses par établissement : la coupure déjeuner d'un salon n'est
-- pas celle de l'autre, et Nathalie peut être à Paris le lundi et à Neuilly le
-- jeudi.
ALTER TABLE "ProWorkingHours" ADD COLUMN IF NOT EXISTS "profileId" TEXT;
ALTER TABLE "ProBreak"        ADD COLUMN IF NOT EXISTS "profileId" TEXT;

-- L'annonce appartient à l'établissement qui la publie. Tant que la relation
-- compte → établissement était bijective, on pouvait la déduire ; avec
-- plusieurs boutiques, la déduction devient impossible. Le remplissage
-- ci-dessous est donc à faire maintenant, pendant qu'elle l'est encore.
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "establishmentId" TEXT;

-- ── Remplissage ───────────────────────────────────────────────────────────

-- Une entreprise par fiche existante. `md5` sur l'id de la fiche donne un
-- identifiant stable : rejouer la migration ne crée pas de doublon.
INSERT INTO "ProCompany" ("id", "legalName", "tradeName", "siret", "createdAt", "updatedAt")
SELECT
  'cmp_' || md5(p."id"),
  COALESCE(NULLIF(u."companyName", ''), p."name"),
  p."name",
  u."siret",
  p."createdAt",
  CURRENT_TIMESTAMP
FROM "ProProfile" p
JOIN "User" u ON u."id" = p."userId"
WHERE p."companyId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "ProProfile" p
SET "companyId" = 'cmp_' || md5(p."id")
WHERE p."companyId" IS NULL;

-- Le créateur devient propriétaire de son entreprise.
INSERT INTO "ProAccess" ("id", "userId", "companyId", "role", "createdAt")
SELECT 'acc_' || md5(p."userId" || p."companyId"), p."userId", p."companyId", 'OWNER', CURRENT_TIMESTAMP
FROM "ProProfile" p
WHERE p."companyId" IS NOT NULL
ON CONFLICT ("userId", "companyId") DO NOTHING;

-- Les membres existants sont rattachés à l'établissement qui les porte déjà.
INSERT INTO "ProMemberEstablishment" ("id", "memberId", "profileId")
SELECT 'mes_' || md5(m."id" || m."profileId"), m."id", m."profileId"
FROM "ProMember" m
ON CONFLICT ("memberId", "profileId") DO NOTHING;

-- Les plannings héritent de l'établissement de leur membre.
UPDATE "ProWorkingHours" h
SET "profileId" = m."profileId"
FROM "ProMember" m
WHERE m."id" = h."memberId" AND h."profileId" IS NULL;

UPDATE "ProBreak" b
SET "profileId" = m."profileId"
FROM "ProMember" m
WHERE m."id" = b."memberId" AND b."profileId" IS NULL;

-- Les annonces professionnelles rejoignent l'établissement de leur auteur.
-- Les annonces de particuliers gardent `establishmentId` nul, c'est leur état
-- normal et définitif.
UPDATE "Listing" l
SET "establishmentId" = p."id"
FROM "ProProfile" p
WHERE p."userId" = l."userId"
  AND l."postedAs" = 'PRO'
  AND l."establishmentId" IS NULL;

-- ── Levée de la contrainte historique ─────────────────────────────────────
--
-- C'est la ligne qui interdisait le multi-établissement. La colonne reste :
-- elle devient la trace du créateur, l'autorité passe à "ProAccess".
DROP INDEX IF EXISTS "ProProfile_userId_key";

-- ── Clés étrangères ───────────────────────────────────────────────────────
ALTER TABLE "ProAccess"
  ADD CONSTRAINT "ProAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProAccess"
  ADD CONSTRAINT "ProAccess_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "ProCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProProfile"
  ADD CONSTRAINT "ProProfile_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "ProCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProMemberEstablishment"
  ADD CONSTRAINT "ProMemberEstablishment_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "ProMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProMemberEstablishment"
  ADD CONSTRAINT "ProMemberEstablishment_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProWorkingHours"
  ADD CONSTRAINT "ProWorkingHours_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProBreak"
  ADD CONSTRAINT "ProBreak_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL et non CASCADE : la fermeture d'une boutique ne doit pas effacer
-- l'historique de ses annonces.
ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_establishmentId_fkey"
  FOREIGN KEY ("establishmentId") REFERENCES "ProProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ProProfile_companyId_idx"        ON "ProProfile"("companyId");
CREATE INDEX IF NOT EXISTS "ProProfile_userId_idx"           ON "ProProfile"("userId");
CREATE INDEX IF NOT EXISTS "ProWorkingHours_profileId_weekday_idx" ON "ProWorkingHours"("profileId", "weekday");
CREATE INDEX IF NOT EXISTS "ProBreak_profileId_weekday_idx"        ON "ProBreak"("profileId", "weekday");
CREATE INDEX IF NOT EXISTS "Listing_establishmentId_idx"      ON "Listing"("establishmentId");
