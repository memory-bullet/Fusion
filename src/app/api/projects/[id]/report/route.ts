import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectMember(id);

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
        }
      }
    });

    const ranking = members
      .map((member) => member.user)
      .sort((a, b) => b.accumulatedPoints - a.accumulatedPoints)
      .map((user, index) => ({
        rank: index + 1,
        id: user.id,
        name: user.name,
        accumulatedPoints: user.accumulatedPoints,
        creditScore: user.creditScore
      }));

    return NextResponse.json({ ranking });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load report" },
      { status: 400 }
    );
  }
}
