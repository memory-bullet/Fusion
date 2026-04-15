"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Download, MessageSquarePlus, X } from "lucide-react";

import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { useProjectDashboard } from "@/lib/use-project-dashboard";
import { ProjectAiChatPanel } from "@/components/project-ai-chat-panel";
import { ANALYTICS_METRIC_LABELS, buildAnalyticsProfiles } from "@/lib/analytics-metrics";
import type { AnalyticsProfile } from "@/lib/analytics-metrics";

type AppealLogItem = {
  id: string;
  createdAt: string;
  memberName: string;
  scoreType: "TOTAL" | "DIMENSION";
  expectedScore: number | null;
  dimensionName: string | null;
  reason: string;
  evidence: string | null;
};

const FALLBACK_NAMES = ["队长", "小明", "小红", "李华", "成员E", "成员F", "成员G", "成员H"];
const METRIC_WEIGHTS = ["25%", "20%", "15%", "15%", "15%", "10%"];
const RESPONSIBILITY_RULES = [
  "全部按期完成：1.00",
  "出现逾期但最终自行完成：0.90",
  "逾期占比超过 50% 仍未完成：0.75",
  "任务被接管：0.35",
  "明确拒绝任务：0.20"
] as const;
const PENALTY_RULES = [
  "每次逾期未处理：+8",
  "每次被催告后仍无响应：+12",
  "每次被接管：+20",
  "明确拒绝任务：+25"
] as const;
const CREDIT_RULES = [
  "信用分默认 100 分，按项目累计沉淀。",
  "每次逾期未处理：信用分 -8。",
  "每次被催告后仍无响应：信用分 -12。",
  "每次任务被接管：信用分 -20。",
  "明确拒绝任务：信用分 -25。",
  "信用分最低记为 0，不出现负分。"
] as const;
const ZERO_SHOT_RULE_DESCRIPTION =
  "定义：单轮 AI 生成 + 极低人工修改 + 无二次约束，属于无脑使用 AI 直接出稿。命中后，“过程投入”维度上限降至 60，并在最终分阶段触发额外降权。";

const SCORE_RULE_ITEMS = [
  {
    label: "任务质量",
    weight: "25%",
    description: "聚焦最终产出质量：内容可用性、逻辑完整性、评审通过率与返工情况",
    source: "Task.status + ActionLog.actionType + ActionLog.description"
  },
  {
    label: "工作量达成",
    weight: "20%",
    description: "已完成工作量点数 / 已分配工作量点数",
    source: "Task.workloadPoints + Task.status"
  },
  {
    label: "过程投入",
    weight: "15%",
    description: "AI 迭代、编辑与提交过程深度；zero-shot 行为降权",
    source: "ActionLog.actionType + ActionLog.description"
  },
  {
    label: "协作贡献",
    weight: "15%",
    description: "评审支持、跨任务协作、接管后救火完成情况",
    source: "ActionLog + Task.isReallocated + Task.status"
  },
  {
    label: "时效责任",
    weight: "15%",
    description:
      "按逾期占比扣分：0%=100；(0,10%]=80；(10%,25%]=65；(25%,50%]=45；(50%,100%]=30；>100%=20；被接管任务按最重档记 20",
    source: "Task.deadline + Task.status + ActionLog.createdAt"
  },
  {
    label: "信用记录",
    weight: "10%",
    description: "成员长期履约信用分，默认 100，受逾期、失联、被接管、拒绝任务影响",
    source: "User.creditScore"
  }
] as const;

const SHOWCASE_PROFILE_PRESET: Array<{
  name: string;
  role: string;
  trendPct: number;
  dimensions: number[];
}> = [
  { name: "队长", role: "项目协调", trendPct: 2.2, dimensions: [96, 95, 92, 94, 100, 98] },
  { name: "小明", role: "后端开发", trendPct: 1.8, dimensions: [92, 93, 88, 90, 100, 96] },
  { name: "小红", role: "前端开发", trendPct: 1.5, dimensions: [90, 91, 85, 88, 100, 95] },
  { name: "李华", role: "产品与文档", trendPct: 1.1, dimensions: [88, 90, 82, 86, 100, 94] }
];

function weightedBaseScore(dimensions: number[]) {
  const weights = [0.25, 0.2, 0.15, 0.15, 0.15, 0.1];
  return dimensions.reduce((sum, score, idx) => sum + score * weights[idx], 0);
}

