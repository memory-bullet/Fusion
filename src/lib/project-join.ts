import { prisma } from "@/lib/prisma";

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
      role: "MEMBER"
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

export async function createMemberJoin(projectId: string, name: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error("Project not found");
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Name is required");
  }

  const user = await prisma.user.create({ data: { name: trimmedName } });

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
