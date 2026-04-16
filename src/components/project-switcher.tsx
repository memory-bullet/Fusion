"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  title: string;
  role: string;
};

type ProjectSwitcherProps = {
  currentProjectId: string;
  currentProjectTitle: string;
};

export function ProjectSwitcher({ currentProjectId, currentProjectTitle }: ProjectSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects/mine", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error("加载项目列表失败", e);
    } finally {
      setLoading(false);
    }
  }

  function handleSwitch(projectId: string) {
    if (projectId === currentProjectId) {
      setOpen(false);
      return;
    }
    router.push(`/project/${projectId}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm transition hover:bg-slate-50"
        title="切换项目"
      >
        <span className="text-slate-600">选择其他任务</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-neutral-200 bg-white shadow-xl"
        >
          <div className="border-b border-neutral-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-neutral-900">切换项目</h3>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-neutral-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : projects.length === 0 ? (
              <div className="py-8 text-center text-sm text-neutral-400">暂无项目</div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => {
                  const isCurrentProject = project.id === currentProjectId;
                  const isProjectDraftSpace = project.title === "我的任务草稿";
                  const isOwner = project.role === "OWNER";

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleSwitch(project.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        isCurrentProject
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          isProjectDraftSpace
                            ? "bg-amber-100 text-amber-700"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {project.title.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{project.title}</span>
                          {isProjectDraftSpace && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                              草稿
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">
                          {isOwner ? "创建者" : "成员"}
                        </p>
                      </div>
                      {isCurrentProject && (
                        <Check className="h-4 w-4 shrink-0 text-neutral-900" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-neutral-200 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                router.push("/");
                setOpen(false);
              }}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              返回首页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
