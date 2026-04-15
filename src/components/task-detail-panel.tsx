"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { DashboardTask } from "@/lib/types";
import type { TaskStatus } from "@/lib/domain";
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

const TRANSITIONS: Record<TaskStatus, Array<{ to: TaskStatus; label: string; className: string }>> = {
  UNASSIGNED: [],
  TODO: [
    { to: "IN_PROGRESS", label: "开始", className: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100" },
    { to: "DONE", label: "完成", className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
    { to: "BLOCKED", label: "求助", className: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100" }
  ],
  IN_PROGRESS: [
    { to: "DONE", label: "完成", className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
    { to: "BLOCKED", label: "求助", className: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100" }
  ],
  BLOCKED: [
    { to: "IN_PROGRESS", label: "继续", className: "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100" }
  ],
  DONE: [],
  REALLOCATED: []
};

type Props = {
  task: DashboardTask | null;
  isOwner: boolean;
  onClose: () => void;
  onUpdate: () => void;
};

export function TaskDetailPanel({ task, isOwner, onClose, onUpdate }: Props) {
  const [patching, setPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!task) return null;

  const transitions = TRANSITIONS[task.status];

  async function patchStatus(next: TaskStatus) {
    setPatching(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof payload.error === "string" ? payload.error : "更新失败");
        return;
      }
      onUpdate();
    } catch {
      setError("网络异常");
    } finally {
      setPatching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">任务详情</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl font-semibold text-slate-900">{task.title}</span>
            <AlertCountdownBadge level={task.warningLevel} />
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-500">状态</span>
              <span
                className={clsx(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  task.status === "UNASSIGNED" && "border-slate-200 bg-slate-50 text-slate-600",
                  task.status === "TODO" && "border-sky-200 bg-sky-50 text-sky-700",
                  task.status === "IN_PROGRESS" && "border-blue-200 bg-blue-50 text-blue-700",
                  task.status === "BLOCKED" && "border-amber-200 bg-amber-50 text-amber-800",
                  task.status === "DONE" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  task.status === "REALLOCATED" && "border-violet-200 bg-violet-50 text-violet-700"
                )}
              >
                {STATUS_LABEL[task.status]}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-500">负责人</span>
              <span className="font-medium text-slate-900">{task.assignee?.name ?? "未分配"}</span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-500">工作量</span>
              <span className="font-medium text-slate-900">{task.workloadPoints} 点</span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-500">截止时间</span>
              <span className="font-medium text-slate-900">
                {new Date(task.deadline).toLocaleString("zh-CN", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </div>

            {task.sourceLabel ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-slate-500">来源</span>
                <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                  {task.sourceLabel}
                </span>
              </div>
            ) : null}
          </div>

          {transitions.length > 0 ? (
            <div className="mt-6">
              <div className="mb-2 text-xs font-medium text-slate-500">操作</div>
              <div className="flex flex-wrap gap-2">
                {transitions.map((t) => (
                  <button
                    key={t.to}
                    type="button"
                    disabled={patching}
                    onClick={() => void patchStatus(t.to)}
                    className={clsx(
                      "rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50",
                      t.className
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
          ) : null}
        </div>

        {patching ? (
          <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            更新中…
          </div>
        ) : null}
      </div>
    </div>
  );
}
