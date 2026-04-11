"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpFromLine, Bot, CheckCircle2, ChevronRight, Clock3, FileText, Image as ImageIcon, Loader2, MoreHorizontal, Paperclip, Send, XCircle } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { useProjectDashboard } from "@/lib/use-project-dashboard";

type Props = { projectId: string };
type Message = { id: string; role: "assistant" | "user"; text: string; tone?: "warning" };
type HubFile = { id: string; title: string; author: string; time: string; summary: string; content: string; status: "PENDING" | "APPROVED"; mimeType?: string; downloadUrl: string };

const kkBase = process.env.NEXT_PUBLIC_KKFILEVIEW_URL?.replace(/\/$/, "") || "";
const avatar = (name: string) => name.slice(0, 1).toUpperCase();
const isPdf = (file: HubFile) => (file.mimeType ?? "").includes("pdf") || file.title.toLowerCase().endsWith(".pdf");
const isImage = (file: HubFile) => (file.mimeType ?? "").startsWith("image/");
const isTextLike = (file: HubFile) => (file.mimeType ?? "").startsWith("text/") || /\.(txt|md)$/i.test(file.title);

export function ProjectDashboard({ projectId }: Props) {
  const { data, error, refresh } = useProjectDashboard(projectId);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "m1", role: "assistant", text: "我会持续读取所有已通过审核的文件，并据此回答提问、生成大纲、发现冲突。" },
    { id: "m2", role: "assistant", tone: "warning", text: "🚨 警告：刚上传的数据文件与参考资料中的理论要求存在逻辑冲突，请优先核对概念定义。" },
    { id: "m3", role: "user", text: "帮我把张三传的访谈记录和李四传的理论分析总结成一份大纲。" },
    { id: "m4", role: "assistant", text: "已收到，我会优先组合访谈记录、理论分析与项目摘要，整理成结构化大纲。" }
  ]);

  const members = useMemo(() => [...(data?.members ?? [])].sort((a, b) => b.accumulatedPoints - a.accumulatedPoints), [data?.members]);
  const isOwner = data?.me.id === members[0]?.id;
  const files = useMemo<HubFile[]>(() => (data?.files ?? []).map((f) => ({ ...f, status: f.status as "PENDING" | "APPROVED", time: new Date(f.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) })), [data?.files]);

  const pendingFiles = files.filter((f) => f.status === "PENDING");
  const approvedFiles = files.filter((f) => f.status === "APPROVED");

  function openPreview(file: HubFile) {
    window.open(buildPreviewUrl(file), "_blank", "noopener,noreferrer");
  }

  function buildPreviewUrl(file: HubFile | null) {
    if (!file) return "";
    const absolute = typeof window === "undefined" ? file.downloadUrl : new URL(file.downloadUrl, window.location.origin).toString();
    if (kkBase && !isPdf(file) && !isImage(file) && !isTextLike(file)) {
      return `${kkBase}/onlinePreview?url=${encodeURIComponent(btoa(absolute))}`;
    }
    return absolute;
  }

  function sendPrompt() {
    const value = prompt.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: value }, { id: `a-${Date.now() + 1}`, role: "assistant", text: "已收到请求，我会基于已审核资料继续分析。" }]);
    setPrompt("");
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !data) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: formData });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "文件上传失败");
      setMessages((prev) => [...prev, { id: `ok-${Date.now()}`, role: "assistant", text: `${file.name} 已上传${payload.file.status === "APPROVED" ? "并自动纳入 AI 资料库" : "，等待组长审核"}。` }]);
      await refresh();
    } catch (err) {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", tone: "warning", text: err instanceof Error ? err.message : "文件上传失败" }]);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function approveFile(id: string) {
    const res = await fetch(`/api/projects/${projectId}/files/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "APPROVED" }) });
    const payload = await res.json();
    if (!res.ok) return setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", tone: "warning", text: payload.error || "审核失败" }]);
    await refresh();
  }

  async function rejectFile(id: string) {
    const res = await fetch(`/api/projects/${projectId}/files/${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) return setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", tone: "warning", text: payload.error || "打回失败" }]);
    await refresh();
  }

  if (error) return <main className="min-h-screen bg-white p-8 text-critical">{error}</main>;
  if (!data) return <main className="min-h-screen bg-white p-8">Loading...</main>;

  return (
    <main className="min-h-screen bg-[#f8f8f6] text-slate-900">
      <TopNav />
      <div className="shell py-6">
        <ProjectHero project={data.project} title={data.project.title} subtitle="左边栏是持续存在的 AI 对话控制台，右边栏是资料中枢和项目概览卡片。" />

        <div className="grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="flex min-h-[980px] flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div><div className="text-sm font-medium text-slate-500">持续对话框 / 控制台</div><div className="mt-1 text-xl font-semibold">Fusion AI</div></div>
              <span className="rounded-full border border-sky-100 bg-sky-50 p-2 text-sky-600"><Bot className="h-4 w-4" /></span>
            </div>
            <div className="mb-4 rounded-[20px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">AI 会自动读取下方 <span className="font-semibold text-emerald-600">已通过审核</span> 的文件，并支持持续提问与主动预警。</div>
            <div className="flex-1 space-y-4 overflow-auto pr-1">
              {messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[92%] ${message.role === "assistant" ? "mr-7" : "ml-7"}`}>
                    {message.role === "assistant" ? <div className="mb-2 flex items-center gap-2 text-xs text-slate-400"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sky-600"><Bot className="h-3.5 w-3.5" /></span>Fusion AI</div> : null}
                    <div className={message.role === "user" ? "rounded-[22px] rounded-tr-md bg-[#4f9bf7] px-4 py-3 text-sm leading-6 text-white" : message.tone === "warning" ? "rounded-[22px] rounded-tl-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800" : "rounded-[22px] rounded-tl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"}>{message.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><Paperclip className="h-3.5 w-3.5" />已自动关联 {approvedFiles.length} 份已审核资料</div>
              <div className="flex items-center gap-3">
                <input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendPrompt(); } }} className="w-full border-0 bg-transparent text-sm outline-none" placeholder="让 AI 整合资料、生成大纲或指出冲突…" />
                <button type="button" onClick={sendPrompt} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#4f9bf7] text-white transition hover:bg-[#3f87dd]"><Send className="h-4 w-4" /></button>
              </div>
            </div>
          </aside>

          <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">资料中枢</div>
                <h2 className="mt-1 text-[28px] font-semibold tracking-tight">项目资料与审核流</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500"><div className="flex -space-x-2">{members.slice(0, 5).map((member) => <span key={member.id} className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-700">{avatar(member.name)}</span>)}</div><span>组长: {members[0]?.name ?? data.me.name}</span></div>
              </div>
              <div className="flex items-center gap-2"><button type="button" className="rounded-full bg-[#4f9bf7] px-5 py-2 text-sm font-medium text-white">Share</button><button type="button" className="rounded-full border border-slate-200 p-2.5 text-slate-500"><MoreHorizontal className="h-4 w-4" /></button></div>
            </div>

            <div className="mb-6 border-b border-slate-200 pb-3 text-sm font-semibold text-sky-700">资料中枢</div>
            <label className="block cursor-pointer rounded-[26px] border border-slate-300 px-6 py-10 text-center hover:bg-slate-50"><input type="file" className="hidden" accept=".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*" onChange={handleUpload} /><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUpFromLine className="h-5 w-5" />}</div><h3 className="mt-4 text-[32px] font-semibold tracking-tight">{uploading ? "正在上传文件" : "上传文件"}</h3><p className="mt-2 text-sm text-slate-500">文件会被持久化保存。配置 kkFileView 后，可在主界面右侧预览 Office 文件。</p></label>

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between text-sm text-slate-500"><span className="font-medium">待审核区</span><span>最新上传 · 未审核</span></div>
              <div className="space-y-3">
                {pendingFiles.map((f) => (
                  <div key={f.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <button type="button" onClick={() => openPreview(f)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">{avatar(f.author)}</span><div className="min-w-0"><div className="truncate text-base font-semibold text-slate-900">{f.title}</div><div className="mt-1 text-sm text-slate-500">{f.author} · {f.time}</div></div></div>
                        <div className="mt-3 rounded-[16px] bg-white px-4 py-3 text-sm leading-6 text-slate-600">AI 摘要：{f.summary}</div>
                      </button>
                      <div className="flex flex-col items-end gap-2">
                        {isOwner ? <><button type="button" onClick={() => approveFile(f.id)} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />✅ 采纳并喂给 AI</button><button type="button" onClick={() => rejectFile(f.id)} className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600"><XCircle className="h-4 w-4" />❌ 打回重做</button></> : <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"><Clock3 className="h-4 w-4" />待组长审核</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-3 text-xl font-semibold tracking-tight">已通过审核的资料</div>
              <div className="grid gap-3 md:grid-cols-2">
                {approvedFiles.map((f) => (
                  <button key={f.id} type="button" className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50">
                    <div className="flex items-start gap-3"><div className="rounded-2xl bg-white p-3 text-slate-500">{isImage(f) ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="truncate text-base font-semibold text-slate-900">{f.title}</div><div className="mt-1 text-sm text-slate-500">作者：{f.author}</div><div className="mt-2 text-sm leading-6 text-slate-600">{f.summary}</div><div className="mt-3 flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />已通过审核</div><button type="button" onClick={(event) => { event.stopPropagation(); openPreview(f); }} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 hover:text-sky-700">预览文件</button></div></div></div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <section className="rounded-[22px] bg-[#eef3fb] p-5">
                <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-base font-semibold text-slate-900">项目管理</div><div className="mt-1 text-sm text-slate-500">任务、截止时间与进度概览</div></div><AlertTriangle className="h-5 w-5 text-slate-400" /></div>
                <div className="space-y-2 text-sm text-slate-600"><div>当前任务数：{data.tasks.length}</div><div>已完成：{data.tasks.filter((task) => task.status === "DONE").length}</div><div>高风险任务：{data.tasks.filter((task) => task.warningLevel === "CRITICAL").length}</div></div>
                <Link href={`/project/${projectId}/manage`} className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">前往项目管理<ChevronRight className="h-4 w-4" /></Link>
              </section>
              <section className="rounded-[22px] bg-[#eef3fb] p-5">
                <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-base font-semibold text-slate-900">贡献度统计</div><div className="mt-1 text-sm text-slate-500">成员当前积分摘要</div></div><Bot className="h-5 w-5 text-slate-400" /></div>
                <div className="space-y-2 text-sm text-slate-600">{members.slice(0, 3).map((member, index) => <div key={member.id} className="flex items-center justify-between gap-3"><span>{index + 1}. {member.name}</span><span className="font-semibold text-slate-900">{member.accumulatedPoints} 分</span></div>)}</div>
                <Link href={`/project/${projectId}/analytics`} className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">前往贡献度统计<ChevronRight className="h-4 w-4" /></Link>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
