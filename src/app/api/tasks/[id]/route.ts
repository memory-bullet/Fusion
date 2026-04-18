import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectOwner } from "@/lib/auth";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, title: true, projectId: true }
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const userId = await requireProjectOwner(task.projectId);

    await prisma.$transaction([
      prisma.task.delete({ where: { id: task.id } }),
      prisma.actionLog.create({
        data: {
          projectId: task.projectId,
          userId,
          actionType: "TASK_DELETED",
          description: `组长删除任务：${task.title}`
        }
      })
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    const status = message.includes("Only project owner") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
