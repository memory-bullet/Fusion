import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectOwner } from "@/lib/auth";

const bodySchema = z.object({
  workloadPoints: z.number().int().positive().max(10_000)
});

/** PATCH /api/tasks/[id]/workload — 组长修改任务工作量（点） */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const body = bodySchema.parse(await request.json());

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, projectId: true, workloadPoints: true }
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const userId = await requireProjectOwner(task.projectId);

    if (task.workloadPoints === body.workloadPoints) {
      return NextResponse.json({ ok: true, task: { id: task.id, workloadPoints: task.workloadPoints } });
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { workloadPoints: body.workloadPoints },
      select: { id: true, workloadPoints: true }
    });

    await prisma.actionLog.create({
      data: {
        projectId: task.projectId,
        userId,
        actionType: "TASK_WORKLOAD_UPDATED",
        description: `任务工作量调整：${task.title}｜${task.workloadPoints} → ${updated.workloadPoints} 点`
      }
    });

    return NextResponse.json({ ok: true, task: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败" },
      { status: 400 }
    );
  }
}
