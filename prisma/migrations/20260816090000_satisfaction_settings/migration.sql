-- Réglages de la collecte de satisfaction.
--
-- Table à ligne unique, entièrement facultative : tant qu'elle est vide, le
-- système applique les défauts du code. Additive et rejouable.

CREATE TABLE IF NOT EXISTS "SatisfactionSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN,
    "periodicEnabled" BOOLEAN,
    "activityEnabled" BOOLEAN,
    "periodicMinDays" INTEGER,
    "periodicMaxDays" INTEGER,
    "activityThreshold" INTEGER,
    "burstWindowHours" INTEGER,
    "cooldownDays" INTEGER,
    "maxSendsPerRun" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SatisfactionSetting_pkey" PRIMARY KEY ("id")
);
