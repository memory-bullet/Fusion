export type AllocTaskInput = { title: string; workloadPoints: number };
export type AllocMember = { id: string };

export function allocateTasksEvenly(tasks: AllocTaskInput[], members: AllocMember[]) {
  if (members.length === 0) {
    throw new Error("At least one member is required for allocation");
  }

  const sortedTasks = [...tasks].sort((a, b) => b.workloadPoints - a.workloadPoints);
  const buckets = members.map((member) => ({
    member,
    total: 0,
    taskIndexes: [] as number[]
  }));

  sortedTasks.forEach((task, index) => {
    buckets.sort((a, b) => a.total - b.total);
    buckets[0].total += task.workloadPoints;
    buckets[0].taskIndexes.push(index);
  });

  const assigned = new Map<number, string>();
  buckets.forEach((bucket) => {
    bucket.taskIndexes.forEach((i) => assigned.set(i, bucket.member.id));
  });

  return sortedTasks.map((task, index) => ({
    ...task,
    assigneeId: assigned.get(index)!
  }));
}
