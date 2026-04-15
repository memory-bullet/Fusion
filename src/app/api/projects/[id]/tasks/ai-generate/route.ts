import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseRequirementWithAI } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";
import { allocateTasksEvenly } from "@/lib/allocation";

const inputSchema = z.object({
  requirementText: z.string().min(10)
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireProjectMember(id);
    const body = inputSchema.parse(await request.json());

    const ai = await parseRequirementWithAI(body.requirementText);
    const sourceLabel = "AI 自动生成";

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
        }
      }
    });

    const memberUsers = members.map((m) => m.user);
    const assigned = allocateTasksEvenly(
      ai.tasks.map((t) => ({ title: t.title, workloadPoints: t.workloadPoints })),
      memberUsers
    );

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const tasks = [];
      for (let i = 0; i < assigned.length; i += 1) {
        const task = assigned[i];
        const aiTask = ai.tasks.find((x) => x.title === task.title && x.workloadPoints === task.workloadPoints);
        const deadlineOffset = aiTask?.deadlineOffsetHours ?? 24;
        const deadline = new Date(Math.min(project.deadline.getTime(), Date.now() + deadlineOffset * 60 * 60 * 1000));

        const createdTask = await tx.task.create({
          data: {
            projectId: id,
            assigneeId: task.assigneeId,
            title: task.title,
            sourceLabel,
            workloadPoints: task.workloadPoints,
            status: "TODO",
            deadline
          },
          include: { assignee: true }
        });

        tasks.push(createdTask);
      }

      await tx.project.update({
        where: { id },
        data: {
          contextSummary: ai.contextSummary,
          keyDeliverables: JSON.stringify(ai.keyDeliverables),
          assignmentMilestones: JSON.stringify(ai.milestones)
        }
      });

      await tx.actionLog.create({
        data: {
          projectId: id,
          userId,
          actionType: "AI_AUTO_ASSIGNED",
          description: `AI generated and assigned ${tasks.length} tasks｜来源：${sourceLabel}`
        }
      });

      return tasks;
    });

    return NextResponse.json({ contextSummary: ai.contextSummary, tasks: created });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI task generation failed" },
      { status: 400 }
    );
  }
}
