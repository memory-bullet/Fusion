import type { DashboardTask } from "@/lib/types";

/** 计入「当前承担」的工作量：已分配且未结案的任务 */
export function isTaskActiveForWorkload(status: string): boolean {
  return status !== "DONE" && status !== "REALLOCATED";
}

export function memberWorkloadPoints(
  tasks: DashboardTask[],
  memberId: string,
  memberUserId?: string | null
): number {
  return tasks
    .filter((t) => {
      const assigneeId = t.assignee?.id;
      return Boolean(assigneeId) && (assigneeId === memberId || assigneeId === memberUserId) && isTaskActiveForWorkload(t.status);
    })
    .reduce((s, t) => s + t.workloadPoints, 0);
}
