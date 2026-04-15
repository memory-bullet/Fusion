import { prisma } from "@/lib/prisma";
import { parseAssignmentMilestones, sortMilestonesByDue } from "@/lib/assignment-milestones";
import { LEGACY_AUTO_DOC_TITLES } from "@/lib/project-documents";
import { getWarningLevel } from "@/lib/warning";

const MAX_SNAPSHOT_CHARS = 14_000;
const PER_DOC_TEXT = 1_600;
const PER_DOC_DESC = 400;

function parseKeyDeliverables(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } catch {
    return [];
  }
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n[…已截断]`;
}

/**
 * 每次对话请求从数据库拉取的「当前项目全貌」摘要，供系统提示词注入（中文可读）。
 */
export async function buildProjectSnapshotForAi(projectId: string): Promise<string> {
  const [project, members, tasks, logs, documents] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" }
    }),
    prisma.task.findMany({
      where: { projectId },
      include: { assignee: { select: { name: true } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.actionLog.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 18
    }),
    prisma.projectDocument.findMany({
      where: { projectId },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "asc" }
    })
  ]);

  if (!project) {
    return "（项目不存在或已被删除）";
  }

  const milestonesRaw = parseAssignmentMilestones(project.assignmentMilestones);
  const milestones = milestonesRaw ? sortMilestonesByDue(milestonesRaw) : [];
  const keyDeliverables = parseKeyDeliverables(project.keyDeliverables);

  const lines: string[] = [];
  lines.push(`【项目】${project.title}`);
  lines.push(`【状态】${project.status} ｜ 截止：${project.deadline.toISOString()}`);
  lines.push(`【共享共识】\n${clip(project.contextSummary, 2_500)}`);

  if (keyDeliverables.length) {
    lines.push(`【产出物】${keyDeliverables.join("；")}`);
  }
  if (milestones.length) {
    lines.push(
      "【时间节点】" +
        milestones
          .map((m) => {
            const due = m.dueAt ? m.dueAt : m.note ?? "日期待定";
            return `${m.label}（${due}）`;
          })
          .join("；")
    );
  }
  if (project.progressDigest?.trim()) {
    lines.push(`【进度简报】\n${clip(project.progressDigest.trim(), 1_800)}`);
  }

  lines.push(
    "【成员】" +
      members.map((m) => `${m.user.name}${m.role === "OWNER" ? "（队长）" : ""}`).join("、")
  );

  lines.push("【任务】");
  for (const t of tasks) {
    const wl = getWarningLevel(t.deadline);
    const assignee = t.assignee?.name ?? "未分配";
    lines.push(
      `- ${t.title} ｜ ${t.status} ｜ 负责人：${assignee} ｜ 截止：${t.deadline.toISOString()} ｜ 工作量点：${t.workloadPoints} ｜ 预警：${wl}${t.ultimatumLevel && t.ultimatumLevel !== "NONE" ? ` ｜ 通牒：${t.ultimatumLevel}` : ""}`
    );
  }
  if (tasks.length === 0) {
    lines.push("（尚无任务）");
  }

  const visibleDocs = documents.filter((d) => !LEGACY_AUTO_DOC_TITLES.has(d.title.trim()));
  lines.push("【作业文件 / 文档】");
  for (const d of visibleDocs) {
    const meta = [
      d.title,
      d.author.name,
      d.originalFileName ? `文件：${d.originalFileName}` : "无附件",
      d.description ? clip(d.description, PER_DOC_DESC) : ""
    ]
      .filter(Boolean)
      .join(" ｜ ");
    lines.push(`- ${meta}`);
    if (d.content?.trim() && !d.storageKey) {
      lines.push(`  正文摘录：${clip(d.content.trim(), PER_DOC_TEXT)}`);
    }
  }
  if (visibleDocs.length === 0) {
    lines.push("（暂无可见作业文件）");
  }

  lines.push("【近期操作日志】");
  for (const log of [...logs].reverse()) {
    lines.push(`- ${log.createdAt.toISOString()} ${log.user.name}：${log.description}`);
  }

  let body = lines.join("\n");
  if (body.length > MAX_SNAPSHOT_CHARS) {
    body = clip(body, MAX_SNAPSHOT_CHARS);
  }
  return body;
}
