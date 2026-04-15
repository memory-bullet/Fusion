-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "workloadPoints" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "deadline" DATETIME NOT NULL,
    "warningLevel" TEXT NOT NULL DEFAULT 'NORMAL',
    "isReallocated" BOOLEAN NOT NULL DEFAULT false,
    "ultimatumLevel" TEXT NOT NULL DEFAULT 'NONE',
    "ultimatumWarnNotifiedAt" DATETIME,
    "ultimatumRedNotifiedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "createdAt", "deadline", "deletedAt", "id", "isReallocated", "projectId", "sourceLabel", "status", "title", "ultimatumLevel", "ultimatumRedNotifiedAt", "ultimatumWarnNotifiedAt", "updatedAt", "warningLevel", "workloadPoints") SELECT "assigneeId", "createdAt", "deadline", "deletedAt", "id", "isReallocated", "projectId", "sourceLabel", "status", "title", "ultimatumLevel", "ultimatumRedNotifiedAt", "ultimatumWarnNotifiedAt", "updatedAt", "warningLevel", "workloadPoints" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
