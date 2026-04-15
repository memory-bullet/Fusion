import { allocateTasksEvenly } from "@/lib/allocation";

export type TaskDraftRow = {
  title: string;
  workloadPoints: number;
  deadlineOffsetHours: number;
  assigneeId: string;
};

export type SuggestedTaskShape = {
  title: string;
  workloadPoints: number;
  deadlineOffsetHours: number;
};

export function buildDraftFromSuggested(
  suggested: SuggestedTaskShape[],
  members: Array<{ id: string }>
): TaskDraftRow[] {
  if (suggested.length === 0 || members.length === 0) {
    return [];
  }
  const tasksForAlloc = suggested.map((t) => ({ title: t.title, workloadPoints: t.workloadPoints }));
  const allocated = allocateTasksEvenly(tasksForAlloc, members);
  const key = (t: { title: string; workloadPoints: number }) => `${t.title}\t${t.workloadPoints}`;
  const dmap = new Map(suggested.map((t) => [key(t), t.deadlineOffsetHours]));
  return allocated.map((t) => ({
    title: t.title,
    workloadPoints: t.workloadPoints,
    deadlineOffsetHours: dmap.get(key(t)) ?? 24,
    assigneeId: t.assigneeId
  }));
}
