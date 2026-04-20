"use client";

type Props = {
  deadline: string;
  size?: "normal" | "large";
  showCountdown?: boolean;
};

export function DeadlineDisplay({ deadline, size = "normal", showCountdown = true }: Props) {
  const now = Date.now();
  const ddl = new Date(deadline).getTime();
  const diff = ddl - now;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  const dateStr = new Date(deadline).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const countdownText = diff > 0 ? `距截止还有 ${days}天${hours}小时` : "已逾期";
  const countdownClassName =
    diff > 0
      ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
      : "rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700";

  return (
    <div
      className={
        size === "large"
          ? "flex flex-wrap items-center gap-x-2 gap-y-1 text-base sm:text-lg"
          : "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
      }
    >
      <span className="text-slate-600">{dateStr}</span>
      {showCountdown ? <span className={countdownClassName}>{countdownText}</span> : null}
    </div>
  );
}
