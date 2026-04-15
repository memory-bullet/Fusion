import type { DashboardTask } from "@/lib/types";

/** 计入「当前承担」的工作量：已分配且未结案的任务 */
export function isTaskActiveForWorkload(status: string): boolean {
  return status !== "DONE" && status !== "REALLOCATED";
}

export function memberWorkloadPoints(tasks: DashboardTask[], memberId: string): number {
  return tasks
    .filter((t) => t.assignee?.id === memberId && isTaskActiveForWorkload(t.status))
    .reduce((s, t) => s + t.workloadPoints, 0);
}
