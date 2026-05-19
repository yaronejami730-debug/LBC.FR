-- AddColumn (idempotent)
ALTER TABLE "HeroBanner" ADD COLUMN IF NOT EXISTS "showText" BOOLEAN NOT NULL DEFAULT true;
