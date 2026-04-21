"use client";

import { FileText, Sparkles, ChevronRight } from "lucide-react";
import { ProjectCardMenu } from "./project-card-menu";

type DraftSpaceCardProps = {
  projectId: string;
  inviteCode: string;
  onEnter: (id: string) => void;
  onRename: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

const ui = {
  card: "rounded-2xl border bg-white p-5 shadow-sm"
};

export function DraftSpaceCard({ projectId, inviteCode, onEnter, onRename, onDelete }: DraftSpaceCardProps) {
  return (
    <div
      className={`${ui.card} border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white transition hover:border-amber-300 hover:shadow-md`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <FileText className="h-5 w-5 text-amber-600" />
          <div className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-200">
            <Sparkles className="h-2.5 w-2.5 text-amber-600" />
          </div>
        </div>
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => onEnter(projectId)}
          role="button"
          data-button-hover="off"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onEnter(projectId)}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900">我的任务草稿</span>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              个人空间
            </span>
          </div>
          <p className="mt-0.5 text-xs text-amber-600">
            快速记录想法，AI 帮你拆解成可执行任务
          </p>
        </div>
        <ProjectCardMenu
          projectId={projectId}
          projectTitle="我的任务草稿"
          inviteCode={inviteCode}
          isDraftSpace={true}
          onRename={onRename}
          onDelete={onDelete}
        />
        <button
          type="button"
          onClick={() => onEnter(projectId)}
          className="shrink-0 rounded-lg p-1.5 text-amber-400 hover:bg-amber-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
