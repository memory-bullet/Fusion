import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email-send";

export type NotifyUserInput = {
  userId: string;
  projectId?: string | null;
  kind: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  /** 若传入且用户有邮箱，则写入邮件出站表并尝试发送 */
  email?: { subject?: string } | null;
};

/**
 * 创建站内信；可选同步尝试发邮件并更新 EmailOutbox 状态。
 */
export async function notifyUser(input: NotifyUserInput) {
  const notification = await prisma.userNotification.create({
    data: {
      userId: input.userId,
      projectId: input.projectId ?? undefined,
      kind: input.kind,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl ?? undefined
    }
  });

  if (!input.email) {
    return { notification, emailOutbox: null as null };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true }
  });
  const to = user?.email?.trim();
  if (!to) {
    return { notification, emailOutbox: null as null };
  }

  const subject = input.email.subject?.trim() || input.title;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const actionLine =
    input.actionUrl && base
      ? `\n\n打开链接：${base}${input.actionUrl.startsWith("/") ? input.actionUrl : `/${input.actionUrl}`}`
      : "";
  const fullText = `${input.body}${actionLine}\n\n——\nFusion Space`;

  const outbox = await prisma.emailOutbox.create({
    data: {
      userId: input.userId,
      toAddress: to,
      subject,
      textBody: fullText,
      relatedNotificationId: notification.id,
      status: "PENDING"
    }
  });

  const result = await sendTransactionalEmail({
    to,
    subject,
    text: fullText
  });

  if (result.status === "SENT") {
    await prisma.emailOutbox.update({
      where: { id: outbox.id },
      data: { status: "SENT", sentAt: new Date(), errorMessage: null }
    });
  } else if (result.status === "FAILED") {
    await prisma.emailOutbox.update({
      where: { id: outbox.id },
      data: { status: "FAILED", errorMessage: result.error }
    });
  } else {
    await prisma.emailOutbox.update({
      where: { id: outbox.id },
      data: { status: "SKIPPED_NO_PROVIDER", errorMessage: result.reason }
    });
  }

  return { notification, emailOutbox: outbox };
}