function buildShowcaseProfiles(base: AnalyticsProfile[]): AnalyticsProfile[] {
  return SHOWCASE_PROFILE_PRESET.map((preset, index) => {
    const baseId = base[index]?.id ?? `showcase-${index + 1}`;
    const score = Math.round(weightedBaseScore(preset.dimensions));
    return {
      id: baseId,
      name: preset.name,
      role: preset.role,
      totalScore: score,
      trendPct: preset.trendPct,
      dimensions: preset.dimensions,
      weightedBaseScore: Number(weightedBaseScore(preset.dimensions).toFixed(1)),
      riskCoefficient: 1,
      penalty: 0,
      riskGrade: "NORMAL"
    };
  });
}

function parseAppealLogs(
  logs: Array<{ id: string; actionType: string; description: string; createdAt: string; user: { name: string } }>
): AppealLogItem[] {
  return logs
    .filter((log) => log.actionType === "ANALYTICS_APPEAL_SUBMITTED")
    .map((log) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(log.description || "{}") as Record<string, unknown>;
      } catch {
        payload = {};
      }

      return {
        id: log.id,
        createdAt: log.createdAt,
        memberName: log.user?.name || "成员",
        scoreType: payload.scoreType === "DIMENSION" ? "DIMENSION" : "TOTAL",
        expectedScore: typeof payload.expectedScore === "number" ? payload.expectedScore : null,
        dimensionName: typeof payload.dimensionName === "string" ? payload.dimensionName : null,
        reason: typeof payload.reason === "string" ? payload.reason : "未填写",
        evidence: typeof payload.evidence === "string" ? payload.evidence : null
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function normalizeName(rawName: string, index: number) {
  const normalized = (rawName || "").trim();
  if (!normalized || /^\?+$/.test(normalized) || normalized.includes("锟")) {
    return FALLBACK_NAMES[index] ?? `成员${index + 1}`;
  }
  return normalized;
}

function points(values: number[], radius: number, center = 140) {
  return values
    .map((value, index) => {
      const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
      const r = (value / 100) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");
}

function axisPoints(count: number, radius: number, center = 140) {
  return Array.from({ length: count }).map((_, index) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    };
  });
}

function RadarChart({ values, average }: { values: number[]; average: number[] }) {
  const rings = [30, 50, 70, 90];
  const center = 140;
  const chartRadius = 88;
  const labelRadius = 118;
  const axis = axisPoints(values.length, chartRadius, center);
  const labelPoints = axisPoints(values.length, labelRadius, center);

  return (
    <svg viewBox="0 0 280 280" className="h-56 w-56">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={points(Array(values.length).fill(ring), chartRadius, center)}
          fill="none"
          stroke="#d9dee8"
          strokeDasharray="3 5"
          strokeWidth="1"
        />
      ))}
      {axis.map((line, index) => (
        <line key={index} x1={center} y1={center} x2={line.x} y2={line.y} stroke="#e5e7eb" strokeWidth="1" />
      ))}
      <polygon
        points={points(average, chartRadius, center)}
        fill="none"
        stroke="#9ca3af"
        strokeDasharray="4 4"
        strokeWidth="1.5"
      />
      <polygon points={points(values, chartRadius, center)} fill="rgba(30, 64, 175, 0.15)" stroke="#1d4ed8" strokeWidth="2" />
      {labelPoints.map((item, index) => {
        const baseline = item.y > center + 14 ? "hanging" : item.y < center - 14 ? "auto" : "middle";
        const yOffset = item.y > center + 14 ? 4 : item.y < center - 14 ? -4 : 0;

        return (
          <text
            key={index}
            x={item.x}
            y={item.y + yOffset}
            fill="#475569"
            fontSize="12"
            textAnchor="middle"
            dominantBaseline={baseline}
          >
            {ANALYTICS_METRIC_LABELS[index]}
          </text>
        );
      })}
    </svg>
  );
}

function riskLabel(risk: string) {
  switch (risk) {
    case "REFUSED":
      return "拒绝任务";
    case "REALLOCATED":
      return "任务被接管";
    case "CRITICAL":
      return "严重逾期";
    case "LATE":
      return "轻微逾期";
    default:
      return "正常履约";
  }
}

