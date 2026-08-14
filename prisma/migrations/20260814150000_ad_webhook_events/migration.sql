-- Idempotence des webhooks Stripe de la régie : un événement rejoué ne
-- crédite pas deux fois.
CREATE TABLE "AdWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    CONSTRAINT "AdWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdWebhookEvent_processedAt_idx" ON "AdWebhookEvent"("processedAt");
