import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const USER_COOKIE = "fusion_user_id";

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(USER_COOKIE)?.value ?? null;
}

/** 需要已登录（带成员 Cookie），否则抛错 */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("需要登录");
  }
  return userId;
}

export async function requireProjectMember(projectId: string): Promise<string> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Missing user session. Join project first.");
  }

  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId
      }
    }
  });

  if (!member) {
    throw new Error("Not a project member.");
  }

  return userId;
}

export async function isProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId
      }
    }
  });

  return member?.role === "OWNER";
}

export async function requireProjectOwner(projectId: string): Promise<string> {
  const userId = await requireProjectMember(projectId);
  const owner = await isProjectOwner(projectId, userId);
  if (!owner) {
    throw new Error("Only project owner (组长) can perform this action");
  }
  return userId;
}
