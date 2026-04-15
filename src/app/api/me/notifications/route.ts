import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { prismaHasNotificationModels } from "@/lib/prisma-notifications";

function serialize(n: {
  id: string;
  userId: string;
  projectId: string | null;
  kind: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    userId: n.userId,
    projectId: n.projectId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    actionUrl: n.actionUrl,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString()
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!prismaHasNotificationModels(prisma)) {
      return NextResponse.json(
        {
          error:
            "服务端的 Prisma 客户端未包含通知模型。请停止 npm run dev，执行 npx prisma generate，再执行 npx prisma db push，然后重启。"
        },
        { status: 503 }
      );
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "需要登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "1" || searchParams.get("unreadOnly") === "true";
    const limit = Math.min(Number(searchParams.get("limit") ?? "50") || 50, 100);

    const rows = await prisma.userNotification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return NextResponse.json({ notifications: rows.map(serialize) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载失败";
    return NextResponse.json(
      {
        error:
          message.includes("UserNotification") || message.includes("no such table")
            ? "数据库尚未包含通知表，请先停止 dev 后执行：npx prisma db push && npx prisma generate"
            : message
      },
      { status: 500 }
    );
  }
}
