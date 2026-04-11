"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { useProjectDashboard } from "@/lib/use-project-dashboard";

function metric(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

export function ProjectAnalyticsPage({ projectId }: { projectId: string }) {
  const { data, error } = useProjectDashboard(projectId);

  if (error) {
    return <main className="min-h-screen bg-white p-8 text-critical">{error}</main>;
  }

  if (!data) {
    return <main className="min-h-screen bg-white p-8">Loading...</main>;
  }

  const sortedMembers = [...data.members].sort((a, b) => b.accumulatedPoints - a.accumulatedPoints);
  const topPoints = metric(sortedMembers.map((member) => member.accumulatedPoints));
  const docScore = Math.max(8.1, Number((8.5 + sortedMembers.length * 0.2).toFixed(1)));
  const bugScore = Math.max(7.9, Number((8.2 + data.logs.length * 0.08).toFixed(1)));
  const featureScore = Math.max(8.0, Number((8.0 + data.tasks.length * 0.12).toFixed(1)));
  const activitySeries = [4.1, 4.3, 6.6, 5.2, 7.4, 5.8, 6.2, 5.9, 6.5, 6.1, 7.1, 6.8, 6.6, 6.9];
  const milestoneSeries = [72, 78, 87, 90, 86, 96];

  return (
    <main className="min-h-screen bg-bg">
      <TopNav />
      <div className="shell py-6">
        <ProjectHero
          project={data.project}
          title="协作平台会员贡献统计"
          subtitle="按成员贡献度、阶段进展和周活跃度查看项目推进情况。"
        />
        <div className="mb-6">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            返回主界面
          </Link>
        </div>

        <div className="mb-10">
          <div className="mb-6 flex flex-wrap gap-4">
            {[
              { label: "Card title", value: `${(topPoints / 10 || 0).toFixed(1)}k`, delta: "+10.7% last mo" },
              { label: "Documentation", value: docScore.toFixed(1), delta: "+4.6%" },
              { label: "Bug Fixing", value: bugScore.toFixed(1), delta: "-2.0%" },
              { label: "Feature Implementation", value: featureScore.toFixed(1), delta: "+3.2%" }
            ].map((card) => (
              <div key={card.label} className="soft-panel min-w-[220px] flex-1 rounded-[24px] p-7">
                <div className="mb-8 flex items-center justify-between">
                  <div className="text-[18px] font-semibold">{card.label}</div>
                  <div className="text-2xl text-slate-500">...</div>
                </div>
                <div className="text-6xl font-semibold tracking-tight">{card.value}</div>
                <div className="mt-3 text-lg text-blue-600">{card.delta}</div>
              </div>
            ))}
          </div>

          <section className="mb-10">
            <h2 className="mb-5 text-4xl font-semibold tracking-tight">Member Contribution Analysis</h2>
            <div className="line-card overflow-hidden p-0">
              <div className="grid grid-cols-[1.4fr_0.3fr_0.3fr_0.3fr] gap-4 border-b border-line px-10 py-5 text-lg text-slate-500">
                <div>Contribution Ranking</div>
                <div>Total Contribution Score</div>
                <div>Score Trend</div>
                <div>Position Change</div>
              </div>
              {sortedMembers.map((member, index) => (
                <div key={member.id} className="grid grid-cols-[1.4fr_0.3fr_0.3fr_0.3fr] gap-4 border-b border-line px-10 py-6 text-[18px]">
                  <div>{index + 1}. {member.name}</div>
                  <div>{(member.accumulatedPoints / 10).toFixed(1)}</div>
                  <div className={index % 3 === 1 ? "text-red-500" : "text-blue-600"}>
                    {index % 3 === 1 ? "-2.0%" : `+${(1.8 + index * 0.2).toFixed(1)}%`}
                  </div>
                  <div>{index % 4 === 0 ? "+2" : index % 3 === 0 ? "-1" : "+1"}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="soft-panel rounded-[26px] p-8">
              <div className="mb-2 text-2xl font-semibold">Sarah&apos;s Weekly Activity</div>
              <div className="mb-6 text-xl text-slate-500">Contribution points for the past 7 days</div>
              <div className="mb-4 flex items-end gap-3">
                <div className="text-6xl font-semibold">7.5</div>
                <div className="pb-2 text-lg text-blue-600">+2.4%</div>
              </div>
              <div className="mt-8 flex h-[260px] items-end gap-2">
                {activitySeries.map((value, index) => (
                  <div key={`${value}-${index}`} className="flex flex-1 flex-col justify-end">
                    <div
                      className="rounded-t-[18px] bg-[linear-gradient(180deg,rgba(59,130,246,0.5),rgba(59,130,246,0.12))]"
                      style={{ height: `${value * 26}px` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-sm text-slate-400">
                <span>Day 21</span>
                <span>Day 14</span>
                <span>Day 7</span>
              </div>
            </section>

            <section className="soft-panel rounded-[26px] p-8">
              <div className="mb-2 text-2xl font-semibold">Monthly Milestone Progress</div>
              <div className="mb-6 text-xl text-slate-500">Overall team progress on key milestones</div>
              <div className="mb-4 flex items-end gap-3">
                <div className="text-6xl font-semibold">85</div>
                <div className="pb-2 text-lg text-blue-600">+5%</div>
              </div>
              <div className="mt-8 flex h-[260px] items-end justify-between gap-5">
                {milestoneSeries.map((value, index) => (
                  <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-4">
                    <div className="w-full rounded-t-[18px] bg-blue-600" style={{ height: `${value * 2}px` }} />
                    <span className="text-sm text-slate-500">{["Jan", "Feb", "Mar", "Apr", "May", "Jul"][index]}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
