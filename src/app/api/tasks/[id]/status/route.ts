import { TaskStatus } from "@/lib/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTransition } from "@/lib/state-machine";
import { isProjectOwner, requireProjectMember } from "@/lib/auth";

const statusSchema = z.object({
  status: z.enum(["UNASSIGNED", "TODO", "IN_PROGRESS", "BLOCKED", "DONE", "REALLOCATED"]),
  assigneeId: z.string().optional()
});

async function handleStatusUpdate(request: NextRequest, params: Promise<{ id: string }>) {
  try {
    const { id } = await params;
    const body = statusSchema.parse(await request.json());

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const userId = await requireProjectMember(task.projectId);

    if (task.status === "DONE" || task.status === "REALLOCATED") {
      return NextResponse.json({ error: "Terminal tasks are locked" }, { status: 400 });
    }

    assertTransition(task.status as TaskStatus, body.status as TaskStatus);

    if (body.status === "DONE") {
      const assigneeId = task.assigneeId ?? userId;

      const result = await prisma.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: { id },
          data: {
            status: "DONE",
            assigneeId,
            ultimatumLevel: "NONE",
            ultimatumWarnNotifiedAt: null,
            ultimatumRedNotifiedAt: null
          },
          include: { assignee: true }
        });

        await tx.user.update({
          where: { id: assigneeId },
          data: { accumulatedPoints: { increment: task.workloadPoints } }
        });

        await tx.actionLog.create({
          data: {
            projectId: task.projectId,
            userId,
            actionType: "TASK_DONE",
            description: `任务完成：${updatedTask.title}｜完成人：${updatedTask.assignee?.name ?? "未分配"}｜奖励：+${task.workloadPoints} 积分`
          }
        });

        return updatedTask;
      });

      return NextResponse.json({ task: result });
    }

    let nextAssigneeId: string | null = task.assigneeId;

    if (body.status === "UNASSIGNED") {
      nextAssigneeId = null;
    } else if (body.assigneeId !== undefined) {
      if (body.assigneeId !== userId) {
        if (!(await isProjectOwner(task.projectId, userId))) {
          return NextResponse.json({ error: "仅队长可将任务指派给其他成员" }, { status: 403 });
        }
        const member = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: task.projectId, userId: body.assigneeId } }
        });
        if (!member) {
          return NextResponse.json({ error: "负责人必须是本项目成员" }, { status: 400 });
        }
      }
      nextAssigneeId = body.assigneeId;
    } else if (body.status === "TODO") {
      if (task.status === "UNASSIGNED" || !task.assigneeId) {
        nextAssigneeId = userId;
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: body.status,
        assigneeId: nextAssigneeId
      },
      include: { assignee: true }
    });

    await prisma.actionLog.create({
      data: {
        projectId: task.projectId,
        userId,
        actionType: "TASK_STATUS_CHANGED",
        description: `状态更新：${updated.title}｜负责人：${updated.assignee?.name ?? "未分配"}｜当前状态：${body.status}`
      }
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update status" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleStatusUpdate(request, params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleStatusUpdate(request, params);
}
