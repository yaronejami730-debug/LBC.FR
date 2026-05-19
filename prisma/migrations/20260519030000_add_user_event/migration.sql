-- CreateTable (idempotent — la table peut préexister via `prisma db push`)
CREATE TABLE IF NOT EXISTS "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "kind" TEXT NOT NULL,
    "path" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserEvent_userId_kind_createdAt_idx" ON "UserEvent"("userId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "UserEvent_kind_createdAt_idx" ON "UserEvent"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "UserEvent_sessionId_createdAt_idx" ON "UserEvent"("sessionId", "createdAt");
