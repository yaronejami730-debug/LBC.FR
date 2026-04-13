-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "hidePhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT;