export function ProjectAnalyticsPage({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const { data, error, refresh } = useProjectDashboard(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealType, setAppealType] = useState<"TOTAL" | "DIMENSION">("TOTAL");
  const [appealDimension, setAppealDimension] = useState("任务质量");
  const [appealExpectedScore, setAppealExpectedScore] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [appealEvidence, setAppealEvidence] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [appealSuccess, setAppealSuccess] = useState<string | null>(null);
  const syncedUrlMemberKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const raw = searchParams.get("member");
    const key = raw ?? "";
    if (key === syncedUrlMemberKeyRef.current) return;
    syncedUrlMemberKeyRef.current = key;
    if (!raw) return;
    const membersForAnalytics = data.members.map((member, index) => ({
      ...member,
      name: normalizeName(member.name, index),
      projectRole: member.role
    }));
    const profs = buildAnalyticsProfiles(membersForAnalytics, data.tasks, data.logs);
    if (profs.some((p) => p.id === raw)) {
      setActiveId(raw);
    }
  }, [data, searchParams]);

  if (error) {
    return <main className="min-h-screen bg-white p-8 text-critical">{error}</main>;
  }

  if (!data) {
    return <main className="min-h-screen bg-white p-8">Loading...</main>;
  }

  const membersForAnalytics = data.members.map((member, index) => ({
    ...member,
    name: normalizeName(member.name, index),
    projectRole: member.role
  }));

  const computedProfiles = buildAnalyticsProfiles(membersForAnalytics, data.tasks, data.logs).sort(
    (a, b) => b.totalScore - a.totalScore
  );
  const profiles = projectId === "demo" ? buildShowcaseProfiles(computedProfiles) : computedProfiles;
  const appealLogs = parseAppealLogs(data.logs).slice(0, 8);

  const teamAverage = ANALYTICS_METRIC_LABELS.map((_, index) =>
    Math.round(profiles.reduce((sum, profile) => sum + profile.dimensions[index], 0) / Math.max(profiles.length, 1))
  );

  const selectedId = activeId ?? profiles[0]?.id ?? null;
  const activeProfile = profiles.find((profile) => profile.id === selectedId);
  const teamOutput = data.tasks.reduce((sum, task) => sum + task.workloadPoints, 0);
  const completed = data.tasks.filter((task) => task.status === "DONE").length;
  const overallTrend = Number(
    (profiles.reduce((sum, profile) => sum + profile.trendPct, 0) / Math.max(profiles.length, 1)).toFixed(1)
  );
  const canSubmitAppeal = !data.isGuest && Boolean(data.me);

  async function submitAppeal() {
    if (!canSubmitAppeal) {
      setAppealError("请先以项目成员身份进入后再提交申诉。");
      return;
    }
    if (appealReason.trim().length < 8) {
      setAppealError("申诉理由至少 8 个字。");
      setAppealSuccess(null);
      return;
    }

    const parsedExpectedScore =
      appealExpectedScore.trim().length > 0 ? Number.parseInt(appealExpectedScore.trim(), 10) : undefined;
    if (parsedExpectedScore != null && (Number.isNaN(parsedExpectedScore) || parsedExpectedScore < 0 || parsedExpectedScore > 100)) {
      setAppealError("期望分数必须是 0-100 的整数。");
      setAppealSuccess(null);
      return;
    }

    setAppealSubmitting(true);
    setAppealError(null);
    setAppealSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/appeals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreType: appealType,
          dimensionName: appealType === "DIMENSION" ? appealDimension : undefined,
          expectedScore: parsedExpectedScore,
          reason: appealReason.trim(),
          evidence: appealEvidence.trim()
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "提交失败");
      }

      setAppealSuccess("申诉已提交，组长将收到提醒。");
      setAppealReason("");
      setAppealEvidence("");
      setAppealExpectedScore("");
      setAppealOpen(false);
      await refresh();
    } catch (err) {
      setAppealError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setAppealSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa]">
      <TopNav />
      <div className="shell py-6">
        <ProjectHero
          project={data.project}
          title="协作平台成员贡献统计"
          subtitle="采用 6 维雷达评分，最终分按「加权基础分 × 责任系数 - 违规惩罚」计算，拖欠 DDL 或拒绝任务将显著拉低最终分。"
          isOwner={data.isOwner}
          projectId={projectId}
          onProjectUpdated={refresh}
        />

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            返回主界面
          </Link>
          <a
            href={`/api/projects/${projectId}/analytics-export`}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            一键导出贡献度 PDF
          </a>
          <button
            type="button"
            onClick={() => {
              setAppealError(null);
              setAppealSuccess(null);
              if (!canSubmitAppeal) {
                setAppealError("当前为访客模式，请先以项目成员身份进入后再提交申诉。");
              }
              setAppealOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <MessageSquarePlus className="h-4 w-4" />
            提交评分申诉
          </button>
        </div>

        <section className="mb-6 rounded-2xl bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-muted">任务总工作量</div>
              <div className="mt-1 text-2xl font-semibold">{teamOutput} pts</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-muted">已完成任务</div>
              <div className="mt-1 text-2xl font-semibold">{completed}</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-muted">成员均分</div>
              <div className="mt-1 text-2xl font-semibold">
                {Math.round(profiles.reduce((sum, profile) => sum + profile.totalScore, 0) / Math.max(profiles.length, 1))}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-muted">平均活跃趋势</div>
              <div className={clsx("mt-1 text-2xl font-semibold", overallTrend >= 0 ? "text-blue-700" : "text-red-500")}>
                {overallTrend >= 0 ? "↑" : "↓"} {Math.abs(overallTrend)}%
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">贡献度评分规则</h2>
              <p className="mt-1 text-sm text-slate-600">
                最终分 = 加权基础分 × 责任系数 - 违规惩罚。6 个维度先形成基础分，再根据最终履约结果乘以责任系数；拖欠 DDL、失联不处理、被接管或拒绝任务，会同时影响时效责任、信用记录和最终扣分。
              </p>
            </div>
            <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">数据每 15 秒自动刷新</div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SCORE_RULE_ITEMS.map((rule) => (
              <div key={rule.label} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">{rule.label}</div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">权重 {rule.weight}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{rule.description}</p>
                <div className="mt-2 text-[11px] text-slate-500">数据源：{rule.source}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-semibold text-amber-950">zero-shot 行为降权</div>
              <p className="mt-1 text-xs leading-5 text-amber-900">{ZERO_SHOT_RULE_DESCRIPTION}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div className="text-sm font-semibold text-rose-950">违规惩罚</div>
              <div className="mt-2 space-y-1 text-xs leading-5 text-rose-900">
                {PENALTY_RULES.map((rule) => (
                  <div key={rule}>{rule}</div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <div className="text-sm font-semibold text-sky-950">责任系数与自动接管</div>
              <div className="mt-2 space-y-1 text-xs leading-5 text-sky-900">
                {RESPONSIBILITY_RULES.map((rule) => (
                  <div key={rule}>{rule}</div>
                ))}
                <div className="pt-1">
                  自动接管规则：当任务逾期占比达到 50% 且仍未完成时，系统将任务转入可接管状态，队长可一键重新分配。
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-sm font-semibold text-slate-900">信用分如何计算</div>
            <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-600 md:grid-cols-2">
              {CREDIT_RULES.map((rule) => (
                <div key={rule}>{rule}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <article className="rounded-2xl bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">核心贡献排行榜</h2>
            <div className="space-y-2">
              {profiles.map((profile, index) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setActiveId(profile.id)}
                  className={clsx(
                    "w-full rounded-xl px-3 py-3 text-left transition",
                    selectedId === profile.id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"
                  )}
                >
                  <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
                    <div className="text-sm font-semibold text-slate-500">{index + 1}</div>
                    <div>
                      <div className="font-medium">{profile.name}</div>
                      <div className="text-xs text-muted">{profile.role}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{profile.totalScore}</div>
                      <div className={clsx("text-xs", profile.trendPct >= 0 ? "text-blue-700" : "text-red-500")}>
                        {profile.trendPct >= 0 ? "↑" : "↓"} {Math.abs(profile.trendPct)}%
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">全员细分维度雷达看板</h2>
            <p className="mb-5 text-sm text-muted">虚线为团队平均分，实线为个人得分。</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={clsx(
                    "rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition",
                    selectedId === profile.id && "ring-2 ring-blue-300"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{profile.name}</div>
                      <div className="text-xs text-muted">{profile.role}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold text-slate-900">{profile.totalScore}</div>
                      <div className={clsx("text-xs", profile.trendPct >= 0 ? "text-blue-700" : "text-red-500")}>
                        {profile.trendPct >= 0 ? "↑" : "↓"} {Math.abs(profile.trendPct)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <RadarChart values={profile.dimensions} average={teamAverage} />
                  </div>

                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="mb-2 text-xs font-medium text-slate-500">维度分数（用于基础分）</div>
                    <div className="grid grid-cols-2 gap-2">
                      {ANALYTICS_METRIC_LABELS.map((label, dimIdx) => {
                        const score = profile.dimensions[dimIdx];
                        const avg = teamAverage[dimIdx];
                        const diff = score - avg;
                        return (
                          <div key={`${profile.id}-${label}`} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
                            <div className="text-slate-600">
                              {label} · {METRIC_WEIGHTS[dimIdx]}
                            </div>
                            <div className="mt-0.5 flex items-center justify-between">
                              <span className="font-semibold text-slate-900">{score}</span>
                              <span className={clsx(diff >= 0 ? "text-blue-700" : "text-red-500")}>
                                {diff >= 0 ? "+" : ""}
                                {diff}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900">评分申诉渠道</h3>
            <button
              type="button"
              onClick={() => {
                setAppealError(null);
                setAppealSuccess(null);
                if (!canSubmitAppeal) {
                  setAppealError("当前为访客模式，请先以项目成员身份进入后再提交申诉。");
                }
                setAppealOpen(true);
              }}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              发起申诉
            </button>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            若你认为总分或某个维度评分存在偏差，可提交申诉。系统会通知组长复核，并保留申诉记录用于追踪处理。
          </p>
          {!canSubmitAppeal ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              当前为访客模式，仅可查看申诉记录；请以项目成员身份登录后发起申诉。
            </div>
          ) : null}
          {appealSuccess ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {appealSuccess}
            </div>
          ) : null}
          {appealLogs.length ? (
            <div className="space-y-2">
              {appealLogs.map((appeal) => (
                <div key={appeal.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{appeal.memberName}</span>
                    <span>{new Date(appeal.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-800">
                    {appeal.scoreType === "TOTAL" ? "总分申诉" : `维度申诉：${appeal.dimensionName ?? "-"}`}
                    {appeal.expectedScore != null ? `，期望分：${appeal.expectedScore}` : ""}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">理由：{appeal.reason}</div>
                  {appeal.evidence ? <div className="mt-1 text-sm text-slate-600">补充证据：{appeal.evidence}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
              暂无申诉记录。
            </div>
          )}
        </section>

        {activeProfile ? (
          <section className="mt-6 rounded-2xl bg-white p-4 text-sm text-muted shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            当前高亮成员：<span className="font-medium text-slate-900">{activeProfile.name}</span>，最终分
            <span className="font-medium text-slate-900"> {activeProfile.totalScore}</span>。基础分 {activeProfile.weightedBaseScore.toFixed(1)} × 责任系数
            {activeProfile.riskCoefficient.toFixed(2)} - 违规惩罚 {activeProfile.penalty}（风险等级：{riskLabel(activeProfile.riskGrade)}）。
          </section>
        ) : null}
      </div>

      {appealOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">提交贡献度评分申诉</h3>
              <button
                type="button"
                onClick={() => setAppealOpen(false)}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">申诉类型</label>
                <select
                  value={appealType}
                  onChange={(e) => setAppealType(e.target.value as "TOTAL" | "DIMENSION")}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-400"
                >
                  <option value="TOTAL">总分申诉</option>
                  <option value="DIMENSION">维度申诉</option>
                </select>
              </div>

              {appealType === "DIMENSION" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">申诉维度</label>
                  <select
                    value={appealDimension}
                    onChange={(e) => setAppealDimension(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-400"
                  >
                    {ANALYTICS_METRIC_LABELS.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">期望分数（可选）</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={appealExpectedScore}
                  onChange={(e) => setAppealExpectedScore(e.target.value)}
                  placeholder="例如 92"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">申诉理由</label>
                <textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  rows={4}
                  placeholder="请写明你认为评分不合理的原因（至少 8 个字）"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">补充证据（可选）</label>
                <textarea
                  value={appealEvidence}
                  onChange={(e) => setAppealEvidence(e.target.value)}
                  rows={2}
                  placeholder="可填写任务链接、提交记录、评审意见等"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-400"
                />
              </div>

              {appealError ? <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{appealError}</div> : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAppealOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitAppeal}
                disabled={appealSubmitting}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {appealSubmitting ? "提交中..." : "提交申诉"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ProjectAiChatPanel projectId={projectId} disabled={data.isGuest || !data.me} currentUserName={data.me?.name} />
    </main>
  );
}
