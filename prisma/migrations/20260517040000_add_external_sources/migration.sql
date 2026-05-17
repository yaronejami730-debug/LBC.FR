-- Sources externes : sites à synchroniser vers les annonces Deal & Co.
CREATE TABLE "ExternalSource" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'bsk',
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalSource_ownerId_idx" ON "ExternalSource"("ownerId");

ALTER TABLE "ExternalSource"
  ADD CONSTRAINT "ExternalSource_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
