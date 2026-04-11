"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { useProjectDashboard } from "@/lib/use-project-dashboard";

const METRIC_LABELS = ["功能开发", "缺陷修复", "文档撰写", "代码评审", "团队协作", "交付效率"];
const FALLBACK_NAMES = ["队长", "小明", "小红", "李华", "成员E", "成员F", "成员G", "成员H"];

type RadarProfile = {
  id: string;
  name: string;
  role: string;
  totalScore: number;
  trendPct: number;
  dimensions: number[];
};

function normalizeName(rawName: string, index: number) {
  const normalized = (rawName || "").trim();
  if (!normalized || /^\?+$/.test(normalized) || normalized.includes("�")) {
    return FALLBACK_NAMES[index] ?? `成员${index + 1}`;
  }
  return normalized;
}

function seedFromName(name: string) {
  return [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function profileFromMember(
  member: { id: string; name: string; accumulatedPoints: number; creditScore: number },
  index: number
): RadarProfile {
  const safeName = normalizeName(member.name, index);
  const seed = seedFromName(safeName);
  const base = Math.max(45, Math.min(98, member.accumulatedPoints + member.creditScore - 5));
  const dimensions = Array.from({ length: 6 }).map((_, dimIdx) => {
    const variance = ((seed + dimIdx * 17) % 23) - 11;
    return Math.max(35, Math.min(100, base + variance));
  });

  return {
    id: member.id,
    name: safeName,
    role: ["前端/UI", "后端/API", "项目协同", "研究支持"][seed % 4],
    totalScore: Math.round(dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length),
    trendPct: Number((((seed % 13) - 4) * 0.6).toFixed(1)),
    dimensions
  };
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
            {METRIC_LABELS[index]}
          </text>
        );
      })}
    </svg>
  );
}

export function ProjectAnalyticsPage({ projectId }: { projectId: string }) {
  const { data, error } = useProjectDashboard(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (error) {
    return <main className="min-h-screen bg-white p-8 text-critical">{error}</main>;
  }

  if (!data) {
    return <main className="min-h-screen bg-white p-8">Loading...</main>;
  }

  const profiles = data.members
    .map((member, index) => profileFromMember(member, index))
    .sort((a, b) => b.totalScore - a.totalScore);

  const teamAverage = METRIC_LABELS.map((_, index) =>
    Math.round(profiles.reduce((sum, profile) => sum + profile.dimensions[index], 0) / Math.max(profiles.length, 1))
  );

  const selectedId = activeId ?? profiles[0]?.id ?? null;
  const activeProfile = profiles.find((profile) => profile.id === selectedId);
  const teamOutput = data.tasks.reduce((sum, task) => sum + task.workloadPoints, 0);
  const completed = data.tasks.filter((task) => task.status === "DONE").length;
  const overallTrend = Number(
    (profiles.reduce((sum, profile) => sum + profile.trendPct, 0) / Math.max(profiles.length, 1)).toFixed(1)
  );

  return (
    <main className="min-h-screen bg-[#f8f9fa]">
      <TopNav />
      <div className="shell py-6">
        <ProjectHero
          project={data.project}
          title="协作平台成员贡献统计"
          subtitle="聚焦成员贡献排名与维度能力，帮助团队快速识别长板和短板。"
        />
        <ProjectTabs projectId={projectId} />

        <section className="mb-6 rounded-2xl bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-muted">团队本周总产出</div>
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
              <div className="text-muted">环比趋势</div>
              <div className={clsx("mt-1 text-2xl font-semibold", overallTrend >= 0 ? "text-blue-700" : "text-red-500")}>
                {overallTrend >= 0 ? "↑" : "↓"} {Math.abs(overallTrend)}%
              </div>
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
            <p className="mb-5 text-sm text-muted">虚线表示团队平均水平，实线表示成员当前水平。</p>
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
                    <div className="mb-2 text-xs font-medium text-slate-500">维度分数</div>
                    <div className="grid grid-cols-2 gap-2">
                      {METRIC_LABELS.map((label, dimIdx) => {
                        const score = profile.dimensions[dimIdx];
                        const avg = teamAverage[dimIdx];
                        const diff = score - avg;
                        return (
                          <div key={`${profile.id}-${label}`} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
                            <div className="text-slate-600">{label}</div>
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
                    <div className="mt-2 text-[11px] text-slate-400">右侧差值为相对团队平均分</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {activeProfile ? (
          <section className="mt-6 rounded-2xl bg-white p-4 text-sm text-muted shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            当前高亮成员：<span className="font-medium text-slate-900">{activeProfile.name}</span>，综合分{" "}
            <span className="font-medium text-slate-900">{activeProfile.totalScore}</span>，可优先关注其低于团队均值的维度进行辅导。
          </section>
        ) : null}
      </div>
    </main>
  );
}
