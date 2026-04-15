import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            inviteCode: true,
            deadline: true,
            updatedAt: true
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });

    const projects = memberships.map((m) => ({
      id: m.project.id,
      title: m.project.title,
      role: m.role,
      inviteCode: m.project.inviteCode,
      deadline: m.project.deadline.toISOString(),
      joinedAt: m.joinedAt.toISOString(),
      updatedAt: m.project.updatedAt.toISOString()
    }));

    projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载失败" },
      { status: 400 }
    );
  }
}
