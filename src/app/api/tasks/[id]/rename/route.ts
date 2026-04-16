import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectOwner } from "@/lib/auth";

const renameSchema = z.object({
  title: z.string().min(1, "任务名称不能为空").max(200)
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = renameSchema.parse(await request.json());

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const userId = await requireProjectOwner(task.projectId);

    const updated = await prisma.task.update({
      where: { id },
      data: { title: body.title.trim() }
    });

    await prisma.actionLog.create({
      data: {
        projectId: task.projectId,
        userId,
        actionType: "TASK_RENAMED",
        description: `任务重命名：${task.title} -> ${updated.title}`
      }
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "重命名失败" },
      { status: 400 }
    );
  }
}
