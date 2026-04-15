"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  FileAudio,
  FileText,
  FileVideo,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  Users2,
  LayoutGrid
} from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { formatMilestoneDueDisplay } from "@/lib/assignment-milestones";
import { LEGACY_AUTO_DOC_TITLES } from "@/lib/project-documents";
import { memberWorkloadPoints } from "@/lib/member-workload";
import { useProjectDashboard } from "@/lib/use-project-dashboard";
import { ProjectAiChatPanel } from "@/components/project-ai-chat-panel";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { TaskItemRow } from "@/components/task-item-row";
import { DashboardTask } from "@/lib/types";

type Props = {
  projectId: string;
};

function formatBytes(n: number | null): string {
  if (n == null || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function DocGlyph({ storageKey, mimeType }: { storageKey: string | null; mimeType: string | null }) {
  if (!storageKey) {
    return <FileText className="h-5 w-5 shrink-0 text-slate-500" />;
  }
  const m = mimeType ?? "";
  if (m.startsWith("image/")) return <ImageIcon className="h-5 w-5 shrink-0 text-sky-600" />;
  if (m.startsWith("video/")) return <FileVideo className="h-5 w-5 shrink-0 text-violet-600" />;
  if (m.startsWith("audio/")) return <FileAudio className="h-5 w-5 shrink-0 text-amber-600" />;
  return <FileText className="h-5 w-5 shrink-0 text-slate-600" />;
}

export function ProjectDashboard({ projectId }: Props) {
  const { data, error, refresh } = useProjectDashboard(projectId);

  // S5: 任务详情浮层
  const [selectedTask, setSelectedTask] = useState<DashboardTask | null>(null);

  const rawDocs = useMemo(() => data?.documents ?? [], [data?.documents]);
  const docs = useMemo(
    () => rawDocs.filter((d) => !LEGACY_AUTO_DOC_TITLES.has(d.title.trim())),
    [rawDocs]
  );

  const canEdit = Boolean(data?.me) && !data?.isGuest;

  // S5: 当前用户的任务列表（仪表盘顶部展示）
  const myTasks = useMemo(() => {
    if (!data?.me || !data.tasks) return [];
    return data.tasks.filter(
      (t) => t.assignee?.id === data.me!.id && !t.deletedAt
    );
  }, [data?.me, data?.tasks]);

  // S5: 删除任务
  async function handleDeleteTask(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) await refresh();
  }

  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contributionRanking = useMemo(
    () => [...(data?.members ?? [])].sort((a, b) => b.accumulatedPoints - a.accumulatedPoints),
    [data?.members]
  );

  async function onUploadPicked(files: FileList | null) {
    const file = files?.[0];
    if (!file || !canEdit) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("description", uploadNote);
      const res = await fetch(`/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: fd
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error(payload.error || "上传失败");
        return;
      }
      setUploadNote("");
      await refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteDocument(id: string) {
    if (!canEdit) return;
    if (!window.confirm("确定删除该条目？")) return;
    const res = await fetch(`/api/projects/${projectId}/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      console.error(payload.error || "删除失败");
      return;
    }
    await refresh();
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white p-8">
        <p className="text-critical">{error}</p>
      </main>
    );
  }

  if (!data) {
    return <main className="min-h-screen bg-white p-8">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <TopNav />
      <div className="shell py-6">
        {data.isGuest || !data.me ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            你正以访客身份浏览（未携带成员登录态）。请返回首页使用已注册账号登录，并通过「加入项目」或队长邀请加入本项目后，即可编辑与操作。
          </div>
        ) : null}

        <ProjectHero
          project={data.project}
          title={data.project.title}
          isOwner={data.isOwner}
          projectId={projectId}
          onProjectUpdated={(newTitle) => {
            refresh();
          }}
        />

        {/* S5: 我的任务列表 */}
        {data.me && myTasks.length > 0 ? (
          <section className="mx-auto max-w-3xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">我的任务</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  {myTasks.length}
                </span>
              </div>
              <Link
                href={`/project/${projectId}/manage`}
                className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
              >
                查看全部 →
              </Link>
            </div>
            <div className="space-y-2">
              {myTasks.slice(0, 5).map((task) => (
                <TaskItemRow
                  key={task.id}
                  task={task}
                  isOwner={data.isOwner}
                  currentUserId={data.me?.id}
                  onDelete={handleDeleteTask}
                  onClick={setSelectedTask}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="mx-auto max-w-3xl space-y-5">
          <section className="line-card rounded-[28px] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-500">一、项目概述</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">共享概况</h2>
              </div>
              <Users2 className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4 rounded-[22px] bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              <div>截止时间：{new Date(data.project.deadline).toLocaleString()}</div>
              <div>邀请码：{data.project.inviteCode}</div>
              <div className="mt-3 whitespace-pre-wrap font-medium text-slate-800">共享共识（摘要）</div>
              <div className="mt-1 whitespace-pre-wrap">{data.project.contextSummary}</div>
              {data.project.assignmentMilestones && data.project.assignmentMilestones.length > 0 ? (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="font-medium text-slate-800">关键时间节点</div>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    {data.project.assignmentMilestones.map((m, i) => (
                      <li key={`${i}-${m.label}`}>
                        <span className="font-medium text-slate-700">{m.label}</span>
                        <span className="text-slate-500"> — {formatMilestoneDueDisplay(m)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.project.keyDeliverables && data.project.keyDeliverables.length > 0 ? (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="font-medium text-slate-800">所需产出物</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {data.project.keyDeliverables.map((item, i) => (
                      <li key={`${i}-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-medium text-slate-800">AI 团队进度简报</div>
                  {data.project.progressDigestAt ? (
                    <span className="text-xs text-slate-500">
                      {new Date(data.project.progressDigestAt).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  ) : null}
                </div>
                {data.project.progressDigest ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {data.project.progressDigest}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    暂无简报。成员在项目管理页更新任务状态后，系统会自动汇总生成。
                  </p>
                )}
              </div>
            </div>
            <Link
              href={`/project/${projectId}/manage`}
              className="mt-4 inline-flex rounded-full border border-slate-900 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white"
            >
              进入项目管理
            </Link>
          </section>

          <section className="line-card rounded-[28px] p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-500">二、现有成员</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">团队与贡献入口</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  点击成员进入贡献统计页，查看该成员六维雷达、与团队均分对比及实时趋势（数据随任务与日志刷新）。
                </p>
              </div>
              <Link
                href={`/project/${projectId}/analytics`}
                className="shrink-0 rounded-full border border-slate-900 px-3 py-2 text-xs font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white"
              >
                全员看板
              </Link>
            </div>
            <div className="space-y-3">
              {contributionRanking.map((member, index) => {
                // 仅自己一人时显示"创建者"，有其他成员加入后改为"组长"
                const teamSize = contributionRanking.filter((m) => m.joinedStatus === "ACTIVATED").length;
                const label = member.role === "OWNER"
                  ? (teamSize <= 1 ? "创建者" : "组长")
                  : "成员";
                const initial = (member.name || "?").slice(0, 1);
                const ongoing = data.tasks ? memberWorkloadPoints(data.tasks, member.id) : 0;
                return (
                  <Link
                    key={member.id}
                    href={`/project/${projectId}/analytics?member=${encodeURIComponent(member.id)}`}
                    className="block rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-900 hover:bg-white hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-slate-900">
                            {index + 1}. {member.name}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span title="当前进行中任务工作量点数">{ongoing} 点进行中</span>
                          <span>信用 {member.creditScore}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-semibold tabular-nums text-slate-900">{member.accumulatedPoints}</div>
                        <div className="text-[11px] font-medium text-blue-700">贡献度 →</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="line-card rounded-[28px] p-6">
            <div className="mb-4 space-y-2">
              <div className="text-sm font-medium text-slate-500">三、作业文件</div>
              <h2 className="text-2xl font-semibold tracking-tight">上传与资料库</h2>
              <p className="text-sm leading-relaxed text-slate-500">
                支持 Word、PDF、Markdown、图片、音视频、常见建模与压缩包等。上传时请填写作品说明；成功上传会计入积分并写入操作日志，列表与成员分在约 15 秒内随轮询刷新。
              </p>
            </div>

            <div className="mb-4 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-4">
              <label className="block text-xs font-medium text-slate-600">上传前说明（会保存到该文件条目）</label>
              <textarea
                value={uploadNote}
                onChange={(e) => setUploadNote(e.target.value)}
                disabled={!canEdit || uploading}
                rows={2}
                maxLength={8000}
                placeholder="简要描述作业内容、版本、分工等…"
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-50"
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.md,.txt,.ppt,.pptx,.xls,.xlsx,.csv,.json,.zip,.rar,.7z,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.mp4,.webm,.mov,.mkv,.mp3,.wav,.m4a,.aac,.ogg,.flac,.glb,.gltf,.obj,.fbx,.stl,image/*,video/*,audio/*"
                onChange={(e) => void onUploadPicked(e.target.files)}
              />
              <div className="mt-3">
                <button
                  type="button"
                  disabled={!canEdit || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "上传中…" : "选择文件上传"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">单文件上限约 80MB。不支持的类型将被拒绝。</p>
            </div>

            <div className="space-y-3">
              {docs.length === 0 ? (
                <p className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  暂无作业文件。登录成员账号后可上传；旧版自动生成的「项目概述 / 任务拆解 / 成员协作记录」已从本列表隐藏。
                </p>
              ) : null}
              {docs.map((doc) => {
                const fileUrl = doc.storageKey
                  ? `/api/projects/${projectId}/documents/${doc.id}/file`
                  : null;
                return (
                  <div key={doc.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="flex gap-3">
                      <DocGlyph storageKey={doc.storageKey} mimeType={doc.mimeType} />
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold text-slate-900">{doc.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {doc.storageKey
                            ? `${doc.originalFileName ?? "文件"}${doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}`
                            : "历史协作文稿（无附件）"}
                        </div>
                        {doc.description ? (
                          <div className="mt-1 text-xs text-slate-600">{doc.description}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-400">作者：{doc.author.name}</div>
                        {!doc.storageKey && doc.content?.trim() ? (
                          <details className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                            <summary className="cursor-pointer text-slate-600">查看正文</summary>
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                              {doc.content}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          在新标签打开
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deleteDocument(doc.id)}
                        disabled={!canEdit}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <ProjectAiChatPanel
        projectId={projectId}
        disabled={data.isGuest || !data.me}
        currentUserName={data.me?.name}
      />

      {/* S5: 任务详情浮层 */}
      <TaskDetailPanel
        task={selectedTask}
        isOwner={data.isOwner}
        onClose={() => setSelectedTask(null)}
        onUpdate={refresh}
      />
    </main>
  );
}
