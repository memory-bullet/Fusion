"use client";

import { DashboardTask } from "@/lib/types";
import type { TaskStatus } from "@/lib/domain";
import { canTransition } from "@/lib/state-machine";

const COLUMNS: TaskStatus[] = ["UNASSIGNED", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

const COLUMN_LABEL: Record<TaskStatus, string> = {
  UNASSIGNED: "待认领",
  TODO: "待开始",
  IN_PROGRESS: "进行中",
  BLOCKED: "求助中",
  DONE: "已完成",
  REALLOCATED: "已重组"
};

export function TaskBoard({
  tasks,
  onMove,
  onPatchStatus,
  canOperate,
  onHint
}: {
  tasks: DashboardTask[];
  onMove: (id: string, next: TaskStatus) => Promise<void>;
  onPatchStatus: (id: string, status: TaskStatus) => Promise<void>;
  canOperate: boolean;
  onHint?: (msg: string) => void;
}) {
  function onDrop(next: TaskStatus, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!canOperate) return;
    const taskId = event.dataTransfer.getData("taskId");
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (!canTransition(task.status, next)) {
      onHint?.("该列与当前状态不兼容，请拖到相邻阶段或使用卡片按钮。");
      return;
    }
    void onMove(taskId, next);
  }

  return (
    <section className="line-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">任务看板</h3>
          <p className="mt-1 text-xs text-muted">拖拽卡片换列，或使用卡片上的「完成 / 求助」等按钮。无子菜单。</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((column) => (
          <div
            key={column}
            className="rounded-xl border border-line bg-slate-50/90 p-2"
            onDragOver={(e) => canOperate && e.preventDefault()}
            onDrop={(e) => void onDrop(column, e)}
          >
            <div className="mb-2 text-center text-xs font-semibold text-slate-600">{COLUMN_LABEL[column]}</div>
            <div className="space-y-2">
              {tasks
                .filter((task) => task.status === column)
                .map((task) => (
                  <div
                    key={task.id}
                    draggable={canOperate}
                    onDragStart={(e) => {
                      if (!canOperate) return;
                      e.dataTransfer.setData("taskId", task.id);
                    }}
                    className={`rounded-xl border border-line bg-white p-2.5 text-sm shadow-sm ${canOperate ? "cursor-grab active:cursor-grabbing" : "opacity-90"}`}
                  >
                    <div className="flex flex-wrap items-start gap-1.5">
                      <div className="font-medium leading-snug text-slate-900">{task.title}</div>
                      {task.ultimatumLevel === "RED_24H" ? (
                        <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          进度阻塞
                        </span>
                      ) : task.ultimatumLevel === "WARN_3D" ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                          临期预警
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {task.assignee?.name ?? "未分配"} · {task.workloadPoints} 点
                    </div>
                    {canOperate && task.status !== "DONE" && task.status !== "UNASSIGNED" ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.status === "TODO" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void onPatchStatus(task.id, "IN_PROGRESS")}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-800 hover:bg-slate-100"
                            >
                              开始
                            </button>
                            <button
                              type="button"
                              onClick={() => void onPatchStatus(task.id, "DONE")}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              onClick={() => void onPatchStatus(task.id, "BLOCKED")}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                            >
                              求助
                            </button>
                          </>
                        ) : null}
                        {task.status === "IN_PROGRESS" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void onPatchStatus(task.id, "DONE")}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              onClick={() => void onPatchStatus(task.id, "BLOCKED")}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                            >
                              求助
                            </button>
                          </>
                        ) : null}
                        {task.status === "BLOCKED" ? (
                          <button
                            type="button"
                            onClick={() => void onPatchStatus(task.id, "IN_PROGRESS")}
                            className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900 hover:bg-sky-100"
                          >
                            继续
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
