"use client";
import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, BrainCircuit, CheckCircle2, Clock3, FolderUp, LoaderCircle, SendHorizonal, Sparkles, Users2, XCircle } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { useProjectDashboard } from "@/lib/use-project-dashboard";
import { DashboardFile } from "@/lib/types";

type Props = { projectId: string };
const initials = (name: string) => name.slice(0, 2).toUpperCase();
const formatTime = (v: string) => new Date(v).toLocaleString();

export function ProjectDashboard({ projectId }: Props) {
  const { data, error, refresh } = useProjectDashboard(projectId);
  const [draft, setDraft] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const approved = useMemo(() => (data?.files ?? []).filter((f) => f.status === "APPROVED"), [data?.files]);
  const pending = useMemo(() => (data?.files ?? []).filter((f) => f.status === "PENDING"), [data?.files]);
  const ranking = useMemo(() => [...(data?.members ?? [])].sort((a, b) => b.accumulatedPoints - a.accumulatedPoints), [data?.members]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      setUploadError(null);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: formData });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "上传失败");
      await refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function reviewFile(fileId: string, status: "APPROVED" | "REJECTED") {
    try {
      setActioningId(fileId);
      setUploadError(null);
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "操作失败");
      await refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActioningId(null);
    }
  }

  const openPreview = (file: DashboardFile) => window.open(file.previewUrl, "_blank", "noopener,noreferrer");

  if (error) return <main className="min-h-screen bg-white p-8 text-red-500">{error}</main>;
  if (!data) return <main className="min-h-screen bg-white p-8">Loading...</main>;

  const messages = [
    { id: "1", role: "ai", cls: "border-slate-200 bg-white text-slate-700", hint: "Fusion AI", text: `我会持续读取下方“已通过审核”的文件。当前已纳入：${approved[0]?.name ?? "项目资料"}、${approved[1]?.name ?? "理论材料"}。` },
    { id: "2", role: "user", cls: "ml-auto border-sky-200 bg-sky-500 text-white", hint: "组员提问", text: `帮我把${pending[0]?.uploader ?? "张三"}传的访谈记录和${pending[1]?.uploader ?? "李四"}传的理论分析总结成一份大纲。` },
    { id: "3", role: "ai", cls: "border-amber-200 bg-amber-50 text-amber-900", hint: "主动风险提示", text: "🚨 警告：刚上传的数据文件与参考资料中的理论要求存在逻辑冲突。" }
  ];

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#f4f7fb_100%)] text-slate-900"><TopNav /><div className="shell py-6"><ProjectHero project={data.project} title={data.project.title} subtitle="左侧是持续存在的 AI 对话控制台，右侧集中展示资料中枢、待审核区和项目概览。" /><div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]"><aside className="line-card rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,#fff_0%,#f8fbff_100%)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"><div className="flex min-h-[900px] flex-col"><div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">持续对话 / 控制台</div><h2 className="mt-2 text-2xl font-semibold">Fusion AI</h2><p className="mt-2 text-sm leading-6 text-slate-500">AI 会自动读取下方已通过审核的文件。</p></div><div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">在线</div></div><div className="mt-5 flex-1 space-y-4">{messages.map((m) => <div key={m.id} className={`max-w-[92%] rounded-[22px] border px-4 py-4 shadow-sm ${m.cls}`}><div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${m.role === "user" ? "text-white/70" : "text-slate-400"}`}>{m.hint}</div><div className="mt-2 text-sm leading-7">{m.text}</div></div>)}</div><div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"><BrainCircuit className="h-4 w-4 text-sky-500" />AI 已读取资料</div><div className="mt-3 space-y-3">{approved.length ? approved.map((doc) => <button key={doc.id} type="button" onClick={() => openPreview(doc)} className="block w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-sky-300 hover:bg-sky-50"><div className="text-sm font-medium text-slate-800">{doc.name}</div><div className="mt-1 text-xs text-slate-500">{doc.uploader} · {formatTime(doc.uploadedAt)}</div></button>) : <div className="rounded-[18px] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">暂无已通过审核资料</div>}</div><div className="mt-4 flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3"><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="例如：帮我总结成大纲" className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" /><button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white"><SendHorizonal className="h-4 w-4" /></button></div></div></div></aside><section className="space-y-6"><section className="line-card rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">资料中枢</div><h2 className="mt-2 text-3xl font-semibold">项目资料与审核流</h2><div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">{data.members.slice(0, 3).map((m) => <div key={m.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">{initials(m.name)}</span><span>{m.name}</span></div>)}<span className="rounded-full border border-slate-200 px-3 py-1.5">组长：{data.members[0]?.name ?? data.me.name}</span></div></div><button className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-medium text-white">Share</button></div><div className="mt-6 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fcfdff_0%,#f5f8ff_100%)] p-5"><div className="text-sm font-medium text-sky-700">资料中枢</div><label className="mt-4 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white text-center transition hover:border-sky-400 hover:bg-sky-50/40"><input type="file" className="hidden" onChange={handleUpload} /><div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">{isUploading ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <FolderUp className="h-6 w-6" />}</div><div className="mt-5 text-4xl font-semibold">{isUploading ? "上传中..." : "上传文件"}</div><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">上传后会立即出现在待审核区，并支持在线预览。</p>{uploadError ? <div className="mt-4 text-sm text-red-500">{uploadError}</div> : null}</label></div><div className="mt-6"><div className="flex items-center justify-between gap-3"><div className="text-base font-semibold">待审核区</div><div className="text-sm text-slate-400">最新上传 · 未审核</div></div><div className="mt-4 space-y-3">{pending.length ? pending.map((file) => <div key={file.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"><div className="flex flex-wrap items-start justify-between gap-4"><button type="button" onClick={() => openPreview(file)} className="flex min-w-0 items-start gap-3 text-left"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{initials(file.uploader)}</div><div className="min-w-0"><div className="truncate text-base font-medium hover:text-sky-600">{file.name}</div><div className="mt-1 text-sm text-slate-500">{file.uploader} · {formatTime(file.uploadedAt)}</div></div></button>{data.isOwner ? <div className="flex flex-wrap gap-2"><button type="button" disabled={actioningId === file.id} onClick={() => reviewFile(file.id, "APPROVED")} className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />采纳并喂给 AI</button><button type="button" disabled={actioningId === file.id} onClick={() => reviewFile(file.id, "REJECTED")} className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"><XCircle className="h-4 w-4" />打回重做</button></div> : <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">未审核</span>}</div></div>) : <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">还没有待审核文件。</div>}</div></div></section><section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"><article className="line-card rounded-[28px] border border-slate-200/80 bg-white p-6"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">已通过审核的资料</div><p className="mt-2 text-sm leading-7 text-slate-500">这些内容会自动进入 AI 的长期上下文。</p></div><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div><div className="mt-5 space-y-3">{approved.length ? approved.map((doc) => <button key={doc.id} type="button" onClick={() => openPreview(doc)} className="block w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:border-emerald-300 hover:bg-emerald-50"><div className="text-sm font-medium">{doc.name}</div><div className="mt-1 text-xs text-slate-500">{doc.uploader} · {formatTime(doc.uploadedAt)}</div></button>) : <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">暂无已通过审核文件</div>}</div></article><article className="line-card rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#fffaf0_0%,#fff_100%)] p-6"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">AI 风险感知</div><p className="mt-2 text-sm leading-7 text-slate-500">AI 会主动提示潜在逻辑冲突。</p></div><AlertTriangle className="h-5 w-5 text-amber-500" /></div><div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">{pending.length ? `最近上传的 ${pending[0].name} 正在等待审核。` : "当前没有新的待审核文件。"}</div><div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" />最近一次检查：30 秒前</div></article></section><section className="grid gap-6 lg:grid-cols-2"><article className="line-card rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#eef4ff_0%,#f9fbff_100%)] p-6"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">项目管理</div><p className="mt-2 text-sm leading-7 text-slate-500">查看当前任务、截止时间与项目概览。</p></div><Users2 className="h-5 w-5 text-slate-400" /></div><div className="mt-5 space-y-2 text-sm text-slate-700"><div>当前任务数：{data.tasks.length}</div><div>已采纳资料：{approved.length}</div><div>待跟进事项：{pending.length}</div></div><Link href={`/project/${projectId}/manage`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm">前往项目管理<ArrowUpRight className="h-4 w-4" /></Link></article><article className="line-card rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#eef7ff_0%,#f8fbff_100%)] p-6"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">贡献度统计</div><p className="mt-2 text-sm leading-7 text-slate-500">成员当前积分简要概览。</p></div><Sparkles className="h-5 w-5 text-slate-400" /></div><div className="mt-5 space-y-2 text-sm text-slate-700">{ranking.slice(0, 3).map((m, i) => <div key={m.id} className="flex items-center justify-between gap-3"><span>{i + 1}. {m.name}</span><span className="font-semibold text-slate-900">{m.accumulatedPoints} 分</span></div>)}</div><Link href={`/project/${projectId}/analytics`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm">前往贡献度统计<ArrowUpRight className="h-4 w-4" /></Link></article></section></section></div></div></main>;
}
