import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

const activateSchema = z.object({
  presetId: z.string(),
  userId: z.string()
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const currentUserId = await requireUserId();
    const body = activateSchema.parse(await request.json());

    if (currentUserId !== body.userId) {
      return NextResponse.json({ error: "无权执行此操作" }, { status: 403 });
    }

    const preset = await prisma.memberPreset.findUnique({ where: { id: body.presetId } });
    if (!preset) {
      return NextResponse.json({ error: "预设成员不存在" }, { status: 404 });
    }
    if (preset.projectId !== projectId) {
      return NextResponse.json({ error: "预设成员不属于本项目" }, { status: 400 });
    }
    if (preset.activated) {
      return NextResponse.json({ error: "该成员已激活" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.memberPreset.update({
        where: { id: body.presetId },
        data: { activated: true, activatedBy: body.userId }
      });

      // 设置项目内昵称，而不是修改全局用户名
      await tx.projectMember.updateMany({
        where: { projectId, userId: body.userId },
        data: {
          joinedStatus: "ACTIVATED",
          projectNickname: preset.presetName
        }
      });

      await tx.actionLog.create({
        data: {
          projectId,
          userId: body.userId,
          actionType: "MEMBER_ACTIVATED",
          description: `${preset.presetName} 激活并加入项目`
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "激活失败" },
      { status: 400 }
    );
  }
}
