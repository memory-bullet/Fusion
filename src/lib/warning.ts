import { WarningLevel } from "@/lib/domain";

const HOURS_24 = 24;
const HOURS_48 = 48;

export function getWarningLevel(deadline: Date): WarningLevel {
  const now = Date.now();
  const diffHours = (deadline.getTime() - now) / 1000 / 60 / 60;

  if (diffHours <= HOURS_24) {
    return "CRITICAL";
  }

  if (diffHours <= HOURS_48) {
    return "WARNING";
  }

  return "NORMAL";
}

export function warningText(level: WarningLevel): string {
  if (level === "CRITICAL") {
    return "CRITICAL";
  }
  if (level === "WARNING") {
    return "WARNING";
  }
  return "NORMAL";
}
