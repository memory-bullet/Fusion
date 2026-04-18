"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BellRing, FileUp, Loader2, RefreshCw, Trash2, Users, Plus, X, UserCog, UserMinus, Share2 } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { ReallocateDialog } from "@/components/reallocate-dialog";
import { ProjectInvitePanel } from "@/components/project-invite-panel";
import { useProjectDashboard } from "@/lib/use-project-dashboard";
import { buildDraftFromSuggested, type TaskDraftRow } from "@/lib/task-draft";
import { formatMilestoneDueDisplay } from "@/lib/assignment-milestones";
import { MemberWorkloadStrip } from "@/components/member-workload-strip";
import { WorkloadShareBar } from "@/components/workload-share-bar";
import { memberWorkloadPoints } from "@/lib/member-workload";
import { TaskBoard } from "@/components/task-board";
import { ProjectAiChatPanel } from "@/components/project-ai-chat-panel";
import type { TaskStatus } from "@/lib/domain";
import { DashboardData, DashboardTask } from "@/lib/types";
import { getDisplayName } from "@/lib/display-name";

function statusTone(task: DashboardTask) {
  if (task.warningLevel === "CRITICAL") return "text-red-500";
  if (task.warningLevel === "WARNING") return "text-amber-500";
  return "text-slate-800";
}

function normalizeTaskTitle(title: string) {
  return title
    .replace(/^(\[Reallocated\]\s*)+/g, "")
    .replace(/^(\[Split\s+\d+\/\d+\]\s*)+/g, "")
    .trim();
}

function taskIdentityKey(task: Pick<DashboardTask, "title" | "sourceLabel">) {
  return `${task.sourceLabel ?? "未标注来源"}__${normalizeTaskTitle(task.title)}`;
}

function canReallocateTask(task: DashboardTask) {
  return task.warningLevel === "CRITICAL" && task.status !== "DONE";
}

function criticalLabel(task: DashboardTask) {
  if (task.warningLevel !== "CRITICAL") return "";
  return new Date(task.deadline).getTime() <= Date.now() ? "（已逾期）" : "（24 小时内）";
}

function ganttSlotIndex(deadline: string) {
  const day = new Date(deadline).getDate();
  const slots = [5, 6, 7, 8, 9, 10, 11];
  const index = slots.indexOf(day);
  return index >= 0 ? index : Math.max(0, Math.min(slots.length - 1, day - 5));
}

function ganttBarStyle(task: DashboardTask, laneIndex: number) {
  const slot = ganttSlotIndex(task.deadline);
  const left = Math.min(84, slot * 13.5 + laneIndex * 2.5);
  const width = Math.min(30, 12 + task.workloadPoints * 1.8);

  return {
    left: `${left}%`,
    width: `${width}%`
  };
}

function ganttBarMetrics(task: DashboardTask) {
  const slot = ganttSlotIndex(task.deadline);
  const left = Math.min(84, slot * 13.5);
  const width = Math.min(30, 12 + task.workloadPoints * 1.8);
  return {
    left,
    width,
    right: left + width
  };
}

function buildLaneLayouts(tasks: DashboardTask[]) {
  const sorted = [...tasks].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  );
  const rows: Array<Array<{ id: string; left: number; right: number }>> = [];

  return sorted.map((task) => {
    const metrics = ganttBarMetrics(task);
    let rowIndex = 0;

    while (true) {
      const row = rows[rowIndex] ?? [];
      const overlap = row.some((item) => !(metrics.right < item.left || metrics.left > item.right));
      if (!overlap) {
        row.push({ id: task.id, left: metrics.left, right: metrics.right });
        rows[rowIndex] = row;
        return {
          task,
          rowIndex,
          left: metrics.left,
          width: metrics.width
        };
      }
      rowIndex += 1;
    }
  });
}

function laneTone(index: number) {
  const tones = [
    "bg-sky-50/45",
    "bg-emerald-50/45",
    "bg-amber-50/45",
    "bg-rose-50/45",
    "bg-violet-50/45"
  ];

  return tones[index % tones.length];
}

function classifyLog(actionType: string) {
  if (actionType === "TASK_REALLOCATED") {
    return {
      label: "任务转交",
      className: "border-amber-100 bg-amber-50 text-amber-800"
    };
  }

  if (actionType === "TASK_DONE") {
    return {
      label: "任务完成",
      className: "border-emerald-100 bg-emerald-50 text-emerald-600"
    };
  }

  if (actionType === "TASK_STATUS_CHANGED") {
    return {
      label: "状态更新",
      className: "border-sky-100 bg-sky-50 text-sky-700"
    };
  }

  if (actionType === "TASK_ASSIGNED") {
    return {
      label: "任务分配",
      className: "border-violet-100 bg-violet-50 text-violet-800"
    };
  }

  if (actionType === "TASK_ULTIMATUM_RED") {
    return {
      label: "最后通牒",
      className: "border-red-200 bg-red-50 text-red-800"
    };
  }

  return {
    label: "系统记录",
    className: "border-slate-200 bg-slate-50 text-slate-600"
  };
}

function splitLogDescription(description: string) {
  const penaltyMarker = "｜处罚：";
  if (!description.includes(penaltyMarker)) {
    return {
      main: description,
      penalty: null as string | null
    };
  }

  const [main, penalty] = description.split(penaltyMarker);
  return {
    main,
    penalty: penalty ? `处罚：${penalty}` : null
  };
}

