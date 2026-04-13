"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Plus, X } from "lucide-react";
import { InviteQrScanner } from "@/components/invite-qr-scanner";

type JoinMode = "id" | "invite";

type MyProjectRow = {
  id: string;
  title: string;
  role: string;
  inviteCode: string;
  deadline: string;
};

const ui = {
  shell: "mx-auto w-full max-w-6xl px-5 pb-20 pt-14 sm:px-6 sm:pt-16",
  card: "rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6",
  field:
    "w-full rounded-xl border-0 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 ring-1 ring-inset ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900",
  btnPrimary:
    "w-full rounded-xl bg-neutral-900 py-3 text-center text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40",
  btnGhost:
    "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50",
  btnGhostDark:
    "inline-flex items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800",
  btnOutline:
    "w-full rounded-xl border border-neutral-200 bg-white py-3 text-center text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50",
  muted: "text-sm text-neutral-500",
  label: "mb-1.5 block text-xs font-medium text-neutral-500"
} as const;

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [memberDraft, setMemberDraft] = useState("");
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [joinMode, setJoinMode] = useState<JoinMode>("invite");
  const [joinProjectId, setJoinProjectId] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<{ name: string; email: string | null } | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);
  const [myProjects, setMyProjects] = useState<MyProjectRow[]>([]);
  const [myProjectsLoading, setMyProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [inviteScanOpen, setInviteScanOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSessionUser(d.user ?? null))
      .catch(() => setSessionUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("invite")?.trim();
    if (code) {
      setJoinInviteCode(code);
      setJoinMode("invite");
    }
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      setMyProjects([]);
      setSelectedProjectId("");
      return;
    }
    setMyProjectsLoading(true);
    fetch("/api/projects/mine", { cache: "no-store" })
      .then(async (r) => {
        const d = (await r.json()) as { projects?: MyProjectRow[] };
        if (!r.ok) {
          setMyProjects([]);
          return;
        }
        setMyProjects(Array.isArray(d.projects) ? d.projects : []);
      })
      .catch(() => setMyProjects([]))
      .finally(() => setMyProjectsLoading(false));
  }, [sessionUser]);

  const isRegistered = Boolean(sessionUser?.email);
  const canUseApp = authReady && isRegistered;

  function addMemberName() {
    const name = memberDraft.trim();
    if (!name) return;
    setMemberNames((prev) => [...prev, name]);
    setMemberDraft("");
    setMemberDialogOpen(false);
  }

  function removeMemberName(index: number) {
    setMemberNames((prev) => prev.filter((_, i) => i !== index));
  }

  async function createProject() {
    setError(null);
    if (!isRegistered) {
      setError("请先登录或注册。");
      return;
    }
    const t = title.trim();
    if (t.length < 2) {
      setError("请填写项目名称（至少 2 个字）");
      return;
    }
    if (!deadline) {
      setError("请选择项目截止时间");
      return;
    }
    const on = ownerName.trim();
    if (!on) {
      setError("请填写队长/创建者在项目中的显示昵称");
      return;
    }

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        deadline: new Date(deadline).toISOString(),
        ownerName: on,
        memberNames: memberNames.map((name) => name.trim()).filter(Boolean)
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Create project failed");
      return;
    }

    router.push(`/project/${data.projectId}`);
  }

  async function joinProject() {
    setError(null);
    if (!authReady) {
      setError("请稍候，正在确认登录状态…");
      return;
    }
    if (!isRegistered) {
      setError("请先登录或注册后再加入项目。");
      return;
    }

    const base = joinMode === "id" ? { projectId: joinProjectId.trim() } : { inviteCode: joinInviteCode.trim() };

    if (joinMode === "invite" && !joinInviteCode.trim()) {
      setError("请填写队长提供的邀请码");
      return;
    }
    if (joinMode === "id" && !joinProjectId.trim()) {
      setError("请填写项目 ID");
      return;
    }

    const res = await fetch("/api/projects/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(base)
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Join failed");
      return;
    }

    router.push(`/project/${data.projectId}`);
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className={ui.shell}>
        <header className="text-center">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Fusion Space</h1>
          <p className={`${ui.muted} mt-2`}>团队项目协作</p>
        </header>

        {!authReady ? <p className="mt-14 text-center text-sm text-neutral-400">正在确认登录状态…</p> : null}

        {authReady && !canUseApp ? (
          <div className="mx-auto mt-12 max-w-md">
            <section className={`${ui.card} text-center`}>
              <h2 className="text-base font-semibold text-neutral-900">请先登录或注册</h2>
              {!sessionUser ? (
                <>
                  <p className={`${ui.muted} mt-3`}>未登录无法打开、新建或加入项目。请使用已注册账号登录；没有账号可先注册。</p>
                  {joinInviteCode ? <p className="mt-4 text-xs leading-relaxed text-neutral-500">已从链接带入邀请码，登录后在「加入项目」中可直接使用。</p> : null}
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Link href="/login" className={`${ui.btnGhost} sm:min-w-[120px]`}>登录</Link>
                    <Link href="/register" className={`${ui.btnGhostDark} sm:min-w-[120px]`}>注册</Link>
                  </div>
                </>
              ) : (
                <>
                  <p className={`${ui.muted} mt-3`}>当前会话未绑定注册邮箱。请退出后使用已注册账号登录，或完成注册。</p>
                  <div className="mt-8 flex flex-col gap-3">
                    <Link href="/login" className={ui.btnGhostDark}>改用注册账号登录</Link>
                    <Link href="/register" className={ui.btnGhost}>注册新账号</Link>
                    <button type="button" className={ui.btnOutline} onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => window.location.reload())}>清除本机身份</button>
                  </div>
                </>
              )}
            </section>
          </div>
        ) : null}

        {canUseApp ? (
          <>
            <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-neutral-700">
                <span className="font-medium">{sessionUser!.name}</span>
                <span className="text-neutral-400">·</span>
                <span className="max-w-[260px] truncate text-neutral-500">{sessionUser!.email}</span>
                <span className="text-neutral-400">·</span>
                <button type="button" className="text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900" onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => window.location.reload())}>退出</button>
              </div>
              <p className="max-w-lg text-xs text-neutral-500">登录后可打开已有项目、新建项目或通过邀请码 / 项目 ID 加入。</p>
            </div>

            {error ? <p className="mt-8 text-center text-sm text-red-600">{error}</p> : null}

            <div className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
              <section className={`${ui.card} flex flex-col`}>
                <h2 className="text-base font-semibold text-neutral-900">打开项目</h2>
                <p className={`${ui.muted} mt-1`}>选择后进入项目主页</p>
                {myProjectsLoading ? <p className="mt-4 text-sm text-neutral-400">加载列表中…</p> : myProjects.length === 0 ? <p className={`${ui.muted} mt-4`}>暂无项目，可在旁新建或加入。</p> : (
                  <div className="mt-4 flex flex-1 flex-col gap-3">
                    <select className={ui.field} value={selectedProjectId} onChange={(e) => { const id = e.target.value; setSelectedProjectId(id); if (id) router.push(`/project/${id}`); }}>
                      <option value="">选择项目…</option>
                      {myProjects.map((p) => <option key={p.id} value={p.id}>{p.title}{p.role === "OWNER" ? " · 队长" : " · 成员"}</option>)}
                    </select>
                    <button type="button" disabled={!selectedProjectId} onClick={() => selectedProjectId && router.push(`/project/${selectedProjectId}`)} className={ui.btnPrimary}>进入</button>
                  </div>
                )}
              </section>

              <section className={`${ui.card} flex flex-col`}>
                <h2 className="text-base font-semibold text-neutral-900">新建项目</h2>
                <p className={`${ui.muted} mt-1`}>你将担任队长</p>
                <div className="mt-5 flex flex-1 flex-col space-y-4">
                  <input className={ui.field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="项目名称" />
                  <div>
                    <label className={ui.label}>截止时间</label>
                    <input className={ui.field} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </div>
                  <input className={ui.field} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="队长显示昵称" />
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className={ui.label}>初始成员（可选）</label>
                      <button type="button" onClick={() => { setMemberDraft(""); setMemberDialogOpen(true); }} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 transition hover:bg-neutral-50" aria-label="新增成员"><Plus className="h-4 w-4" /></button>
                    </div>
                    {memberNames.length === 0 ? <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-400 ring-1 ring-inset ring-neutral-200">暂无成员，点击右侧加号逐个添加成员昵称</div> : (
                      <div className="flex min-h-[52px] flex-wrap gap-2 rounded-xl bg-neutral-50 px-3 py-3 ring-1 ring-inset ring-neutral-200">
                        {memberNames.map((name, index) => (
                          <span key={`${name}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800">
                            <span>{name}</span>
                            <button type="button" onClick={() => removeMemberName(index)} className="text-neutral-400 transition hover:text-neutral-900" aria-label={`删除成员 ${name}`}><X className="h-3.5 w-3.5" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button type="button" onClick={createProject} className={`${ui.btnPrimary} mt-5`}>创建</button>
              </section>

              <section className={`${ui.card} flex flex-col`}>
                <h2 className="text-base font-semibold text-neutral-900">加入项目</h2>
                <p className={`${ui.muted} mt-1`}>向队长索取邀请码或项目 ID</p>
                <div className="mt-4 flex gap-6 border-b border-neutral-200">
                  <button type="button" onClick={() => setJoinMode("invite")} className={`border-b-2 pb-2 text-sm font-medium transition ${joinMode === "invite" ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-600"}`}>邀请码</button>
                  <button type="button" onClick={() => setJoinMode("id")} className={`border-b-2 pb-2 text-sm font-medium transition ${joinMode === "id" ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-600"}`}>项目 ID</button>
                </div>
                <div className="mt-5 flex flex-1 flex-col space-y-4">
                  {joinMode === "invite" ? (
                    <div className="flex gap-2">
                      <input className={`${ui.field} min-w-0 flex-1`} value={joinInviteCode} onChange={(e) => setJoinInviteCode(e.target.value)} placeholder="邀请码或扫码填入" autoComplete="off" />
                      <button type="button" title="扫描邀请二维码" onClick={() => { setError(null); setInviteScanOpen(true); }} className={`${ui.btnGhost} shrink-0 gap-1.5 px-3`}><Camera className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">扫码</span></button>
                    </div>
                  ) : <input className={`${ui.field} font-mono text-[13px]`} value={joinProjectId} onChange={(e) => setJoinProjectId(e.target.value)} placeholder="项目 ID" />}
                </div>
                <button type="button" onClick={joinProject} className={`${ui.btnOutline} mt-5`}>加入</button>
              </section>
            </div>

            <InviteQrScanner open={inviteScanOpen} onClose={() => setInviteScanOpen(false)} onDecoded={(code) => { setJoinInviteCode(code); setError(null); }} />

            {memberDialogOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-5">
                <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">新增成员</h3>
                      <p className="mt-1 text-sm text-neutral-500">填写成员昵称，确认后加入初始成员列表。</p>
                    </div>
                    <button type="button" onClick={() => { setMemberDialogOpen(false); setMemberDraft(""); }} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900" aria-label="关闭新增成员窗口"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-4">
                    <label className={ui.label}>成员昵称</label>
                    <input autoFocus className={ui.field} value={memberDraft} onChange={(e) => setMemberDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMemberName(); } }} placeholder="例如：朱远雅" />
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => { setMemberDialogOpen(false); setMemberDraft(""); }} className={ui.btnGhost}>取消</button>
                    <button type="button" onClick={addMemberName} disabled={!memberDraft.trim()} className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">添加</button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
