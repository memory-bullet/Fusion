"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { AlertCountdownBadge } from "@/components/alert-countdown-badge";
import { ProjectInviteChips } from "@/components/project-invite-chips";
import { ProjectEditModal } from "@/components/project-edit-modal";
import { DashboardData, DashboardTask } from "@/lib/types";

export function ProjectHero({
  project,
  activeTask,
  title,
  subtitle,
  isOwner,
  projectId,
  onProjectUpdated
}: {
  project: DashboardData["project"];
  activeTask?: DashboardTask | null;
  title?: string;
  subtitle?: string;
  /** 是否为组长，仅组长显示编辑按钮 */
  isOwner?: boolean;
  /** 项目 ID，用于编辑弹窗 */
  projectId?: string;
  /** 项目名更新回调 */
  onProjectUpdated?: (newTitle: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  function handleUpdated(newTitle: string) {
    onProjectUpdated?.(newTitle);
  }

  const displayTitle = title ?? project.title;

  return (
    <>
      <section className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-5xl font-semibold leading-tight tracking-tight truncate">
              {displayTitle}
            </h1>
            {isOwner && projectId && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="项目设置"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 pt-1 shrink-0">
            <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-mono font-medium text-slate-600">
              {project.inviteCode}
            </span>
            <ProjectInviteChips inviteCode={project.inviteCode} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>截止时间：{new Date(project.deadline).toLocaleString()}</span>
          {activeTask ? <AlertCountdownBadge level={activeTask.warningLevel} /> : null}
        </div>
        <p className="mt-4 max-w-3xl text-base text-muted">{subtitle ?? project.contextSummary}</p>
      </section>

      {/* 项目编辑弹窗 */}
      {isOwner && projectId ? (
        <ProjectEditModal
          open={editOpen}
          projectId={projectId}
          projectTitle={displayTitle}
          inviteCode={project.inviteCode}
          isOwner={isOwner}
          onClose={() => setEditOpen(false)}
          onUpdated={handleUpdated}
        />
      ) : null}
    </>
  );
}
