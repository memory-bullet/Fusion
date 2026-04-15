import { WarningLevel } from "@/lib/domain";
import { warningText } from "@/lib/warning";
import clsx from "clsx";

export function AlertCountdownBadge({ level }: { level: WarningLevel }) {
  return (
    <span
      className={clsx(
        "state-badge",
        level === "CRITICAL" && "state-critical",
        level === "WARNING" && "state-warning",
        level === "NORMAL" && "state-normal"
      )}
    >
      {warningText(level)}
    </span>
  );
}
