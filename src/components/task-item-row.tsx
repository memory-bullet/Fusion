"use client";

import { Trash2, Clock } from "lucide-react";
import { DashboardTask } from "@/lib/types";
import { TaskStatus } from "@/lib/domain";

type TaskItemRowProps = {
  task: DashboardTask;
  isOwner: boolean;
  currentUserId?: string | null;
  onDelete?: (taskId: string) => void;
  onClick?: (task: DashboardTask) => void;
};

/**
 * 判断当前用户是否有权删除此任务
 * - 组长可删除任意任务
 * - 成员可删除自己创建的任务
 */
function canDelete(task: DashboardTask, isOwner: boolean, currentUserId?: string | null): boolean {
  if (isOwner) return true;
  if (currentUserId && task.createdById === currentUserId) return true;
  return false;
}

export function TaskItemRow({ task, isOwner, currentUserId, onDelete, onClick }: TaskItemRowProps) {
  const statusLabels: Record<TaskStatus, string> = {
    UNASSIGNED: "待认领",
    TODO: "待开始",
    IN_PROGRESS: "进行中",
    BLOCKED: "求助中",
    DONE: "已完成",
    REALLOCATED: "已重新分配"
  };

  const statusColors: Record<TaskStatus, string> = {
    UNASSIGNED: "bg-yellow-100 text-yellow-700",
    TODO: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-blue-200 text-blue-800",
    BLOCKED: "bg-orange-100 text-orange-700",
    DONE: "bg-green-100 text-green-700",
    REALLOCATED: "bg-red-100 text-red-700"
  };

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm("确定要删除这个任务吗？")) {
      onDelete?.(task.id);
    }
  }

  return (
    <div
      onClick={() => onClick?.(task)}
      className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-4">
        <div>
          <h4 className="font-medium text-neutral-900">{task.title}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[task.status as TaskStatus]}`}>
              {statusLabels[task.status as TaskStatus]}
            </span>
            {task.deadline && (
              <span className="flex items-center gap-1 text-xs text-neutral-500">
                <Clock className="h-3 w-3" />
                {new Date(task.deadline).toLocaleDateString("zh-CN")}
              </span>
            )}
            {task.assignee && (
              <span className="text-xs text-neutral-500">
                负责人：{task.assignee.name}
              </span>
            )}
          </div>
        </div>
      </div>
      {canDelete(task, isOwner, currentUserId) && (
        <button
          onClick={handleDelete}
          className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          title="删除任务"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
