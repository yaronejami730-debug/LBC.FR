-- Abonnés à la revue de presse.
--
-- Table à part de `User`, et délibérément : l'abonnement ne suppose pas de
-- compte. Quelqu'un qui lit la revue de presse et veut être prévenu n'a aucune
-- raison de s'inscrire au site d'annonces d'abord — le lui imposer, c'est
-- perdre l'abonné.
--
-- `confirmedAt` reste nul tant que la personne n'a pas cliqué le lien reçu par
-- mail, et aucun envoi n'a lieu avant. Sans cette double confirmation,
-- n'importe qui peut abonner l'adresse d'un tiers, et nous n'avons aucune
-- preuve de consentement à opposer le jour où on nous la demande.
CREATE TABLE IF NOT EXISTS "NewsSubscriber" (
    "id"             TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    -- Rubriques suivies, en JSON : ["societe","emploi"]. Tableau vide = toutes,
    -- ce qui évite de réécrire chaque abonnement le jour où une rubrique naît.
    "sections"       TEXT NOT NULL DEFAULT '[]',
    -- 'alerte' (au fil de l'eau, plafonné) ou 'resume' (un mail à 20 h).
    "mode"           TEXT NOT NULL DEFAULT 'resume',
    "confirmedAt"    TIMESTAMP(3),
    -- La ligne est conservée au désabonnement : c'est elle qui prouve l'opt-out.
    "unsubscribedAt" TIMESTAMP(3),
    "token"          TEXT NOT NULL,
    "lastAlertAt"    TIMESTAMP(3),
    -- Le plafond quotidien : l'écart de quatre heures ne suffit pas à lui seul,
    -- six envois espacés de quatre heures tiendraient dans une journée.
    "alertCount"     INTEGER NOT NULL DEFAULT 0,
    "alertDay"       TIMESTAMP(3),
    "lastDigestAt"   TIMESTAMP(3),
    "userId"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NewsSubscriber_email_key" ON "NewsSubscriber"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "NewsSubscriber_token_key" ON "NewsSubscriber"("token");
-- L'index de sélection des destinataires : le cron interroge toujours par mode,
-- confirmation et désabonnement.
CREATE INDEX IF NOT EXISTS "NewsSubscriber_mode_confirmedAt_unsubscribedAt_idx"
    ON "NewsSubscriber"("mode", "confirmedAt", "unsubscribedAt");
CREATE INDEX IF NOT EXISTS "NewsSubscriber_createdAt_idx" ON "NewsSubscriber"("createdAt");
