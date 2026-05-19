-- CreateTable (idempotent — la table peut préexister via `prisma db push`)
CREATE TABLE IF NOT EXISTS "EmailEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "emailType" TEXT NOT NULL DEFAULT 'transactional',
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailEvent_userId_kind_idx" ON "EmailEvent"("userId", "kind");
CREATE INDEX IF NOT EXISTS "EmailEvent_emailType_kind_idx" ON "EmailEvent"("emailType", "kind");
CREATE INDEX IF NOT EXISTS "EmailEvent_createdAt_idx" ON "EmailEvent"("createdAt");
