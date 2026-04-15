import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { prismaHasNotificationModels } from "@/lib/prisma-notifications";

const patchSchema = z.object({
  read: z.boolean().optional()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!prismaHasNotificationModels(prisma)) {
      return NextResponse.json(
        { error: "通知服务未就绪，请执行 prisma generate 与 db push 后重启。" },
        { status: 503 }
      );
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "需要登录" }, { status: 401 });
    }

    const { id } = await params;
    let body: z.infer<typeof patchSchema>;
    try {
      body = patchSchema.parse(await request.json());
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
      }
      throw error;
    }

    const existing = await prisma.userNotification.findFirst({
      where: { id, userId }
    });
    if (!existing) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }

    if (body.read === true) {
      const updated = await prisma.userNotification.update({
        where: { id },
        data: { readAt: existing.readAt ?? new Date() }
      });
      return NextResponse.json({
        notification: {
          id: updated.id,
          readAt: updated.readAt?.toISOString() ?? null
        }
      });
    }

    return NextResponse.json({ error: "无可执行操作" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败" },
      { status: 400 }
    );
  }
}
