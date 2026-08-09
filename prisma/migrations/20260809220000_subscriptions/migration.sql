-- Abonnements aux vendeurs. Un abonné est prévenu des nouvelles annonces,
-- regroupées en un seul email grâce à "lastNotifiedAt".
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3),
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_followerId_sellerId_key" ON "Subscription"("followerId", "sellerId");
CREATE INDEX IF NOT EXISTS "Subscription_sellerId_idx" ON "Subscription"("sellerId");
CREATE INDEX IF NOT EXISTS "Subscription_followerId_idx" ON "Subscription"("followerId");

ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_followerId_fkey"
    FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
