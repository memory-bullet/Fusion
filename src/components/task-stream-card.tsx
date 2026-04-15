"use client";

import { DashboardTask } from "@/lib/types";
import { AlertCountdownBadge } from "@/components/alert-countdown-badge";
import clsx from "clsx";

type Props = {
  task: DashboardTask;
  onMove: (id: string, next: DashboardTask["status"]) => Promise<void>;
  onReallocate: (id: string) => Promise<void>;
};

const nextStatusMap: Record<DashboardTask["status"], DashboardTask["status"] | null> = {
  UNASSIGNED: "TODO",
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  BLOCKED: "IN_PROGRESS",
  DONE: null,
  REALLOCATED: null
};

export function TaskStreamCard({ task, onMove, onReallocate }: Props) {
  const next = nextStatusMap[task.status];
  const terminal = task.status === "DONE" || task.status === "REALLOCATED";

  return (
    <article className="line-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-base font-semibold">{task.title}</h4>
        <AlertCountdownBadge level={task.warningLevel} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm text-muted">
        <div>Owner: {task.assignee?.name ?? "Unassigned"}</div>
        <div>Points: {task.workloadPoints}</div>
        <div>Status: {task.status}</div>
        <div>Deadline: {new Date(task.deadline).toLocaleString()}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {next ? (
          <button
            type="button"
            className={clsx(
              "rounded-full border border-line px-3 py-1 text-sm font-medium transition",
              "hover:bg-slate-100 active:bg-slate-200"
            )}
            onClick={() => onMove(task.id, next)}
          >
            Move to {next}
          </button>
        ) : null}

        {!terminal ? (
          <button
            type="button"
            onClick={() => onReallocate(task.id)}
            className="rounded-full border border-critical px-3 py-1 text-sm font-medium text-critical transition hover:bg-red-50"
          >
            Crisis takeover
          </button>
        ) : null}
      </div>
    </article>
  );
}
