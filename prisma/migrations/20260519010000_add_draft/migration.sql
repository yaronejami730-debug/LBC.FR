-- CreateTable (idempotent — la table peut préexister via `prisma db push`)
CREATE TABLE IF NOT EXISTS "Draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "category" TEXT,
    "step" INTEGER NOT NULL DEFAULT 0,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- AddColumn (table préexistante : complète les colonnes manquantes)
ALTER TABLE "Draft" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Draft" ADD COLUMN IF NOT EXISTS "step" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Draft" ADD COLUMN IF NOT EXISTS "completeness" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Draft_userId_key" ON "Draft"("userId");
CREATE INDEX IF NOT EXISTS "Draft_updatedAt_idx" ON "Draft"("updatedAt");

-- AddForeignKey (idempotent — ignore si la contrainte existe déjà)
DO $$ BEGIN
  ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
