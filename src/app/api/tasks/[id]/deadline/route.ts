import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectOwner } from "@/lib/auth";

const updateDeadlineSchema = z.object({
  deadline: z.string().datetime()
});

/** PATCH /api/tasks/[id]/deadline — 修改任务截止时间（仅组长） */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = updateDeadlineSchema.parse(await request.json());

    // 获取任务所属项目
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true }
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // 验证是否为项目组长
    await requireProjectOwner(task.projectId);

    // 更新任务截止时间
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { deadline: new Date(body.deadline) },
      select: { id: true, deadline: true }
    });

    return NextResponse.json({ ok: true, task: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "格式错误" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败" },
      { status: 400 }
    );
  }
}
