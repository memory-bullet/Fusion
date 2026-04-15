import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export type RegisteredUserResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "no_session" | "no_email" };

/** 必须已带 Cookie 且 User.email 存在（注册账号） */
export async function getRegisteredUserId(): Promise<RegisteredUserResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, reason: "no_session" };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  if (!user?.email?.trim()) {
    return { ok: false, reason: "no_email" };
  }
  return { ok: true, userId };
}
