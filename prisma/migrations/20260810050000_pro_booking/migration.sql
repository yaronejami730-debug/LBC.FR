-- Module professionnel : équipe, disponibilités et réservation.
--
-- `ProProfile` portait déjà la fiche d'établissement et `ProService` la carte
-- des prestations (label + durationMin + price). Il manquait tout ce qui rend
-- un rendez-vous possible : qui travaille, quand, et ce qui est déjà pris.
--
-- Les horaires sont stockés en minutes depuis minuit, pas en chaînes « 09:00 ».
-- `ProProfile.hours` reste le texte affiché sur la fiche publique ; le moteur
-- de créneaux ne lit que les tables ci-dessous. Deux sources parce que ce sont
-- deux usages : l'une est décorative, l'autre est opposable.

-- Une prestation peut quitter la carte sans être supprimée (les rendez-vous
-- passés la référencent), et une ligne « sur devis » reste affichée sans être
-- réservable.
ALTER TABLE "ProService" ADD COLUMN IF NOT EXISTS "isActive"   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProService" ADD COLUMN IF NOT EXISTS "isBookable" BOOLEAN NOT NULL DEFAULT true;

-- Un membre d'équipe n'est pas un `User` : une coiffeuse n'a pas forcément de
-- compte Deal&Co, et le salon doit pouvoir gérer son planning dès le jour un.
CREATE TABLE IF NOT EXISTS "ProMember" (
  "id"          TEXT NOT NULL,
  "profileId"   TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role"        TEXT,
  "avatar"      TEXT,
  "color"       TEXT NOT NULL DEFAULT '#2f6fb8',
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "position"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProMember_profileId_isActive_position_idx"
  ON "ProMember"("profileId", "isActive", "position");

-- Qui sait faire quoi. Sans ligne ici, le membre n'est jamais proposé pour la
-- prestation — c'est ce qui alimente l'étape « choisir le professionnel ».
CREATE TABLE IF NOT EXISTS "ProMemberService" (
  "id"        TEXT NOT NULL,
  "memberId"  TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "ProMemberService_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProMemberService_memberId_serviceId_key"
  ON "ProMemberService"("memberId", "serviceId");
CREATE INDEX IF NOT EXISTS "ProMemberService_serviceId_idx"
  ON "ProMemberService"("serviceId");

-- Horaires récurrents. Deux plages le même jour (matin / après-midi) = deux
-- lignes ; c'est ce qui évite d'inventer une syntaxe de pause dans l'horaire.
CREATE TABLE IF NOT EXISTS "ProWorkingHours" (
  "id"       TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "weekday"  INTEGER NOT NULL,
  "startMin" INTEGER NOT NULL,
  "endMin"   INTEGER NOT NULL,
  CONSTRAINT "ProWorkingHours_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProWorkingHours_memberId_weekday_idx"
  ON "ProWorkingHours"("memberId", "weekday");

-- Pause récurrente : la coupure déjeuner, typiquement.
CREATE TABLE IF NOT EXISTS "ProBreak" (
  "id"       TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "weekday"  INTEGER NOT NULL,
  "startMin" INTEGER NOT NULL,
  "endMin"   INTEGER NOT NULL,
  "label"    TEXT,
  CONSTRAINT "ProBreak_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProBreak_memberId_weekday_idx"
  ON "ProBreak"("memberId", "weekday");

-- Absence ponctuelle : congés, formation. Datée, contrairement à ProBreak.
CREATE TABLE IF NOT EXISTS "ProTimeOff" (
  "id"        TEXT NOT NULL,
  "memberId"  TEXT NOT NULL,
  "startAt"   TIMESTAMP(3) NOT NULL,
  "endAt"     TIMESTAMP(3) NOT NULL,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProTimeOff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProTimeOff_memberId_startAt_endAt_idx"
  ON "ProTimeOff"("memberId", "startAt", "endAt");

-- Le rendez-vous.
--
-- `priceSnapshot` / `durationSnapshot` / `labelSnapshot` figent la prestation :
-- le salon qui change ses tarifs demain ne doit pas réécrire le prix d'un
-- rendez-vous déjà pris.
--
-- `customerId` est nullable : on réserve sans compte, les coordonnées vivent
-- alors sur la ligne.
CREATE TABLE IF NOT EXISTS "ProBooking" (
  "id"               TEXT NOT NULL,
  "profileId"        TEXT NOT NULL,
  "memberId"         TEXT NOT NULL,
  "serviceId"        TEXT NOT NULL,
  "customerId"       TEXT,
  "startAt"          TIMESTAMP(3) NOT NULL,
  "endAt"            TIMESTAMP(3) NOT NULL,
  "firstName"        TEXT NOT NULL,
  "lastName"         TEXT NOT NULL,
  "phone"            TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "note"             TEXT,
  "priceSnapshot"    DOUBLE PRECISION NOT NULL,
  "durationSnapshot" INTEGER NOT NULL,
  "labelSnapshot"    TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  "confirmedAt"      TIMESTAMP(3),
  "cancelledAt"      TIMESTAMP(3),
  "cancelReason"     TEXT,
  "cancelledBy"      TEXT,
  CONSTRAINT "ProBooking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProBooking_profileId_startAt_idx"  ON "ProBooking"("profileId", "startAt");
CREATE INDEX IF NOT EXISTS "ProBooking_memberId_startAt_idx"   ON "ProBooking"("memberId", "startAt");
CREATE INDEX IF NOT EXISTS "ProBooking_customerId_startAt_idx" ON "ProBooking"("customerId", "startAt");
CREATE INDEX IF NOT EXISTS "ProBooking_status_startAt_idx"     ON "ProBooking"("status", "startAt");

-- Règles de réservation. Les valeurs par défaut décrivent un salon classique :
-- un pro doit pouvoir ouvrir la réservation sans rien régler.
CREATE TABLE IF NOT EXISTS "ProBookingSettings" (
  "id"                 TEXT NOT NULL,
  "profileId"          TEXT NOT NULL,
  "slotGranularityMin" INTEGER NOT NULL DEFAULT 15,
  "bufferMin"          INTEGER NOT NULL DEFAULT 0,
  "minNoticeMin"       INTEGER NOT NULL DEFAULT 120,
  "maxAdvanceDays"     INTEGER NOT NULL DEFAULT 60,
  "autoConfirm"        BOOLEAN NOT NULL DEFAULT true,
  "allowCancel"        BOOLEAN NOT NULL DEFAULT true,
  "allowReschedule"    BOOLEAN NOT NULL DEFAULT true,
  "cancelDeadlineMin"  INTEGER NOT NULL DEFAULT 1440,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProBookingSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProBookingSettings_profileId_key"
  ON "ProBookingSettings"("profileId");

-- Clés étrangères.
--
-- Supprimer un membre efface son planning (horaires, pauses, absences) mais
-- pas ses rendez-vous : RESTRICT sur ProBooking force le pro à traiter les
-- rendez-vous en cours avant de retirer quelqu'un de l'équipe. Un historique
-- de réservations qui disparaît, c'est un litige client sans preuve.
ALTER TABLE "ProMember"
  ADD CONSTRAINT "ProMember_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProMemberService"
  ADD CONSTRAINT "ProMemberService_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "ProMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProMemberService"
  ADD CONSTRAINT "ProMemberService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "ProService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProWorkingHours"
  ADD CONSTRAINT "ProWorkingHours_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "ProMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProBreak"
  ADD CONSTRAINT "ProBreak_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "ProMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProTimeOff"
  ADD CONSTRAINT "ProTimeOff_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "ProMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProBooking"
  ADD CONSTRAINT "ProBooking_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProBooking"
  ADD CONSTRAINT "ProBooking_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "ProMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProBooking"
  ADD CONSTRAINT "ProBooking_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "ProService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProBooking"
  ADD CONSTRAINT "ProBooking_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProBookingSettings"
  ADD CONSTRAINT "ProBookingSettings_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Anti double-réservation
-- ---------------------------------------------------------------------------
--
-- Deux clients peuvent demander le même créneau à la même milliseconde. Un
-- SELECT de vérification suivi d'un INSERT ne protège de rien : les deux
-- transactions lisent « libre » avant que l'une n'écrive.
--
-- La seule garantie qui tienne est posée par PostgreSQL lui-même. La contrainte
-- d'exclusion refuse deux rendez-vous dont les intervalles se chevauchent pour
-- le même membre. La transaction perdante reçoit une erreur 23P01, que l'API
-- traduit en « créneau déjà pris » (409).
--
-- La clause WHERE est ce qui rend le créneau réutilisable : un rendez-vous
-- annulé ou marqué absent ne bloque plus rien. Elle doit rester alignée sur
-- les statuts « occupants » de lib/booking/status.ts.
--
-- Bornes [) : un rendez-vous qui finit à 14h45 et un autre qui commence à
-- 14h45 ne se chevauchent pas.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ProBooking" DROP CONSTRAINT IF EXISTS "ProBooking_no_overlap";
ALTER TABLE "ProBooking" ADD CONSTRAINT "ProBooking_no_overlap"
  EXCLUDE USING gist (
    "memberId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'));
