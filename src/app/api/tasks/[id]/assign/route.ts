import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isProjectOwner, requireProjectMember } from "@/lib/auth";
import { notifyUser } from "@/lib/notify-user";

const bodySchema = z.object({
  assigneeId: z.string().min(1)
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.status === "DONE" || task.status === "REALLOCATED") {
      return NextResponse.json({ error: "任务已结束，不可改派" }, { status: 400 });
    }

    const userId = await requireProjectMember(task.projectId);
    const owner = await isProjectOwner(task.projectId, userId);

    if (body.assigneeId !== userId && !owner) {
      return NextResponse.json({ error: "仅队长可将任务指派给其他成员" }, { status: 403 });
    }

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId: body.assigneeId } }
    });
    if (!member) {
      return NextResponse.json({ error: "被指派者必须是本项目成员" }, { status: 400 });
    }

    const nextStatus = task.status === "UNASSIGNED" ? "TODO" : task.status;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        assigneeId: body.assigneeId,
        status: nextStatus
      },
      include: { assignee: true }
    });

    await prisma.actionLog.create({
      data: {
        projectId: task.projectId,
        userId,
        actionType: "TASK_ASSIGNED",
        description: `任务指派：${updated.title} → ${updated.assignee?.name ?? body.assigneeId}`
      }
    });

    if (body.assigneeId !== userId) {
      const [project, actor] = await Promise.all([
        prisma.project.findUnique({ where: { id: task.projectId }, select: { title: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      ]);
      const actionUrl = `/project/${task.projectId}/manage`;
      void notifyUser({
        userId: body.assigneeId,
        projectId: task.projectId,
        kind: "TASK_ASSIGNED",
        title: "新任务指派",
        body: `${actor?.name ?? "项目成员"} 将任务「${updated.title}」指派给你。项目：${project?.title ?? "（未知）"}。`,
        actionUrl,
        email: { subject: `[Fusion] 新任务：${updated.title}` }
      }).catch((e) => console.error("notifyUser assign", e));
    }

    return NextResponse.json({ task: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "指派失败" },
      { status: 400 }
    );
  }
}
