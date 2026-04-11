import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWarningLevel } from "@/lib/warning";
import { requireProjectMember } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meId = await requireProjectMember(id);

    const [project, members, tasks, logs, files] = await Promise.all([
      prisma.project.findUnique({ where: { id } }),
      prisma.projectMember.findMany({ where: { projectId: id }, include: { user: true } }),
      prisma.task.findMany({ where: { projectId: id }, include: { assignee: true }, orderBy: { createdAt: "asc" } }),
      prisma.actionLog.findMany({
        where: { projectId: id },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 30
      }),
      prisma.projectFile.findMany({
        where: { projectId: id },
        include: { uploader: true },
        orderBy: { createdAt: "desc" }
      })
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const tasksWithWarning = tasks.map((task: any) => ({
      ...task,
      warningLevel: getWarningLevel(task.deadline)
    }));

    await prisma.$transaction(
      tasksWithWarning.map((task: any) =>
        prisma.task.update({
          where: { id: task.id },
          data: { warningLevel: task.warningLevel }
        })
      )
    );

    const me = members.find((m) => m.userId === meId)?.user;

    if (!me) {
      return NextResponse.json({ error: "User is not in project" }, { status: 403 });
    }

    return NextResponse.json({
      project,
      me,
      members: members.map((member) => member.user),
      tasks: tasksWithWarning,
      logs,
      files: files.map((file) => ({
        id: file.id,
        title: file.title,
        summary: file.summary,
        content: file.extractedText,
        mimeType: file.mimeType,
        status: file.status,
        createdAt: file.createdAt,
        author: file.uploader.name,
        downloadUrl: `/api/projects/${id}/files/${file.id}/download`
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dashboard" },
      { status: 400 }
    );
  }
}
