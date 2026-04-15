import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRegisteredUserId } from "@/lib/require-registered-user";
import { computeUltimatumLevel } from "@/lib/deadline-ultimatum";

export async function GET() {
  try {
    const reg = await getRegisteredUserId();
    if (reg.ok === false) {
      if (reg.reason === "no_session") {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
      }
      return NextResponse.json({ error: "请使用已注册账号" }, { status: 403 });
    }

    const memberships = await prisma.projectMember.findMany({
      where: { userId: reg.userId },
      select: { projectId: true, role: true, project: { select: { id: true, title: true, deadline: true } } }
    });

    const projectIds = memberships.map((m) => m.projectId);
    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [], tasks: [] });
    }

    const tasks = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        assigneeId: reg.userId,
        status: { notIn: ["DONE", "REALLOCATED"] }
      },
      include: { project: { select: { id: true, title: true } } },
      orderBy: { deadline: "asc" }
    });

    return NextResponse.json({
      projects: memberships.map((m) => ({
        id: m.project.id,
        title: m.project.title,
        role: m.role,
        deadline: m.project.deadline.toISOString()
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        deadline: t.deadline.toISOString(),
        ultimatumLevel: t.ultimatumLevel || computeUltimatumLevel(t.deadline, t.status),
        projectId: t.projectId,
        projectTitle: t.project.title
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载失败" },
      { status: 400 }
    );
  }
}
