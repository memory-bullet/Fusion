import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWarningLevel } from "@/lib/warning";
import { requireProjectMember } from "@/lib/auth";
import { ensureDefaultProjectDocuments } from "@/lib/project-documents";
import { runDeadlineUltimatumEngine } from "@/lib/deadline-ultimatum";

function parseKeyDeliverables(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return null;
    const list = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let meId: string | null = null;
    try {
      meId = await requireProjectMember(id);
    } catch {
      // Allow read-only dashboard mode for direct shared links without an active member cookie.
      meId = null;
    }

    const [project, members, presets, tasks, logs] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          contextSummary: true,
          status: true,
          deadline: true,
          inviteCode: true
        }
      }),
      prisma.projectMember.findMany({
        where: { projectId: id },
        include: {
          user: {
            select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
          }
        }
      }),
      prisma.memberPreset.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "asc" }
      }),
      prisma.task.findMany({
        where: { projectId: id },
        select: {
          id: true,
          title: true,
          status: true,
          workloadPoints: true,
          createdAt: true,
          deadline: true,
          assignee: {
            select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
          }
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.actionLog.findMany({
        where: { projectId: id },
        include: {
          user: {
            select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 30
      })
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (members.length === 0) {
      return NextResponse.json({ error: "Project has no members" }, { status: 403 });
    }

    if (meId) {
      await runDeadlineUltimatumEngine(id).catch((err) => console.error("deadline ultimatum", err));
    }

    const tasksLatest = await prisma.task.findMany({
      where: { projectId: id },
      select: {
        id: true,
        title: true,
        status: true,
        workloadPoints: true,
        createdAt: true,
        deadline: true,
        assignee: {
          select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (meId) {
      await ensureDefaultProjectDocuments(id);
    }

    const documentRows = meId
      ? await prisma.projectDocument.findMany({
          where: { projectId: id },
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" }
        })
      : [];

    const myMembership = members.find((m) => m.userId === meId);
    const me = myMembership?.user ?? null;
    const isOwner = myMembership?.role === "OWNER";
    const isGuest = meId === null;

    const rawDeliverables: string | null = null;
    const rawMilestones: string | null = null;
    const projectRest = project;
    const milestonesSorted = null;

    // 构建成员 ID → displayName 映射（项目内昵称）
    const memberDisplayNames = new Map(
      members.map((m) => [m.userId, m.displayName ?? null])
    );

    const publicMembers = members.map((m) => ({
      id: m.user.id,
      // 项目内显示昵称：displayName > User.name
      name: m.displayName ?? m.user.name,
      accumulatedPoints: m.user.accumulatedPoints,
      creditScore: m.user.creditScore,
      role: m.role,
      joinedStatus: m.joinedStatus as "ACTIVATED" | "NOT_ACTIVATED"
    }));
    const publicMe = me ? {
      id: me.id,
      name: memberDisplayNames.get(me.id) ?? me.name,
      accumulatedPoints: me.accumulatedPoints,
      creditScore: me.creditScore
    } : null;
    const publicLogs = logs.map((log) => ({
      ...log,
      user: {
        id: log.user.id,
        name: memberDisplayNames.get(log.user.id) ?? log.user.name,
        accumulatedPoints: log.user.accumulatedPoints,
        creditScore: log.user.creditScore
      }
    }));
    const publicTasks = tasksLatest.map((task: any) => ({
      ...task,
      sourceLabel: task.sourceLabel ?? null,
      warningLevel: getWarningLevel(task.deadline),
      isReallocated: task.isReallocated ?? false,
      assignee: task.assignee
        ? {
            id: task.assignee.id,
            // 任务负责人优先使用项目内昵称
            name: memberDisplayNames.get(task.assignee.id) ?? task.assignee.name
          }
        : null
    }));

    return NextResponse.json({
      isGuest,
      isOwner,
      project: {
        ...projectRest,
        keyDeliverables: parseKeyDeliverables(rawDeliverables),
        assignmentMilestones: milestonesSorted
      },
      me: publicMe,
      members: publicMembers,
      presets: presets.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        presetName: p.presetName,
        activated: p.activated,
        activatedBy: p.activatedBy,
        createdAt: p.createdAt.toISOString()
      })),
      tasks: publicTasks,
      logs: publicLogs,
      documents: documentRows.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        description: doc.description ?? "",
        originalFileName: doc.originalFileName ?? null,
        mimeType: doc.mimeType ?? null,
        fileSize: doc.fileSize ?? null,
        storageKey: doc.storageKey ?? null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        author: doc.author
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dashboard" },
      { status: 400 }
    );
  }
}
