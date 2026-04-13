"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  FileAudio,
  FileText,
  FileVideo,
  ImageIcon,
  Loader2,
  Upload,
  Users2
} from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { formatMilestoneDueDisplay } from "@/lib/assignment-milestones";
import { LEGACY_AUTO_DOC_TITLES } from "@/lib/project-documents";
import { memberWorkloadPoints } from "@/lib/member-workload";
import { useProjectDashboard } from "@/lib/use-project-dashboard";
import { ProjectAiChatPanel } from "@/components/project-ai-chat-panel";

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
  if (!storageKey) return <FileText className="h-5 w-5 shrink-0 text-slate-500" />;
  const m = mimeType ?? "";
  if (m.startsWith("image/")) return <ImageIcon className="h-5 w-5 shrink-0 text-sky-600" />;
  if (m.startsWith("video/")) return <FileVideo className="h-5 w-5 shrink-0 text-violet-600" />;
  if (m.startsWith("audio/")) return <FileAudio className="h-5 w-5 shrink-0 text-amber-600" />;
  return <FileText className="h-5 w-5 shrink-0 text-slate-600" />;
}

export function ProjectDashboard({ projectId }: Props) {
  const { data, error, refresh } = useProjectDashboard(projectId);
  const rawDocs = useMemo(() => data?.documents ?? [], [data?.documents]);
  const docs = useMemo(() => rawDocs.filter((d) => !LEGACY_AUTO_DOC_TITLES.has(d.title.trim())), [rawDocs]);
  const canEdit = Boolean(data?.me) && !data?.isGuest;
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contributionRanking = useMemo(() => [...(data?.members ?? [])].sort((a, b) => b.accumulatedPoints - a.accumulatedPoints), [data?.members]);

  async function onUploadPicked(files: FileList | null) {
    const file = files?.[0];
    if (!file || !canEdit) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("description", uploadNote);
      const res = await fetch(`/api/projects/${projectId}/documents/upload`, { method: "POST", body: fd });
      const payload = await res.json();
      if (!res.ok) return void console.error(payload.error || "上传失败");
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
      return void console.error(payload.error || "删除失败");
    }
    await refresh();
  }

  if (error) return <main className="min-h-screen bg-white p-8"><p className="text-critical">{error}</p></main>;
  if (!data) return <main className="min-h-screen bg-white p-8">Loading...</main>;

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <TopNav />
      <div className="shell py-6">
        {data.isGuest || !data.me ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">你正以访客身份浏览（未携带成员登录态）。请返回首页使用已注册账号登录，并通过「加入项目」或队长邀请加入本项目后，即可编辑与操作。</div> : null}
        <ProjectHero project={data.project} title={data.project.title} />

        <div className="mx-auto max-w-3xl space-y-5">
          <section className="line-card rounded-[28px] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-500">一、项目概述</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">共享概况</h2>
              </div>
              <div className="flex items-start gap-3">
                <Link href={`/project/${projectId}/manage`} className="shrink-0 rounded-full border border-slate-900 px-3 py-2 text-xs font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white">进入项目管理</Link>
                <Users2 className="mt-1 h-5 w-5 text-slate-400" />
              </div>
            </div>
            <div className="mt-4 rounded-[22px] bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              <div>截止时间：{new Date(data.project.deadline).toLocaleString()}</div>
              <div>邀请码：{data.project.inviteCode}</div>
              <div className="mt-3 whitespace-pre-wrap font-medium text-slate-800">共享共识（摘要）</div>
              <div className="mt-1 whitespace-pre-wrap">{data.project.contextSummary}</div>
              {data.project.assignmentMilestones?.length ? <div className="mt-4 border-t border-slate-200 pt-4"><div className="font-medium text-slate-800">关键时间节点</div><ul className="mt-2 list-disc space-y-1.5 pl-5">{data.project.assignmentMilestones.map((m, i) => <li key={`${i}-${m.label}`}><span className="font-medium text-slate-700">{m.label}</span><span className="text-slate-500"> — {formatMilestoneDueDisplay(m)}</span></li>)}</ul></div> : null}
              {data.project.keyDeliverables?.length ? <div className="mt-4 border-t border-slate-200 pt-4"><div className="font-medium text-slate-800">所需产出物</div><ul className="mt-2 list-disc space-y-1 pl-5">{data.project.keyDeliverables.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul></div> : null}
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-medium text-slate-800">AI 团队进度简报</div>
                  {data.project.progressDigestAt ? <span className="text-xs text-slate-500">{new Date(data.project.progressDigestAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span> : null}
                </div>
                {data.project.progressDigest ? <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{data.project.progressDigest}</p> : <p className="mt-2 text-sm text-slate-500">暂无简报。成员在项目管理页更新任务状态后，系统会自动汇总生成。</p>}
              </div>
            </div>
          </section>

          <section className="line-card rounded-[28px] p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-500">二、现有成员</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">团队与贡献入口</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">点击成员进入贡献统计页，查看该成员六维雷达、与团队均分对比及实时趋势（数据随任务与日志刷新）。</p>
              </div>
              <Link href={`/project/${projectId}/analytics`} className="shrink-0 rounded-full border border-slate-900 px-3 py-2 text-xs font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white">全员看板</Link>
            </div>
            <div className="space-y-3">
              {contributionRanking.map((member, index) => {
                const label = member.role === "OWNER" ? "队长" : "成员";
                const initial = (member.name || "?").slice(0, 1);
                const ongoing = data.tasks ? memberWorkloadPoints(data.tasks, member.id) : 0;
                return <Link key={member.id} href={`/project/${projectId}/analytics?member=${encodeURIComponent(member.id)}`} className="block rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-900 hover:bg-white hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{initial}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-sm font-semibold text-slate-900">{index + 1}. {member.name}</span><span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">{label}</span></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500"><span title="当前进行中任务工作量点数">{ongoing} 点进行中</span><span>信用 {member.creditScore}</span></div></div><div className="shrink-0 text-right"><div className="text-lg font-semibold tabular-nums text-slate-900">{member.accumulatedPoints}</div><div className="text-[11px] font-medium text-blue-700">贡献度 →</div></div></div></Link>;
              })}
            </div>
          </section>
        </div>
      </div>
      <ProjectAiChatPanel projectId={projectId} disabled={data.isGuest || !data.me} currentUserName={data.me?.name} />
    </main>
  );
}
