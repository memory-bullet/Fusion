"use client";

const SEGMENTS = [
  "bg-sky-400/90",
  "bg-emerald-400/90",
  "bg-amber-400/90",
  "bg-violet-400/90",
  "bg-rose-300/95",
  "bg-cyan-400/90",
  "bg-indigo-400/90",
  "bg-orange-300/95",
  "bg-teal-400/90",
  "bg-fuchsia-400/90",
  "bg-lime-400/90",
  "bg-blue-500/85"
];

type Item = { label: string; points: number };

export function WorkloadShareBar({
  items,
  title = "工作量占比（点）"
}: {
  items: Item[];
  title?: string;
}) {
  const total = items.reduce((s, x) => s + x.points, 0);
  if (items.length === 0 || total <= 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-muted">
          合计 <span className="font-semibold text-slate-700">{total}</span> 点
          {total === 100 ? <span className="ml-1">（100 点制）</span> : null}
        </p>
      </div>
      <div
        className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-200/90"
        role="img"
        aria-label="工作量占比条"
      >
        {items.map((item, i) => {
          if (item.points <= 0) return null;
          const pct = (item.points / total) * 100;
          return (
            <div
              key={`${i}-${item.label}`}
              title={`${item.label}: ${item.points} 点 (${pct.toFixed(1)}%)`}
              className={`${SEGMENTS[i % SEGMENTS.length]} h-full min-w-[3px]`}
              style={{ flex: `${item.points} 1 0%` }}
            />
          );
        })}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
        {items.map((item, i) => {
          const pct = (item.points / total) * 100;
          return (
            <li key={`${i}-${item.label}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={`inline-block h-2 w-2 shrink-0 rounded-sm ${SEGMENTS[i % SEGMENTS.length]}`} />
              <span className="font-medium text-slate-800">{item.label}</span>
              <span className="text-muted">
                {item.points} 点 · {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
