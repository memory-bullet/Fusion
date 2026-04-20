"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { AlertCountdownBadge } from "@/components/alert-countdown-badge";
import { ProjectInviteChips } from "@/components/project-invite-chips";
import { ProjectEditModal } from "@/components/project-edit-modal";
import { ProjectSwitcher } from "@/components/project-switcher";
import { DeadlineDisplay } from "@/components/deadline-display";
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
  onProjectUpdated?: (newTitle: string, newDeadline?: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  function handleUpdated(newTitle: string, newDeadline?: string) {
    onProjectUpdated?.(newTitle, newDeadline);
  }

  const displayTitle = title ?? project.title;

  return (
    <>
      <section className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* 项目标题 */}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
                {displayTitle}
              </h1>
              {/* 项目切换器 */}
              {projectId && (
                <ProjectSwitcher
                  currentProjectId={projectId}
                  currentProjectTitle={displayTitle}
                />
              )}
              {/* 编辑按钮 */}
              {isOwner && projectId && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  title="项目设置"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
              <span className="shrink-0">截止时间</span>
              <DeadlineDisplay deadline={project.deadline} size="normal" />
              {activeTask ? <AlertCountdownBadge level={activeTask.warningLevel} /> : null}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1 shrink-0">
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-mono font-medium text-slate-600">
              {project.inviteCode}
            </span>
            <ProjectInviteChips inviteCode={project.inviteCode} />
          </div>
        </div>
      </section>

      {/* 项目编辑弹窗 */}
      {isOwner && projectId ? (
        <ProjectEditModal
          open={editOpen}
          projectId={projectId}
          projectTitle={displayTitle}
          projectDeadline={project.deadline}
          inviteCode={project.inviteCode}
          isOwner={isOwner}
          onClose={() => setEditOpen(false)}
          onUpdated={handleUpdated}
        />
      ) : null}
    </>
  );
}
