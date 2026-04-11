"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BellRing, FileUp, RefreshCw } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { useProjectDashboard } from "@/lib/use-project-dashboard";
import { DashboardTask } from "@/lib/types";

function statusTone(task: DashboardTask) {
  if (task.warningLevel === "CRITICAL") return "text-red-500";
  if (task.warningLevel === "WARNING") return "text-amber-500";
  return "text-slate-800";
}

function avatarToken(name: string) {
  return name.slice(0, 1).toUpperCase();
}

export function ProjectManagePage({ projectId }: { projectId: string }) {
  const { data, error } = useProjectDashboard(projectId);
  const [view, setView] = useState<"list" | "gantt">("list");

  if (error) {
    return <main className="min-h-screen bg-white p-8 text-critical">{error}</main>;
  }

  if (!data) {
    return <main className="min-h-screen bg-white p-8">Loading...</main>;
  }

  const orderedTasks = [...data.tasks].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  );

  return (
    <main className="min-h-screen bg-bg">
      <TopNav />
      <div className="shell py-6">
        <ProjectHero project={data.project} title="项目管理" subtitle="上传文档、查看任务列表，并跟踪系统干预记录。" />
        <div className="mb-6">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            返回主界面
          </Link>
        </div>

        <section className="line-card mb-8 p-6">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-slate-50">
                <FileUp className="h-7 w-7 text-slate-500" />
              </div>
              <div className="mt-6 text-3xl font-semibold tracking-tight">上传作业要求文档</div>
              <p className="mt-3 text-sm text-muted">支持 PDF、图片和文本，上传后可进入 AI 提取流程。</p>
            </div>

            <div className="soft-panel rounded-[28px] p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <RefreshCw className="h-5 w-5 text-blue-500" />
                  AI 正在提取关键产出物...
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-sm font-medium text-emerald-700">
                  Done
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full border border-line bg-white px-4 py-2 text-sm shadow-card">[调研报告]</span>
                <span className="rounded-full border border-line bg-white px-4 py-2 text-sm shadow-card">[Figma 原型]</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-5 flex justify-center">
          <div className="inline-flex rounded-full border border-line bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-full px-6 py-3 text-lg font-medium ${view === "list" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"}`}
            >
              任务列表视图
            </button>
            <button
              type="button"
              onClick={() => setView("gantt")}
              className={`rounded-full px-6 py-3 text-lg font-medium ${view === "gantt" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"}`}
            >
              甘特图视图
            </button>
          </div>
        </div>

        {view === "list" ? (
          <section className="line-card mb-8 overflow-hidden p-8">
            <div className="grid grid-cols-[1.1fr_2fr_0.7fr_0.7fr] gap-6 border-b border-line pb-5 text-[22px] font-semibold tracking-tight text-slate-500">
              <div>任务名称</div>
              <div>具体内容</div>
              <div>分配给</div>
              <div>DDL</div>
            </div>
            <div>
              {orderedTasks.map((task) => (
                <div key={task.id} className="grid grid-cols-[1.1fr_2fr_0.7fr_0.7fr] gap-6 border-b border-line py-7">
                  <div className={`text-[18px] font-semibold ${statusTone(task)}`}>
                    {task.title}
                    {task.warningLevel === "CRITICAL" ? "（已逾期）" : ""}
                  </div>
                  <div className="text-[16px] text-slate-500">
                    收集与整理产出，工作量 {task.workloadPoints} 点，当前状态 {task.status.replaceAll("_", " ")}
                  </div>
                  <div>
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-emerald-50 text-lg font-semibold text-emerald-700 shadow-card">
                      {avatarToken(task.assignee?.name ?? "U")}
                    </span>
                  </div>
                  <div>
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-[16px] text-slate-600">
                      {new Date(task.deadline).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="line-card mb-8 overflow-hidden p-8">
            <div className="grid gap-6 lg:grid-cols-[120px_1fr]">
              <div className="space-y-6 border-r border-line pr-4">
                {data.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-slate-50 text-lg font-semibold text-slate-700">
                      {avatarToken(member.name)}
                    </span>
                    <span className="text-xl font-semibold text-slate-700">{member.name}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="grid grid-cols-7 gap-4 pb-6 text-center text-2xl font-medium text-slate-400">
                  {["4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11"].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="relative space-y-6 border-t border-line pt-6">
                  <div className="pointer-events-none absolute inset-y-0 left-[50%] w-px bg-blue-400" />
                  {orderedTasks.map((task, index) => (
                    <div
                      key={task.id}
                      className={`w-full rounded-full border px-6 py-4 text-xl font-semibold shadow-card ${
                        task.warningLevel === "CRITICAL"
                          ? "border-red-200 text-red-500"
                          : task.warningLevel === "WARNING"
                            ? "border-amber-200 text-amber-600"
                            : "border-emerald-200 text-emerald-600"
                      }`}
                      style={{
                        maxWidth: `${32 + (index % 3) * 16}%`,
                        marginLeft: `${index % 4 === 0 ? "0%" : `${8 + (index % 4) * 12}%`}`
                      }}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="line-card p-8">
          <div className="mb-6 flex items-center gap-3 text-[32px] font-semibold tracking-tight">
            <BellRing className="h-8 w-8 text-slate-400" />
            督促与干预系统公告栏
          </div>
          <div className="space-y-4">
            {data.logs.slice(0, 6).map((log, index) => (
              <div
                key={log.id}
                className={`rounded-2xl border px-6 py-5 text-xl ${
                  index % 2 === 0
                    ? "border-red-100 bg-red-50 text-red-500"
                    : "border-emerald-100 bg-emerald-50 text-emerald-600"
                }`}
              >
                {index % 2 === 0 ? "[系统预警]" : "[进度播报]"} {log.description}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
