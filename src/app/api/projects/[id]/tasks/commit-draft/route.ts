import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectOwner } from "@/lib/auth";

export const maxDuration = 120;

const draftTaskSchema = z.object({
  title: z.string().min(1).max(500),
  workloadPoints: z.number().int().positive().max(10_000),
  deadlineOffsetHours: z.number().int().min(1).max(240),
  assigneeId: z.string().optional()
});

const bodySchema = z.object({
  sourceLabel: z.string().trim().min(1).max(120),
  tasks: z.array(draftTaskSchema).min(1).max(50)
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireProjectOwner(id);
    const body = bodySchema.parse(await request.json());
    const sourceLabel = body.sourceLabel.trim();

    const [project, members] = await Promise.all([
      prisma.project.findUnique({ where: { id } }),
      prisma.projectMember.findMany({ where: { projectId: id } })
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const memberIds = new Set(members.map((m) => m.userId));
    for (const t of body.tasks) {
      if (t.assigneeId && !memberIds.has(t.assigneeId)) {
        return NextResponse.json({ error: `负责人必须是项目成员：${t.title}` }, { status: 400 });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const t of body.tasks) {
        const deadline = new Date(
          Math.min(project.deadline.getTime(), Date.now() + t.deadlineOffsetHours * 60 * 60 * 1000)
        );
        const task = await tx.task.create({
          data: {
            projectId: id,
            assigneeId: t.assigneeId ?? null,
            createdById: userId,
            title: t.title,
            sourceLabel,
            workloadPoints: t.workloadPoints,
            status: t.assigneeId ? "TODO" : "UNASSIGNED",
            deadline
          },
          include: { assignee: true }
        });
        out.push(task);
      }

      await tx.actionLog.create({
        data: {
          projectId: id,
          userId,
          actionType: "OWNER_COMMITTED_TASKS",
          description: `组长新增写入了 ${out.length} 条阶段任务｜来源：${sourceLabel}`
        }
      });

      return out;
    });

    return NextResponse.json({ tasks: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "任务草稿格式无效" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Commit failed";
    const status = message.includes("Only project owner") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
