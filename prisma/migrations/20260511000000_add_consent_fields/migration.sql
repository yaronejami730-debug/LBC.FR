-- AlterTable: add RGPD consent tracking fields to User
ALTER TABLE "User" ADD COLUMN "consentGivenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
