-- AlterTable
ALTER TABLE "ProjectDocument" ADD COLUMN "fileHash" TEXT;
ALTER TABLE "ProjectDocument" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "ProjectDocument" ADD COLUMN "reviewComment" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectDocument" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "ProjectDocument" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "ProjectDocument" ADD COLUMN "pointsAwarded" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ProjectDocument_projectId_authorId_fileHash_idx" ON "ProjectDocument"("projectId", "authorId", "fileHash");
