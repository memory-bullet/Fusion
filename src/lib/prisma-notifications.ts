import { prisma } from "@/lib/prisma";

/** 开发环境下热更新后 global 里可能仍是旧 Prisma 实例，缺少新模型的 delegate */
export function prismaHasNotificationModels(client: unknown): boolean {
  const p = client as unknown as {
    userNotification?: { findMany?: unknown };
    projectChatMessage?: { findMany?: unknown };
  };
  return (
    typeof p.userNotification?.findMany === "function" &&
    typeof p.projectChatMessage?.findMany === "function"
  );
}

type NotifyUserOptions = {
  userId: string;
  projectId?: string;
  kind: string;
  title: string;
  body: string;
  actionUrl?: string;
};

export async function notifyUser(opts: NotifyUserOptions) {
  await prisma.userNotification.create({
    data: {
      userId: opts.userId,
      projectId: opts.projectId ?? null,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      actionUrl: opts.actionUrl ?? null
    }
  });
}
