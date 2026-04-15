import { DashboardData } from "@/lib/types";

export function ContributionPanel({ members }: { members: DashboardData["members"] }) {
  const ranking = [...members].sort((a, b) => b.accumulatedPoints - a.accumulatedPoints);
  const maxPoint = Math.max(1, ...ranking.map((member) => member.accumulatedPoints));

  return (
    <section className="line-card p-4">
      <h3 className="text-xl font-semibold">Member Contribution Analysis</h3>
      <div className="mt-3 space-y-2">
        {ranking.map((member, index) => {
          const width = Math.round((member.accumulatedPoints / maxPoint) * 100);
          return (
            <div key={member.id} className="rounded-xl border border-line px-3 py-2 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <span className="mr-2 font-semibold">{index + 1}.</span>
                  {member.name}
                </div>
                <div className="text-muted">{member.accumulatedPoints} pts | credit {member.creditScore}</div>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-400" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
