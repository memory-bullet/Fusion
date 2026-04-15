"use client";

import { Trash2 } from "lucide-react";
import { DashboardTask } from "@/lib/types";
import { AlertCountdownBadge } from "@/components/alert-countdown-badge";
import clsx from "clsx";

const STATUS_LABEL: Record<DashboardTask["status"], string> = {
  UNASSIGNED: "待认领",
  TODO: "待开始",
  IN_PROGRESS: "进行中",
  BLOCKED: "求助中",
  DONE: "已完成",
  REALLOCATED: "已重组"
};

const STATUS_TONE: Record<DashboardTask["status"], string> = {
  UNASSIGNED: "border-slate-200 bg-slate-50 text-slate-600",
  TODO: "border-sky-200 bg-sky-50 text-sky-700",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
  BLOCKED: "border-amber-200 bg-amber-50 text-amber-800",
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REALLOCATED: "border-violet-200 bg-violet-50 text-violet-700"
};

type Props = {
  task: DashboardTask;
  isOwner: boolean;
  currentUserId?: string;
  onDelete: (taskId: string) => Promise<void>;
  onClick: (task: DashboardTask) => void;
};

export function TaskItemRow({ task, isOwner, currentUserId, onDelete, onClick }: Props) {
  const isAssignee = task.assignee?.id === currentUserId;
  const canDelete = isOwner || isAssignee;

  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 transition",
        "cursor-pointer hover:border-slate-900 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
        task.warningLevel === "CRITICAL" && "border-red-200",
        task.warningLevel === "WARNING" && "border-amber-200",
        task.warningLevel === "NORMAL" && "border-slate-200"
      )}
      onClick={() => onClick(task)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{task.title}</span>
          <AlertCountdownBadge level={task.warningLevel} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span>{task.assignee?.name ?? "未分配"}</span>
          <span>{task.workloadPoints} 点</span>
          <span>截止 {new Date(task.deadline).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
        </div>
      </div>
      <span
        className={clsx(
          "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
          STATUS_TONE[task.status]
        )}
      >
        {STATUS_LABEL[task.status]}
      </span>
      {canDelete && task.status !== "DONE" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void onDelete(task.id);
          }}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label="删除任务"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
