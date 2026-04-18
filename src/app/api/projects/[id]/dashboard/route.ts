import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWarningLevel } from "@/lib/warning";
import { requireProjectMember } from "@/lib/auth";
import { ensureDefaultProjectDocuments } from "@/lib/project-documents";
import { toPublicUser } from "@/lib/user-serialize";
import { runDeadlineUltimatumEngine } from "@/lib/deadline-ultimatum";
import { parseAssignmentMilestones, sortMilestonesByDue } from "@/lib/assignment-milestones";

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

    const [project, members, presets, logs] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          contextSummary: true,
          keyDeliverables: true,
          assignmentMilestones: true,
          progressDigest: true,
          progressDigestAt: true,
          status: true,
          createdAt: true,
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
        sourceLabel: true,
        isReallocated: true,
        ultimatumLevel: true,
        createdById: true,
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

    const rawDeliverables = project.keyDeliverables ?? null;
    const rawMilestones = project.assignmentMilestones ?? null;
    const { keyDeliverables: _ignoredDeliverables, assignmentMilestones: _ignoredMilestones, ...projectRest } = project;
    const milestonesSorted = rawMilestones ? sortMilestonesByDue(parseAssignmentMilestones(rawMilestones) ?? []) : null;

    const publicMembers = members.map((m) => ({
      ...toPublicUser(m.user),
      id: m.id, // ProjectMember.id，用于移出成员等操作（必须放在 toPublicUser 之后以覆盖 user.id）
      userId: m.userId, // 添加 userId 字段以保留用户 ID
      role: m.role,
      joinedStatus: m.joinedStatus as "ACTIVATED" | "NOT_ACTIVATED",
      projectNickname: m.projectNickname
    }));
    const publicMe = me ? toPublicUser(me) : null;
    const publicLogs = logs.map((log) => ({
      ...log,
      user: toPublicUser(log.user)
    }));

    // 创建成员昵称映射表
    const memberNicknameMap = new Map(
      members.map((m) => [m.userId, m.projectNickname?.trim() || m.user.name])
    );

    const publicTasks = tasksLatest.map((task: any) => ({
      ...task,
      sourceLabel: task.sourceLabel ?? null,
      warningLevel: getWarningLevel(task.deadline),
      isReallocated: task.isReallocated ?? false,
      assignee: task.assignee
        ? {
            id: task.assignee.id,
            name: memberNicknameMap.get(task.assignee.id) || task.assignee.name
          }
        : null,
      createdById: task.createdById
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
        createdAt: p.createdAt.toISOString()
      })),
      tasks: publicTasks,
      logs: publicLogs,
      documents: (documentRows as Array<any>).map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        description: doc.description ?? "",
        originalFileName: doc.originalFileName ?? null,
        mimeType: doc.mimeType ?? null,
        fileSize: doc.fileSize ?? null,
        storageKey: doc.storageKey ?? null,
        fileHash: doc.fileHash ?? null,
        reviewStatus: (doc.reviewStatus as "PENDING" | "APPROVED" | "REJECTED") ?? "APPROVED",
        reviewComment: doc.reviewComment ?? "",
        reviewedBy: doc.reviewedBy ?? null,
        reviewedAt: doc.reviewedAt?.toISOString() ?? null,
        pointsAwarded: doc.pointsAwarded ?? 0,
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
