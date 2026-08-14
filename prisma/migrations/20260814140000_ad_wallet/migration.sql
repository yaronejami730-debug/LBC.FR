-- Portefeuille prépayé et factures de la régie.
CREATE TABLE "AdWalletTransaction" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfterCents" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "campaignId" TEXT,
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdWalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdWalletTransaction_stripeSessionId_key" ON "AdWalletTransaction"("stripeSessionId");
CREATE INDEX "AdWalletTransaction_advertiserId_createdAt_idx" ON "AdWalletTransaction"("advertiserId", "createdAt");
CREATE INDEX "AdWalletTransaction_type_createdAt_idx" ON "AdWalletTransaction"("type", "createdAt");
ALTER TABLE "AdWalletTransaction" ADD CONSTRAINT "AdWalletTransaction_advertiserId_fkey"
    FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdInvoice" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amountCentsHT" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "amountCentsTTC" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "stripeSessionId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdInvoice_number_key" ON "AdInvoice"("number");
CREATE UNIQUE INDEX "AdInvoice_stripeSessionId_key" ON "AdInvoice"("stripeSessionId");
CREATE INDEX "AdInvoice_advertiserId_issuedAt_idx" ON "AdInvoice"("advertiserId", "issuedAt");
ALTER TABLE "AdInvoice" ADD CONSTRAINT "AdInvoice_advertiserId_fkey"
    FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
