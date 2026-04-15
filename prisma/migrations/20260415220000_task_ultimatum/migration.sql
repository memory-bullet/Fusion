-- AlterTable
ALTER TABLE "Task" ADD COLUMN "ultimatumLevel" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Task" ADD COLUMN "ultimatumWarnNotifiedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "ultimatumRedNotifiedAt" DATETIME;
