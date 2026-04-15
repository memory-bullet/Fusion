import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

const payloadSchema = z.object({
  newAssigneeId: z.string().optional(),
  newDeadline: z.string().datetime().optional(),
  allocations: z
    .array(
      z.object({
        assigneeId: z.string(),
        workloadPoints: z.number().int().positive()
      })
    )
    .optional()
})
  .refine((value) => value.newAssigneeId || value.allocations?.length, {
    message: "Need at least one reallocation target"
  });

function creditPenalty(workloadPoints: number): number {
  return Math.max(1, Math.min(20, Math.ceil(workloadPoints / 5)));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = payloadSchema.parse(await request.json());

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const actorId = await requireProjectMember(task.projectId);

    if (task.status === "DONE") {
      return NextResponse.json({ error: "Task already terminal" }, { status: 400 });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: task.projectId },
      include: {
        user: {
          select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
        }
      }
    });

    const candidateUserIds = new Set(
      members.map((member) => member.user.id).filter((userId) => userId !== task.assigneeId)
    );

    let allocations = payload.allocations?.map((item) => ({
      assigneeId: item.assigneeId,
      workloadPoints: item.workloadPoints
    }));

    if (!allocations?.length) {
      let nextAssigneeId = payload.newAssigneeId;

      if (!nextAssigneeId) {
        const candidate = members
          .map((member) => member.user)
          .filter((user) => user.id !== task.assigneeId)
          .sort((a, b) => a.accumulatedPoints - b.accumulatedPoints)[0];
        nextAssigneeId = candidate?.id;
      }

      if (!nextAssigneeId) {
        return NextResponse.json({ error: "No target assignee available" }, { status: 400 });
      }

      allocations = [{ assigneeId: nextAssigneeId, workloadPoints: task.workloadPoints }];
    }

    const deduped = new Set<string>();
    for (const allocation of allocations) {
      if (!candidateUserIds.has(allocation.assigneeId)) {
        return NextResponse.json({ error: "Invalid reallocation target" }, { status: 400 });
      }
      if (deduped.has(allocation.assigneeId)) {
        return NextResponse.json({ error: "Duplicate assignee in split allocation" }, { status: 400 });
      }
      deduped.add(allocation.assigneeId);
    }

    const totalWorkload = allocations.reduce((sum, item) => sum + item.workloadPoints, 0);
    if (totalWorkload !== task.workloadPoints) {
      return NextResponse.json({ error: "Split workload must equal the original workload" }, { status: 400 });
    }

    const nextDeadline = payload.newDeadline ? new Date(payload.newDeadline) : task.deadline;
    if (Number.isNaN(nextDeadline.getTime())) {
      return NextResponse.json({ error: "Invalid deadline" }, { status: 400 });
    }

    const penalty = creditPenalty(task.workloadPoints);
    const oldAssigneeName = members.find((member) => member.user.id === task.assigneeId)?.user.name ?? "未分配";

    const result = await prisma.$transaction(async (tx) => {
      const oldTask = await tx.task.update({
        where: { id: task.id },
        data: {
          status: "REALLOCATED",
          isReallocated: true
        }
      });

      if (task.assigneeId) {
        await tx.user.update({
          where: { id: task.assigneeId },
          data: {
            creditScore: {
              decrement: penalty
            }
          }
        });
      }

      const newTasks = await Promise.all(
        allocations.map((allocation, index) =>
          tx.task.create({
            data: {
              projectId: task.projectId,
              assigneeId: allocation.assigneeId,
              title:
                allocations.length === 1
                  ? `[Reallocated] ${task.title}`
                  : `[Split ${index + 1}/${allocations.length}] ${task.title}`,
              sourceLabel: task.sourceLabel,
              workloadPoints: allocation.workloadPoints,
              status: "TODO",
              deadline: nextDeadline,
              isReallocated: true
            },
            include: {
              assignee: {
                select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
              }
            }
          })
        )
      );

      const nextAssigneeNames = newTasks.map((item) => item.assignee?.name ?? "未分配").join("、");

      await tx.actionLog.create({
        data: {
          projectId: task.projectId,
          userId: actorId,
          actionType: "TASK_REALLOCATED",
          description: `未完成任务：${oldTask.title}｜原负责人：${oldAssigneeName}｜已转交给：${nextAssigneeNames}｜处罚：信用分 -${penalty}`
        }
      });

      return newTasks;
    });

    return NextResponse.json({ tasks: result, penalty });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reallocation failed" },
      { status: 400 }
    );
  }
}
