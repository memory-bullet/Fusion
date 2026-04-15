"use client";

import type { DashboardTask } from "@/lib/types";
import { memberWorkloadPoints } from "@/lib/member-workload";

type Member = { id: string; name: string };

export function MemberWorkloadStrip({
  members,
  tasks,
  title = "成员当前承担工作量（进行中任务点数）"
}: {
  members: Member[];
  tasks: DashboardTask[];
  title?: string;
}) {
  if (members.length === 0) return null;

  const rows = members
    .map((m) => ({
      ...m,
      pts: memberWorkloadPoints(tasks, m.id)
    }))
    .sort((a, b) => b.pts - a.pts);

  const maxPts = Math.max(...rows.map((r) => r.pts), 1);

  return (
    <div className="rounded-2xl border border-line bg-white/90 p-4">
      <p className="text-center text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-center text-xs text-muted">点数越高，当前负责任务越重；0 点可能为未领任务或已完成。</p>
      <div className="mt-4 flex flex-wrap items-end justify-center gap-x-5 gap-y-4">
        {rows.map((m) => (
          <div key={m.id} className="flex min-w-[72px] flex-col items-center">
            <div
              className="mb-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-900 shadow-sm"
              title={`${m.name}：进行中任务合计 ${m.pts} 点工作量`}
            >
              {m.pts} 点
            </div>
            <div
              className={`rounded-full border border-line px-3 py-1.5 text-center text-[13px] font-semibold text-slate-800 ${
                m.pts === 0 ? "bg-slate-50 text-slate-500" : "bg-slate-50"
              }`}
            >
              {m.name}
            </div>
            <div className="mt-2 h-1.5 w-[72px] rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-sky-400/80 transition-[width]"
                style={{ width: `${maxPts > 0 ? (m.pts / maxPts) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
