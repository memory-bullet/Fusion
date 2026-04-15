import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { prismaHasNotificationModels } from "@/lib/prisma-notifications";

export async function GET() {
  try {
    if (!prismaHasNotificationModels(prisma)) {
      return NextResponse.json({ count: 0 });
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "需要登录" }, { status: 401 });
    }

    const count = await prisma.userNotification.count({
      where: { userId, readAt: null }
    });

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
