import { TaskStatus } from "@/lib/domain";

const transitions: Record<TaskStatus, TaskStatus[]> = {
  UNASSIGNED: ["TODO"],
  /** 极简操作：待开始可直接回退为待认领，也可完成或标记求助 */
  TODO: ["UNASSIGNED", "IN_PROGRESS", "DONE", "BLOCKED"],
  IN_PROGRESS: ["BLOCKED", "DONE"],
  BLOCKED: ["IN_PROGRESS"],
  DONE: ["IN_PROGRESS"],
  REALLOCATED: []
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid task transition from ${from} to ${to}`);
  }
}
