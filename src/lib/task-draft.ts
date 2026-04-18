import { allocateTasksEvenly } from "@/lib/allocation";

export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type TaskDraftRow = {
  title: string;
  workloadPoints: number;
  deadline: string;
  assigneeId: string;
};

export type SuggestedTaskShape = {
  title: string;
  workloadPoints: number;
  deadlineOffsetHours: number;
};

export function buildDraftFromSuggested(
  suggested: SuggestedTaskShape[],
  members: Array<{ id: string }>,
  projectDeadline: string | Date
): TaskDraftRow[] {
  if (suggested.length === 0 || members.length === 0) {
    return [];
  }
  const tasksForAlloc = suggested.map((t) => ({ title: t.title, workloadPoints: t.workloadPoints }));
  const allocated = allocateTasksEvenly(tasksForAlloc, members);
  const projectDeadlineAt = new Date(projectDeadline);
  const key = (t: { title: string; workloadPoints: number }) => `${t.title}\t${t.workloadPoints}`;
  const dmap = new Map(suggested.map((t) => [key(t), t.deadlineOffsetHours]));
  return allocated.map((t) => {
    const offsetHours = dmap.get(key(t)) ?? 24;
    const draftDeadline = new Date(
      Math.min(projectDeadlineAt.getTime(), Date.now() + offsetHours * 60 * 60 * 1000)
    );
    return {
      title: t.title,
      workloadPoints: t.workloadPoints,
      deadline: formatDateInput(draftDeadline),
      assigneeId: t.assigneeId
    };
  });
}
