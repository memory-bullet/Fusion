import { assertLlmConfigured } from "@/lib/llm-config";
import { generateProgressDigestText } from "@/lib/llm-router";
import { prisma } from "@/lib/prisma";

export async function generateAndStoreProgressDigest(projectId: string, scope: "day" | "week"): Promise<string> {
  assertLlmConfigured();

  const since = new Date();
  if (scope === "day") {
    since.setDate(since.getDate() - 1);
  } else {
    since.setDate(since.getDate() - 7);
  }

  const [project, tasks, logs] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.task.findMany({
      where: { projectId },
      include: { assignee: { select: { name: true } } },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.actionLog.findMany({
      where: { projectId, createdAt: { gte: since } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 40
    })
  ]);

  if (!project) {
    throw new Error("Project not found");
  }

  const taskLines = tasks
    .filter((t) => t.status !== "REALLOCATED")
    .map(
      (t) =>
        `- ${t.title}｜${t.status}｜${t.assignee?.name ?? "未分配"}｜${t.workloadPoints}点`
    )
    .join("\n");

  const logLines = logs
    .map((l) => `- ${l.createdAt.toISOString().slice(0, 16)} ${l.user.name}: ${l.description}`)
    .join("\n");

  const scopeLabel = scope === "day" ? "过去约 24 小时" : "过去约 7 天";

  const system =
    "You write very short team progress briefs in zh-CN for all project members. " +
    "Output 2–4 short bullet lines (use leading •), total under 220 Chinese characters. " +
    "Be factual from the data; no fluff; mention blockers if any; no markdown headings.";
  const user = `项目：${project.title}\n时间范围：${scopeLabel}\n\n当前任务快照：\n${taskLines || "（无）"}\n\n近期操作记录：\n${logLines || "（无）"}\n\n请生成团队进度简报。`;

  const text = await generateProgressDigestText(system, user);

  const now = new Date();
  await prisma.project.update({
    where: { id: projectId },
    data: {
      progressDigest: text.slice(0, 2000),
      progressDigestAt: now
    }
  });

  return text;
}
