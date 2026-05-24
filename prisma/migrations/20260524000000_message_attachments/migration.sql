-- Pièces jointes dans la messagerie : image ou PDF.
ALTER TABLE "Message" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentType" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentName" TEXT;
