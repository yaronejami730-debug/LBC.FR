-- Stripe Connect : encaissement par le professionnel, jamais par la plateforme.
--
-- Additif seulement : colonnes nullables ou avec défaut, deux tables neuves.
-- Aucune donnée existante n'est réécrite.

-- ── Compte connecté de l'établissement ──────────────────────────────────────
ALTER TABLE "ProProfile" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "ProProfile" ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProProfile" ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProProfile" ADD COLUMN "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProProfile" ADD COLUMN "stripeDisabledReason" TEXT;
ALTER TABLE "ProProfile" ADD COLUMN "stripeConnectedAt" TIMESTAMP(3);
ALTER TABLE "ProProfile" ADD COLUMN "stripeDisconnectedAt" TIMESTAMP(3);
ALTER TABLE "ProProfile" ADD COLUMN "stripeUpdatedAt" TIMESTAMP(3);
ALTER TABLE "ProProfile" ADD COLUMN "stripePayoutIssue" TEXT;
ALTER TABLE "ProProfile" ADD COLUMN "stripePayoutIssueAt" TIMESTAMP(3);
ALTER TABLE "ProProfile" ADD COLUMN "onlinePaymentRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "ProProfile_stripeAccountId_key" ON "ProProfile"("stripeAccountId");

-- ── État de paiement porté par le rendez-vous ───────────────────────────────
ALTER TABLE "ProBooking" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "ProBooking" ADD COLUMN "paidAt" TIMESTAMP(3);

-- ── Paiement en ligne d'un rendez-vous ──────────────────────────────────────
CREATE TABLE "ProBookingPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" TEXT NOT NULL DEFAULT 'REQUIRES_PAYMENT',
    "failureMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProBookingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProBookingPayment_bookingId_key" ON "ProBookingPayment"("bookingId");
CREATE UNIQUE INDEX "ProBookingPayment_stripeCheckoutSessionId_key" ON "ProBookingPayment"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "ProBookingPayment_stripePaymentIntentId_key" ON "ProBookingPayment"("stripePaymentIntentId");
CREATE INDEX "ProBookingPayment_profileId_status_idx" ON "ProBookingPayment"("profileId", "status");
CREATE INDEX "ProBookingPayment_stripeAccountId_idx" ON "ProBookingPayment"("stripeAccountId");

ALTER TABLE "ProBookingPayment" ADD CONSTRAINT "ProBookingPayment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "ProBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProBookingPayment" ADD CONSTRAINT "ProBookingPayment_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "ProProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Journal d'événements Stripe : idempotence des webhooks ──────────────────
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accountId" TEXT,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StripeWebhookEvent_accountId_type_idx" ON "StripeWebhookEvent"("accountId", "type");
CREATE INDEX "StripeWebhookEvent_processedAt_idx" ON "StripeWebhookEvent"("processedAt");
