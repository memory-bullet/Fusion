-- AlterTable
ALTER TABLE "ProjectDocument" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectDocument" ADD COLUMN "originalFileName" TEXT;
ALTER TABLE "ProjectDocument" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "ProjectDocument" ADD COLUMN "fileSize" INTEGER;
ALTER TABLE "ProjectDocument" ADD COLUMN "storageKey" TEXT;
