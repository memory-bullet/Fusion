import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseRequirementWithAI } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

export const maxDuration = 900;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  requirementText: z.string().min(10)
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireProjectMember(id);
    const body = inputSchema.parse(await request.json());

    const ai = await parseRequirementWithAI(body.requirementText);

    await prisma.project.update({
      where: { id },
      data: {
        contextSummary: ai.contextSummary,
        keyDeliverables: JSON.stringify(ai.keyDeliverables),
        assignmentMilestones: JSON.stringify(ai.milestones)
      }
    });

    await prisma.actionLog.create({
      data: {
        projectId: id,
        userId,
        actionType: "AI_PARSED_CONTEXT",
        description: "AI generated shared context summary"
      }
    });

    return NextResponse.json({
      contextSummary: ai.contextSummary,
      keyDeliverables: ai.keyDeliverables,
      milestones: ai.milestones,
      suggestedTasks: ai.tasks
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI parsing failed" },
      { status: 400 }
    );
  }
}
