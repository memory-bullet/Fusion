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

  const dateStr = new Date(deadline).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <div className={size === "large" ? "text-xl" : "text-base"}>
      <div>{dateStr}</div>
      {showCountdown && diff > 0 && (
        <div className="text-sm text-slate-500">
          距截止还有 {days}天{hours}小时
        </div>
      )}
      {showCountdown && diff <= 0 && (
        <div className="text-sm text-red-600 font-medium">已逾期</div>
      )}
    </div>
  );
}