function formatLogTime(createdAt: string) {
  return new Date(createdAt).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function dedupeLogs(logs: DashboardData["logs"]) {
  const seen = new Set<string>();

  return logs.filter((log) => {
    const minuteBucket = new Date(log.createdAt).toISOString().slice(0, 16);
    const key = `${log.actionType}__${log.description}__${minuteBucket}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

const ACCEPT_UPLOAD =
  ".pdf,.docx,.html,.htm,.txt,.md,.markdown,.mdown,.mkd,text/plain,text/markdown,text/x-markdown,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif";

export function ProjectManagePage({ projectId }: { projectId: string }) {
  const { data, error, refresh } = useProjectDashboard(projectId);
  const [view, setView] = useState<"list" | "gantt" | "kanban">("kanban");
  const [digestBusy, setDigestBusy] = useState(false);
  const digestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "processing">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftTasks, setDraftTasks] = useState<TaskDraftRow[] | null>(null);
  const [draftSourceLabel, setDraftSourceLabel] = useState("");
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [reallocateTaskId, setReallocateTaskId] = useState<string | null>(null);
  const [reallocateLoading, setReallocateLoading] = useState(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);
  const [taskActionMessage, setTaskActionMessage] = useState<string | null>(null);

  const runUpload = useCallback(
    async (file: File, isOwner: boolean, members: { id: string }[]) => {
      setUploadError(null);
      setCommitError(null);
      if (!isOwner) {
        setUploadError("仅项目创建者（组长）可在此上传文档并生成可编辑的任务草稿。");
        return;
      }
      setUploadPhase("processing");
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/projects/${projectId}/requirement-upload`, {
          method: "POST",
          body: formData
        });
        const parsePayload = await res.json();
        if (!res.ok) {
          throw new Error(typeof parsePayload.error === "string" ? parsePayload.error : "文档处理失败");
        }

        await refresh();

        const suggested = parsePayload.suggestedTasks;
        if (Array.isArray(suggested) && suggested.length > 0 && members.length > 0) {
          const normalized = suggested
            .map((t: { title?: unknown; workloadPoints?: unknown; deadlineOffsetHours?: unknown }) => ({
              title: String(t.title ?? "").trim(),
              workloadPoints: Number(t.workloadPoints),
              deadlineOffsetHours: Number(t.deadlineOffsetHours)
            }))
            .filter(
              (t) =>
                t.title.length > 0 &&
                Number.isInteger(t.workloadPoints) &&
                t.workloadPoints > 0 &&
                Number.isInteger(t.deadlineOffsetHours) &&
                t.deadlineOffsetHours >= 1 &&
                t.deadlineOffsetHours <= 240
            );
          const rows = buildDraftFromSuggested(normalized, members);
          setDraftTasks(rows.length > 0 ? rows : null);
        } else {
          setDraftTasks(null);
        }
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "上传处理失败");
      } finally {
        setUploadPhase("idle");
      }
    },
    [projectId, refresh]
  );

  const commitDraft = useCallback(async () => {
    if (!draftTasks?.length) return;
    setCommitError(null);
    setCommitLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/commit-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLabel: draftSourceLabel.trim(), tasks: draftTasks })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "写入失败");
      }
      setDraftTasks(null);
      setDraftSourceLabel("");
      await refresh();
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : "写入失败");
    } finally {
      setCommitLoading(false);
    }
  }, [draftSourceLabel, draftTasks, projectId, refresh]);

  function updateDraftRow(index: number, patch: Partial<TaskDraftRow>) {
    setDraftTasks((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeDraftRow(index: number) {
    setDraftTasks((prev) => {
      if (!prev) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : null;
    });
  }

  function openReallocateDialog(taskId: string) {
    setReallocateError(null);
    setReallocateTaskId(taskId);
  }

  function closeReallocateDialog() {
    if (reallocateLoading) return;
    setReallocateError(null);
    setReallocateTaskId(null);
  }

  const scheduleProgressDigest = useCallback(() => {
    if (digestTimerRef.current) clearTimeout(digestTimerRef.current);
    digestTimerRef.current = setTimeout(() => {
      digestTimerRef.current = null;
      void fetch(`/api/projects/${projectId}/progress-digest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "week" })
      })
        .then((r) => {
          if (r.ok) return refresh();
        })
        .catch(() => {});
    }, 2200);
  }, [projectId, refresh]);

  const patchTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      setTaskActionMessage(null);
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTaskActionMessage(typeof payload.error === "string" ? payload.error : "更新失败");
        return;
      }
      await refresh();
      scheduleProgressDigest();
    },
    [refresh, scheduleProgressDigest]
  );

  const claimTask = useCallback(
    async (taskId: string) => {
      setTaskActionMessage(null);
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "TODO" })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTaskActionMessage(typeof payload.error === "string" ? payload.error : "认领失败");
        return;
      }
      setTaskActionMessage("已认领该任务");
      await refresh();
      scheduleProgressDigest();
    },
    [refresh, scheduleProgressDigest]
  );

  const assignTaskToMember = useCallback(
    async (taskId: string, assigneeId: string, previousAssigneeId: string | null | undefined) => {
      if (assigneeId === previousAssigneeId) return;
      setTaskActionMessage(null);
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTaskActionMessage(typeof payload.error === "string" ? payload.error : "指派失败");
        return;
      }
      await refresh();
      scheduleProgressDigest();
    },
    [refresh, scheduleProgressDigest]
  );

  const refreshProgressDigestNow = useCallback(async () => {
    setDigestBusy(true);
    setTaskActionMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/progress-digest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "week" })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTaskActionMessage(typeof payload.error === "string" ? payload.error : "简报生成失败");
        return;
      }
      await refresh();
    } finally {
      setDigestBusy(false);
    }
  }, [projectId, refresh]);

  const nextSourceLabel = data
    ? `第${new Set(data.tasks.map((task) => task.sourceLabel).filter(Boolean)).size + 1}批作业要求`
    : "";

  useEffect(() => {
    if (!data) return;
    if (!draftTasks?.length) {
      setDraftSourceLabel(nextSourceLabel);
    }
  }, [data, draftTasks, nextSourceLabel]);

  if (error) {
    return <main className="min-h-screen bg-white p-8 text-critical">{error}</main>;
  }

  if (!data) {
    return <main className="min-h-screen bg-white p-8">Loading...</main>;
  }

  const visibleTasks = Array.from(
    data.tasks
      .filter((task) => task.status !== "REALLOCATED")
      .reduce((map, task) => {
        const identityKey = taskIdentityKey(task);
        const existing = map.get(identityKey);

        if (!existing || new Date(task.deadline).getTime() >= new Date(existing.deadline).getTime()) {
          map.set(identityKey, task);
        }

        return map;
      }, new Map<string, DashboardTask>())
      .values()
  );

  const orderedTasks = [...visibleTasks].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  );

  const deliverables =
    data.project.keyDeliverables?.filter((x) => typeof x === "string" && x.trim().length > 0) ?? [];
  const milestones = data.project.assignmentMilestones ?? [];

  const taskListWorkloadTotal = orderedTasks.reduce((s, t) => s + t.workloadPoints, 0);

  const draftWorkloadItems = (draftTasks ?? []).map((row) => ({
    label: row.title.trim() || "未命名任务",
    points: row.workloadPoints
  }));

  const listWorkloadItems = orderedTasks.map((t) => ({
    label: normalizeTaskTitle(t.title),
    points: t.workloadPoints
  }));

  const visibleLogs = dedupeLogs(data.logs).slice(0, 6);
  const busy = uploadPhase !== "idle";
  const canCommitDraft = data.isOwner && Boolean(draftTasks?.length) && !commitLoading && !busy;
  const selectedTask = orderedTasks.find((task) => task.id === reallocateTaskId) ?? null;

  async function confirmReallocation(payload: {
    newDeadline: string;
    allocations: Array<{ assigneeId: string; workloadPoints: number }>;
  }) {
    if (!selectedTask || payload.allocations.length === 0) return;
    setReallocateError(null);
    setReallocateLoading(true);

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/reallocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const responseBody = await res.json();

      if (!res.ok) {
        throw new Error(typeof responseBody.error === "string" ? responseBody.error : "重新分配失败");
      }

      setReallocateTaskId(null);
      await refresh();
    } catch (e) {
      setReallocateError(e instanceof Error ? e.message : "重新分配失败");
    } finally {
      setReallocateLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg">
      <TopNav />
      <div className="shell py-6">
        <ProjectHero
          project={data.project}
          title="项目管理"
          subtitle={
            data.isOwner
              ? "组长：上传并解析作业全文后，可编辑任务草稿并按阶段多次写入；刷新页面会丢失未确认的草稿。"
              : "查看任务与公告；上传与任务排期仅组长（项目创建者）可操作。"
          }
          projectId={projectId}
          isOwner={data.isOwner}
        />
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">AI 团队进度简报</h2>
              <p className="mt-1 text-xs text-muted">
                根据任务状态与操作记录自动生成，供全员查看；状态更新后约 2 秒会尝试刷新（需配置 GEMINI_API_KEY 或 OPENAI_API_KEY）。
              </p>
            </div>
            {data.me && !data.isGuest ? (
              <button
                type="button"
                disabled={digestBusy}
                onClick={() => void refreshProgressDigestNow()}
                className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {digestBusy ? "生成中…" : "立即刷新简报"}
              </button>
            ) : null}
          </div>
          {data.project.progressDigest ? (
            <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-line bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-800">
              {data.project.progressDigest}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">尚无简报。更新任务状态或点击「立即刷新简报」生成。</p>
          )}
          {data.project.progressDigestAt ? (
            <p className="mt-2 text-xs text-muted">
              生成时间：{new Date(data.project.progressDigestAt).toLocaleString("zh-CN")}
            </p>
          ) : null}
        </section>

        {/* ── 成员管理 ── */}
        <MemberManagementSection
          projectId={projectId}
          members={data.members}
          presets={data.presets ?? []}
          isOwner={data.isOwner}
          currentUserId={data.me?.id ?? null}
          inviteCode={data.project.inviteCode}
          onRefresh={refresh}
        />

        <section className="line-card mb-8 p-6">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={ACCEPT_UPLOAD}
              disabled={busy || !data.isOwner}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void runUpload(file, data.isOwner, data.members);
              }}
            />
            <button
              type="button"
              disabled={busy || !data.isOwner}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!busy && data.isOwner) setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActive(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActive(false);
                if (busy || !data.isOwner) return;
                const file = e.dataTransfer.files?.[0];
                if (file) void runUpload(file, data.isOwner, data.members);
              }}
              className={`rounded-[28px] border border-dashed bg-white p-10 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                dragActive ? "border-blue-400 bg-blue-50/40" : "border-slate-200"
              }`}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-slate-50">
                {busy ? (
                  <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                ) : (
                  <FileUp className="h-7 w-7 text-slate-500" />
                )}
              </div>
              <div className="mt-6 text-3xl font-semibold tracking-tight">上传作业要求文档</div>
              <p className="mt-3 text-sm text-muted">
                支持 PDF、Word（.docx）、Markdown、HTML、纯文本与常见图片（含 HEIC）；点击或拖拽到此处，将自动提取文本并由 AI 解析（含时间节点与建议任务）。
              </p>
              {!data.isOwner ? (
                <p className="mt-4 text-sm font-medium text-amber-700">仅组长可在此上传并生成任务草稿。</p>
              ) : null}
            </button>

            <div className="soft-panel rounded-[28px] p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3 text-lg font-semibold">
                  {uploadPhase === "processing" ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-500" />
                  ) : (
                    <RefreshCw className="h-5 w-5 shrink-0 text-slate-400" />
                  )}
                  <span className="truncate">
                    {uploadPhase === "processing"
                      ? "正在读取文档并由 AI 解析（可能需要 1～3 分钟）…"
                      : deliverables.length > 0
                        ? "AI 已提取关键产出物"
                        : "AI 提取关键产出物"}
                  </span>
                </div>
                {uploadError ? (
                  <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-4 py-1 text-sm font-medium text-red-700">
                    失败
                  </span>
                ) : busy ? (
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-sm font-medium text-amber-800">
                    处理中
                  </span>
                ) : deliverables.length > 0 ? (
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-sm font-medium text-emerald-700">
                    已完成
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-1 text-sm font-medium text-slate-600">
                    待上传
                  </span>
                )}
              </div>
              {uploadError ? (
                <p className="mt-4 text-sm text-red-600">{uploadError}</p>
              ) : null}
              <div className="mt-5 flex min-h-[48px] flex-wrap gap-3">
                {deliverables.length > 0 ? (
                  deliverables.map((label, idx) => (
                    <span
                      key={`${idx}-${label}`}
                      className="rounded-full border border-line bg-white px-4 py-2 text-sm shadow-card"
                    >
                      [{label}]
                    </span>
                  ))
                ) : !busy ? (
                  <p className="text-sm text-muted">上传左侧文档后，将在此显示模型识别出的交付物标签。</p>
                ) : null}
              </div>
              {milestones.length > 0 ? (
                <div className="mt-5 border-t border-line pt-5">
                  <p className="text-sm font-medium text-slate-700">关键时间节点（AI）</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {milestones.map((m, i) => (
                      <li key={`${i}-${m.label}`} className="flex flex-wrap gap-x-2 gap-y-0.5">
                        <span className="font-medium text-slate-800">{m.label}</span>
                        <span className="text-muted">{formatMilestoneDueDisplay(m)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {data.isOwner && draftTasks && draftTasks.length > 0 ? (
          <section className="line-card mb-8 overflow-hidden p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">任务草稿（未写入数据库）</h2>
                <p className="mt-1 text-sm text-muted">
                  刷新页面会丢失。AI 建议为<strong className="font-medium text-slate-800"> 100 点制</strong>
                  工作量（可改）；确认后写入任务列表，相对截止会换算为具体日期（不超过项目截止）。
                </p>
              </div>
              <button
                type="button"
                disabled={!canCommitDraft || draftSourceLabel.trim().length === 0}
                onClick={() => void commitDraft()}
                className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {commitLoading ? "写入中…" : "确认新增这一批任务"}
              </button>
            </div>
            {commitError ? <p className="mb-3 text-sm text-red-600">{commitError}</p> : null}
            <div className="mb-4 max-w-sm">
              <label className="mb-2 block text-sm font-medium text-slate-700">来源标签</label>
              <input
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                value={draftSourceLabel}
                onChange={(e) => setDraftSourceLabel(e.target.value)}
                placeholder="例如：第一阶段作业要求"
              />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-slate-600">
                    <th className="px-3 py-3 font-semibold">任务名称</th>
                    <th className="w-28 px-3 py-3 font-semibold">工作量</th>
                    <th className="w-36 px-3 py-3 font-semibold">相对截止（小时）</th>
                    <th className="min-w-[140px] px-3 py-3 font-semibold">负责人</th>
                    <th className="w-14 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {draftTasks.map((row, index) => (
                    <tr key={`draft-${index}`} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 align-middle">
                        <input
                          className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                          value={row.title}
                          onChange={(e) => updateDraftRow(index, { title: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <input
                          type="number"
                          min={1}
                          className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                          value={row.workloadPoints}
                          onChange={(e) =>
                            updateDraftRow(index, { workloadPoints: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <input
                          type="number"
                          min={1}
                          max={240}
                          className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                          value={row.deadlineOffsetHours}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            const v = Number.isFinite(n) ? Math.min(240, Math.max(1, Math.floor(n))) : 1;
                            updateDraftRow(index, { deadlineOffsetHours: v });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <select
                          className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                          value={row.assigneeId}
                          onChange={(e) => updateDraftRow(index, { assigneeId: e.target.value })}
                        >
                          {data.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {getDisplayName(m)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-2 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => removeDraftRow(index)}
                          className="inline-flex rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label="删除此行"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <WorkloadShareBar items={draftWorkloadItems} title="草稿：工作量权重分布" />
            </div>
          </section>
        ) : null}

        <div className="mb-5 flex justify-center">
          <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-line bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`rounded-full px-5 py-3 text-base font-medium ${view === "kanban" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"}`}
            >
              看板（拖拽）
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-full px-5 py-3 text-base font-medium ${view === "list" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"}`}
            >
              任务列表
            </button>
            <button
              type="button"
              onClick={() => setView("gantt")}
              className={`rounded-full px-5 py-3 text-base font-medium ${view === "gantt" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"}`}
            >
              甘特图
            </button>
          </div>
        </div>

        {view === "kanban" ? (
          <section className="mb-8 space-y-4">
            <MemberWorkloadStrip members={data.members} tasks={data.tasks} />
            {taskActionMessage ? <p className="text-center text-sm text-slate-700">{taskActionMessage}</p> : null}
            <TaskBoard
              tasks={orderedTasks}
              canOperate={Boolean(data.me) && !data.isGuest}
              onMove={(id, next) => void patchTaskStatus(id, next)}
              onPatchStatus={(id, s) => void patchTaskStatus(id, s)}
              onHint={(msg) => setTaskActionMessage(msg)}
            />
          </section>
        ) : null}

        {view === "list" ? (
          <section className="line-card mb-8 overflow-hidden p-8">
            <div className="mb-6 space-y-4">
              <MemberWorkloadStrip members={data.members} tasks={data.tasks} />
              {taskActionMessage ? (
                <p className="text-center text-sm text-slate-700">{taskActionMessage}</p>
              ) : null}
            </div>
            {listWorkloadItems.length > 0 ? (
              <div className="mb-6">
                <WorkloadShareBar
                  items={listWorkloadItems}
                  title={taskListWorkloadTotal === 100 ? "当前列表：工作量权重（100 点制）" : "当前列表：工作量权重分布"}
                />
              </div>
            ) : null}
            <div className="grid grid-cols-[1.05fr_1.55fr_0.6fr_0.8fr_0.9fr_0.7fr] items-center gap-6 border-b border-line pb-5 text-center text-[22px] font-semibold tracking-tight text-slate-500">
              <div className="flex items-center justify-center">任务名称</div>
              <div className="flex items-center justify-center">具体内容</div>
              <div className="flex items-center justify-center">工作量</div>
              <div className="flex items-center justify-center">当前状态</div>
              <div className="flex items-center justify-center">分配给</div>
              <div className="flex items-center justify-center">DDL</div>
            </div>
            <div>
              {orderedTasks.map((task) => (
                <div key={task.id} className="grid grid-cols-[1.05fr_1.55fr_0.6fr_0.8fr_0.9fr_0.7fr] items-center gap-6 border-b border-line py-7 text-center">
                  <div className={`flex flex-col items-center justify-center text-[18px] font-semibold ${statusTone(task)}`}>
                    <div>{normalizeTaskTitle(task.title)}</div>
                    {task.sourceLabel ? (
                      <div className="mt-2">
                        <span className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                          {task.sourceLabel}
                        </span>
                      </div>
                    ) : null}
                    {criticalLabel(task)}
                    {canReallocateTask(task) ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => openReallocateDialog(task.id)}
                          className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          重新分配
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 text-[14px] text-slate-500">
                    <span>
                      占团队任务总量{" "}
                      <span className="font-semibold text-slate-700">
                        {taskListWorkloadTotal > 0
                          ? ((task.workloadPoints / taskListWorkloadTotal) * 100).toFixed(1)
                          : "0"}
                        %
                      </span>
                    </span>
                    <span className="text-xs text-muted">相对权重，可结合上方彩条查看</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-[15px] font-medium text-slate-600">
                      {task.workloadPoints} 点
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2 px-1">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-medium text-slate-600">
                      {task.status === "UNASSIGNED"
                        ? "待认领"
                        : task.status === "TODO"
                          ? "待开始"
                          : task.status === "IN_PROGRESS"
                            ? "进行中"
                            : task.status === "BLOCKED"
                              ? "求助中"
                              : task.status === "DONE"
                                ? "已完成"
                                : task.status.replaceAll("_", " ")}
                    </span>
                    {data.me && !data.isGuest && task.status !== "DONE" && task.status !== "REALLOCATED" && task.status !== "UNASSIGNED" ? (
                      <div className="flex max-w-[200px] flex-wrap justify-center gap-1">
                        {task.status === "TODO" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void patchTaskStatus(task.id, "IN_PROGRESS")}
                              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-800 hover:bg-slate-50"
                            >
                              开始
                            </button>
                            <button
                              type="button"
                              onClick={() => void patchTaskStatus(task.id, "DONE")}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              onClick={() => void patchTaskStatus(task.id, "BLOCKED")}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-100"
                            >
                              求助
                            </button>
                          </>
                        ) : null}
                        {task.status === "IN_PROGRESS" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void patchTaskStatus(task.id, "DONE")}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              onClick={() => void patchTaskStatus(task.id, "BLOCKED")}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-100"
                            >
                              求助
                            </button>
                          </>
                        ) : null}
                        {task.status === "BLOCKED" ? (
                          <button
                            type="button"
                            onClick={() => void patchTaskStatus(task.id, "IN_PROGRESS")}
                            className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-900 hover:bg-sky-100"
                          >
                            继续
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2 px-1">
                    <span className="inline-flex min-h-9 min-w-[88px] items-center justify-center rounded-full border border-line bg-emerald-50 px-3 py-1.5 text-[14px] font-semibold text-emerald-800 shadow-card">
                      {task.assignee?.name ?? "未分配"}
                    </span>
                    {task.status === "UNASSIGNED" && data.me && !data.isGuest ? (
                      <button
                        type="button"
                        onClick={() => void claimTask(task.id)}
                        className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-[11px] font-medium text-white transition hover:opacity-90"
                      >
                        认领
                      </button>
                    ) : null}
                    {data.isOwner ? (
                      <label className="flex w-full max-w-[140px] flex-col items-stretch gap-0.5">
                        <span className="text-center text-[10px] text-muted">队长指派</span>
                        <select
                          className="w-full rounded-lg border border-line bg-white px-2 py-1 text-left text-[11px] outline-none focus:ring-2 focus:ring-slate-200"
                          value={task.assignee?.id ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            void assignTaskToMember(task.id, v, task.assignee?.id ?? null);
                          }}
                        >
                          <option value="">选择成员…</option>
                          {data.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {getDisplayName(m)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-[16px] text-slate-600">
                      {new Date(task.deadline).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : view === "gantt" ? (
          <section className="line-card mb-8 overflow-hidden p-8">
            <div className="mb-6">
              <MemberWorkloadStrip members={data.members} tasks={data.tasks} />
              {taskActionMessage ? (
                <p className="mt-3 text-center text-sm text-slate-700">{taskActionMessage}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-[132px_1fr] gap-4">
              <div />
              <div className="grid grid-cols-7 gap-3 pb-4 text-center text-[15px] font-semibold text-slate-400">
                {["4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11"].map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              {data.members.map((member, memberIndex) => {
                const laneTasks = orderedTasks.filter((task) => task.assignee?.id === member.id);
                const layouts = buildLaneLayouts(laneTasks);
                const laneHeight = Math.max(56, layouts.length > 0 ? layouts.length * 42 + 10 : 56);
                const lanePts = memberWorkloadPoints(data.tasks, member.id);

                return (
                  <div key={member.id} className="contents">
                    <div className="flex flex-col items-center justify-center gap-1 border-r border-line pr-4" style={{ minHeight: `${laneHeight}px` }}>
                      <span
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-900 shadow-sm"
                        title={`进行中任务工作量 ${lanePts} 点`}
                      >
                        {lanePts} 点
                      </span>
                      <span className={`inline-flex min-h-9 min-w-[100px] items-center justify-center rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-slate-700 ${laneTone(memberIndex)}`}>
                        {getDisplayName(member)}
                      </span>
                    </div>
                    <div
                      className={`relative border-t border-line border-b border-slate-100 px-2 ${laneTone(memberIndex)}`}
                      style={{ minHeight: `${laneHeight}px` }}
                    >
                      <div className="pointer-events-none absolute inset-y-0 left-[50%] w-px bg-blue-400" />
                      {layouts.map(({ task, rowIndex, left, width }) => (
                        <div
                          key={task.id}
                          className={`absolute flex min-h-[34px] items-center rounded-full border px-4 py-2 text-[13px] font-semibold shadow-card ${
                            task.warningLevel === "CRITICAL"
                              ? "border-red-200 bg-white/90 text-red-500"
                              : task.warningLevel === "WARNING"
                                ? "border-amber-200 bg-white/90 text-amber-600"
                                : "border-emerald-200 bg-white/90 text-emerald-600"
                          }`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            top: `${rowIndex * 42 + 8}px`
                          }}
                        >
                          <div className="min-w-0 flex-1 truncate">{normalizeTaskTitle(task.title)}</div>
                          {canReallocateTask(task) ? (
                            <button
                              type="button"
                              onClick={() => openReallocateDialog(task.id)}
                              className="ml-3 shrink-0 rounded-full border border-current/30 px-2.5 py-1 text-[11px] font-medium"
                            >
                              重新分配
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="line-card p-8">
          <div className="mb-6 flex items-center gap-3 text-[32px] font-semibold tracking-tight">
            <BellRing className="h-8 w-8 text-slate-400" />
            公告栏
          </div>
          <div className="space-y-4">
            {visibleLogs.map((log) => {
              const meta = classifyLog(log.actionType);
              const content = splitLogDescription(log.description);

              return (
                <div key={log.id} className={`rounded-2xl border px-6 py-5 ${meta.className}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-wide">{meta.label}</div>
                    <div className="text-sm opacity-80">{formatLogTime(log.createdAt)}</div>
                  </div>
                  <div className="mt-2 text-sm opacity-80">相关人：{log.user.name}</div>
                  <div className="mt-3 text-lg leading-8">{content.main}</div>
                  {content.penalty ? (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                      {content.penalty}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <ReallocateDialog
        open={Boolean(selectedTask)}
        task={selectedTask}
        members={data.members}
        submitting={reallocateLoading}
        error={reallocateError}
        onClose={closeReallocateDialog}
        onConfirm={confirmReallocation}
      />

      <ProjectAiChatPanel
        projectId={projectId}
        disabled={data.isGuest || !data.me}
        currentUserName={data.me?.name}
      />
    </main>
  );
}

// ─── 成员管理区块 ────────────────────────────────────────────────

type ManagedMember = {
  id: string; // ProjectMember.id
  userId?: string; // User.id
  name: string;
  projectNickname?: string | null;
  role: string;
  joinedStatus: string;
};

type ManagedPreset = {
  id: string;
  presetName: string;
};

function TransferOwnerModal({
  open,
  members,
  projectId,
  onClose,
  onSuccess
}: {
  open: boolean;
  members: ManagedMember[];
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setSelected(null); setError(null); }
  }, [open]);

  async function confirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/transfer-owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: selected })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "转让失败"); return; }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "转让失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  // 可转让对象：已入驻、不是当前OWNER的所有成员
  const transferTargets = members.filter(
    (m) => m.joinedStatus === "ACTIVATED" && m.role !== "OWNER"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">转让组长权限</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          转让后你将变为普通成员，新组长可管理任务、邀请成员。
        </p>
        {transferTargets.length === 0 ? (
          <p className="text-sm text-slate-400">暂无可转让的成员。</p>
        ) : (
          <div className="mb-4 space-y-2">
            {transferTargets.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.userId || m.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selected === (m.userId || m.id)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {getDisplayName(m)}
              </button>
            ))}
          </div>
        )}
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            取消
          </button>
          <button
            type="button"
            disabled={!selected || submitting}
            onClick={confirm}
            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "转让中…" : "确认转让"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberManagementSection({
  projectId,
  members,
  presets,
  isOwner,
  currentUserId,
  inviteCode,
  onRefresh
}: {
  projectId: string;
  members: ManagedMember[];
  presets: ManagedPreset[];
  isOwner: boolean;
  currentUserId: string | null;
  inviteCode: string;
  onRefresh: () => void;
}) {
  const [addingPresets, setAddingPresets] = useState(false);
  const [presetInputs, setPresetInputs] = useState<string[]>([""]);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [presetSubmitting, setPresetSubmitting] = useState(false);
  const [kickMemberId, setKickMemberId] = useState<string | null>(null);
  const [kickError, setKickError] = useState<string | null>(null);
  const [kickSubmitting, setKickSubmitting] = useState(false);
  const [cancelPresetId, setCancelPresetId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDone, setTransferDone] = useState(false);
  // S6: 定向邀请 — 当前正在邀请的预设成员 ID
  const [invitingPresetId, setInvitingPresetId] = useState<string | null>(null);
  // 编辑项目内昵称
  const [editingNicknameMemberId, setEditingNicknameMemberId] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [nicknameSubmitting, setNicknameSubmitting] = useState(false);

  const activatedMembers = members.filter((m) => m.joinedStatus === "ACTIVATED");
  const currentOwner = members.find((m) => m.role === "OWNER");
  const activatedMemberCount = activatedMembers.length;
  // 仅自己一人时显示"创建者"，有其他成员加入后改为"组长"
  const ownerLabel = activatedMemberCount <= 1 ? "创建者" : "组长";
  // 转让按钮：当前用户是组长，且团队至少有 2 人
  const canShowTransfer = isOwner && currentOwner?.userId === currentUserId && activatedMemberCount >= 2;

  function addPresetInput() {
    setPresetInputs((p) => [...p, ""]);
  }
  function removePresetInput(i: number) {
    setPresetInputs((p) => p.filter((_, idx) => idx !== i));
  }
  function updatePresetInput(i: number, v: string) {
    setPresetInputs((p) => p.map((val, idx) => (idx === i ? v : val)));
  }

  async function submitPresets() {
    const names = presetInputs.map((n) => n.trim()).filter(Boolean);
    if (!names.length) return;
    setPresetError(null);
    setPresetSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/member-presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names })
      });
      const data = await res.json();
      if (!res.ok) { setPresetError(data.error || "添加失败"); return; }
      setPresetInputs([""]);
      setAddingPresets(false);
      onRefresh();
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setPresetSubmitting(false);
    }
  }

  async function confirmKick() {
    if (!kickMemberId) return;
    setKickError(null);
    setKickSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members?memberId=${kickMemberId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setKickError(data.error || "移出失败"); return; }
      setKickMemberId(null);
      onRefresh();
    } catch (e) {
      setKickError(e instanceof Error ? e.message : "移出失败");
    } finally {
      setKickSubmitting(false);
    }
  }

  async function confirmCancelPreset() {
    if (!cancelPresetId) return;
    setCancelError(null);
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/member-presets?presetId=${cancelPresetId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setCancelError(data.error || "取消失败"); return; }
      setCancelPresetId(null);
      onRefresh();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "取消失败");
    } finally {
      setCancelSubmitting(false);
    }
  }

  function startEditNickname(memberId: string, currentNickname: string | null | undefined) {
    setEditingNicknameMemberId(memberId);
    setNicknameInput(currentNickname || "");
    setNicknameError(null);
  }

  function cancelEditNickname() {
    setEditingNicknameMemberId(null);
    setNicknameInput("");
    setNicknameError(null);
  }

  async function saveNickname() {
    if (!editingNicknameMemberId) return;
    setNicknameError(null);
    setNicknameSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/nickname`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectNickname: nicknameInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setNicknameError(data.error || "保存失败");
        return;
      }
      setEditingNicknameMemberId(null);
      setNicknameInput("");
      onRefresh();
    } catch (e) {
      setNicknameError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setNicknameSubmitting(false);
    }
  }

  return (
    <>
      <section className="line-card mb-8 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">成员管理</h2>
            {isOwner && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {activatedMemberCount} 人
              </span>
            )}
          </div>
          {isOwner && (
            <div className="flex items-center gap-2">
              {canShowTransfer && !transferDone && (
                <button
                  type="button"
                  onClick={() => setTransferOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <UserCog className="h-3.5 w-3.5" />
                  转让组长
                </button>
              )}
              {transferDone && (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600">
                  已转让
                </span>
              )}
              <button
                type="button"
                onClick={() => setAddingPresets((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                邀请成员
              </button>
            </div>
          )}
        </div>

        {/* 已入驻成员列表 */}
        {activatedMembers.length > 0 ? (
          <div className="mb-4 space-y-2">
            {activatedMembers.map((m) => {
              const displayName = getDisplayName(m);
              const isCurrentUser = m.userId === currentUserId;
              const isEditingThis = editingNicknameMemberId === m.id;

              return (
                <div key={m.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                  {isEditingThis ? (
                    // 编辑昵称模式
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={nicknameInput}
                          onChange={(e) => setNicknameInput(e.target.value)}
                          placeholder="输入项目内昵称"
                          maxLength={40}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>全局昵称：{m.name}</span>
                      </div>
                      {nicknameError && <p className="text-xs text-red-600">{nicknameError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEditNickname}
                          disabled={nicknameSubmitting}
                          className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={saveNickname}
                          disabled={nicknameSubmitting}
                          className="flex-1 rounded-lg bg-slate-900 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {nicknameSubmitting ? "保存中…" : "保存"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 正常显示模式
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                          {displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{displayName}</span>
                            {m.role === "OWNER" && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
                                {ownerLabel}
                              </span>
                            )}
                            {m.role === "MEMBER" && (
                              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-500">组员</span>
                            )}
                          </div>
                          {isCurrentUser && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">我</span>
                              {m.projectNickname && (
                                <span className="text-xs text-slate-400">（全局：{m.name}）</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrentUser && (
                          <button
                            type="button"
                            onClick={() => startEditNickname(m.id, m.projectNickname)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                            title="编辑项目内昵称"
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            改昵称
                          </button>
                        )}
                        {isOwner && m.role !== "OWNER" && (
                          <button
                            type="button"
                            onClick={() => setKickMemberId(m.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="移出成员"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            移出
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mb-4 text-sm text-slate-400">暂无已入驻成员。</p>
        )}

        {/* 预邀请待入驻 */}
        {isOwner && presets.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wider">待入驻</p>
            <div className="space-y-1.5">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full border border-slate-200 bg-white text-center text-xs leading-6 text-slate-400">?</div>
                    <span className="text-sm text-slate-500">{p.presetName}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">未入驻</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInvitingPresetId(p.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
                      title="分享定向邀请链接"
                    >
                      <Share2 className="h-3 w-3" />
                      邀请
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelPresetId(p.id)}
                      className="text-xs text-slate-400 underline underline-offset-2 hover:text-red-500"
                    >
                      取消邀请
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 动态添加预设成员 */}
        {isOwner && addingPresets && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-medium text-slate-600">预邀请成员入驻（入驻前不会显示在成员列表）</p>
            <div className="mb-3 space-y-2">
              {presetInputs.map((name, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    value={name}
                    onChange={(e) => updatePresetInput(i, e.target.value)}
                    placeholder={`成员昵称`}
                    maxLength={40}
                  />
                  {presetInputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePresetInput(i)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {presetError ? <p className="mb-3 text-sm text-red-600">{presetError}</p> : null}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={addPresetInput}
                className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
              >
                + 再加一个
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => { setAddingPresets(false); setPresetInputs([""]); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={presetSubmitting}
                onClick={submitPresets}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {presetSubmitting ? "添加中…" : "确认邀请"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 确认移出成员弹窗 */}
      {kickMemberId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setKickMemberId(null)} />
          <div className="relative z-10 w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-slate-900">确认移出该成员？</h3>
            <p className="mb-4 text-sm text-slate-500">移出后该成员将无法再访问本项目。</p>
            {kickError ? <p className="mb-3 text-sm text-red-600">{kickError}</p> : null}
            <div className="flex gap-3">
              <button type="button" onClick={() => setKickMemberId(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                取消
              </button>
              <button type="button" disabled={kickSubmitting} onClick={confirmKick} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {kickSubmitting ? "移出中…" : "确认移出"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 确认取消预设成员弹窗 */}
      {cancelPresetId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setCancelPresetId(null)} />
          <div className="relative z-10 w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-slate-900">确认取消该邀请？</h3>
            <p className="mb-4 text-sm text-slate-500">该成员将无法再通过此预设入驻本项目。</p>
            {cancelError ? <p className="mb-3 text-sm text-red-600">{cancelError}</p> : null}
            <div className="flex gap-3">
              <button type="button" onClick={() => setCancelPresetId(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                取消
              </button>
              <button type="button" disabled={cancelSubmitting} onClick={confirmCancelPreset} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {cancelSubmitting ? "取消中…" : "确认取消"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 转让组长权限弹窗 */}
      <TransferOwnerModal
        open={transferOpen}
        members={activatedMembers}
        projectId={projectId}
        onClose={() => setTransferOpen(false)}
        onSuccess={() => {
          setTransferDone(true);
          onRefresh();
        }}
      />

      {/* S6: 定向邀请弹窗 — 显示含 presetId 的专属邀请链接/二维码 */}
      {invitingPresetId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setInvitingPresetId(null)} />
          <div className="relative z-10 w-full max-w-sm">
            <ProjectInvitePanel
              inviteCode={`${inviteCode} ${presets.find((p) => p.id === invitingPresetId)?.presetName || ""}`}
              presetId={invitingPresetId}
              presetName={presets.find((p) => p.id === invitingPresetId)?.presetName}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
