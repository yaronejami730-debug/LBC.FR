-- AlterTable: Add role and adminNote to User
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "adminNote" TEXT;

-- AlterTable: Add status and rejectionReason to Listing
-- Existing rows get status='APPROVED' so they remain publicly visible
ALTER TABLE "Listing" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Listing" ADD COLUMN "rejectionReason" TEXT;

-- CreateTable: Advertisement
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);
