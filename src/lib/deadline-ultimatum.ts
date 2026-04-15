import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify-user";
import { generateRedUltimatumLine } from "@/lib/ultimatum-red-ai";

export type UltimatumLevel = "NONE" | "WARN_3D" | "RED_24H";

const H_RED = 24;
const H_WARN = 72;

function terminal(status: string) {
  return status === "DONE" || status === "REALLOCATED";
}

export function computeUltimatumLevel(deadline: Date, status: string): UltimatumLevel {
  if (terminal(status)) return "NONE";
  const h = (deadline.getTime() - Date.now()) / 3600000;
  if (h <= H_RED) return "RED_24H";
  if (h <= H_WARN) return "WARN_3D";
  return "NONE";
}

/**
 * 打开项目 dashboard 时调用：刷新 ultimatum 标记，并在首次进入窗口时发站内信 / 日志。
 */
export async function runDeadlineUltimatumEngine(projectId: string): Promise<void> {
  const [project, members, tasks] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { title: true } }),
    prisma.projectMember.findMany({ where: { projectId }, select: { userId: true, role: true } }),
    prisma.task.findMany({ where: { projectId } })
  ]);

  if (!project || members.length === 0) return;

  const owner = members.find((m) => m.role === "OWNER");
  const logUserId = owner?.userId ?? members[0]!.userId;
  const manageUrl = `/project/${projectId}/manage`;

  for (const task of tasks) {
    const level = computeUltimatumLevel(task.deadline, task.status);

    if (terminal(task.status)) {
      if (
        task.ultimatumLevel !== "NONE" ||
        task.ultimatumWarnNotifiedAt ||
        task.ultimatumRedNotifiedAt
      ) {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            ultimatumLevel: "NONE",
            ultimatumWarnNotifiedAt: null,
            ultimatumRedNotifiedAt: null
          }
        });
      }
      continue;
    }

    await prisma.task.update({
      where: { id: task.id },
      data: { ultimatumLevel: level }
    });

    if (level === "WARN_3D" && !task.ultimatumWarnNotifiedAt) {
      const hoursLeft = Math.max(0, Math.round((task.deadline.getTime() - Date.now()) / 3600000));
      if (task.assigneeId) {
        await notifyUser({
          userId: task.assigneeId,
          projectId,
          kind: "TASK_DEADLINE_WARN",
          title: "任务临近截止",
          body: `「${task.title}」将在约 ${hoursLeft} 小时内截止（预警期）。建议尽快推进，避免进入最后 24 小时红灯。`,
          actionUrl: manageUrl
        }).catch(() => {});
      }
      await prisma.task.update({
        where: { id: task.id },
        data: { ultimatumWarnNotifiedAt: new Date() }
      });
    }

    if (level === "RED_24H" && !task.ultimatumRedNotifiedAt) {
      const assigneeName =
        task.assigneeId ?
          (await prisma.user.findUnique({ where: { id: task.assigneeId }, select: { name: true } }))?.name
        : null;
      const hoursLeft = Math.max(0, Math.round((task.deadline.getTime() - Date.now()) / 3600000));
      const aiLine = await generateRedUltimatumLine({
        projectTitle: project.title,
        taskTitle: task.title,
        assigneeName: assigneeName ?? "未指定负责人",
        hoursLeft
      });
      const body = `${aiLine}\n\n任务：${task.title}\n负责：${assigneeName ?? "未分配"}\n项目：${project.title}`;

      await prisma.$transaction(async (tx) => {
        await tx.userNotification.createMany({
          data: members.map((m) => ({
            userId: m.userId,
            projectId,
            kind: "TASK_DEADLINE_RED",
            title: "进度阻塞 · 最后通牒",
            body,
            actionUrl: manageUrl
          }))
        });
        await tx.actionLog.create({
          data: {
            projectId,
            userId: logUserId,
            actionType: "TASK_ULTIMATUM_RED",
            description: `红灯警报：「${task.title}」不足 24h 截止仍未完成，已向全员推送强提醒。`
          }
        });
        await tx.task.update({
          where: { id: task.id },
          data: { ultimatumRedNotifiedAt: new Date() }
        });
      });
    }
  }
}
