import { TaskStatus } from "@/lib/domain";

const transitions: Record<TaskStatus, TaskStatus[]> = {
  UNASSIGNED: ["TODO"],
  /** 极简操作：待开始可直接完成或标记求助，无需多级菜单 */
  TODO: ["IN_PROGRESS", "DONE", "BLOCKED"],
  IN_PROGRESS: ["BLOCKED", "DONE"],
  BLOCKED: ["IN_PROGRESS"],
  DONE: [],
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
