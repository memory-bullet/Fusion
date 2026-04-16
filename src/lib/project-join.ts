import { prisma } from "@/lib/prisma";

/**
 * 已登录用户加入新项目：复用当前 User，不新建账号。
 */
export async function linkExistingUserToProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error("Project not found");
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  });
  if (existing) {
    return { userId, projectId, alreadyMember: true as const };
  }

  await prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role: "MEMBER",
      joinedStatus: "ACTIVATED"
    }
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await prisma.actionLog.create({
    data: {
      projectId,
      userId,
      actionType: "MEMBER_JOINED",
      description: `${user?.name ?? "成员"} 加入项目`
    }
  });

  return { userId, projectId, alreadyMember: false as const };
}

/**
 * 访客：新建 User 并加入项目（Cookie 识别身份）。
 */
export async function createMemberJoin(projectId: string, displayName: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error("Project not found");
  }

  const name = displayName.trim();
  if (!name) {
    throw new Error("Name is required");
  }

  const user = await prisma.user.create({ data: { name } });

  await prisma.projectMember.create({
    data: {
      projectId,
      userId: user.id,
      role: "MEMBER"
    }
  });

  await prisma.actionLog.create({
    data: {
      projectId,
      userId: user.id,
      actionType: "MEMBER_JOINED",
      description: `${user.name} 加入项目`
    }
  });

  return { userId: user.id, projectId };
}

export async function resolveProjectByInviteCode(rawCode: string) {
  const trimmed = rawCode.trim();
  if (!trimmed) return null;

  let project = await prisma.project.findUnique({
    where: { inviteCode: trimmed }
  });
  if (!project) {
    project = await prisma.project.findUnique({
      where: { inviteCode: trimmed.toUpperCase() }
    });
  }
  return project;
}
