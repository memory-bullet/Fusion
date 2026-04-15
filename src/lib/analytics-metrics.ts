import type { DashboardTask } from "@/lib/types";

export const ANALYTICS_METRIC_LABELS = [
  "任务质量",
  "工作量达成",
  "过程投入",
  "协作贡献",
  "时效责任",
  "信用记录"
] as const;

const WEIGHTS = [0.25, 0.2, 0.15, 0.15, 0.15, 0.1] as const;

type RiskGrade = "NORMAL" | "LATE" | "CRITICAL" | "REALLOCATED" | "REFUSED";

export type AnalyticsLog = {
  actionType?: string;
  description?: string;
  createdAt: string;
  user: { id: string };
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ratio(numerator: number, denominator: number, fallback: number): number {
  if (denominator <= 0) return fallback;
  return (numerator / denominator) * 100;
}

function overdueRatio(task: DashboardTask, nowMs: number): number {
  const deadlineMs = new Date(task.deadline).getTime();
  if (Number.isNaN(deadlineMs)) return 0;
  const createdMs = new Date(task.createdAt ?? task.deadline).getTime();
  const baselineDurationMs = 72 * 60 * 60 * 1000;
  const totalDurationMs =
    Number.isNaN(createdMs) ? baselineDurationMs : Math.max(deadlineMs - createdMs, baselineDurationMs);
  const overdueMs = Math.max(0, nowMs - deadlineMs);
  return overdueMs / totalDurationMs;
}

function computeTaskQuality(memberId: string, tasks: DashboardTask[], logs: AnalyticsLog[]): number {
  const mine = tasks.filter((t) => t.assignee?.id === memberId);
  if (!mine.length) return 82;

  const done = mine.filter((t) => t.status === "DONE");
  const completion = ratio(done.length, mine.length, 60);

  const mineLogs = logs.filter((l) => l.user.id === memberId);
  const positiveSignals = mineLogs.filter((l) => {
    const t = (l.actionType || "").toUpperCase();
    const d = (l.description || "").toUpperCase();
    return (
      t.includes("APPROVE") ||
      t.includes("PASS") ||
      t.includes("ACCEPT") ||
      t.includes("MERGE") ||
      d.includes("通过") ||
      d.includes("采纳")
    );
  }).length;

  const negativeSignals = mineLogs.filter((l) => {
    const t = (l.actionType || "").toUpperCase();
    const d = (l.description || "").toUpperCase();
    return (
      t.includes("REJECT") ||
      t.includes("REWORK") ||
      t.includes("ROLLBACK") ||
      t.includes("BUG") ||
      d.includes("驳回") ||
      d.includes("返工") ||
      d.includes("缺陷")
    );
  }).length;

  const qualityCore = clampScore(82 + positiveSignals * 4 - negativeSignals * 7);
  return clampScore(completion * 0.3 + qualityCore * 0.7);
}

function computeWorkload(memberId: string, tasks: DashboardTask[]): number {
  const mine = tasks.filter((t) => t.assignee?.id === memberId);
  const assignedPts = mine.reduce((sum, t) => sum + t.workloadPoints, 0);
  const donePts = mine
    .filter((t) => t.status === "DONE")
    .reduce((sum, t) => sum + t.workloadPoints, 0);
  const teamAssignedPts = tasks.reduce((sum, t) => sum + t.workloadPoints, 0);
  const teamDonePts = tasks
    .filter((t) => t.status === "DONE")
    .reduce((sum, t) => sum + t.workloadPoints, 0);
  const fallback = Math.max(78, ratio(teamDonePts, teamAssignedPts, 78));
  return clampScore(ratio(donePts, assignedPts, fallback));
}

function computeProcessInput(memberId: string, logs: AnalyticsLog[]): number {
  const mine = logs.filter((l) => l.user.id === memberId);
  const iterations = mine.filter((l) => {
    const t = (l.actionType || "").toUpperCase();
    return t.includes("AI") || t.includes("EDIT") || t.includes("UPDATE") || t.includes("SUBMIT");
  }).length;

  const base = clampScore(62 + iterations * 7);
  const hasZeroShotSignal = mine.length > 0 && iterations <= 1;
  return hasZeroShotSignal ? Math.min(base, 60) : base;
}

function computeCollaboration(memberId: string, tasks: DashboardTask[], logs: AnalyticsLog[]): number {
  const mineLogs = logs.filter((l) => l.user.id === memberId);
  const reviewLike = mineLogs.filter((l) => {
    const t = (l.actionType || "").toUpperCase();
    return t.includes("REVIEW") || t.includes("COMMENT") || t.includes("SYNC");
  }).length;

  const rescueDone = tasks.filter(
    (t) => t.assignee?.id === memberId && t.isReallocated && t.status === "DONE"
  ).length;

  return clampScore(60 + reviewLike * 6 + rescueDone * 18);
}

function overdueScoreByRatio(ratioValue: number): number {
  if (ratioValue <= 0) return 100;
  if (ratioValue <= 0.1) return 80;
  if (ratioValue <= 0.25) return 65;
  if (ratioValue <= 0.5) return 45;
  if (ratioValue <= 1) return 30;
  return 20;
}

function computeTimeliness(memberId: string, tasks: DashboardTask[], nowMs: number): number {
  const mine = tasks.filter((t) => t.assignee?.id === memberId);
  if (!mine.length) return 85;

  const perTask = mine.map((task) => {
    if (task.status === "REALLOCATED") return 20;
    if (task.status === "DONE") return 100;

    // 未完成任务：仅按逾期占比扣分（不再按 WARNING/CRITICAL 分档）
    return overdueScoreByRatio(overdueRatio(task, nowMs));
  });

  let score = perTask.reduce((sum, s) => sum + s, 0) / perTask.length;

  // 只要出现被接管，时效责任分再额外下压，确保这是最重信号
  if (mine.some((t) => t.status === "REALLOCATED")) {
    score = Math.min(score, 25);
  }

  return clampScore(score);
}

function computeCredit(member: { creditScore: number }): number {
  return clampScore(member.creditScore);
}

function inferMemberRole(
  memberId: string,
  tasks: DashboardTask[],
  logs: AnalyticsLog[],
  memberIndex: number
): string {
  const myLoad = tasks
    .filter((t) => t.assignee?.id === memberId)
    .reduce((s, t) => s + t.workloadPoints, 0);
  const loadByMember = new Map<string, number>();
  for (const task of tasks) {
    const id = task.assignee?.id;
    if (!id) continue;
    loadByMember.set(id, (loadByMember.get(id) ?? 0) + task.workloadPoints);
  }
  const maxLoad = Math.max(1, ...Array.from(loadByMember.values()));
  if (myLoad >= maxLoad) return "主力承担";

  const myLogs = logs.filter((l) => l.user.id === memberId).length;
  if (myLogs >= 4) return "协作活跃";
  return ["项目协同", "执行成员", "支持角色"][memberIndex % 3];
}

function computeActivityTrendPct(memberId: string, logs: AnalyticsLog[], nowMs: number): number {
  const mine = logs.filter((l) => l.user.id === memberId);
  if (mine.length < 2) return 0;

  const week = 7 * 24 * 60 * 60 * 1000;
  let recent = 0;
  let older = 0;
  for (const l of mine) {
    const t = new Date(l.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    if (nowMs - t < week) recent += 1;
    else older += 1;
  }
  if (recent === 0 && older === 0) return 0;
  const base = Math.max(1, older);
  const raw = ((recent - older) / base) * 12;
  return Math.max(-10, Math.min(10, Number(raw.toFixed(1))));
}

function detectRiskGrade(memberId: string, tasks: DashboardTask[], logs: AnalyticsLog[]): RiskGrade {
  const mine = tasks.filter((t) => t.assignee?.id === memberId);
  const hasRefused = logs.some((l) => {
    if (l.user.id !== memberId) return false;
    const t = (l.actionType || "").toUpperCase();
    const d = (l.description || "").toUpperCase();
    return t.includes("REFUSE") || d.includes("拒绝");
  });
  if (hasRefused) return "REFUSED";
  if (mine.some((t) => t.status === "REALLOCATED")) return "REALLOCATED";

  const nowMs = Date.now();
  const maxOverdueRatio = mine
    .filter((t) => t.status !== "DONE" && t.status !== "REALLOCATED")
    .reduce((max, t) => Math.max(max, overdueRatio(t, nowMs)), 0);
  if (maxOverdueRatio >= 0.5) return "CRITICAL";
  if (maxOverdueRatio > 0) return "LATE";
  return "NORMAL";
}

function riskCoefficient(grade: RiskGrade): number {
  switch (grade) {
    case "LATE":
      return 0.85;
    case "CRITICAL":
      return 0.6;
    case "REALLOCATED":
      return 0.35;
    case "REFUSED":
      return 0.2;
    default:
      return 1;
  }
}

function violationPenalty(memberId: string, grade: RiskGrade, tasks: DashboardTask[], logs: AnalyticsLog[]): number {
  const mine = tasks.filter((t) => t.assignee?.id === memberId);
  const nowMs = Date.now();
  const overdueUndone = mine.filter(
    (t) => t.status !== "DONE" && t.status !== "REALLOCATED" && overdueRatio(t, nowMs) > 0
  ).length;
  const seriousUndone = mine.filter(
    (t) => t.status !== "DONE" && t.status !== "REALLOCATED" && overdueRatio(t, nowMs) >= 0.5
  ).length;
  const reallocated = mine.filter((t) => t.status === "REALLOCATED").length;
  const refusedCount =
    grade === "REFUSED"
      ? logs.filter((l) => {
          const t = (l.actionType || "").toUpperCase();
          const d = (l.description || "").toUpperCase();
          return l.user.id === memberId && (t.includes("REFUSE") || d.includes("拒绝"));
        }).length || 1
      : 0;

  return overdueUndone * 8 + seriousUndone * 12 + reallocated * 20 + refusedCount * 25;
}

export type AnalyticsMemberInput = {
  id: string;
  name: string;
  accumulatedPoints: number;
  creditScore: number;
  projectRole?: string;
};

export type AnalyticsProfile = {
  id: string;
  name: string;
  role: string;
  totalScore: number;
  trendPct: number;
  dimensions: number[];
  weightedBaseScore: number;
  riskCoefficient: number;
  penalty: number;
  riskGrade: RiskGrade;
};

export function buildAnalyticsProfiles(
  members: AnalyticsMemberInput[],
  tasks: DashboardTask[],
  logs: AnalyticsLog[],
  nowMs: number = Date.now()
): AnalyticsProfile[] {
  return members.map((member, index) => {
    const dimensions = [
      computeTaskQuality(member.id, tasks, logs),
      computeWorkload(member.id, tasks),
      computeProcessInput(member.id, logs),
      computeCollaboration(member.id, tasks, logs),
      computeTimeliness(member.id, tasks, nowMs),
      computeCredit(member)
    ];

    const weightedBaseScore = dimensions.reduce((sum, score, idx) => sum + score * WEIGHTS[idx], 0);
    const riskGrade = detectRiskGrade(member.id, tasks, logs);
    const risk = riskCoefficient(riskGrade);
    const penalty = violationPenalty(member.id, riskGrade, tasks, logs);
    const encouragementBoost = riskGrade === "NORMAL" ? 8 : riskGrade === "LATE" ? 4 : 0;
    const totalScore = clampScore(weightedBaseScore * risk - penalty + encouragementBoost);
    const trendPct = computeActivityTrendPct(member.id, logs, nowMs);

    const role =
      member.projectRole === "OWNER"
        ? "队长 · 项目协调"
        : inferMemberRole(member.id, tasks, logs, index);

    return {
      id: member.id,
      name: member.name,
      role,
      totalScore,
      trendPct,
      dimensions,
      weightedBaseScore: Number(weightedBaseScore.toFixed(1)),
      riskCoefficient: risk,
      penalty,
      riskGrade
    };
  });
}
