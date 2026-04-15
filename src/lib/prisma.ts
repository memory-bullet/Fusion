import { PrismaClient } from "@prisma/client";
import { prismaHasNotificationModels } from "@/lib/prisma-notifications";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient();
}

function resolvePrisma(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    const stale = global.prisma;
    if (stale && !prismaHasNotificationModels(stale)) {
      void stale.$disconnect().catch(() => {});
      global.prisma = undefined;
    }
    if (!global.prisma) {
      global.prisma = createPrismaClient();
    }
    return global.prisma;
  }
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
  return global.prisma;
}

export const prisma = resolvePrisma();
